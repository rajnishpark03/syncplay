'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/ui/status-dot';
import { useAuth } from '@/providers/auth-provider';
import { getOrCreateDeviceId } from '@/lib/device';
import { api } from '@/lib/api';

const PLATFORM_ICON: Record<string, string> = { ios: '📱', android: '🤖', web: '🌐', desktop: '🖥️' };

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: api.devices, refetchInterval: 15000 });
  const deviceId = getOrCreateDeviceId();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-white/40">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      </header>

      <GlassCard hoverable={false} className="flex items-center gap-4">
        <Avatar name={profile?.name ?? profile?.email ?? '?'} src={profile?.avatarUrl} size={64} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile?.name ?? 'SyncPlay user'}</p>
          <p className="truncate text-sm text-white/40">{profile?.email}</p>
        </div>
      </GlassCard>

      <GlassCard hoverable={false}>
        <h3 className="mb-4 text-sm font-semibold text-white/70">Connected Devices ({devices.length})</h3>
        <div className="space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center gap-3">
              <span className="text-xl">{PLATFORM_ICON[device.platform] ?? '📱'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {device.name} {device.id === deviceId && <span className="text-white/30">(this device)</span>}
                </p>
                <p className="text-xs text-white/40">
                  {device.isOnline ? 'Online' : `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`}
                  {device.pingMs != null && device.isOnline && ` · ${device.pingMs}ms`}
                  {device.batteryLevel != null && ` · ${device.batteryLevel}%`}
                </p>
              </div>
              <StatusDot online={device.isOnline} />
            </div>
          ))}
          {devices.length === 0 && <p className="text-sm text-white/40">No devices linked yet.</p>}
        </div>
      </GlassCard>

      <button onClick={handleLogout} className="btn-secondary w-full text-red-300 hover:text-red-200">
        Log out
      </button>
    </div>
  );
}
