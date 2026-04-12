'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Business, OpportunityCell, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';
import { API_BASE } from '@/lib/config';

const ORLANDO_CENTER: [number, number] = [28.5383, -81.3792];

type Props = {
  businesses: Business[];
  allBusinesses?: Business[];
  selectedCategory?: string;
  selectedSubcategory?: string;
  showBusinessMarkers: boolean;
  opportunityLayerEnabled?: boolean;
  flyTo?: [number, number] | null;
  onBoundsChange?: (bounds: { south: number; north: number; west: number; east: number }) => void;
  onBusinessSaved?: () => void;
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

function formatDistance(km: number): string {
  const meters = Math.round(km * 1000);
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters}m`;
}

function ratingStars(rating: number | null): string {
  if (rating === null) return 'N/A';
  return `${rating.toFixed(1)} stars`;
}

export function MapPanel({
  businesses,
  selectedCategory,
  selectedSubcategory,
  showBusinessMarkers,
  opportunityLayerEnabled = false,
  flyTo,
  onBoundsChange,
  onBusinessSaved
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

      const map = L.map(mapElementRef.current, {
        zoomControl: false,
      }).setView(ORLANDO_CENTER, 11);

      // Add zoom control to bottom-left
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // Use a cleaner dark-friendly tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
      clusterLayerRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 80,
        singleMarkerMode: false,
        disableClusteringAtZoom: 12
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
  }, []);

  // ── Resize observer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapElementRef.current) return;
    const map = mapRef.current;
    const element = mapElementRef.current;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [mapReady]);

  // ── Save business handler (attached to window for popup access) ────────
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.placeId || !detail?.name) return;

      const token = localStorage.getItem('streetscope_token');
      if (!token) {
        alert('Please log in to save businesses');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            place_id: detail.placeId,
            business_name: detail.name
          })
        });

        if (res.ok) {
          onBusinessSaved?.();
          // Update the button in the popup
          const btn = document.getElementById(`save-btn-${detail.placeId}`);
          if (btn) {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;color:#818cf8;"><path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clip-rule="evenodd" /></svg> Saved';
          }
        }
      } catch {
        // silently fail
      }
    };

    window.addEventListener('streetscope-save-business', handler);
    return () => window.removeEventListener('streetscope-save-business', handler);
  }, [onBusinessSaved]);

  // ── Business markers ─────────────────────────────────��─────────────────
  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !clusterLayerRef.current) return;
    const { divIcon } = leafletRef.current;
    const L = (window as any).L;
    if (!L) return;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    clusterLayer.clearLayers();

    const token = localStorage.getItem('streetscope_token');

    businesses.forEach((business) => {
      const catColor = getCategoryColor(business.normalized_category);
      const icon = divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${catColor.fill};border:1.5px solid ${catColor.stroke};opacity:0.9;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const marker = L.marker([business.lat, business.lng], { icon });

      // Build popup with save button
      const saveButton = business.place_id && token
        ? `<button id="save-btn-${escapeHtml(business.place_id)}" onclick="window.dispatchEvent(new CustomEvent('streetscope-save-business', { detail: { placeId: '${escapeHtml(business.place_id)}', name: '${escapeHtml(business.name).replaceAll("'", "\\'")}' } }))" style="display:flex;align-items:center;gap:4px;margin-top:8px;padding:4px 10px;border-radius:6px;background:rgb(99 102 241 / 0.15);border:1px solid rgb(99 102 241 / 0.3);color:#a5b4fc;font-size:11px;cursor:pointer;transition:all 0.15s;width:100%;justify-content:center;" onmouseover="this.style.background='rgb(99 102 241 / 0.25)'" onmouseout="this.style.background='rgb(99 102 241 / 0.15)'"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg> Save</button>`
        : '';

      const ratingDisplay = business.rating !== null
        ? `<span style="color:#fbbf24;">&#9733;</span> ${business.rating.toFixed(1)}`
        : 'No rating';

      marker.bindPopup(`
        <div style="min-width:200px;">
          <div style="font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:6px;">${escapeHtml(business.name)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:500;background:${catColor.fill}22;border:1px solid ${catColor.stroke}44;color:${catColor.fill};">
              <span style="width:6px;height:6px;border-radius:2px;background:${catColor.fill};"></span>
              ${escapeHtml(business.subcategory || business.normalized_category)}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:#94a3b8;">
            <div>${ratingDisplay}</div>
            <div>${business.review_count.toLocaleString()} reviews</div>
          </div>
          ${business.address ? `<div style="margin-top:4px;font-size:11px;color:#64748b;">${escapeHtml(business.address)}</div>` : ''}
          ${saveButton}
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

    if (opportunityAbortRef.current) opportunityAbortRef.current.abort();
    const controller = new AbortController();
    opportunityAbortRef.current = controller;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    let cellSize = 500;
    let radius = 1500;
    let minGap = 0.6;
    let minSpacing = 1.2;

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

    if (selectedSubcategory) params.set('subcategory', selectedSubcategory);
    if (selectedCategory) params.set('category', selectedCategory);

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

      const L = (window as any).L;

      for (const cell of cells) {
        const catColor = getCategoryColor(cell.category);
        const displayCategory = selectedSubcategory || cell.category;

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

        const gapDistance = formatDistance(cell.gap_km ?? 0);
        const hasCompetitors = cell.top_competitors.length > 0;
        const avgRating = cell.avg_competitor_rating;

        let insightHtml: string;
        if (!hasCompetitors) {
          insightHtml = `<div style="font-size:13px;font-weight:600;color:#4ade80;margin-bottom:8px;">
            No ${escapeHtml(displayCategory)} businesses found nearby!<br/>
            <span style="font-size:11px;font-weight:400;color:#86efac;">Zero competition in this area.</span>
          </div>`;
        } else {
          insightHtml = `<div style="font-size:13px;font-weight:600;color:#4ade80;margin-bottom:8px;">
            Nearest ${escapeHtml(displayCategory)} is ${gapDistance} away<br/>
            <span style="font-size:11px;font-weight:400;color:#86efac;">Gap detected - potential opportunity!</span>
          </div>`;
        }

        const demandHtml = cell.total_nearby > 20
          ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;"><strong style="color:#38bdf8;">${cell.total_nearby} businesses</strong> nearby = high foot traffic</div>`
          : cell.total_nearby > 10
            ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;"><strong style="color:#38bdf8;">${cell.total_nearby} businesses</strong> nearby = moderate activity</div>`
            : `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;"><strong style="color:#38bdf8;">${cell.total_nearby} businesses</strong> nearby = developing area</div>`;

        let qualityHtml = '';
        if (hasCompetitors && avgRating !== null) {
          if (avgRating < 3.5) {
            qualityHtml = `<div style="font-size:11px;color:#fbbf24;margin-bottom:4px;">Competitors avg <strong>${avgRating.toFixed(1)} stars</strong> - room for a better option!</div>`;
          } else if (avgRating < 4.0) {
            qualityHtml = `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Competitors avg <strong>${avgRating.toFixed(1)} stars</strong> - moderate quality</div>`;
          } else {
            qualityHtml = `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Competitors avg <strong>${avgRating.toFixed(1)} stars</strong> - strong competition</div>`;
          }
        }

        const competitorHtml = cell.top_competitors.length === 0
          ? ''
          : `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #334155;">
              <strong style="font-size:11px;">Nearest competitors:</strong>
              ${cell.top_competitors
                .map(
                  (c) =>
                    `<div style="margin:3px 0;font-size:11px;color:#cbd5e1;">
                      ${escapeHtml(c.name)} - ${ratingStars(c.rating)} (${c.review_count} reviews) &middot; ${formatDistance(c.distance_km)}
                    </div>`
                )
                .join('')}
            </div>`;

        const scoreBadgeColor = cell.score >= 60 ? '#22c55e' : cell.score >= 40 ? '#eab308' : '#94a3b8';

        rect.bindPopup(`
          <div style="min-width:280px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:2px;background:${catColor.fill};border:1px solid ${catColor.stroke};display:inline-block;"></span>
                <strong style="font-size:13px;">${escapeHtml(displayCategory)} Opportunity</strong>
              </div>
              <span style="background:${scoreBadgeColor}22;color:${scoreBadgeColor};font-weight:bold;font-size:13px;padding:2px 8px;border-radius:12px;border:1px solid ${scoreBadgeColor}44;">
                ${cell.score}/100
              </span>
            </div>
            ${insightHtml}
            ${demandHtml}
            ${qualityHtml}
            ${competitorHtml}
          </div>
        `);

        layer.addLayer(rect);

        if (L) {
          const marker = L.marker([cell.lat, cell.lng], {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:24px;height:24px;border-radius:50%;background:${scoreBadgeColor};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${cell.score}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          });
          marker.bindPopup(rect.getPopup());
          layer.addLayer(marker);
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('Opportunity grid fetch failed:', err);
    }
  }, [opportunityLayerEnabled, selectedCategory, selectedSubcategory]);

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

    fetchAndRenderOpportunities();
    map.on('moveend', scheduleRender);

    return () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      map.off('moveend', scheduleRender);
      if (opportunityAbortRef.current) opportunityAbortRef.current.abort();
      layer.clearLayers();
    };
  }, [mapReady, opportunityLayerEnabled, selectedCategory, selectedSubcategory, fetchAndRenderOpportunities]);

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
        'background:rgba(15,23,42,0.92);padding:10px 12px;border-radius:10px;font-size:11px;line-height:1.6;color:#cbd5e1;pointer-events:auto;border:1px solid rgba(51,65,85,0.5);backdrop-filter:blur(8px);';

      const displayLabel = selectedSubcategory || selectedCategory || 'All categories';

      const entries = selectedCategory
        ? [[selectedCategory, CATEGORY_COLORS[selectedCategory] ?? CATEGORY_COLORS['Services']]]
        : Object.entries(CATEGORY_COLORS);

      div.innerHTML =
        `<div style="font-weight:600;margin-bottom:4px;color:#e2e8f0;">Searching: ${escapeHtml(displayLabel)}</div>` +
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
  }, [mapReady, opportunityLayerEnabled, selectedCategory, selectedSubcategory]);

  return (
    <div
      ref={mapElementRef}
      className="w-full flex-1 rounded-xl border border-slate-800/60 bg-slate-900"
      style={{ minHeight: '400px' }}
    />
  );
}
