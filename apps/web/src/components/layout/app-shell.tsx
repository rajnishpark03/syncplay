'use client';

import { BottomNav } from './bottom-nav';
import { FloatingVoice } from './floating-voice';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-app-gradient md:flex-row">
      <BottomNav />
      {/* Width is left to each page: most constrain to max-w-3xl, the Sync
          screen goes wider so the camera / player / queue columns fit. */}
      <main className="w-full flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">{children}</main>
      <FloatingVoice />
    </div>
  );
}
