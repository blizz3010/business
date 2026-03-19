import { Business, BusinessFilters, CategoryInsight } from '@/lib/types';

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
  const top50 = opportunities.slice(0, 50);

  return (
    <div className="space-y-4">
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
              <option value="">All categories</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

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
              checked={filters.opportunitiesOnly}
              onChange={(event) => onFilterChange({ ...filters, opportunitiesOnly: event.target.checked })}
            />
            Show Opportunities Only
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Top 50 Opportunities</h3>
        <ul className="mt-2 max-h-[320px] space-y-2 overflow-auto text-sm">
          {top50.map((business) => (
            <li key={`${business.name}-${business.lat}-${business.lng}`}>
              <button
                type="button"
                className="w-full rounded bg-slate-800 p-2 text-left hover:bg-slate-700"
                onClick={() => onSelectBusiness(business)}
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate">{business.name}</span>
                  <span className="font-semibold text-rose-300">{Math.round(business.opportunity_score)}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {business.normalized_category} · Rating {business.rating ?? 'N/A'} · {business.review_count} reviews
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Category Insights</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {categoryInsights.map((insight) => {
            const avgRating = Number(insight.avg_rating || 0);
            const avgReviews = Number(insight.avg_reviews || 0);
            const isOpportunity = avgReviews > 100 && avgRating < 3.8;

            return (
              <li key={insight.category} className={`rounded p-2 ${isOpportunity ? 'bg-amber-900/40' : 'bg-slate-800'}`}>
                <div className="flex justify-between">
                  <span>{insight.category}</span>
                  <span>{insight.total}</span>
                </div>
                <p className="text-xs text-slate-300">
                  Avg rating {avgRating.toFixed(2)} · Avg reviews {avgReviews.toFixed(0)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
