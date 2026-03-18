'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Business, BusinessFilters, CategoryInsight, HeatmapPoint, MapBounds } from '@/lib/types';

const MapPanel = dynamic(() => import('@/components/MapPanel').then((mod) => mod.MapPanel), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-xl bg-slate-900" />
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'https://streetscope-backend-production.up.railway.app';

const DEFAULT_FILTERS: BusinessFilters = {
  minRating: undefined,
  minReviews: undefined,
  category: undefined,
  opportunitiesOnly: false
};

export default function Home() {
  const [filters, setFilters] = useState<BusinessFilters>(DEFAULT_FILTERS);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [opportunities, setOpportunities] = useState<Business[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [categories, setCategories] = useState<CategoryInsight[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => categories.map((item) => item.category), [categories]);

  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [heatmapResponse, categoryResponse, opportunityResponse] = await Promise.all([
          fetch(`${API_BASE}/api/heatmap`),
          fetch(`${API_BASE}/api/categories`),
          fetch(`${API_BASE}/api/opportunities`)
        ]);

        if (!heatmapResponse.ok || !categoryResponse.ok || !opportunityResponse.ok) {
          throw new Error('Failed to load one or more data sources.');
        }

        const [heatmapData, categoryData, opportunityData] = await Promise.all([
          heatmapResponse.json(),
          categoryResponse.json(),
          opportunityResponse.json()
        ]);

        setHeatmap(heatmapData);
        setCategories(categoryData);
        setOpportunities(opportunityData.sort((a: Business, b: Business) => b.opportunity_score - a.opportunity_score));
      } catch (fetchError) {
        console.error('Failed to fetch static analytics data', fetchError);
        setError('Unable to load analytics data. Please verify backend connectivity.');
      }
    };

    fetchStaticData();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const fetchBusinesses = async () => {
        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams();
          if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
          if (filters.minReviews !== undefined) params.set('minReviews', String(filters.minReviews));
          if (filters.category) params.set('category', filters.category);

          if (bounds) {
            params.set('minLat', String(bounds.minLat));
            params.set('maxLat', String(bounds.maxLat));
            params.set('minLng', String(bounds.minLng));
            params.set('maxLng', String(bounds.maxLng));
          }

          const response = await fetch(`${API_BASE}/api/businesses?${params.toString()}`);
          if (!response.ok) {
            throw new Error('Failed to fetch business records.');
          }

          let rows: Business[] = await response.json();

          if (filters.opportunitiesOnly) {
            rows = rows.filter((biz) => (biz.rating ?? 0) < 3.8 && biz.review_count > 100);
          }

          setBusinesses(rows);
        } catch (fetchError) {
          console.error('Failed to fetch business records', fetchError);
          setBusinesses([]);
          setError('Failed to fetch business records. Please check API URL and CORS settings.');
        } finally {
          setLoading(false);
        }
      };

      fetchBusinesses();
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters, bounds]);

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Business Opportunity Intelligence</h1>
          <span className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-300">
            {loading ? 'Loading...' : `${businesses.length} businesses`}
          </span>
        </div>
        {error ? <p className="rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-100">{error}</p> : null}
        <MapPanel
          businesses={businesses}
          heatmap={heatmap}
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
