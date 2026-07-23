'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useRoomStore } from '@/lib/room-store';

type ModalMode = null | 'create' | 'join' | 'created';

export function CreateJoinRoom({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ModalMode>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setRoom = useRoomStore((s) => s.setRoom);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const room = await api.createRoom(name || undefined);
      setRoom(room);
      setCreatedCode(room.code);
      setMode('created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const room = await api.getRoom(code.trim().toUpperCase());
      setRoom(room);
      router.push('/sync');
      setMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Room not found');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(createdCode);
  }

  async function shareCode() {
    const shareText = `Join my SyncPlay session — code: ${createdCode}`;
    const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'SyncPlay', text: shareText });
        return;
      } catch {
        // user cancelled share sheet — fall through to clipboard
      }
    }
    copyCode();
  }

  return (
    <>
      <div className={compact ? 'flex gap-3' : 'grid grid-cols-2 gap-3'}>
        <button className="btn-primary" onClick={() => setMode('create')}>
          Create Room
        </button>
        <button className="btn-secondary" onClick={() => setMode('join')}>
          Join Room
        </button>
      </div>

      <AnimatePresence>
        {mode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center"
            onClick={() => mode !== 'created' && setMode(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-card w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {mode === 'create' && (
                <>
                  <h3 className="mb-1 font-semibold">Create a room</h3>
                  <p className="mb-4 text-xs text-white/40">You&rsquo;ll get a 6-character code to share with anyone you want to sync with.</p>
                  <input
                    className="input-field"
                    placeholder="Session name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                  <div className="mt-5 flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => setMode(null)}>
                      Cancel
                    </button>
                    <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
                      {loading ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </>
              )}

              {mode === 'join' && (
                <>
                  <h3 className="mb-1 font-semibold">Join a room</h3>
                  <p className="mb-4 text-xs text-white/40">Enter the code your host shared with you.</p>
                  <input
                    className="input-field text-center text-2xl tracking-[0.3em]"
                    placeholder="AB3XZ9"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    autoFocus
                  />
                  {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                  <div className="mt-5 flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => setMode(null)}>
                      Cancel
                    </button>
                    <button className="btn-primary flex-1" onClick={handleJoin} disabled={loading || code.length !== 6}>
                      {loading ? 'Joining…' : 'Join'}
                    </button>
                  </div>
                </>
              )}

              {mode === 'created' && (
                <>
                  <h3 className="mb-1 font-semibold">Room created 🎉</h3>
                  <p className="mb-4 text-xs text-white/40">Share this code — anyone who enters it joins your session instantly.</p>
                  <div className="rounded-2xl bg-accent/10 py-6 text-center">
                    <p className="text-4xl font-bold tracking-[0.3em] text-accent-soft">{createdCode}</p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button className="btn-secondary flex-1" onClick={copyCode}>
                      Copy code
                    </button>
                    <button className="btn-secondary flex-1" onClick={shareCode}>
                      Share
                    </button>
                  </div>
                  <button
                    className="btn-primary mt-3 w-full"
                    onClick={() => {
                      setMode(null);
                      router.push('/sync');
                    }}
                  >
                    Continue
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
