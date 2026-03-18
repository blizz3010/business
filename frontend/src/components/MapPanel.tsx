'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Business, MapBounds } from '@/lib/types';

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

const GRID_STEP = 0.015;
const SEARCH_RADIUS_KM = 1.5;
const RENDER_DEBOUNCE_MS = 300;

type OpportunityCell = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  score: number;
};

type Props = {
  businesses: Business[];
  selectedBusiness?: Business | null;
  selectedCategory?: string;
  showOpportunitiesOnly?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
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

function getMarkerColor(score: number) {
  if (score >= 220) return '#ef4444';
  if (score >= 120) return '#facc15';
  return '#22c55e';
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const kmPerLat = 111;
  const kmPerLng = 111 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const dLat = (lat1 - lat2) * kmPerLat;
  const dLng = (lng1 - lng2) * kmPerLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function scoreToColor(score: number) {
  if (score >= 0.68) return '#ef4444';
  if (score >= 0.45) return '#facc15';
  return '#22c55e';
}

function computeOpportunityGrid(bounds: MapBounds, businesses: Business[]) {
  const cells: OpportunityCell[] = [];

  for (let lat = bounds.minLat; lat < bounds.maxLat; lat += GRID_STEP) {
    for (let lng = bounds.minLng; lng < bounds.maxLng; lng += GRID_STEP) {
      const cellCenterLat = lat + GRID_STEP / 2;
      const cellCenterLng = lng + GRID_STEP / 2;

      const nearby = businesses.filter((biz) => distanceKm(biz.lat, biz.lng, cellCenterLat, cellCenterLng) <= SEARCH_RADIUS_KM);

      const density = nearby.length;
      const avgRating = density ? nearby.reduce((sum, biz) => sum + (biz.rating ?? 0), 0) / density : 0;
      const avgReviews = density ? nearby.reduce((sum, biz) => sum + (biz.review_count || 0), 0) / density : 0;

      const score =
        (1 / Math.pow(density + 1, 1.5)) * 0.6 + ((5 - avgRating) / 5) * 0.25 + (1 / Math.log(avgReviews + 2)) * 0.15;

      cells.push({
        minLat: lat,
        maxLat: Math.min(lat + GRID_STEP, bounds.maxLat),
        minLng: lng,
        maxLng: Math.min(lng + GRID_STEP, bounds.maxLng),
        score
      });
    }
  }

  return cells;
}

export function MapPanel({
  businesses,
  selectedBusiness,
  selectedCategory,
  showOpportunitiesOnly = false,
  onBoundsChange
}: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const heatmapLayerRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const gridLayerRef = useRef<any>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const categoryFilteredBusinesses = useMemo(() => {
    if (!selectedCategory) return businesses;
    const selected = selectedCategory.toLowerCase();
    return businesses.filter(
      (biz) => biz.category?.toLowerCase() === selected || biz.normalized_category?.toLowerCase() === selected
    );
  }, [businesses, selectedCategory]);

  const clearLeafletLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current);
      markerLayerRef.current = null;
    }

    if (gridLayerRef.current) {
      map.removeLayer(gridLayerRef.current);
      gridLayerRef.current = null;
    }
  }, []);

  const renderOpportunityMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;

    clearLeafletLayers();

    heatmapLayerRef.current = window.L.layerGroup().addTo(map);
    markerLayerRef.current = window.L.markerClusterGroup().addTo(map);
    gridLayerRef.current = window.L.layerGroup().addTo(map);

    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const mappedBounds = {
      minLat: sw.lat,
      maxLat: ne.lat,
      minLng: sw.lng,
      maxLng: ne.lng
    };

    onBoundsChange?.(mappedBounds);

    const cells = computeOpportunityGrid(mappedBounds, categoryFilteredBusinesses);

    for (const cell of cells) {
      window.L.rectangle(
        [
          [cell.minLat, cell.minLng],
          [cell.maxLat, cell.maxLng]
        ],
        {
          color: scoreToColor(cell.score),
          fillColor: scoreToColor(cell.score),
          weight: 0,
          fillOpacity: 0.38
        }
      )
        .bindTooltip(`Opportunity: ${cell.score.toFixed(2)}`)
        .addTo(heatmapLayerRef.current);

      window.L.rectangle(
        [
          [cell.minLat, cell.minLng],
          [cell.maxLat, cell.maxLng]
        ],
        {
          color: '#0f172a',
          weight: 0.2,
          fillOpacity: 0
        }
      ).addTo(gridLayerRef.current);
    }

    if (showOpportunitiesOnly) return;

    for (const business of categoryFilteredBusinesses) {
      const marker = window.L.circleMarker([business.lat, business.lng], {
        radius: 6,
        color: getMarkerColor(business.opportunity_score),
        fillColor: getMarkerColor(business.opportunity_score),
        fillOpacity: 0.9,
        weight: 1
      });

      marker.bindPopup(`
        <div style="font-size:12px;line-height:1.4;">
          <strong>${escapeHtml(business.name)}</strong><br/>
          ${escapeHtml(business.normalized_category)}<br/>
          Rating: <strong>${business.rating ?? 'N/A'}</strong> · Reviews: <strong>${business.review_count}</strong><br/>
          Opportunity: ${Math.round(business.opportunity_score)}
        </div>
      `);

      markerLayerRef.current.addLayer(marker);
    }
  }, [categoryFilteredBusinesses, clearLeafletLayers, onBoundsChange, showOpportunitiesOnly]);

  const scheduleRender = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }

    renderTimeoutRef.current = setTimeout(() => {
      renderOpportunityMap();
    }, RENDER_DEBOUNCE_MS);
  }, [renderOpportunityMap]);

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
      map.on('moveend', scheduleRender);
      map.on('zoomend', scheduleRender);

      scheduleRender();
    };

    init();

    return () => {
      mounted = false;

      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
        renderTimeoutRef.current = null;
      }

      if (mapRef.current) {
        clearLeafletLayers();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [clearLeafletLayers, scheduleRender]);

  useEffect(() => {
    scheduleRender();
  }, [selectedCategory, showOpportunitiesOnly, categoryFilteredBusinesses, scheduleRender]);

  useEffect(() => {
    if (!selectedBusiness || !mapRef.current) return;
    mapRef.current.flyTo([selectedBusiness.lat, selectedBusiness.lng], 15, { duration: 0.8 });
  }, [selectedBusiness]);

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div ref={mapElementRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-4 right-4 max-w-[240px] rounded-xl border border-slate-700 bg-slate-900/85 p-3 text-xs text-slate-100 shadow-lg">
        <p className="mb-2 text-sm font-semibold">Opportunity Score</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-3 w-3 rounded-full bg-red-500" />
            <span>
              <strong>High Opportunity</strong>
              <br />Few or no competitors · Weak competition
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-3 w-3 rounded-full bg-yellow-400" />
            <span>
              <strong>Medium Opportunity</strong>
              <br />Some competition
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-3 w-3 rounded-full bg-green-500" />
            <span>
              <strong>Low Opportunity</strong>
              <br />High competition · Strong nearby businesses
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
