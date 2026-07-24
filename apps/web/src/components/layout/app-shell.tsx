'use client';

import { BottomNav } from './bottom-nav';
import { FloatingVoice } from './floating-voice';
import { PersistentPlayer } from './persistent-player';
import { RoomBackdrop } from '@/components/ui/room-backdrop';
import { IncomingCall } from './incoming-call';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-app-gradient md:flex-row">
      <RoomBackdrop />
      <BottomNav />
      {/* Width is left to each page: most constrain to max-w-3xl, the Sync
          screen goes wider so the camera / player / queue columns fit. */}
      <main className="w-full flex-1 px-3 pb-44 pt-5 sm:px-4 md:px-8 md:pb-10 md:pt-8">{children}</main>
      <PersistentPlayer />
      <IncomingCall />
      <FloatingVoice />
    </div>
  );
}
