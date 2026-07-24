import type { Platform } from '@orbit/shared';

const DEVICE_ID_KEY = 'orbit:deviceId';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  const w = window as unknown as { Capacitor?: { getPlatform: () => string } };
  if (w.Capacitor) {
    const platform = w.Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') return platform;
    return 'desktop';
  }
  const ua = navigator.userAgent;
  if (/Electron/.test(ua)) return 'desktop';
  return 'web';
}

export function defaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Device';
  const platform = detectPlatform();
  const ua = navigator.userAgent;
  if (platform === 'ios') return /iPad/.test(ua) ? 'iPad' : 'iPhone';
  if (platform === 'android') return 'Android device';
  if (platform === 'desktop') return 'Desktop app';
  if (/Mac/.test(ua)) return 'Mac (Browser)';
  if (/Win/.test(ua)) return 'Windows (Browser)';
  return 'Web browser';
}

export function getBatteryLevel(): Promise<number | null> {
  const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number }> };
  if (!nav.getBattery) return Promise.resolve(null);
  return nav
    .getBattery()
    .then((battery) => Math.round(battery.level * 100))
    .catch(() => null);
}

export function estimateNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
  const nav = navigator as unknown as {
    connection?: { effectiveType?: string; downlink?: number };
  };
  const conn = nav.connection;
  if (!conn?.effectiveType) return 'unknown';
  switch (conn.effectiveType) {
    case '4g':
      return (conn.downlink ?? 0) >= 5 ? 'excellent' : 'good';
    case '3g':
      return 'fair';
    default:
      return 'poor';
  }
}
