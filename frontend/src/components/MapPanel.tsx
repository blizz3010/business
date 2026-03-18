'use client';

import { useEffect, useRef } from 'react';
import { Business, HeatmapPoint } from '@/lib/types';

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
  heatmap: HeatmapPoint[];
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

function getMarkerColor(score: number) {
  if (score >= 220) return '#ef4444';
  if (score >= 120) return '#facc15';
  return '#22c55e';
}

export function MapPanel({ businesses, heatmap, selectedBusiness }: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterLayerRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);

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
      clusterLayerRef.current = window.L.markerClusterGroup();
      heatLayerRef.current = window.L.layerGroup();
      map.addLayer(clusterLayerRef.current);
      map.addLayer(heatLayerRef.current);
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!window.L || !mapRef.current || !clusterLayerRef.current || !heatLayerRef.current) return;

    clusterLayerRef.current.clearLayers();
    heatLayerRef.current.clearLayers();

    for (const point of heatmap) {
      const totalReviews = Number(point.total_reviews || 0);
      const businessCount = Number(point.business_count || 0);
      const intensity = Math.max(totalReviews, businessCount * 25);

      window.L.circleMarker([Number(point.lat_bucket), Number(point.lng_bucket)], {
        radius: Math.max(8, Math.min(34, intensity / 70)),
        color: '#38bdf8',
        fillOpacity: 0.2,
        weight: 1
      }).addTo(heatLayerRef.current);
    }

    for (const business of businesses) {
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
  }, [businesses, heatmap]);

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
