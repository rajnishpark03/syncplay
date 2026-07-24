'use client';

import { createContext, useContext } from 'react';
import { useVoiceChat } from '@/hooks/use-voice-chat';

type VoiceContextValue = ReturnType<typeof useVoiceChat>;

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Hosts the single, app-wide voice-chat connection. Mounted once at the
 * authenticated-app layout level so the mic/WebRTC session survives page
 * navigation — you can be talking on the Sync screen while the video plays,
 * instead of voice tearing down every time you switch pages.
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoiceChat();
  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
}
