'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusDot } from '@/components/ui/status-dot';
import { CreateJoinRoom } from '@/components/room/create-join-room';
import { useAuth } from '@/providers/auth-provider';
import { useSyncEngine } from '@/hooks/use-sync-engine';
import { useRoomStore } from '@/lib/room-store';
import { api } from '@/lib/api';
import type { ActivityType } from '@syncplay/shared';

const ACTIVITY_ICON: Record<ActivityType, string> = {
  device_connected: '🔗',
  device_disconnected: '📴',
  media_play: '▶️',
  media_pause: '⏸️',
  media_seek: '⏩',
  media_track_changed: '🎵',
  voice_started: '🎙️',
  voice_ended: '🔇',
  screen_share_started: '🖥️',
  screen_share_stopped: '🖥️',
};

export default function HomePage() {
  const { profile } = useAuth();
  const { members, mediaState, leaveRoom, deviceId } = useSyncEngine();
  const currentRoom = useRoomStore((s) => s.currentRoom);

  const { data: activity } = useQuery({
    queryKey: ['activity', currentRoom?.code ?? 'account'],
    queryFn: () => (currentRoom ? api.roomActivity(currentRoom.code, 8) : api.activity(8)),
    refetchInterval: 15000,
  });

  const partner = members.find((m) => m.deviceId !== deviceId);
  const firstName = profile?.name?.split(' ')[0] ?? profile?.email.split('@')[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-white/40">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
      </header>

      {currentRoom ? (
        <GlassCard hoverable={false} className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40">Active session {currentRoom.name ? `· ${currentRoom.name}` : ''}</p>
            <p className="text-2xl font-bold tracking-[0.25em] text-accent-soft">{currentRoom.code}</p>
            <p className="mt-1 text-xs text-white/40">
              {members.length} device{members.length === 1 ? '' : 's'} connected
            </p>
          </div>
          <button className="btn-secondary text-xs" onClick={leaveRoom}>
            Leave
          </button>
        </GlassCard>
      ) : (
        <GlassCard hoverable={false}>
          <h3 className="mb-1 font-semibold">Start a session</h3>
          <p className="mb-4 text-xs text-white/40">Create a room and share the code, or join one your partner started.</p>
          <CreateJoinRoom compact />
        </GlassCard>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/sync">
          <GlassCard className="h-40 justify-between overflow-hidden">
            <div className="flex flex-col justify-between h-full">
              <span className="text-2xl">🎧</span>
              <div>
                <h3 className="font-semibold">Listen Together</h3>
                <p className="text-xs text-white/40">Music, perfectly synced</p>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/sync">
          <GlassCard className="h-40 justify-between overflow-hidden">
            <div className="flex flex-col justify-between h-full">
              <span className="text-2xl">🎬</span>
              <div>
                <h3 className="font-semibold">Watch Together</h3>
                <p className="text-xs text-white/40">Video &amp; movies in sync</p>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/voice">
          <GlassCard className="h-40 justify-between overflow-hidden">
            <div className="flex flex-col justify-between h-full">
              <span className="text-2xl">🎙️</span>
              <div>
                <h3 className="font-semibold">Voice Chat</h3>
                <p className="text-xs text-white/40">Talk while you sync</p>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/profile">
          <GlassCard className="h-40 justify-between overflow-hidden">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-2xl">📱</span>
                <StatusDot online={!!partner} />
              </div>
              <div>
                <h3 className="font-semibold">Connected Device</h3>
                <p className="truncate text-xs text-white/40">{partner ? partner.deviceName : 'No one in your session'}</p>
              </div>
            </div>
          </GlassCard>
        </Link>
      </div>

      {mediaState.track && (
        <GlassCard className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl">
            {mediaState.track.mediaType === 'music' ? '🎵' : '🎬'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{mediaState.track.title}</p>
            <p className="truncate text-xs text-white/40">{mediaState.track.subtitle ?? 'Now playing'}</p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-white/60">{mediaState.state}</span>
        </GlassCard>
      )}

      <GlassCard hoverable={false}>
        <h3 className="mb-4 font-semibold">Recent Activity</h3>
        <div className="space-y-3">
          {!activity?.length && <p className="text-sm text-white/40">No activity yet — start playing something together.</p>}
          {activity?.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3">
              <span className="text-lg">{ACTIVITY_ICON[entry.type] ?? '•'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/80">{entry.message}</p>
                <p className="text-xs text-white/30">{new Date(entry.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
