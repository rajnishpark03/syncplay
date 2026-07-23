'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { tokenStore } from '@/lib/tokens';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { detectPlatform, defaultDeviceName, getOrCreateDeviceId } from '@/lib/device';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  profile: Profile | null;
  requestOtp: (email: string) => Promise<{ devCode?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  const bootstrap = useCallback(async () => {
    if (!tokenStore.access) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const me = await api.me();
      setProfile(me);
      setStatus('authenticated');
      connectSocket();
    } catch {
      tokenStore.clear();
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const requestOtp = useCallback(async (email: string) => {
    const res = await api.requestOtp(email);
    return { devCode: res.devCode };
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const deviceId = getOrCreateDeviceId();
    const result = await api.verifyOtp({
      email,
      code,
      device: {
        deviceId,
        name: defaultDeviceName(),
        platform: detectPlatform(),
        appVersion: '0.1.0',
      },
    });
    tokenStore.set(result.accessToken, result.refreshToken);
    const me = await api.me();
    setProfile(me);
    setStatus('authenticated');
    connectSocket();
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // token might already be invalid — proceed with local cleanup regardless
    }
    disconnectSocket();
    tokenStore.clear();
    setProfile(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ status, profile, requestOtp, verifyOtp, logout }),
    [status, profile, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
