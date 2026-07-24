import { tokenStore } from './tokens';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshTokens() {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) throw new ApiError('No refresh token', 401);

  const res = await fetch(`${API_URL}/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokenStore.clear();
    throw new ApiError('Session expired', 401);
  }
  const data = await res.json();
  tokenStore.set(data.accessToken, data.refreshToken);
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const access = tokenStore.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && tokenStore.refresh) {
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message ?? 'Request failed', res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  requestOtp: (email: string) => request<{ sent: boolean; devCode?: string; expiresInSeconds: number }>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  verifyOtp: (payload: {
    email: string;
    code: string;
    device: { deviceId: string; name: string; platform: string; appVersion?: string };
  }) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<{ id: string; email: string; name: string | null; avatarUrl: string | null; createdAt: string }>('/auth/me'),
  devices: () => request<import('@orbit/shared').DeviceInfo[]>('/devices'),
  activity: (limit = 20) => request<import('@orbit/shared').ActivityEntry[]>(`/activity?limit=${limit}`),
  roomActivity: (code: string, limit = 20) =>
    request<import('@orbit/shared').ActivityEntry[]>(`/activity/room/${code}?limit=${limit}`),
  createRoom: (name?: string) => request<import('@orbit/shared').RoomInfo>('/rooms', { method: 'POST', body: JSON.stringify({ name }) }),
  getRoom: (code: string) => request<import('@orbit/shared').RoomInfo>(`/rooms/${code}`),
};

export { ApiError };
