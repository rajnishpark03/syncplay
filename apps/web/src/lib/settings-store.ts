import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VoiceQuality = 'auto' | 'low' | 'balanced' | 'high';

interface SettingsState {
  notifications: boolean;
  autoSync: boolean;
  reconnectAutomatically: boolean;
  developerMode: boolean;
  voiceQuality: VoiceQuality;
  toggle: (key: 'notifications' | 'autoSync' | 'reconnectAutomatically' | 'developerMode') => void;
  setVoiceQuality: (quality: VoiceQuality) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: true,
      autoSync: true,
      reconnectAutomatically: true,
      developerMode: false,
      voiceQuality: 'auto',
      toggle: (key) => set((state) => ({ ...state, [key]: !state[key] })),
      setVoiceQuality: (voiceQuality) => set({ voiceQuality }),
    }),
    { name: 'orbit:settings' },
  ),
);
