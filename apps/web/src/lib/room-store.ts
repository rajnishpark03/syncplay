import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomInfo } from '@orbit/shared';

interface RoomState {
  currentRoom: RoomInfo | null;
  /** False until the persisted room has been read back from localStorage. */
  hydrated: boolean;
  setRoom: (room: RoomInfo) => void;
  clearRoom: () => void;
  setHydrated: () => void;
}

/** Persisted so refreshing the page (or reopening the app) keeps you in your session. */
export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      currentRoom: null,
      hydrated: false,
      setRoom: (room) => set({ currentRoom: room }),
      clearRoom: () => set({ currentRoom: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'orbit:room',
      // Only the room is persisted; `hydrated` is runtime-only.
      partialize: (state) => ({ currentRoom: state.currentRoom }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
