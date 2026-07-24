'use client';

import { motion } from 'framer-motion';
import { RoomGate } from '@/components/room/room-gate';
import { useSyncEngine } from '@/hooks/use-sync-engine';
import { useVoice } from '@/providers/voice-provider';

export default function VoicePage() {
  return (
    <RoomGate>
      <VoiceSession />
    </RoomGate>
  );
}

function VoiceSession() {
  const { status, muted, speakerOn, remoteLevel, peerDeviceIds, join, leave, toggleMute, toggleSpeaker } = useVoice();
  const { members } = useSyncEngine();

  const peer = members.find((m) => peerDeviceIds.includes(m.deviceId));
  const inCall = status === 'connecting' || status === 'connected';

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center space-y-10 text-center">
      <div>
        <p className="text-sm text-white/40">Voice Chat</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 'connected' ? `Connected with ${peer?.deviceName ?? 'your device'}` : status === 'connecting' ? 'Connecting…' : 'Start a session'}
        </h1>
      </div>

      <div className="relative flex h-56 w-56 items-center justify-center">
        {inCall && (
          <>
            <span className="absolute h-full w-full animate-pulse-ring rounded-full bg-accent/30" />
            <span
              className="absolute rounded-full bg-accent/20 transition-all duration-150"
              style={{ width: `${60 + remoteLevel * 40}%`, height: `${60 + remoteLevel * 40}%` }}
            />
          </>
        )}
        <button
          onClick={inCall ? leave : join}
          className={`relative z-10 flex h-32 w-32 items-center justify-center rounded-full shadow-glow transition-all ${
            inCall ? 'bg-gradient-to-br from-accent to-accent-muted' : 'glass'
          }`}
        >
          <MicIcon muted={muted} />
        </button>
      </div>

      {inCall && <WaveBars level={remoteLevel} />}

      <p className="text-sm text-white/40">
        {status === 'connected' && 'Low-latency WebRTC — noise suppression & echo cancellation on'}
        {status === 'connecting' && 'Waiting for the other device to join…'}
        {status === 'idle' && 'Tap the mic to start talking while you sync'}
        {status === 'error' && 'Microphone permission denied — check your browser settings'}
      </p>

      {inCall && (
        <div className="flex items-center gap-4">
          <ControlButton active={muted} onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'} icon={<MicIcon muted={muted} small />} />
          <ControlButton active={!speakerOn} onClick={toggleSpeaker} label="Speaker" icon={<SpeakerIcon off={!speakerOn} />} />
          <ControlButton active danger onClick={leave} label="End" icon={<EndIcon />} />
        </div>
      )}
    </div>
  );
}

function WaveBars({ level }: { level: number }) {
  return (
    <div className="flex h-8 items-end gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-accent-soft"
          animate={{ height: 6 + Math.abs(Math.sin(i + level * 5)) * 22 * Math.max(0.2, level) }}
          transition={{ duration: 0.25 }}
          style={{ height: 6 }}
        />
      ))}
    </div>
  );
}

function ControlButton({
  active,
  danger,
  onClick,
  label,
  icon,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={`btn-icon h-14 w-14 ${danger ? 'bg-red-500/90 hover:bg-red-500' : active ? 'bg-white/15' : ''}`}
      >
        {icon}
      </button>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

function MicIcon({ muted, small }: { muted?: boolean; small?: boolean }) {
  const size = small ? 20 : 40;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={muted ? 'none' : 'white'} stroke="white" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      {muted && <path d="M4 4l16 16" strokeLinecap="round" />}
    </svg>
  );
}
function SpeakerIcon({ off }: { off?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {!off && <path d="M17 9a4 4 0 0 1 0 6" strokeLinecap="round" />}
      {off && <path d="M15 15l6-6M21 15l-6-6" strokeLinecap="round" />}
    </svg>
  );
}
function EndIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 9c-2.4 0-4.7.5-6.8 1.4a1.5 1.5 0 0 0-.8 1.9l1 2.7c.2.6.8 1 1.4.9 1-.1 1.9-.5 2.7-1.1.3-.2.7-.3 1-.1.8.4 1.7.6 2.5.6s1.7-.2 2.5-.6c.3-.2.7-.1 1 .1.8.6 1.7 1 2.7 1.1.6.1 1.2-.3 1.4-.9l1-2.7a1.5 1.5 0 0 0-.8-1.9C16.7 9.5 14.4 9 12 9Z" />
    </svg>
  );
}
