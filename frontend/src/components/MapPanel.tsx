'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AnalyzeResponse } from '@/lib/types';

declare global {
  interface Window {
    google: typeof google;
  }
}

type Props = {
  data: AnalyzeResponse | null;
  apiKey?: string;
};

const ORLANDO_CENTER = { lat: 28.5383, lng: -81.3792 };

export function MapPanel({ data, apiKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map>();

  const markers = useMemo(() => {
    if (!data) return [];

    const businessMarkers = data.businesses.map((biz) => ({
      position: { lat: biz.lat, lng: biz.lng },
      color: '#22c55e',
      title: `${biz.name} (${biz.category})`
    }));

    const weakMarkers = data.weak_competitors.map((biz) => ({
      position: { lat: biz.lat, lng: biz.lng },
      color: '#facc15',
      title: `Weak competitor: ${biz.name}`
    }));

    const opportunityMarkers = data.opportunities.slice(0, 5).map((op, index) => ({
      position: {
        lat: ORLANDO_CENTER.lat + (index * 0.01 - 0.02),
        lng: ORLANDO_CENTER.lng + (index * 0.01 - 0.02)
      },
      color: '#ef4444',
      title: `Opportunity: ${op.category}`
    }));

    return [...businessMarkers, ...weakMarkers, ...opportunityMarkers];
  }, [data]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    const ensureMap = () => {
      if (!window.google?.maps) return;
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current!, {
        center: ORLANDO_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false
      });
    };

    if (window.google?.maps) {
      ensureMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = ensureMap;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    markers.forEach((marker) => {
      new window.google.maps.Marker({
        position: marker.position,
        map: mapInstanceRef.current,
        title: marker.title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: marker.color,
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#111827'
        }
      });
    });
  }, [markers]);

  return (
    <div className="h-full min-h-[500px] rounded-xl border border-slate-800 bg-slate-900">
      {apiKey ? (
        <div ref={mapRef} className="h-full w-full rounded-xl" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to render map.
        </div>
      )}
    </div>
  );
}
