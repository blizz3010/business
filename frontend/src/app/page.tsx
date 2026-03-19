'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Business, BusinessFilters, CategoryInsight } from '@/lib/types';

const MapPanel = dynamic(() => import('@/components/MapPanel').then((mod) => mod.MapPanel), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-xl bg-slate-900" />
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const DEFAULT_FILTERS: BusinessFilters = {
  minRating: undefined,
  minReviews: undefined,
  category: undefined,
  opportunitiesOnly: false,
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

function hasValidBounds(
  bounds: ViewportBounds | null
): bounds is ViewportBounds {
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

  const categoryOptions = useMemo(() => categories.map((item) => item.category), [categories]);

  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [categoryResponse, opportunityResponse] = await Promise.all([
          fetch(`${API_BASE}/api/categories`),
          fetch(`${API_BASE}/api/opportunities`)
        ]);

        if (!categoryResponse.ok || !opportunityResponse.ok) {
          throw new Error('Failed to load one or more data sources.');
        }

        const [categoryData, opportunityData] = await Promise.all([categoryResponse.json(), opportunityResponse.json()]);

        setCategories(categoryData);
        setOpportunities(opportunityData.sort((a: Business, b: Business) => b.opportunity_score - a.opportunity_score));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load analytics data.');
      }
    };

    fetchStaticData();
  }, []);

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!hasValidBounds(bounds)) return;
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

        if (!filters.category) {
          const response = await fetch(`${API_BASE}/api/businesses?${baseParams.toString()}`);
          if (!response.ok) throw new Error(await readErrorMessage(response));
          const rows: Business[] = await response.json();
          setAllBusinesses(rows);
          setSelectedBusinesses(rows);
          return;
        }

        const selectedParams = new URLSearchParams(baseParams.toString());
        selectedParams.set('category', filters.category);

        const [allResponse, selectedResponse] = await Promise.all([
          fetch(`${API_BASE}/api/businesses?${baseParams.toString()}`),
          fetch(`${API_BASE}/api/businesses?${selectedParams.toString()}`)
        ]);
        if (!allResponse.ok) throw new Error(await readErrorMessage(allResponse));
        if (!selectedResponse.ok) throw new Error(await readErrorMessage(selectedResponse));

        const [allRows, selectedRows]: [Business[], Business[]] = await Promise.all([allResponse.json(), selectedResponse.json()]);
        setAllBusinesses(allRows);
        setSelectedBusinesses(selectedRows);
      } catch (fetchError) {
        setAllBusinesses([]);
        setSelectedBusinesses([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Network error while loading businesses.');
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [bounds, filters.category, filters.minRating, filters.minReviews]);

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3">
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
          opportunitiesOnly={filters.opportunitiesOnly}
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
