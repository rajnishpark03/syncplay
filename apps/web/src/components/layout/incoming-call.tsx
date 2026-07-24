'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '@/providers/voice-provider';

/**
 * Incoming-call banner. Shown app-wide (it lives in the shell) so a call
 * reaches you on any screen — Games, Sync, Home — with a soft ringtone.
 */
export function IncomingCall() {
  const { incomingCall, acceptCall, declineCall } = useVoice();

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          // Centred with auto margins, NOT a translate: framer-motion writes its
          // own `transform` for the entry animation, which would wipe out a
          // Tailwind -translate-x-1/2 and shove the banner off-screen.
          className="fixed inset-x-3 top-3 z-50 mx-auto max-w-[380px]"
        >
          <div className="glass-card flex items-center gap-2.5 p-2.5 shadow-glow sm:gap-3 sm:p-3">
            <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-muted">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
              <span className="relative text-lg">📞</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{incomingCall.deviceName} is calling</p>
              <p className="text-xs text-white/40">Voice chat in your room</p>
            </div>
            <button
              onClick={declineCall}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
              aria-label="Decline"
            >
              ✕
            </button>
            <button
              onClick={acceptCall}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint text-lg text-black transition hover:brightness-110"
              aria-label="Accept call"
            >
              📞
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
