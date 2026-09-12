/**
 * Haptics are reinforcement, never decoration: distance, contact, reveal.
 * Used sparingly and always throttled — a buzzing phone ruins the mood.
 */
let enabled = true;
let lastPulse = 0;

function canVibrate(): boolean {
  return enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export const haptics = {
  setEnabled(on: boolean): void {
    enabled = on;
  },

  /** Signal pulse — intensity 0..1 maps to a 4–22ms tick, min 120ms apart. */
  signal(intensity: number): void {
    if (!canVibrate()) return;
    const now = performance.now();
    if (now - lastPulse < 120) return;
    lastPulse = now;
    navigator.vibrate(Math.round(3 + intensity * 19));
  },

  contact(): void {
    if (!canVibrate()) return;
    const now = performance.now();
    if (now - lastPulse < 90) return;
    lastPulse = now;
    navigator.vibrate(8);
  },

  strike(): void {
    if (!canVibrate()) return;
    lastPulse = performance.now();
    navigator.vibrate([0, 26, 40, 18]);
  },

  reveal(): void {
    if (!canVibrate()) return;
    lastPulse = performance.now();
    navigator.vibrate([0, 14, 60, 14, 60, 90]);
  },

  danger(): void {
    if (!canVibrate()) return;
    lastPulse = performance.now();
    navigator.vibrate([0, 60, 90, 60, 90, 160]);
  },

  tap(): void {
    if (!canVibrate()) return;
    navigator.vibrate(6);
  },
};
