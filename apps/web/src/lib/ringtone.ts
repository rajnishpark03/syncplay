/**
 * A soft two-note chime, synthesised with the Web Audio API so there's no
 * audio file to ship or preload. Loops gently until stopped.
 */
export function createRingtone() {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const chime = () => {
    if (!ctx) return;
    // Two soft sine notes (a rising minor third) with a slow fade — warm, not shrill.
    [
      { freq: 587.33, at: 0 }, // D5
      { freq: 739.99, at: 0.28 }, // F#5
    ].forEach(({ freq, at }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = ctx!.currentTime + at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.75);

      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.8);
    });
  };

  return {
    start() {
      if (timer) return;
      try {
        ctx = new AudioContext();
        // Autoplay policy may leave it suspended until a gesture — resuming is
        // a no-op failure in that case, which is fine (the banner still shows).
        void ctx.resume();
        chime();
        timer = setInterval(chime, 2600);
      } catch {
        // no audio available — the on-screen incoming-call banner still works
      }
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
