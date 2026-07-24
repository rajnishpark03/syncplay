'use client';

import { createContext, useContext } from 'react';
import { useSyncEngine } from '@/hooks/use-sync-engine';

type SyncContextValue = ReturnType<typeof useSyncEngine>;

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Runs the room sync engine exactly once for the whole app.
 *
 * Previously every screen called `useSyncEngine()` directly, which meant each
 * one registered its own socket listeners, ran its own 4s ping timer, and kept
 * a separate copy of the room state — copies that could briefly disagree and
 * visibly flicker. One provider = one socket subscription, one timer, one
 * source of truth.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useSyncEngine();
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
