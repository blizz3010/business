'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Business, BusinessFilters, CategoryInsight } from '@/lib/types';

const MapPanel = dynamic(() => import('@/components/MapPanel').then((mod) => mod.MapPanel), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-slate-900 lg:h-[460px]" />
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const DEFAULT_FILTERS: BusinessFilters = {
  minRating: undefined,
  minReviews: undefined,
  category: undefined,
  showBusinessMarkers: true,
  opportunityLayerEnabled: true
};

type ViewportBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (payload?.error && payload?.details) return `${payload.error}: ${payload.details}`;
    if (payload?.error) return String(payload.error);
    if (payload?.message) return String(payload.message);
  } catch {
    // no-op: fallback to status text below
  }

  return `Request failed (${response.status} ${response.statusText})`;
}

function hasValidBounds(bounds: ViewportBounds | null): bounds is ViewportBounds {
  if (!bounds) return false;
  const { south, north, west, east } = bounds;
  return (
    Number.isFinite(south) &&
    Number.isFinite(north) &&
    Number.isFinite(west) &&
    Number.isFinite(east) &&
    south < north &&
    west < east
  );
}

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export default function Home() {
  const [filters, setFilters] = useState<BusinessFilters>(DEFAULT_FILTERS);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState<Business[]>([]);
  const [opportunities, setOpportunities] = useState<Business[]>([]);
  const [categories, setCategories] = useState<CategoryInsight[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const businessRequestAbortRef = useRef<AbortController | null>(null);

  const categoryOptions = useMemo(() => categories.map((item) => item.category), [categories]);
  const isMisconfiguredProdApiBase =
    typeof window !== 'undefined' && !isLocalhostHost(window.location.hostname) && API_BASE.includes('localhost');

  useEffect(() => {
    const fetchStaticData = async () => {
      if (isMisconfiguredProdApiBase) {
        setError(
          'Frontend is using a localhost API URL in production. Set NEXT_PUBLIC_API_BASE_URL (or NEXT_PUBLIC_API_URL) to your deployed backend URL.'
        );
        return;
      }

      try {
        const [categoryResponse, opportunityResponse] = await Promise.all([
          fetch(`${API_BASE}/api/categories`),
          fetch(`${API_BASE}/api/priority-targets`)
        ]);

        if (!categoryResponse.ok || !opportunityResponse.ok) {
          throw new Error('Failed to load one or more data sources.');
        }

        const [categoryData, opportunityData] = await Promise.all([categoryResponse.json(), opportunityResponse.json()]);

        setCategories(categoryData);
        setOpportunities(opportunityData.sort((a: Business, b: Business) => b.opportunity_score - a.opportunity_score));
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load analytics data. Verify API URL and backend CORS settings.'
        );
      }
    };

    fetchStaticData();
  }, [isMisconfiguredProdApiBase]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!hasValidBounds(bounds)) return;

      if (businessRequestAbortRef.current) {
        businessRequestAbortRef.current.abort();
      }
      const controller = new AbortController();
      businessRequestAbortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const baseParams = new URLSearchParams({
          south: String(bounds.south),
          north: String(bounds.north),
          west: String(bounds.west),
          east: String(bounds.east)
        });
        if (filters.minRating !== undefined) baseParams.set('minRating', String(filters.minRating));
        if (filters.minReviews !== undefined) baseParams.set('minReviews', String(filters.minReviews));
        const response = await fetch(`${API_BASE}/api/businesses?${baseParams.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const rows: Business[] = await response.json();

        setAllBusinesses(rows);
        setSelectedBusinesses(
          filters.category ? rows.filter((business) => business.normalized_category === filters.category) : rows
        );
      } catch (fetchError) {
        if ((fetchError as Error)?.name === 'AbortError') return;
        setAllBusinesses([]);
        setSelectedBusinesses([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Network error while loading businesses. Verify API URL and backend CORS settings.'
        );
      } finally {
        if (businessRequestAbortRef.current === controller) {
          setLoading(false);
        }
      }
    };

    fetchBusinesses();
    return () => {
      if (businessRequestAbortRef.current) {
        businessRequestAbortRef.current.abort();
      }
    };
  }, [bounds, filters.category, filters.minRating, filters.minReviews]);

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:items-start">
      <section className="space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Business Opportunity Intelligence</h1>
          <span className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-300">
            {loading ? 'Loading...' : `${selectedBusinesses.length} businesses`}
          </span>
        </div>
        {error ? <p className="rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-100">{error}</p> : null}
        <MapPanel
          businesses={selectedBusinesses}
          allBusinesses={allBusinesses}
          selectedCategory={filters.category}
          showBusinessMarkers={filters.showBusinessMarkers}
          opportunityLayerEnabled={filters.opportunityLayerEnabled}
          selectedBusiness={selectedBusiness}
          onBoundsChange={setBounds}
        />
      </section>

      <aside>
        <Dashboard
          filters={filters}
          categories={categoryOptions}
          opportunities={opportunities}
          categoryInsights={categories}
          onFilterChange={setFilters}
          onSelectBusiness={setSelectedBusiness}
        />
      </aside>
    </main>
  );
}
