import { AnalyzeResponse } from '@/lib/types';

type Props = {
  data: AnalyzeResponse | null;
};

export function Dashboard({ data }: Props) {
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">StreetScope AI</h2>
        <p className="mt-2 text-sm text-slate-400">Run tile analysis to see Orlando market gaps.</p>
      </div>
    );
  }

  const sortedCategories = Object.entries(data.category_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Top Opportunities</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.opportunities.slice(0, 5).map((op) => (
            <li key={`${op.type}-${op.category}`} className="rounded bg-slate-800 p-2">
              <div className="flex justify-between">
                <span>{op.category}</span>
                <span className="font-semibold text-emerald-400">{op.score}</span>
              </div>
              <p className="text-xs text-slate-400">{op.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Market Gaps</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {sortedCategories.map(([category, count]) => (
            <li key={category} className="flex justify-between border-b border-slate-800 py-1">
              <span>{category}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-md font-semibold">Weak Competitors</h3>
        <p className="mt-2 text-sm text-slate-300">{data.weak_competitors.length} businesses with rating below 3.5.</p>
      </section>
    </div>
  );
}
