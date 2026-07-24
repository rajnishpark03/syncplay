'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CreateJoinRoom } from '@/components/room/create-join-room';
import { RoomCodeChip } from '@/components/room/room-code-chip';
import {
  DevicesIcon,
  FilmIcon,
  GamepadIcon,
  LinkIcon,
  MicIcon,
  MusicIcon,
  ScreenIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { useRoomStore } from '@/lib/room-store';
import { api } from '@/lib/api';
import type { ActivityType } from '@orbit/shared';

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  device_connected: LinkIcon,
  device_disconnected: LinkIcon,
  media_play: MusicIcon,
  media_pause: MusicIcon,
  media_seek: MusicIcon,
  media_track_changed: MusicIcon,
  voice_started: MicIcon,
  voice_ended: MicIcon,
  screen_share_started: ScreenIcon,
  screen_share_stopped: ScreenIcon,
  game_started: GamepadIcon,
  game_ended: GamepadIcon,
};

const SHORTCUTS = [
  { href: '/sync', label: 'Listen', hint: 'Music, in step', Icon: MusicIcon },
  { href: '/sync', label: 'Watch', hint: 'Video together', Icon: FilmIcon },
  { href: '/games', label: 'Play', hint: 'Chess & Ludo', Icon: GamepadIcon },
  { href: '/profile', label: 'Devices', hint: 'Your sessions', Icon: DevicesIcon },
];

function greetingFor(hour: number) {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { profile } = useAuth();
  const { members, mediaState, leaveRoom, deviceId } = useSync();
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const hydrated = useRoomStore((s) => s.hydrated);

  const { data: activity } = useQuery({
    queryKey: ['activity', currentRoom?.code ?? 'account'],
    queryFn: () => (currentRoom ? api.roomActivity(currentRoom.code, 6) : api.activity(6)),
    refetchInterval: 15000,
  });

  const partner = members.find((m) => m.deviceId !== deviceId);
  const firstName = profile?.name?.split(' ')[0] ?? profile?.email.split('@')[0] ?? '';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header className="pt-1">
        <p className="text-sm text-white/35">{greetingFor(new Date().getHours())}</p>
        <h1 className="text-3xl font-semibold capitalize tracking-tight">{firstName}</h1>
      </header>

      {/* The room is the hero of this screen; everything else supports it. */}
      {!hydrated ? (
        <div className="h-44 animate-pulse rounded-3xl bg-white/[0.03]" />
      ) : currentRoom ? (
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-accent/20 via-white/[0.04] to-transparent p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Your room</p>
              <h2 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">{currentRoom.name ?? 'Your session'}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RoomCodeChip code={currentRoom.code} />
                <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
                  <span className={`h-1.5 w-1.5 rounded-full ${partner ? 'bg-mint' : 'bg-white/25'}`} />
                  {partner ? `${partner.deviceName} is here` : 'Waiting for your partner'}
                </span>
              </div>
            </div>
            <button
              onClick={leaveRoom}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs text-white/45 transition hover:bg-white/10 hover:text-white/80"
            >
              Leave
            </button>
          </div>

          {mediaState.track && (
            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                {mediaState.track.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaState.track.artworkUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <MusicIcon className="text-base text-white/50" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{mediaState.track.title}</span>
                <span className="block truncate text-xs text-white/35">
                  {mediaState.state === 'playing' ? 'Playing now' : 'Paused'}
                </span>
              </span>
              <Link href="/sync" className="flex-shrink-0 text-xs text-accent-soft transition hover:text-accent">
                Open
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <SparkleIcon className="mx-auto mb-3 text-2xl text-accent-soft" />
          <h2 className="text-lg font-semibold">Start a room</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-white/40">
            Create one and share the code, or join the room your partner opened.
          </p>
          <div className="mt-5">
            <CreateJoinRoom compact />
          </div>
        </section>
      )}

      {/* Compact shortcuts instead of four oversized identical tiles. */}
      <section className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4">
        {SHORTCUTS.map(({ href, label, hint, Icon }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <Icon className="text-lg text-accent-soft" />
            <p className="mt-2.5 text-sm font-medium">{label}</p>
            <p className="truncate text-xs text-white/35">{hint}</p>
          </Link>
        ))}
      </section>

      <section>
        <h3 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/35">Recent</h3>
        {activity?.length ? (
          <ul className="space-y-3">
            {activity.map((entry) => {
              const Icon = ACTIVITY_ICON[entry.type] ?? LinkIcon;
              return (
                <li key={entry.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                    <Icon className="text-xs text-white/50" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/70">{entry.message}</span>
                  <time className="flex-shrink-0 text-xs text-white/25">
                    {new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/30">Nothing yet — play something together.</p>
        )}
      </section>
    </div>
  );
}
