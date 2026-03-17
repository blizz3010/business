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
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/analyze-tile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_TILE),
        signal: controller.signal
      });

      const data = await response.json();

      if (!response.ok) {
        setResult(null);
        setError(data?.details || data?.error || 'Analysis failed. Check backend environment variables and URL.');
        return;
      }

      const normalized = normalizeAnalyzeResponse(data);
      if (!normalized) {
        setResult(null);
        setError('Unexpected response shape from API.');
        return;
      }

      setResult(normalized);
    } catch (err) {
      setResult(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Verify NEXT_PUBLIC_API_BASE_URL and backend health.');
      } else {
        setError('Network error while analyzing tile. Verify API URL and CORS settings.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">StreetScope AI · Orlando Intelligence</h1>
          <button
            onClick={analyze}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Analyzing...' : 'Analyze Tile'}
          </button>
        </div>
        {error ? (
          <div className="mb-3 rounded-lg border border-rose-700 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">{error}</div>
        ) : null}
        <MapPanel data={result} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
      </section>
      <aside>
        <Dashboard data={result} />
      </aside>
    </main>
  );
}

function normalizeAnalyzeResponse(payload: unknown): AnalyzeResponse | null {
  if (!payload || typeof payload !== 'object') return null;

  const maybe = payload as Partial<AnalyzeResponse>;
  if (!Array.isArray(maybe.businesses) || !Array.isArray(maybe.opportunities) || !Array.isArray(maybe.weak_competitors)) {
    return null;
  }

  return {
    businesses: maybe.businesses,
    opportunities: maybe.opportunities,
    weak_competitors: maybe.weak_competitors,
    category_counts: maybe.category_counts && typeof maybe.category_counts === 'object' ? maybe.category_counts : {}
  };
}
