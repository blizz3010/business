'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Business, OpportunityCell, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';

const ORLANDO_CENTER: [number, number] = [28.5383, -81.3792];

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Props = {
  businesses: Business[];
  allBusinesses: Business[];
  selectedCategory?: string;
  showBusinessMarkers: boolean;
  opportunityLayerEnabled?: boolean;
  flyTo?: [number, number] | null;
  onBoundsChange?: (bounds: { south: number; north: number; west: number; east: number }) => void;
};

type LeafletRuntime = {
  map: any;
  tileLayer: any;
  markerClusterGroup: any;
  layerGroup: any;
  rectangle: any;
  divIcon: any;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getCellStepDegrees(cellSizeMeters: number, latitude: number) {
  const latStep = cellSizeMeters / 111320;
  const lngStep = cellSizeMeters / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2));
  return { latStep, lngStep };
}

export function MapPanel({
  businesses,
  allBusinesses,
  selectedCategory,
  showBusinessMarkers,
  opportunityLayerEnabled = false,
  flyTo,
  onBoundsChange
}: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterLayerRef = useRef<any>(null);
  const opportunityLayerRef = useRef<any>(null);
  const legendControlRef = useRef<any>(null);
  const leafletRef = useRef<LeafletRuntime | null>(null);
  const opportunityAbortRef = useRef<AbortController | null>(null);
  const redrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsCallbackRef = useRef(onBoundsChange);
  const [mapReady, setMapReady] = useState(false);

  // Keep the callback ref updated without re-initializing the map
  boundsCallbackRef.current = onBoundsChange;

  // ── Map initialization ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mapElementRef.current) return;

      const leafletModule = await import('leaflet');
      const L = leafletModule.default;
      (window as any).L = L;
      await import('leaflet.markercluster');
      if (!mounted || !L || mapRef.current) return;

      leafletRef.current = {
        map: L.map,
        tileLayer: L.tileLayer,
        markerClusterGroup: L.markerClusterGroup,
        layerGroup: L.layerGroup,
        rectangle: L.rectangle,
        divIcon: L.divIcon
      };

      const map = L.map(mapElementRef.current).setView(ORLANDO_CENTER, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
      clusterLayerRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 80,
        singleMarkerMode: true,
        disableClusteringAtZoom: 14
      });
      opportunityLayerRef.current = L.layerGroup();
      map.addLayer(clusterLayerRef.current);
      map.addLayer(opportunityLayerRef.current);

      const syncBounds = () => {
        if (!boundsCallbackRef.current || !mapRef.current) return;
        const viewport = mapRef.current.getBounds();
        boundsCallbackRef.current({
          south: viewport.getSouth(),
          north: viewport.getNorth(),
          west: viewport.getWest(),
          east: viewport.getEast()
        });
      };

      syncBounds();
      map.on('moveend', syncBounds);
      map.on('zoomend', syncBounds);
      map.invalidateSize();
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
      leafletRef.current = null;
    };
  }, []); // stable — no deps that change

  // ── Resize observer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapElementRef.current) return;
    const map = mapRef.current;
    const element = mapElementRef.current;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [mapReady]);

  // ── Business markers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !clusterLayerRef.current) return;
    const { divIcon } = leafletRef.current;
    const L = (window as any).L;
    if (!L) return;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    clusterLayer.clearLayers();

    businesses.forEach((business) => {
      const catColor = getCategoryColor(business.normalized_category);
      const icon = divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${catColor.fill};border:1.5px solid ${catColor.stroke};opacity:0.9;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const marker = L.marker([business.lat, business.lng], { icon });

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
    if (businesses.length > 0 && showBusinessMarkers) map.addLayer(clusterLayer);
  }, [businesses, showBusinessMarkers]);

  // ── Toggle business marker visibility ──────────────────────────────────
  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !clusterLayerRef.current) return;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    if (map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if (showBusinessMarkers) map.addLayer(clusterLayer);
  }, [showBusinessMarkers]);

  // ── Opportunity grid layer (fetches from backend) ──────────────────────
  const fetchAndRenderOpportunities = useCallback(async () => {
    if (!leafletRef.current || !mapRef.current || !opportunityLayerRef.current) return;
    if (!opportunityLayerEnabled) return;

    const map = mapRef.current;
    const layer = opportunityLayerRef.current;
    const { rectangle } = leafletRef.current;

    // Abort any in-flight request
    if (opportunityAbortRef.current) opportunityAbortRef.current.abort();
    const controller = new AbortController();
    opportunityAbortRef.current = controller;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Adaptive parameters based on zoom level
    let cellSize = 500;
    let radius = 1500;
    let minGap = 0.6;    // km - minimum distance from nearest competitor to count as gap
    let minSpacing = 1.2; // km - minimum distance between opportunity markers

    if (zoom <= 10) {
      cellSize = 1500; radius = 2500; minGap = 1.5; minSpacing = 3.0;
    } else if (zoom <= 11) {
      cellSize = 1000; radius = 2000; minGap = 1.0; minSpacing = 2.0;
    } else if (zoom <= 12) {
      cellSize = 800; radius = 1500; minGap = 0.6; minSpacing = 1.2;
    } else if (zoom <= 13) {
      cellSize = 600; radius = 1200; minGap = 0.4; minSpacing = 0.8;
    } else {
      cellSize = 400; radius = 800; minGap = 0.25; minSpacing = 0.5;
    }

    const params = new URLSearchParams({
      south: String(bounds.getSouth()),
      north: String(bounds.getNorth()),
      west: String(bounds.getWest()),
      east: String(bounds.getEast()),
      cellSize: String(cellSize),
      radius: String(radius),
      minGap: String(minGap),
      minSpacing: String(minSpacing),
      limit: '15'
    });

    if (selectedCategory) {
      params.set('category', selectedCategory);
    }

    try {
      const response = await fetch(`${API_BASE}/api/opportunity-grid?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) return;
      const cells: OpportunityCell[] = await response.json();

      if (controller.signal.aborted) return;

      layer.clearLayers();

      const centerLat = (bounds.getSouth() + bounds.getNorth()) / 2;
      const { latStep, lngStep } = getCellStepDegrees(cellSize, centerLat);
      const halfLat = latStep * 0.42;
      const halfLng = lngStep * 0.42;

      for (const cell of cells) {
        const catColor = getCategoryColor(cell.category);
        const gapMeters = Math.round((cell.gap_km ?? 0) * 1000);

        const rect = rectangle(
          [
            [cell.lat - halfLat, cell.lng - halfLng],
            [cell.lat + halfLat, cell.lng + halfLng]
          ],
          {
            color: catColor.stroke,
            fillColor: catColor.fill,
            fillOpacity: Math.min(0.20 + (cell.score / 100) * 0.40, 0.55),
            weight: 2
          }
        );

        // Build popup
        const competitorHtml = cell.top_competitors.length === 0
          ? '<em>No competitors nearby</em>'
          : cell.top_competitors
              .map(
                (c) =>
                  `<div style="margin:2px 0;">• ${escapeHtml(c.name)} — ★${c.rating ?? 'N/A'} (${c.review_count} reviews) · ${(c.distance_km * 1000).toFixed(0)}m away</div>`
              )
              .join('');

        const scoreBarHtml = (label: string, value: number, color: string) =>
          `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
            <span style="width:80px;font-size:10px;color:#94a3b8;">${label}</span>
            <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
              <div style="width:${value}%;height:100%;background:${color};border-radius:3px;"></div>
            </div>
            <span style="width:24px;text-align:right;font-size:10px;color:#94a3b8;">${value}</span>
          </div>`;

        rect.bindPopup(`
          <div style="font-size:12px;line-height:1.5;max-width:300px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span style="width:10px;height:10px;border-radius:2px;background:${catColor.fill};border:1px solid ${catColor.stroke};display:inline-block;"></span>
              <strong>${escapeHtml(cell.category)} gap</strong>
              <span style="margin-left:auto;font-weight:bold;font-size:14px;">${cell.score}</span>
            </div>

            <div style="margin-bottom:6px;font-size:11px;color:#94a3b8;">
              Nearest ${escapeHtml(cell.category)} is <strong style="color:#e2e8f0;">${gapMeters >= 1000 ? (gapMeters / 1000).toFixed(1) + 'km' : gapMeters + 'm'}</strong> away
            </div>

            ${scoreBarHtml('Gap distance', cell.scarcity_score, '#22c55e')}
            ${scoreBarHtml('Local demand', cell.demand_score, '#38bdf8')}
            ${scoreBarHtml('Quality gap', cell.quality_gap_score, '#facc15')}

            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #334155;">
              <strong>Nearest ${escapeHtml(cell.category)} businesses</strong>
              ${competitorHtml}
            </div>
          </div>
        `);

        layer.addLayer(rect);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('Opportunity grid fetch failed:', err);
    }
  }, [opportunityLayerEnabled, selectedCategory]);

  // Wire up opportunity layer toggling and re-fetching on map movement
  useEffect(() => {
    if (!mapRef.current || !opportunityLayerRef.current) return;

    const map = mapRef.current;
    const layer = opportunityLayerRef.current;

    if (map.hasLayer(layer)) map.removeLayer(layer);

    if (!opportunityLayerEnabled) {
      layer.clearLayers();
      return;
    }

    map.addLayer(layer);

    const scheduleRender = () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      redrawTimerRef.current = setTimeout(fetchAndRenderOpportunities, 350);
    };

    // Initial render
    fetchAndRenderOpportunities();

    // moveend fires after zoomend, so one listener is sufficient
    map.on('moveend', scheduleRender);

    return () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      map.off('moveend', scheduleRender);
      if (opportunityAbortRef.current) opportunityAbortRef.current.abort();
      layer.clearLayers();
    };
  }, [mapReady, opportunityLayerEnabled, selectedCategory, fetchAndRenderOpportunities]);

  // ── Fly to location ──────────────────────────────────────────────────
  useEffect(() => {
    if (!flyTo || !mapReady || !mapRef.current) return;
    mapRef.current.flyTo(flyTo, 12, { duration: 1.2 });
  }, [flyTo, mapReady]);

  // ── Category legend overlay ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !opportunityLayerEnabled) {
      if (legendControlRef.current && mapRef.current) {
        mapRef.current.removeControl(legendControlRef.current);
        legendControlRef.current = null;
      }
      return;
    }

    // Don't re-create if already present
    if (legendControlRef.current) {
      mapRef.current.removeControl(legendControlRef.current);
      legendControlRef.current = null;
    }

    const L = (window as any).L;
    if (!L) return;

    const legend = (L.control as any)({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control');
      div.style.cssText =
        'background:rgba(15,23,42,0.92);padding:8px 10px;border-radius:8px;font-size:11px;line-height:1.6;color:#cbd5e1;pointer-events:auto;';

      const entries = selectedCategory
        ? [[selectedCategory, CATEGORY_COLORS[selectedCategory] ?? CATEGORY_COLORS['Services']]]
        : Object.entries(CATEGORY_COLORS);

      div.innerHTML =
        '<div style="font-weight:600;margin-bottom:4px;color:#e2e8f0;">Opportunity categories</div>' +
        (entries as [string, { fill: string; stroke: string }][])
          .map(
            ([name, c]) =>
              `<div style="display:flex;align-items:center;gap:5px;">
                <span style="width:10px;height:10px;border-radius:2px;background:${c.fill};border:1px solid ${c.stroke};display:inline-block;"></span>
                ${name}
              </div>`
          )
          .join('');

      return div;
    };

    legend.addTo(mapRef.current);
    legendControlRef.current = legend;

    return () => {
      if (legendControlRef.current && mapRef.current) {
        mapRef.current.removeControl(legendControlRef.current);
        legendControlRef.current = null;
      }
    };
  }, [mapReady, opportunityLayerEnabled, selectedCategory]);

  return (
    <div
      ref={mapElementRef}
      className="w-full rounded-xl border border-slate-800 bg-slate-900"
      style={{ height: 'calc(100vh - 120px)', minHeight: '400px' }}
    />
  );
}
