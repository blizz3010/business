import { Business, BusinessFilters, CategoryInsight, getCategoryColor, CATEGORY_COLORS } from '@/lib/types';

type Props = {
  filters: BusinessFilters;
  categories: string[];
  opportunities: Business[];
  categoryInsights: CategoryInsight[];
  onFilterChange: (next: BusinessFilters) => void;
  onSelectBusiness: (business: Business) => void;
};

export function Dashboard({
  filters,
  categories,
  opportunities,
  categoryInsights,
  onFilterChange,
  onSelectBusiness
}: Props) {
  const top50PriorityTargets = opportunities.slice(0, 50);

  return (
    <div className="space-y-4">
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

          <label className="block">
            <span className="mb-1 block text-slate-300">Minimum rating</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="w-full rounded bg-slate-800 p-2"
              value={filters.minRating ?? ''}
              onChange={(event) =>
                onFilterChange({
                  ...filters,
                  minRating: event.target.value === '' ? undefined : Number(event.target.value)
                })
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-slate-300">Minimum review count</span>
            <input
              type="number"
              min={0}
              step={10}
              className="w-full rounded bg-slate-800 p-2"
              value={filters.minReviews ?? ''}
              onChange={(event) =>
                onFilterChange({
                  ...filters,
                  minReviews: event.target.value === '' ? undefined : Number(event.target.value)
                })
              }
            />
          </label>

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

      {/* ── Priority Targets ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Top 50 Priority Targets</h3>
        <p className="mt-1 text-xs text-slate-400">
          Weak-rated businesses with high review counts — potential opportunities to outperform
        </p>
        <ul className="mt-2 max-h-[320px] space-y-2 overflow-auto text-sm">
          {top50PriorityTargets.map((business) => {
            const catColor = getCategoryColor(business.normalized_category);
            return (
              <li key={`${business.name}-${business.lat}-${business.lng}`}>
                <button
                  type="button"
                  className="w-full rounded bg-slate-800 p-2 text-left hover:bg-slate-700"
                  onClick={() => onSelectBusiness(business)}
                >
                  <div className="flex justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                        style={{ background: catColor.fill, border: `1px solid ${catColor.stroke}` }}
                      />
                      <span className="truncate">{business.name}</span>
                    </div>
                    <span className="font-semibold text-rose-300">{Math.round(business.opportunity_score)}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {business.normalized_category} · Rating {business.rating ?? 'N/A'} · {business.review_count} reviews
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
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

            return (
              <li
                key={insight.category}
                className={`rounded p-2 ${isOpportunity ? 'bg-amber-900/40' : 'bg-slate-800'}`}
                style={{
                  borderLeft: `3px solid ${catColor.stroke}`
                }}
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
