'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled UI error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-xl text-center text-slate-300">
        The dashboard hit an unexpected issue. Please retry. If this keeps happening, refresh the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-500"
      >
        Try again
      </button>
    </main>
  );
}
