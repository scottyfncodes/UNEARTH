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
