'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SavedPanel } from './SavedPanel';
import { BusinessFilters, CategoryInsight, SubcategoryMap, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800">
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
    </div>
  );
}

type Props = {
  filters: BusinessFilters;
  categories: string[];
  categoryInsights: CategoryInsight[];
  subcategories: SubcategoryMap;
  onFilterChange: (next: BusinessFilters) => void;
  onFlyTo: (lat: number, lng: number) => void;
  savedRefreshTrigger: number;
};

export function Dashboard({
  filters,
  categories,
  categoryInsights,
  subcategories,
  onFilterChange,
  onFlyTo,
  savedRefreshTrigger
}: Props) {
  const { user } = useAuth();
  const [zipcode, setZipcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleZipcodeSearch = async () => {
    const trimmed = zipcode.trim();
    if (!trimmed || searching) return;
    setLocationError(null);
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(trimmed)}&country=us&format=json&limit=1`
      );
      const data = await res.json();
      if (data.length === 0) {
        setLocationError('Zip code not found');
        return;
      }
      onFlyTo(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setLocationError('Lookup failed - try again');
    } finally {
      setSearching(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFlyTo(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        const msg = err.code === 1 ? 'Location access denied'
          : err.code === 3 ? 'Location request timed out'
          : 'Could not determine location';
        setLocationError(msg);
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleFindOpportunities = () => {
    onFilterChange({
      ...filters,
      opportunityLayerEnabled: true,
      showBusinessMarkers: true
    });
  };

  const currentSubcategories = filters.category ? (subcategories[filters.category] ?? []) : [];

  const opportunityLabel = filters.subcategory
    ? `Find ${filters.subcategory} Opportunities`
    : filters.category
      ? `Find ${filters.category} Opportunities`
      : 'Find Business Opportunities';

  return (
    <div className="space-y-3">
      {/* ── Find Opportunities CTA ─────────────────────────────────────── */}
      <section className="rounded-xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/80 p-4">
        <SectionHeader
          icon={<svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
          title="Opportunity Finder"
        />
        <button
          type="button"
          onClick={handleFindOpportunities}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            filters.opportunityLayerEnabled
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'bg-emerald-700/60 text-emerald-100 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-900/40'
          }`}
        >
          {filters.opportunityLayerEnabled ? `Showing: ${opportunityLabel}` : opportunityLabel}
        </button>
        {filters.opportunityLayerEnabled && (
          <>
            <p className="mt-2 text-center text-xs text-emerald-400/60">
              Green zones show market gaps where this business type is missing
            </p>
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, opportunityLayerEnabled: false })}
              className="mt-2 w-full rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
            >
              Hide Opportunity Layer
            </button>
          </>
        )}
      </section>

      {/* ── Location ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
        <SectionHeader
          icon={<svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>}
          title="Location"
        />
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Zip code"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleZipcodeSearch()}
              className="flex-1 rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
            />
            <button
              type="button"
              onClick={handleZipcodeSearch}
              disabled={searching}
              className="rounded-lg bg-slate-800 px-4 py-2 text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Go
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            {locating ? 'Locating...' : 'Use My Location'}
          </button>
          {locationError && <p className="text-xs text-rose-400">{locationError}</p>}
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
        <SectionHeader
          icon={<svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>}
          title="Filters"
        />
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Category</span>
            <select
              className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 p-2 text-slate-100 outline-none transition-colors focus:border-indigo-500/50"
              value={filters.category || ''}
              onChange={(event) => onFilterChange({ ...filters, category: event.target.value || undefined, subcategory: undefined })}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          {/* Subcategory chips */}
          {currentSubcategories.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Subcategory</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    !filters.subcategory
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  onClick={() => onFilterChange({ ...filters, subcategory: undefined })}
                >
                  All ({currentSubcategories.reduce((sum, s) => sum + Number(s.total), 0)})
                </button>
                {currentSubcategories.map((sub) => (
                  <button
                    key={sub.subcategory}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      filters.subcategory === sub.subcategory
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                    onClick={() =>
                      onFilterChange({
                        ...filters,
                        subcategory: filters.subcategory === sub.subcategory ? undefined : sub.subcategory
                      })
                    }
                  >
                    {sub.subcategory} ({sub.total})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category color legend */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Quick Select</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORY_COLORS).map(([name, colors]) => (
                <button
                  key={name}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] transition-all ${
                    !filters.category || filters.category === name
                      ? 'opacity-100'
                      : 'opacity-35 hover:opacity-70'
                  } ${filters.category === name ? 'ring-1 ring-slate-500' : ''}`}
                  style={{ background: `${colors.fill}18`, border: `1px solid ${colors.stroke}40` }}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      category: filters.category === name ? undefined : name,
                      subcategory: undefined
                    })
                  }
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: colors.fill, border: `1px solid ${colors.stroke}` }}
                  />
                  {name}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2 text-slate-300">
            <input
              type="checkbox"
              checked={filters.showBusinessMarkers}
              onChange={(event) => onFilterChange({ ...filters, showBusinessMarkers: event.target.checked })}
              className="rounded border-slate-600"
            />
            <span className="text-xs">Show Business Markers</span>
          </label>
        </div>
      </section>

      {/* ── Saved Businesses (logged in only) ─────────────────────────── */}
      {user && (
        <section className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
          <SectionHeader
            icon={<svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>}
            title="Saved Businesses"
          />
          <SavedPanel onFlyTo={onFlyTo} refreshTrigger={savedRefreshTrigger} />
        </section>
      )}

      {/* ── Category Insights ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
        <SectionHeader
          icon={<svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          title="Category Insights"
        />
        <ul className="space-y-1.5">
          {categoryInsights.map((insight) => {
            const avgRating = Number(insight.avg_rating || 0);
            const avgReviews = Number(insight.avg_reviews || 0);
            const isOpportunity = avgReviews > 100 && avgRating < 3.8;
            const catColor = getCategoryColor(insight.category);
            const isSelected = filters.category === insight.category;

            return (
              <li
                key={insight.category}
                className={`cursor-pointer rounded-lg p-2.5 transition-all ${
                  isOpportunity
                    ? 'bg-amber-900/20 hover:bg-amber-900/40'
                    : 'bg-slate-800/40 hover:bg-slate-800/70'
                } ${isSelected ? 'ring-1 ring-indigo-500/50' : ''}`}
                style={{ borderLeft: `3px solid ${catColor.stroke}` }}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    category: isSelected ? undefined : insight.category,
                    subcategory: undefined
                  })
                }
              >
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: catColor.fill, border: `1px solid ${catColor.stroke}` }}
                    />
                    <span className="text-sm font-medium text-slate-200">{insight.category}</span>
                  </div>
                  <span className="text-sm tabular-nums text-slate-400">{insight.total}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {avgRating.toFixed(1)} avg rating &middot; {avgReviews.toFixed(0)} avg reviews
                  {isOpportunity && <span className="ml-2 font-medium text-amber-400">Weak - opportunity!</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
