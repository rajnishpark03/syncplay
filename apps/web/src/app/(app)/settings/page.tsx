'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { useSettingsStore, VoiceQuality } from '@/lib/settings-store';

export default function SettingsPage() {
  const settings = useSettingsStore();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-white/40">Preferences</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <GlassCard hoverable={false} className="space-y-1">
        <Row label="Dark Theme" description="SyncPlay is dark-mode only by design">
          <ToggleSwitch checked readOnly />
        </Row>
        <Row label="Notifications" description="Get notified when your partner connects">
          <ToggleSwitch checked={settings.notifications} onChange={() => settings.toggle('notifications')} />
        </Row>
        <Row label="Auto Sync" description="Automatically resync when drift is detected">
          <ToggleSwitch checked={settings.autoSync} onChange={() => settings.toggle('autoSync')} />
        </Row>
        <Row label="Reconnect Automatically" description="Reconnect sockets after network drops">
          <ToggleSwitch checked={settings.reconnectAutomatically} onChange={() => settings.toggle('reconnectAutomatically')} />
        </Row>
        <Row label="Developer Mode" description="Show latency, clock offset & raw event logs">
          <ToggleSwitch checked={settings.developerMode} onChange={() => settings.toggle('developerMode')} />
        </Row>
      </GlassCard>

      <GlassCard hoverable={false}>
        <h3 className="mb-3 text-sm font-semibold text-white/70">Voice Quality</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['auto', 'low', 'balanced', 'high'] as VoiceQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => settings.setVoiceQuality(q)}
              className={`rounded-xl px-2 py-2 text-xs capitalize ${
                settings.voiceQuality === q ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </GlassCard>

      <p className="text-center text-xs text-white/25">SyncPlay v0.1.0</p>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3.5 last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, readOnly }: { checked: boolean; onChange?: () => void; readOnly?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={readOnly ? undefined : onChange}
      className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-white/10'} ${
        readOnly ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
