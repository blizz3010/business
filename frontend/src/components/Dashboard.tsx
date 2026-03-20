'use client';

import { useState } from 'react';
import { BusinessFilters, CategoryInsight, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';

type Props = {
  filters: BusinessFilters;
  categories: string[];
  categoryInsights: CategoryInsight[];
  onFilterChange: (next: BusinessFilters) => void;
  onFlyTo: (lat: number, lng: number) => void;
};

export function Dashboard({
  filters,
  categories,
  categoryInsights,
  onFilterChange,
  onFlyTo
}: Props) {
  const [zipcode, setZipcode] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleZipcodeSearch = async () => {
    const trimmed = zipcode.trim();
    if (!trimmed) return;
    setLocationError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(trimmed)}&country=us&format=json&limit=1`,
        { headers: { 'User-Agent': 'StreetScopeAI/1.0' } }
      );
      const data = await res.json();
      if (data.length === 0) {
        setLocationError('Zip code not found');
        return;
      }
      onFlyTo(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setLocationError('Lookup failed — try again');
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
      () => {
        setLocationError('Location access denied');
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
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
              className="rounded bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-500"
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
              onChange={(event) => onFilterChange({ ...filters, category: event.target.value || undefined })}
            >
              <option value="">All categories (show all opportunities)</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

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
                    category: filters.category === name ? undefined : name
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
              checked={filters.opportunityLayerEnabled}
              onChange={(event) => onFilterChange({ ...filters, opportunityLayerEnabled: event.target.checked })}
            />
            Show Opportunity Layer
          </label>

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
                    category: isSelected ? undefined : insight.category
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
                  {isOpportunity && <span className="ml-2 text-amber-300">⚠ Weak category</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
