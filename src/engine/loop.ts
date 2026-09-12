/** Fixed-ish frame loop with a clamped delta and automatic pause when hidden. */
export interface LoopHandle {
  stop(): void;
}

export function startLoop(step: (dt: number, elapsed: number) => void): LoopHandle {
  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    // Clamp so a backgrounded tab can't teleport the player across the field.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    elapsed += dt;
    step(dt, elapsed);
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
