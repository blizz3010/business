'use client';

import { useState } from 'react';
import { BusinessFilters, CategoryInsight, SubcategoryMap, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';

type Props = {
  filters: BusinessFilters;
  categories: string[];
  categoryInsights: CategoryInsight[];
  subcategories: SubcategoryMap;
  searchResultCount: number | null;
  onFilterChange: (next: BusinessFilters) => void;
  onFlyTo: (lat: number, lng: number) => void;
  onSearch: (query: string) => void;
};

export function Dashboard({
  filters,
  categories,
  categoryInsights,
  subcategories,
  searchResultCount,
  onFilterChange,
  onFlyTo,
  onSearch
}: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  const clearSearch = () => {
    setSearchInput('');
    onSearch('');
  };

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
      setLocationError('Lookup failed — try again');
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

  // Get subcategories for the currently selected category
  const currentSubcategories = filters.category ? (subcategories[filters.category] ?? []) : [];

  const opportunityLabel = filters.subcategory
    ? `Find ${filters.subcategory} Opportunities`
    : filters.category
      ? `Find ${filters.category} Opportunities`
      : 'Find Business Opportunities';

  return (
    <div className="space-y-4">
      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Search Businesses</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search (e.g., McDonald's, daycare, car wash...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 rounded bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
            >
              Search
            </button>
          </div>
          {filters.searchQuery && (
            <div className="flex items-center justify-between rounded bg-blue-900/30 px-3 py-2">
              <span className="text-blue-200">
                {searchResultCount !== null
                  ? `Found ${searchResultCount} results for "${filters.searchQuery}"`
                  : `Searching for "${filters.searchQuery}"...`}
              </span>
              <button
                type="button"
                onClick={clearSearch}
                className="ml-2 text-blue-400 hover:text-blue-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Find Opportunities CTA ─────────────────────────────────────── */}
      <section className="rounded-xl border border-emerald-800/50 bg-gradient-to-r from-emerald-950/60 to-slate-900 p-4">
        <button
          type="button"
          onClick={handleFindOpportunities}
          className={`w-full rounded-lg px-4 py-3 text-base font-semibold transition-all ${
            filters.opportunityLayerEnabled
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
              : 'bg-emerald-700/80 text-emerald-100 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-900/50'
          }`}
        >
          {filters.opportunityLayerEnabled ? `Showing: ${opportunityLabel}` : opportunityLabel}
        </button>
        {filters.opportunityLayerEnabled && (
          <p className="mt-2 text-center text-xs text-emerald-300/70">
            Green zones on the map show gaps where this business type is missing
          </p>
        )}
        {filters.opportunityLayerEnabled && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, opportunityLayerEnabled: false })}
            className="mt-2 w-full rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Hide Opportunity Layer
          </button>
        )}
      </section>

      {/* ── Location ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Location</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter zip code"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleZipcodeSearch()}
              className="flex-1 rounded bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-slate-600"
            />
            <button
              type="button"
              onClick={handleZipcodeSearch}
              disabled={searching}
              className="rounded bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              Go
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="w-full rounded bg-slate-800 px-3 py-2 text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {locating ? 'Locating...' : 'Use My Location'}
          </button>
          {locationError && <p className="text-xs text-rose-400">{locationError}</p>}
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="mt-3 space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-slate-300">Category</span>
            <select
              className="w-full rounded bg-slate-800 p-2"
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
              <span className="mb-1 block text-slate-300">Subcategory</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs transition-all ${
                    !filters.subcategory
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  onClick={() => onFilterChange({ ...filters, subcategory: undefined })}
                >
                  All ({currentSubcategories.reduce((sum, s) => sum + Number(s.total), 0)})
                </button>
                {currentSubcategories.map((sub) => (
                  <button
                    key={sub.subcategory}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs transition-all ${
                      filters.subcategory === sub.subcategory
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

          {/* Category color legend (compact) */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_COLORS).map(([name, colors]) => (
              <button
                key={name}
                type="button"
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs transition-opacity ${
                  !filters.category || filters.category === name ? 'opacity-100' : 'opacity-40'
                }`}
                style={{ background: `${colors.fill}22`, border: `1px solid ${colors.stroke}55` }}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    category: filters.category === name ? undefined : name,
                    subcategory: undefined
                  })
                }
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: colors.fill, border: `1px solid ${colors.stroke}` }}
                />
                {name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-slate-200">
            <input
              type="checkbox"
              checked={filters.showBusinessMarkers}
              onChange={(event) => onFilterChange({ ...filters, showBusinessMarkers: event.target.checked })}
            />
            Show Business Markers
          </label>
        </div>
      </section>

      {/* ── Category Insights ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Category Insights</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {categoryInsights.map((insight) => {
            const avgRating = Number(insight.avg_rating || 0);
            const avgReviews = Number(insight.avg_reviews || 0);
            const isOpportunity = avgReviews > 100 && avgRating < 3.8;
            const catColor = getCategoryColor(insight.category);

            const isSelected = filters.category === insight.category;

            return (
              <li
                key={insight.category}
                className={`cursor-pointer rounded p-2 transition-colors ${isOpportunity ? 'bg-amber-900/40 hover:bg-amber-900/60' : 'bg-slate-800 hover:bg-slate-700'} ${isSelected ? 'ring-1 ring-slate-500' : ''}`}
                style={{
                  borderLeft: `3px solid ${catColor.stroke}`
                }}
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
                    <span>{insight.category}</span>
                  </div>
                  <span>{insight.total}</span>
                </div>
                <p className="text-xs text-slate-300">
                  Avg rating {avgRating.toFixed(2)} · Avg reviews {avgReviews.toFixed(0)}
                  {isOpportunity && <span className="ml-2 text-amber-300">Weak category - opportunity!</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
