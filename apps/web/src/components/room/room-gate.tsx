'use client';

import { useRoomStore } from '@/lib/room-store';
import { GlassCard } from '@/components/ui/glass-card';
import { CreateJoinRoom } from './create-join-room';

export function RoomGate({ children }: { children: React.ReactNode }) {
  const currentRoom = useRoomStore((s) => s.currentRoom);

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
