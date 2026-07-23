'use client';

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/providers/auth-provider';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { devCode } = await requestOtp(email);
      setDevCode(devCode ?? null);
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      router.replace('/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-accent-muted shadow-glow">
            <PlayWave />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SyncPlay</h1>
          <p className="mt-1 text-sm text-white/50">For two hearts, one moment — perfectly in sync. 💕</p>
        </div>

        <div className="glass-card p-6">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={handleRequestOtp}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-sm text-white/60">Email</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-field"
                  />
                  <p className="mt-2 text-xs text-white/40">
                    Sign in with the same email on both devices to link them automatically.
                  </p>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending…' : 'Send code'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-sm text-white/60">6-digit code sent to {email}</label>
                  <input
                    ref={otpInputRef}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="input-field text-center text-2xl tracking-[0.5em]"
                  />
                  {devCode && (
                    <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent-soft">
                      Dev mode — your code is <span className="font-mono font-semibold">{devCode}</span>
                    </p>
                  )}
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>
                <button type="button" onClick={() => setStep('email')} className="w-full text-center text-sm text-white/40 hover:text-white/70">
                  Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function PlayWave() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M8 5v14l11-7-11-7Z" fill="white" />
    </svg>
  );
}
