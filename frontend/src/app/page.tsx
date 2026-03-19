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
  opportunitiesOnly: false
};

export default function Home() {
  const [filters, setFilters] = useState<BusinessFilters>(DEFAULT_FILTERS);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [opportunities, setOpportunities] = useState<Business[]>([]);
  const [categories, setCategories] = useState<CategoryInsight[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => categories.map((item) => item.category), [categories]);
  const businesses = useMemo(() => {
    if (!filters.category) return allBusinesses;
    return allBusinesses.filter((biz) => biz.normalized_category === filters.category || biz.category === filters.category);
  }, [allBusinesses, filters.category]);

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
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
        if (filters.minReviews !== undefined) params.set('minReviews', String(filters.minReviews));

        const response = await fetch(`${API_BASE}/api/businesses?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch business records.');
        }

        const rows: Business[] = await response.json();
        setAllBusinesses(rows);
      } catch (fetchError) {
        setAllBusinesses([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Network error while loading businesses.');
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [filters.minRating, filters.minReviews]);

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
          allBusinesses={allBusinesses}
          selectedCategory={filters.category}
          opportunitiesOnly={filters.opportunitiesOnly}
          selectedBusiness={selectedBusiness}
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
