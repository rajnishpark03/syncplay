'use client';

import { useRoomStore } from '@/lib/room-store';
import { GlassCard } from '@/components/ui/glass-card';
import { CreateJoinRoom } from './create-join-room';

export function RoomGate({ children }: { children: React.ReactNode }) {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const hydrated = useRoomStore((s) => s.hydrated);

  // Until the saved room is read back from localStorage we don't know whether
  // there's a session — showing "No active session" first would flash the
  // wrong screen on every load.
  if (!hydrated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <GlassCard hoverable={false} className="w-full max-w-sm text-center">
          <span className="mb-3 block text-3xl">🔗</span>
          <h2 className="mb-1 font-semibold">No active session</h2>
          <p className="mb-5 text-sm text-white/40">Create a room or join one with a code to start syncing.</p>
          <CreateJoinRoom />
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}
