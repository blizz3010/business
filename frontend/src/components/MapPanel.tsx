'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Business } from '@/lib/types';

const ORLANDO_CENTER: [number, number] = [28.5383, -81.3792];
const OPPORTUNITY_ENABLED = true;
const MAX_OPPORTUNITY_CELLS = 40;
const MIN_DEMAND_COUNT = 4;
const MIN_OPPORTUNITY_SCORE = 45;
const SPATIAL_BUCKET_SIZE_KM = 0.6;

type Props = {
  businesses: Business[];
  allBusinesses: Business[];
  selectedCategory?: string;
  showBusinessMarkers: boolean;
  opportunityLayerEnabled?: boolean;
  selectedBusiness?: Business | null;
  onBoundsChange?: (bounds: { south: number; north: number; west: number; east: number }) => void;
};

type LeafletRuntime = {
  map: any;
  tileLayer: any;
  markerClusterGroup: any;
  layerGroup: any;
  rectangle: any;
  circleMarker: any;
};

type SpatialEntry = { business: Business; latBucket: number; lngBucket: number };

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

function buildSpatialBuckets(input: Business[]) {
  const buckets = new Map<string, SpatialEntry[]>();

  input.forEach((business) => {
    const latBucket = Math.floor(business.lat / (SPATIAL_BUCKET_SIZE_KM / 111.32));
    const lngBucket = Math.floor(
      business.lng / (SPATIAL_BUCKET_SIZE_KM / (111.32 * Math.max(Math.cos((business.lat * Math.PI) / 180), 0.2)))
    );
    const key = `${latBucket}:${lngBucket}`;
    const existing = buckets.get(key);
    const entry: SpatialEntry = { business, latBucket, lngBucket };
    if (existing) {
      existing.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  });

  return buckets;
}

function nearbyFromBuckets(
  buckets: Map<string, SpatialEntry[]>,
  centerLat: number,
  centerLng: number,
  radiusKm: number
): Array<{ business: Business; distance: number }> {
  const latBucket = Math.floor(centerLat / (SPATIAL_BUCKET_SIZE_KM / 111.32));
  const lngBucket = Math.floor(
    centerLng / (SPATIAL_BUCKET_SIZE_KM / (111.32 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2)))
  );
  const nearby: Array<{ business: Business; distance: number }> = [];

  for (let latOffset = -2; latOffset <= 2; latOffset += 1) {
    for (let lngOffset = -2; lngOffset <= 2; lngOffset += 1) {
      const key = `${latBucket + latOffset}:${lngBucket + lngOffset}`;
      const entries = buckets.get(key);
      if (!entries?.length) continue;

      entries.forEach(({ business }) => {
        const distance = distanceKm(centerLat, centerLng, business.lat, business.lng);
        if (distance <= radiusKm) {
          nearby.push({ business, distance });
        }
      });
    }
  }

  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

export function MapPanel({
  businesses,
  allBusinesses,
  selectedCategory,
  showBusinessMarkers,
  opportunityLayerEnabled = false,
  selectedBusiness,
  onBoundsChange
}: Props) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterLayerRef = useRef<any>(null);
  const opportunityLayerRef = useRef<any>(null);
  const leafletRef = useRef<LeafletRuntime | null>(null);
  const redrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const allBusinessesBuckets = useMemo(() => buildSpatialBuckets(allBusinesses), [allBusinesses]);
  const selectedBusinessesBuckets = useMemo(() => buildSpatialBuckets(businesses), [businesses]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mapElementRef.current) return;

      const [leafletModule] = await Promise.all([
        import('leaflet'),
        import('leaflet.markercluster/dist/leaflet.markercluster.js')
      ]);
      const L = leafletModule.default;
      if (!mounted || !L || mapRef.current) return;

      leafletRef.current = {
        map: L.map,
        tileLayer: L.tileLayer,
        markerClusterGroup: L.markerClusterGroup,
        layerGroup: L.layerGroup,
        rectangle: L.rectangle,
        circleMarker: L.circleMarker
      };

      const map = L.map(mapElementRef.current).setView(ORLANDO_CENTER, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
      clusterLayerRef.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
      opportunityLayerRef.current = L.layerGroup();
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
  }, [onBoundsChange]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapElementRef.current) return;

    const map = mapRef.current;
    const element = mapElementRef.current;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapReady]);

  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !clusterLayerRef.current) return;

    const { circleMarker } = leafletRef.current;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    clusterLayer.clearLayers();

    businesses.forEach((business) => {
      const marker = circleMarker([business.lat, business.lng], {
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
    if (businesses.length > 0 && showBusinessMarkers) map.addLayer(clusterLayer);
  }, [businesses, showBusinessMarkers]);

  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !clusterLayerRef.current) return;
    const map = mapRef.current;
    const clusterLayer = clusterLayerRef.current;
    if (map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if (showBusinessMarkers) map.addLayer(clusterLayer);
  }, [showBusinessMarkers]);

  useEffect(() => {
    if (!leafletRef.current || !mapRef.current || !opportunityLayerRef.current || !OPPORTUNITY_ENABLED) return;

    const map = mapRef.current;
    const layer = opportunityLayerRef.current;

    if (map.hasLayer(layer)) map.removeLayer(layer);
    if (!opportunityLayerEnabled) return;
    map.addLayer(layer);

    const renderOpportunityGrid = () => {
      if (!mapRef.current || !opportunityLayerRef.current || !leafletRef.current) return;
      const { rectangle } = leafletRef.current;

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

          const nearbyBusinesses = nearbyFromBuckets(allBusinessesBuckets, cellLat, cellLng, radiusKm);
          if (nearbyBusinesses.length < MIN_DEMAND_COUNT) continue;

          const nearbyCompetitors = nearbyFromBuckets(selectedBusinessesBuckets, cellLat, cellLng, radiusKm);
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

        const marker = rectangle(
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
      redrawTimerRef.current = setTimeout(renderOpportunityGrid, 250);
    };

    renderOpportunityGrid();
    map.on('moveend', scheduleRender);
    map.on('zoomend', scheduleRender);

    return () => {
      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      map.off('moveend', scheduleRender);
      map.off('zoomend', scheduleRender);
      layer.clearLayers();
    };
  }, [selectedCategory, opportunityLayerEnabled, allBusinessesBuckets, selectedBusinessesBuckets]);

  useEffect(() => {
    if (!selectedBusiness || !mapRef.current) return;
    mapRef.current.flyTo([selectedBusiness.lat, selectedBusiness.lng], Math.max(mapRef.current.getZoom(), 14), {
      duration: 0.6
    });
  }, [selectedBusiness]);

  return <div ref={mapElementRef} className="h-[420px] w-full rounded-xl border border-slate-800 bg-slate-900 lg:h-[460px]" />;
}
