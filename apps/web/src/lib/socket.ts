import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';
import { tokenStore } from './tokens';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: tokenStore.access }),
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
