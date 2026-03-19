export default function Loading() {
  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:items-start">
      <section className="space-y-3 lg:col-span-2">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
        <div className="h-[420px] animate-pulse rounded-xl bg-slate-900 lg:h-[460px]" />
      </section>
      <aside className="space-y-4">
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
        <div className="h-72 animate-pulse rounded-xl bg-slate-900" />
      </aside>
    </main>
  );
}
