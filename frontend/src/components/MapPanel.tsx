'use client';

import { useEffect, useRef } from 'react';
import { Business } from '@/lib/types';

declare global {
  interface Window {
    L: any;
  }
}

const ORLANDO_CENTER: [number, number] = [28.5383, -81.3792];
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const MARKER_CLUSTER_JS = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
const MARKER_CLUSTER_CSS = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
const MARKER_CLUSTER_DEFAULT_CSS =
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';

type Props = {
  businesses: Business[];
  demandBusinesses: Business[];
  selectedCategory?: string;
  opportunitiesOnly: boolean;
  selectedBusiness?: Business | null;
};

function loadStyle(href: string) {
  if (document.querySelector(`link[href=\"${href}\"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src=\"${src}\"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}


function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getOpportunityColor(score: number) {
  if (score >= 67) return '#22c55e';
  if (score >= 34) return '#facc15';
  return '#ef4444';
}

function getCellSizeMeters(zoom: number) {
  if (zoom <= 10) return 1000;
  if (zoom <= 12) return 750;
  return 500;
}

function getCellStepDegrees(cellSizeMeters: number, latitude: number) {
  const latStep = cellSizeMeters / 111320;
  const lngStep = cellSizeMeters / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2));
  return { latStep, lngStep };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapPanel({ businesses, demandBusinesses, selectedCategory, opportunitiesOnly, selectedBusiness }: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const businessClusterLayerRef = useRef<any>(null);
  const opportunityLayerRef = useRef<any>(null);
  const redrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mapElementRef.current) return;

      loadStyle(LEAFLET_CSS);
      loadStyle(MARKER_CLUSTER_CSS);
      loadStyle(MARKER_CLUSTER_DEFAULT_CSS);
      await loadScript(LEAFLET_JS);
      await loadScript(MARKER_CLUSTER_JS);

      if (!mounted || !window.L || mapRef.current) return;

      const map = window.L.map(mapElementRef.current).setView(ORLANDO_CENTER, 11);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
      businessClusterLayerRef.current = window.L.markerClusterGroup();
      opportunityLayerRef.current = window.L.layerGroup();
      map.addLayer(businessClusterLayerRef.current);
      map.addLayer(opportunityLayerRef.current);
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!window.L || !mapRef.current || !businessClusterLayerRef.current) return;

    const clusterLayer = businessClusterLayerRef.current;
    clusterLayer.clearLayers();

    if (opportunitiesOnly) return;

    for (const business of businesses) {
      const marker = window.L.circleMarker([business.lat, business.lng], {
        radius: 6,
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.9,
        weight: 1
      });

      marker.bindPopup(`
        <div style="font-size:12px;line-height:1.4;">
          <strong>${escapeHtml(business.name)}</strong><br/>
          ${escapeHtml(business.normalized_category)}<br/>
          Rating: <strong>${business.rating ?? 'N/A'}</strong> · Reviews: <strong>${business.review_count}</strong>
        </div>
      `);
      clusterLayer.addLayer(marker);
    }
  }, [businesses, opportunitiesOnly]);

  useEffect(() => {
    if (!window.L || !mapRef.current || !opportunityLayerRef.current) return;

    const map = mapRef.current;
    const layer = opportunityLayerRef.current;
    const nearbyRadiusKm = 1;
    const minDemandCount = 3;
    const minOpportunityScore = 35;
    const maxCellsPerViewport = 120;

    const renderOpportunityGrid = () => {
      if (!mapRef.current || !opportunityLayerRef.current) return;

      layer.clearLayers();

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const cellSizeMeters = getCellSizeMeters(zoom);
      const centerLat = bounds.getCenter().lat;
      const { latStep, lngStep } = getCellStepDegrees(cellSizeMeters, centerLat);
      const markerRadius = Math.max(7, Math.min(16, Math.round(zoom * 0.9)));

      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();

      const viewportDemandBusinesses = demandBusinesses.filter(
        (business) =>
          business.lat >= south && business.lat <= north && business.lng >= west && business.lng <= east
      );
      const viewportCompetitors = businesses.filter(
        (business) =>
          business.lat >= south && business.lat <= north && business.lng >= west && business.lng <= east
      );

      const cells: Array<{
        centerLat: number;
        centerLng: number;
        nearbyDemandBusinesses: Business[];
        nearbyCompetitors: Business[];
        dominantCategory: string;
        opportunityScore: number;
        demandScore: number;
        scarcityScore: number;
        qualityGapScore: number;
        avgCompetitorRating: number;
        avgCompetitorReviews: number;
      }> = [];

      let maxDemand = 0;
      let maxCompetitors = 0;
      let maxAvgRating = 0;
      let maxAvgReviews = 0;

      for (let lat = south; lat < north; lat += latStep) {
        for (let lng = west; lng < east; lng += lngStep) {
          const centerCellLat = lat + latStep / 2;
          const centerCellLng = lng + lngStep / 2;
          const nearbyDemandBusinesses = viewportDemandBusinesses.filter(
            (business) => distanceKm(centerCellLat, centerCellLng, business.lat, business.lng) <= nearbyRadiusKm
          );
          const nearbyCompetitors = viewportCompetitors.filter(
            (business) => distanceKm(centerCellLat, centerCellLng, business.lat, business.lng) <= nearbyRadiusKm
          );
          if (nearbyDemandBusinesses.length < minDemandCount) continue;

          const avgCompetitorRating =
            nearbyCompetitors.length === 0
              ? 0
              : nearbyCompetitors.reduce((sum, business) => sum + (business.rating ?? 0), 0) / nearbyCompetitors.length;
          const avgCompetitorReviews =
            nearbyCompetitors.length === 0
              ? 0
              : nearbyCompetitors.reduce((sum, business) => sum + business.review_count, 0) / nearbyCompetitors.length;

          maxDemand = Math.max(maxDemand, nearbyDemandBusinesses.length);
          maxCompetitors = Math.max(maxCompetitors, nearbyCompetitors.length);
          maxAvgRating = Math.max(maxAvgRating, avgCompetitorRating);
          maxAvgReviews = Math.max(maxAvgReviews, avgCompetitorReviews);

          const cellBusinesses = nearbyDemandBusinesses.filter(
            (business) =>
              business.lat >= lat &&
              business.lat < lat + latStep &&
              business.lng >= lng &&
              business.lng < lng + lngStep
          );
          const categoryCounter = new Map<string, number>();
          for (const business of cellBusinesses) {
            categoryCounter.set(business.normalized_category, (categoryCounter.get(business.normalized_category) ?? 0) + 1);
          }

          let dominantCategory = 'No dominant category';
          let dominantCount = 0;
          categoryCounter.forEach((count, category) => {
            if (count > dominantCount) {
              dominantCount = count;
              dominantCategory = category;
            }
          });

          cells.push({
            centerLat: centerCellLat,
            centerLng: centerCellLng,
            nearbyDemandBusinesses,
            nearbyCompetitors,
            dominantCategory,
            opportunityScore: 0,
            demandScore: 0,
            scarcityScore: 0,
            qualityGapScore: 0,
            avgCompetitorRating,
            avgCompetitorReviews
          });
        }
      }

      const scoredCells = cells
        .map((cell) => {
          const demandScore = maxDemand === 0 ? 0 : (cell.nearbyDemandBusinesses.length / maxDemand) * 100;
          const scarcityScore =
            maxCompetitors === 0 ? 100 : Math.max(0, (1 - cell.nearbyCompetitors.length / maxCompetitors) * 100);
          const ratingGapScore =
            maxAvgRating === 0 ? 100 : Math.max(0, (1 - cell.avgCompetitorRating / maxAvgRating) * 100);
          const reviewsGapScore =
            maxAvgReviews === 0 ? 100 : Math.max(0, (1 - cell.avgCompetitorReviews / maxAvgReviews) * 100);
          const qualityGapScore = cell.nearbyCompetitors.length === 0 ? 100 : Math.round((ratingGapScore + reviewsGapScore) / 2);
          const opportunityScore = Math.round(0.45 * demandScore + 0.35 * scarcityScore + 0.2 * qualityGapScore);
          return { ...cell, demandScore, scarcityScore, qualityGapScore, opportunityScore };
        })
        .filter((cell) => cell.opportunityScore >= minOpportunityScore)
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, maxCellsPerViewport);

      for (const cell of scoredCells) {
        const nearbyBusinesses = cell.nearbyDemandBusinesses
          .map((business) => ({
            business,
            distance: distanceKm(cell.centerLat, cell.centerLng, business.lat, business.lng)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 6);
        const nearbyCompetitors = cell.nearbyCompetitors
          .map((business) => ({
            business,
            distance: distanceKm(cell.centerLat, cell.centerLng, business.lat, business.lng)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 6);

        const nearbyListHtml =
          nearbyBusinesses.length === 0
            ? '<em>No nearby businesses within 1km</em>'
            : nearbyBusinesses
                .map(
                  ({ business, distance }) =>
                    `• ${escapeHtml(business.name)} (${escapeHtml(business.normalized_category)}) - ${distance.toFixed(2)}km`
                )
                .join('<br/>');
        const competitorListHtml =
          nearbyCompetitors.length === 0
            ? '<em>No nearby competitors in selected category</em>'
            : nearbyCompetitors
                .map(
                  ({ business, distance }) =>
                    `• ${escapeHtml(business.name)} (⭐ ${business.rating ?? 'N/A'}, ${business.review_count} reviews) - ${distance.toFixed(2)}km`
                )
                .join('<br/>');

        const marker = window.L.circleMarker([cell.centerLat, cell.centerLng], {
          radius: markerRadius,
          color: getOpportunityColor(cell.opportunityScore),
          fillColor: getOpportunityColor(cell.opportunityScore),
          fillOpacity: 0.4,
          weight: 1
        });

        marker.bindPopup(`
          <div style="font-size:12px;line-height:1.4;max-width:280px;">
            <strong>Opportunity Cell</strong><br/>
            Opportunity Score: <strong>${cell.opportunityScore}</strong><br/>
            Selected Category: <strong>${escapeHtml(selectedCategory ?? 'All categories')}</strong><br/>
            Nearby Businesses (all): <strong>${cell.nearbyDemandBusinesses.length}</strong><br/>
            Nearby Competitors (${escapeHtml(selectedCategory ?? 'all')}): <strong>${cell.nearbyCompetitors.length}</strong><br/>
            Avg Competitor Rating: <strong>${cell.avgCompetitorRating.toFixed(2)}</strong><br/>
            Avg Competitor Reviews: <strong>${cell.avgCompetitorReviews.toFixed(0)}</strong><br/>
            Dominant Cell Category: <strong>${escapeHtml(cell.dominantCategory)}</strong><br/>
            Demand / Scarcity / QualityGap: <strong>${Math.round(cell.demandScore)} / ${Math.round(
          cell.scarcityScore
        )} / ${Math.round(cell.qualityGapScore)}</strong><br/>
            Nearby Competitors:<br/>${competitorListHtml}<br/><br/>
            Nearby Businesses:<br/>${nearbyListHtml}
          </div>
        `);

        layer.addLayer(marker);
      }
    };

    const scheduleRender = () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      redrawTimerRef.current = setTimeout(renderOpportunityGrid, 300);
    };

    renderOpportunityGrid();
    map.on('moveend', scheduleRender);
    map.on('zoomend', scheduleRender);

    return () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      map.off('moveend', scheduleRender);
      map.off('zoomend', scheduleRender);
    };
  }, [businesses, demandBusinesses, selectedCategory]);

  useEffect(() => {
    if (!selectedBusiness || !mapRef.current) return;
    mapRef.current.flyTo([selectedBusiness.lat, selectedBusiness.lng], 15, { duration: 0.8 });
  }, [selectedBusiness]);

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="pointer-events-none absolute bottom-3 left-3 z-[5000] rounded-md border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg">
        <p className="mb-2 font-semibold">Opportunity Heatmap</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            <span>Green → High Opportunity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
            <span>Yellow → Medium Opportunity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            <span>Red → Saturated Area</span>
          </div>
        </div>
      </div>
      <div ref={mapElementRef} className="h-full w-full" />
    </div>
  );
}
