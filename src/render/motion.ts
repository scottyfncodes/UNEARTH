/** Smoothly interpolates CK's on-screen position toward its true grid tile. */
export interface Motion {
  x: number;
  y: number;
}

export function createMotion(x: number, y: number): Motion {
  return { x, y };
}

export function snapMotion(motion: Motion, x: number, y: number): void {
  motion.x = x;
  motion.y = y;
}

const SPEED = 16;

export function stepMotion(motion: Motion, targetX: number, targetY: number, dt: number): void {
  const dx = targetX - motion.x;
  const dy = targetY - motion.y;
  if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) {
    motion.x = targetX;
    motion.y = targetY;
    return;
  }
  const t = Math.min(1, dt * SPEED);
  motion.x += dx * t;
  motion.y += dy * t;
}

/** A hop in progress: CK arcs from one tile to another instead of trotting. */
interface Hop {
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  duration: number;
  height: number;
}

let hop: Hop | null = null;

export function startHop(from: { x: number; y: number }, to: { x: number; y: number }, seconds: number, height = 1): void {
  hop = { from, to, t: 0, duration: seconds, height };
}

/**
 * Advances any hop and, while one is running, drives `motion` along it.
 * Returns how high CK is (0..1) so the renderer can lift the sprite off its shadow.
 */
export function stepHop(motion: Motion, dt: number): number {
  if (!hop) return 0;
  hop.t += dt;
  const k = Math.min(1, hop.t / hop.duration);
  motion.x = hop.from.x + (hop.to.x - hop.from.x) * k;
  motion.y = hop.from.y + (hop.to.y - hop.from.y) * k;
  const lift = Math.sin(k * Math.PI) * hop.height;
  if (k >= 1) hop = null;
  return lift;
}

export function isHopping(): boolean {
  return !!hop;
}
