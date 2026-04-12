'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCategoryColor } from '@/lib/types';
import { API_BASE } from '@/lib/config';

type SavedBusiness = {
  id: number;
  place_id: string;
  business_name: string;
  notes: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  review_count: number | null;
  normalized_category: string | null;
  subcategory: string | null;
  address: string | null;
};

type Props = {
  onFlyTo: (lat: number, lng: number) => void;
  refreshTrigger: number;
};

export function SavedPanel({ onFlyTo, refreshTrigger }: Props) {
  const { token } = useAuth();
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSaved = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSaved(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved, refreshTrigger]);

  const removeSaved = async (placeId: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/favorites/${encodeURIComponent(placeId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaved((prev) => prev.filter((s) => s.place_id !== placeId));
    } catch {
      // silently fail
    }
  };

  if (loading && saved.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-800/50" />
        ))}
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/60 p-6 text-center">
        <svg className="mx-auto mb-2 h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
        <p className="text-sm text-slate-500">No saved businesses yet</p>
        <p className="mt-1 text-xs text-slate-600">Click the bookmark icon on any business to save it</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {saved.map((item) => {
        const catColor = item.normalized_category ? getCategoryColor(item.normalized_category) : null;

        return (
          <li
            key={item.id}
            className="group flex items-start gap-3 rounded-lg bg-slate-800/50 p-3 transition-colors hover:bg-slate-800"
          >
            {catColor && (
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: catColor.fill, border: `1px solid ${catColor.stroke}` }}
              />
            )}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => item.lat && item.lng && onFlyTo(item.lat, item.lng)}
                className="block truncate text-sm font-medium text-slate-200 hover:text-indigo-400 transition-colors text-left"
                title={item.business_name}
              >
                {item.business_name}
              </button>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                {item.subcategory && <span>{item.subcategory}</span>}
                {item.rating !== null && (
                  <span className="flex items-center gap-0.5">
                    <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {item.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSaved(item.place_id)}
              className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition-all hover:bg-slate-700 hover:text-rose-400 group-hover:opacity-100"
              title="Remove from saved"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
