'use client';

import { useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { MapPanel } from '@/components/MapPanel';
import { AnalyzeResponse } from '@/lib/types';

const DEFAULT_TILE = {
  lat: 28.5383,
  lng: -81.3792,
  radius: 500
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/analyze-tile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_TILE)
      });
      const data = (await response.json()) as AnalyzeResponse;
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">StreetScope AI · Orlando Intelligence</h1>
          <button
            onClick={analyze}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Analyzing...' : 'Analyze Tile'}
          </button>
        </div>
        <MapPanel data={result} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
      </section>
      <aside>
        <Dashboard data={result} />
      </aside>
    </main>
  );
}
