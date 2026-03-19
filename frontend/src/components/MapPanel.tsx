'use client';

import { useEffect, useRef, useState } from 'react';
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

const OPPORTUNITY_ENABLED = true;
const MAX_OPPORTUNITY_CELLS = 40;
const MIN_DEMAND_COUNT = 4;
const MIN_OPPORTUNITY_SCORE = 45;

type Props = {
  businesses: Business[];
  allBusinesses: Business[];
  selectedCategory?: string;
  hideBusinessMarkers: boolean;
  opportunityLayerEnabled?: boolean;
  selectedBusiness?: Business | null;
  onBoundsChange?: (bounds: { south: number; north: number; west: number; east: number }) => void;
};

function loadStyle(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
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

export function MapPanel({
  businesses,
  allBusinesses,
  selectedCategory,
  hideBusinessMarkers,
  opportunityLayerEnabled = false,
  selectedBusiness,
  onBoundsChange
}: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterLayerRef = useRef<any>(null);
  const opportunityLayerRef = useRef<any>(null);
  const redrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
      clusterLayerRef.current = window.L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45
      });
      opportunityLayerRef.current = window.L.layerGroup();
      map.addLayer(clusterLayerRef.current);
      map.addLayer(opportunityLayerRef.current);
      const syncBounds = () => {
        if (!onBoundsChange || !mapRef.current) return;
        const viewport = mapRef.current.getBounds();
        onBoundsChange({
          south: viewport.getSouth(),
          north: viewport.getNorth(),
          west: viewport.getWest(),
          east: viewport.getEast()
        });
      };
      syncBounds();
      map.on('moveend', syncBounds);
      map.on('zoomend', syncBounds);
      setMapReady(true);
    };

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      }
      clusterLayerRef.current = null;
      opportunityLayerRef.current = null;
    };
  }, [onBoundsChange]);

  useEffect(() => {
    if (!window.L || !mapRef.current || !clusterLayerRef.current) return;

    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    clusterLayer.clearLayers();

    businesses.forEach((business) => {
      const marker = window.L.circleMarker([business.lat, business.lng], {
        radius: 6,
        color: '#38bdf8',
        fillColor: '#0ea5e9',
        fillOpacity: 0.85,
        weight: 1
      });

      marker.bindPopup(`
        <div style="font-size:12px;line-height:1.4;max-width:280px;">
          <strong>${escapeHtml(business.name)}</strong><br/>
          Category: <strong>${escapeHtml(business.normalized_category)}</strong><br/>
          Rating: <strong>${business.rating ?? 'N/A'}</strong><br/>
          Reviews: <strong>${business.review_count}</strong>
        </div>
      `);
      clusterLayer.addLayer(marker);
    });

    if (map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if (businesses.length > 0 && !hideBusinessMarkers) map.addLayer(clusterLayer);
  }, [businesses, hideBusinessMarkers]);

  useEffect(() => {
    if (!window.L || !mapRef.current || !clusterLayerRef.current) return;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    if (map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if (!hideBusinessMarkers) map.addLayer(clusterLayer);
  }, [hideBusinessMarkers]);

  useEffect(() => {
    if (!window.L || !mapRef.current || !opportunityLayerRef.current || !OPPORTUNITY_ENABLED) return;

    const map = mapRef.current;
    const layer = opportunityLayerRef.current;

    if (map.hasLayer(layer)) map.removeLayer(layer);
    if (!opportunityLayerEnabled) return;
    map.addLayer(layer);

    const renderOpportunityGrid = () => {
      if (!mapRef.current || !opportunityLayerRef.current) return;

      layer.clearLayers();

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const cellSizeMeters = getCellSizeMeters(zoom);
      const centerLat = bounds.getCenter().lat;
      const { latStep, lngStep } = getCellStepDegrees(cellSizeMeters, centerLat);
      const halfLat = latStep * 0.35;
      const halfLng = lngStep * 0.35;
      const radiusKm = zoom >= 14 ? 0.9 : zoom >= 12 ? 1.2 : 1.8;

      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();

      const viewportBusinesses = allBusinesses.filter(
        (business) =>
          business.lat >= south && business.lat <= north && business.lng >= west && business.lng <= east
      );
      const viewportSelectedBusinesses = businesses.filter(
        (business) =>
          business.lat >= south && business.lat <= north && business.lng >= west && business.lng <= east
      );

      const cells: Array<{
        centerLat: number;
        centerLng: number;
        nearbyAllCount: number;
        nearbySelectedCount: number;
        avgCompetitorRating: number | null;
        avgCompetitorReviews: number | null;
        opportunityScore: number;
        nearbyBusinesses: Array<{ business: Business; distance: number }>;
        nearbyCompetitors: Array<{ business: Business; distance: number }>;
      }> = [];

      let maxDemandCount = 0;
      let maxSelectedCount = 0;
      let maxCompetitorReviews = 0;

      for (let lat = south; lat < north; lat += latStep) {
        for (let lng = west; lng < east; lng += lngStep) {
          const cellLat = lat + latStep / 2;
          const cellLng = lng + lngStep / 2;

          const nearbyBusinesses = viewportBusinesses
            .map((business) => ({
              business,
              distance: distanceKm(cellLat, cellLng, business.lat, business.lng)
            }))
            .filter((item) => item.distance <= radiusKm)
            .sort((a, b) => a.distance - b.distance);

          if (nearbyBusinesses.length < MIN_DEMAND_COUNT) continue;

          const nearbyCompetitors = viewportSelectedBusinesses
            .map((business) => ({
              business,
              distance: distanceKm(cellLat, cellLng, business.lat, business.lng)
            }))
            .filter((item) => item.distance <= radiusKm)
            .sort((a, b) => a.distance - b.distance);

          const competitorRatings = nearbyCompetitors
            .map((item) => item.business.rating)
            .filter((rating): rating is number => rating !== null);
          const competitorReviews = nearbyCompetitors.map((item) => item.business.review_count ?? 0);
          const avgCompetitorRating =
            competitorRatings.length > 0
              ? competitorRatings.reduce((acc, rating) => acc + rating, 0) / competitorRatings.length
              : null;
          const avgCompetitorReviews =
            competitorReviews.length > 0
              ? competitorReviews.reduce((acc, count) => acc + count, 0) / competitorReviews.length
              : null;

          maxDemandCount = Math.max(maxDemandCount, nearbyBusinesses.length);
          maxSelectedCount = Math.max(maxSelectedCount, nearbyCompetitors.length);
          maxCompetitorReviews = Math.max(maxCompetitorReviews, avgCompetitorReviews ?? 0);

          cells.push({
            centerLat: cellLat,
            centerLng: cellLng,
            nearbyAllCount: nearbyBusinesses.length,
            nearbySelectedCount: nearbyCompetitors.length,
            avgCompetitorRating,
            avgCompetitorReviews,
            opportunityScore: 0,
            nearbyBusinesses,
            nearbyCompetitors
          });
        }
      }

      for (const cell of cells) {
        const demandScore = maxDemandCount === 0 ? 0 : cell.nearbyAllCount / maxDemandCount;
        const scarcityScore = maxSelectedCount === 0 ? 1 : 1 - cell.nearbySelectedCount / maxSelectedCount;
        const normalizedRating =
          cell.avgCompetitorRating === null ? 0 : Math.min(Math.max(cell.avgCompetitorRating / 5, 0), 1);
        const normalizedReviews =
          cell.avgCompetitorReviews === null || maxCompetitorReviews === 0
            ? 0
            : Math.log1p(cell.avgCompetitorReviews) / Math.log1p(maxCompetitorReviews);
        const competitorStrength = 0.7 * normalizedRating + 0.3 * normalizedReviews;
        const qualityGapScore = 1 - competitorStrength;

        cell.opportunityScore = Math.round((0.4 * demandScore + 0.35 * scarcityScore + 0.25 * qualityGapScore) * 100);
      }

      const renderableCells = cells
        .filter((cell) => cell.opportunityScore >= MIN_OPPORTUNITY_SCORE)
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, MAX_OPPORTUNITY_CELLS);

      for (const cell of renderableCells) {
        const nearbyBusinessListHtml =
          cell.nearbyBusinesses.length === 0
            ? '<em>No nearby businesses in radius</em>'
            : cell.nearbyBusinesses
                .slice(0, 8)
                .map(
                  ({ business, distance }) =>
                    `• ${escapeHtml(business.name)} (${escapeHtml(business.normalized_category)}) - ${distance.toFixed(2)}km`
                )
                .join('<br/>');

        const nearbyCompetitorListHtml =
          cell.nearbyCompetitors.length === 0
            ? '<em>No nearby selected-category competitors</em>'
            : cell.nearbyCompetitors
                .slice(0, 8)
                .map(
                  ({ business, distance }) =>
                    `• ${escapeHtml(business.name)} (${escapeHtml(business.normalized_category)}) - ${distance.toFixed(2)}km`
                )
                .join('<br/>');

        const marker = window.L.rectangle(
          [
            [cell.centerLat - halfLat, cell.centerLng - halfLng],
            [cell.centerLat + halfLat, cell.centerLng + halfLng]
          ],
          {
            color: getOpportunityColor(cell.opportunityScore),
            fillColor: getOpportunityColor(cell.opportunityScore),
            fillOpacity: 0.28,
            weight: 1
          }
        );

        marker.bindPopup(`
          <div style="font-size:12px;line-height:1.4;max-width:300px;">
            <strong>Opportunity Cell</strong><br/>
            Opportunity Score: <strong>${cell.opportunityScore}</strong><br/>
            Selected Category: <strong>${escapeHtml(selectedCategory ?? 'All categories')}</strong><br/>
            Nearby all-business count: <strong>${cell.nearbyAllCount}</strong><br/>
            Nearby selected-category count: <strong>${cell.nearbySelectedCount}</strong><br/>
            Avg nearby competitor rating: <strong>${cell.avgCompetitorRating?.toFixed(2) ?? 'N/A'}</strong><br/>
            Avg nearby competitor reviews: <strong>${cell.avgCompetitorReviews?.toFixed(0) ?? 'N/A'}</strong><br/>
            <br/>
            <strong>Nearby Businesses</strong><br/>${nearbyBusinessListHtml}<br/><br/>
            <strong>Nearby Competitors</strong><br/>${nearbyCompetitorListHtml}
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
  }, [allBusinesses, businesses, selectedCategory, opportunityLayerEnabled]);

  useEffect(() => {
    if (!selectedBusiness || !mapRef.current) return;
    mapRef.current.flyTo([selectedBusiness.lat, selectedBusiness.lng], 15, { duration: 0.8 });
  }, [selectedBusiness]);

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {OPPORTUNITY_ENABLED ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1200] rounded-md border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg">
          <p className="mb-2 font-semibold">Opportunity Layer</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
              <span>Green → High Opportunity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-yellow-400" />
              <span>Yellow → Medium Opportunity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
              <span>Red → Saturated / Lower Opportunity</span>
            </div>
          </div>
        </div>
      ) : null}
      <div ref={mapElementRef} className="h-full w-full" />
    </div>
  );
}
