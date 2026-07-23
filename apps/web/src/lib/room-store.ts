import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomInfo } from '@syncplay/shared';

interface RoomState {
  currentRoom: RoomInfo | null;
  setRoom: (room: RoomInfo) => void;
  clearRoom: () => void;
}

/** Persisted so refreshing the page (or reopening the app) keeps you in your session. */
export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      currentRoom: null,
      setRoom: (room) => set({ currentRoom: room }),
      clearRoom: () => set({ currentRoom: null }),
    }),
    { name: 'syncplay:room' },
  ),
);
