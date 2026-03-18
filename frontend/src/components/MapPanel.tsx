'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  if (score >= 0.66) return '#ef4444';
  if (score >= 0.4) return '#facc15';
  return '#3b82f6';
}

function computeOpportunityGrid(bounds: MapBounds | null, businesses: Business[]) {
  if (!bounds) return [];

  const cells: OpportunityCell[] = [];

  for (let lat = bounds.minLat; lat < bounds.maxLat; lat += GRID_STEP) {
    for (let lng = bounds.minLng; lng < bounds.maxLng; lng += GRID_STEP) {
      const cellCenterLat = lat + GRID_STEP / 2;
      const cellCenterLng = lng + GRID_STEP / 2;

      const nearby = businesses.filter((biz) => distanceKm(biz.lat, biz.lng, cellCenterLat, cellCenterLng) <= SEARCH_RADIUS_KM);

      const density = nearby.length;
      const avgRating = density ? nearby.reduce((sum, biz) => sum + (biz.rating ?? 0), 0) / density : 0;
      const avgReviews = density ? nearby.reduce((sum, biz) => sum + (biz.review_count || 0), 0) / density : 0;

      const score = (1 / (density + 1)) * 0.5 + ((5 - avgRating) / 5) * 0.3 + (1 / (avgReviews + 1)) * 0.2;

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
  const clusterLayerRef = useRef<any>(null);
  const opportunityLayerRef = useRef<any>(null);
  const [viewBounds, setViewBounds] = useState<MapBounds | null>(null);

  const categoryFilteredBusinesses = useMemo(() => {
    if (!selectedCategory) return businesses;
    const selected = selectedCategory.toLowerCase();
    return businesses.filter(
      (biz) => biz.category?.toLowerCase() === selected || biz.normalized_category?.toLowerCase() === selected
    );
  }, [businesses, selectedCategory]);

  const [opportunityCells, setOpportunityCells] = useState<OpportunityCell[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Full reset on category/filter dataset changes to prevent stale overlays.
    setOpportunityCells([]);

    if (opportunityLayerRef.current) {
      mapRef.current.removeLayer(opportunityLayerRef.current);
      opportunityLayerRef.current = window.L.layerGroup();
      mapRef.current.addLayer(opportunityLayerRef.current);
    }

    if (clusterLayerRef.current) {
      clusterLayerRef.current.clearLayers();
    }
  }, [selectedCategory, categoryFilteredBusinesses]);

  useEffect(() => {
    setOpportunityCells(computeOpportunityGrid(viewBounds, categoryFilteredBusinesses));
  }, [viewBounds, categoryFilteredBusinesses]);

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

      const emitBounds = () => {
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const mappedBounds = {
          minLat: sw.lat,
          maxLat: ne.lat,
          minLng: sw.lng,
          maxLng: ne.lng
        };

        setViewBounds(mappedBounds);
        onBoundsChange?.(mappedBounds);
      };

      mapRef.current = map;
      clusterLayerRef.current = window.L.markerClusterGroup();
      opportunityLayerRef.current = window.L.layerGroup();
      map.addLayer(opportunityLayerRef.current);
      map.addLayer(clusterLayerRef.current);
      map.on('moveend', emitBounds);
      map.on('zoomend', emitBounds);
      emitBounds();
    };

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onBoundsChange]);

  useEffect(() => {
    if (!window.L || !mapRef.current || !clusterLayerRef.current || !opportunityLayerRef.current) return;

    // Always rebuild layers from scratch for current filtered dataset.
    mapRef.current.removeLayer(opportunityLayerRef.current);
    opportunityLayerRef.current = window.L.layerGroup();
    mapRef.current.addLayer(opportunityLayerRef.current);
    clusterLayerRef.current.clearLayers();

    for (const cell of opportunityCells) {
      window.L.rectangle(
        [
          [cell.minLat, cell.minLng],
          [cell.maxLat, cell.maxLng]
        ],
        {
          color: scoreToColor(cell.score),
          weight: 0,
          fillOpacity: 0.35
        }
      )
        .bindTooltip(`Opportunity: ${cell.score.toFixed(2)}`)
        .addTo(opportunityLayerRef.current);
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

      clusterLayerRef.current.addLayer(marker);
    }
  }, [categoryFilteredBusinesses, opportunityCells, showOpportunitiesOnly, selectedCategory]);

  useEffect(() => {
    if (!selectedBusiness || !mapRef.current) return;
    mapRef.current.flyTo([selectedBusiness.lat, selectedBusiness.lng], 15, { duration: 0.8 });
  }, [selectedBusiness]);

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div ref={mapElementRef} className="h-full w-full" />
    </div>
  );
}
