'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from './AuthModal';

type Props = {
  searchInput: string;
  searchResultCount: number | null;
  searchQuery?: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  loading: boolean;
  businessCount: number;
};

export function Header({
  searchInput,
  searchResultCount,
  searchQuery,
  onSearchInputChange,
  onSearch,
  onClearSearch,
  loading,
  businessCount
}: Props) {
  const { user, logout, loading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  return (
    <>
      <header className="flex items-center gap-4 border-b border-slate-800/80 bg-slate-900/95 px-4 py-3 backdrop-blur-sm lg:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/30">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold leading-tight text-white">StreetScope</h1>
            <p className="text-[10px] leading-tight text-slate-500">Orlando Business Intelligence</p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-2xl">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search businesses, categories, addresses..."
              className="w-full rounded-xl border border-slate-700/60 bg-slate-800/80 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/50 focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-900/30"
          >
            Search
          </button>
        </div>

        <div className="hidden shrink-0 md:block">
          <span className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs text-slate-400">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                Loading...
              </span>
            ) : searchQuery && searchResultCount !== null ? (
              `${searchResultCount} results`
            ) : (
              `${businessCount} businesses`
            )}
          </span>
        </div>

        <div className="shrink-0">
          {authLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-800" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/80 px-3 py-1.5 text-sm transition-all hover:border-slate-600 hover:bg-slate-700/80"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden text-slate-200 sm:inline">{user.name.split(' ')[0]}</span>
                <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-800 p-1 shadow-xl">
                    <div className="px-3 py-2 text-xs text-slate-500">{user.email}</div>
                    <hr className="border-slate-700" />
                    <button
                      type="button"
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                className="rounded-xl px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setShowAuth(true); }}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-indigo-500"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Search result banner */}
      {searchQuery && (
        <div className="flex items-center justify-between border-b border-indigo-900/40 bg-indigo-950/30 px-4 py-2 text-sm lg:px-6">
          <span className="text-indigo-200">
            {searchResultCount !== null
              ? `Found ${searchResultCount} results for "${searchQuery}"`
              : `Searching for "${searchQuery}"...`}
          </span>
          <button type="button" onClick={onClearSearch} className="text-indigo-400 hover:text-indigo-200 transition-colors">
            Clear search
          </button>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </>
  );
}
