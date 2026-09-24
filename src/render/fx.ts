/**
 * Juice. A small, framework-free effects layer the renderer draws on top of
 * the world: particles, screen shake, flashes, the "found it!" held-up item,
 * a dart streak, a falling rock, and the ambient life each region breathes
 * (fireflies in the meadow, dust in the temple, drips in the crypt, motes
 * in the vault's sunbeam). Game events push into it; nothing here can
 * change the game.
 */
import type { Region, Vec2 } from '@/game/types';
import { TILE_SIZE } from './constants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
  glow?: boolean;
}

interface Streak {
  from: Vec2;
  to: Vec2;
  t: number;
}

interface Held {
  sprite: string;
  t: number;
  duration: number;
}

const particles: Particle[] = [];
const streaks: Streak[] = [];
const rocks: { at: Vec2; t: number }[] = [];
let shake = 0;
let flash: { color: string; t: number; duration: number } | null = null;
let held: Held | null = null;
let fadeIn = 0;

const T = TILE_SIZE;

function center(tile: Vec2): Vec2 {
  return { x: tile.x * T + T / 2, y: tile.y * T + T / 2 };
}

function burst(at: Vec2, count: number, colors: string[], opts: Partial<Particle> & { speed?: number; up?: number } = {}): void {
  const speed = opts.speed ?? 60;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (opts.up ?? 0),
      life: 0,
      max: (opts.max ?? 0.6) * (0.7 + Math.random() * 0.6),
      color: colors[i % colors.length]!,
      size: opts.size ?? 3,
      gravity: opts.gravity ?? 0,
      glow: opts.glow,
    });
  }
  if (particles.length > 500) particles.splice(0, particles.length - 500);
}

export const fx = {
  dig(tile: Vec2, soil = '#6b4a2e'): void {
    burst(center(tile), 14, [soil, '#84603f', '#4a3220'], { speed: 90, up: 60, gravity: 320, max: 0.55, size: 3 });
    shake = Math.max(shake, 2);
  },
  sparkle(tile: Vec2, big = false): void {
    burst(center(tile), big ? 40 : 18, ['#fff4c0', '#f2c14e', '#ffffff'], { speed: big ? 140 : 80, max: big ? 1.1 : 0.8, size: 3, glow: true });
  },
  secret(tile: Vec2): void {
    burst(center(tile), 26, ['#b5f0ff', '#ffffff', '#f2c14e'], { speed: 110, max: 1, size: 3, glow: true });
  },
  hearts(tile: Vec2): void {
    burst(center(tile), 8, ['#ff6b7a', '#ffb0b8'], { speed: 30, up: 50, max: 0.9, size: 4 });
  },
  dust(tile: Vec2): void {
    burst(center(tile), 10, ['#b8a888', '#d8c8a8'], { speed: 50, max: 0.5, size: 3 });
  },
  hurt(): void {
    shake = Math.max(shake, 7);
    flash = { color: 'rgba(200,40,40,0.35)', t: 0, duration: 0.25 };
  },
  goldFlash(): void {
    flash = { color: 'rgba(255,220,120,0.45)', t: 0, duration: 0.6 };
  },
  dart(from: Vec2, to: Vec2): void {
    streaks.push({ from: center(from), to: center(to), t: 0 });
  },
  rock(at: Vec2): void {
    rocks.push({ at: center(at), t: 0 });
  },
  hold(sprite: string, duration = 1.3): void {
    held = { sprite, t: 0, duration };
  },
  fade(): void {
    fadeIn = 1;
  },
  heldSprite(): { sprite: string; progress: number } | null {
    return held ? { sprite: held.sprite, progress: held.t / held.duration } : null;
  },
  isHolding(): boolean {
    return !!held;
  },
};

// ── ambient life ──────────────────────────────────────────────────────────

let ambientClock = 0;

function spawnAmbient(region: Region, w: number, h: number, dark: boolean): void {
  const rx = Math.random() * w;
  const ry = Math.random() * h;
  switch (region) {
    case 'meadow':
      // Drifting pollen, and the occasional firefly.
      particles.push({ x: rx, y: ry, vx: 8 + Math.random() * 10, vy: -4, life: 0, max: 4, color: Math.random() < 0.3 ? '#fff6a0' : 'rgba(255,255,255,0.7)', size: 2, gravity: 0, glow: true });
      break;
    case 'temple':
    case 'well':
      particles.push({ x: rx, y: ry, vx: 3, vy: 2, life: 0, max: 5, color: 'rgba(230,220,190,0.35)', size: 2, gravity: 0 });
      break;
    case 'crypt':
      if (Math.random() < 0.5) {
        // A drip from the ceiling.
        particles.push({ x: rx, y: 0, vx: 0, vy: 40, life: 0, max: 1.4, color: 'rgba(160,200,230,0.8)', size: 2, gravity: 200 });
      } else if (!dark) {
        particles.push({ x: rx, y: ry, vx: 2, vy: -2, life: 0, max: 5, color: 'rgba(180,200,230,0.3)', size: 2, gravity: 0 });
      }
      break;
    case 'vault':
      // Gold motes turning in the sunbeam.
      particles.push({ x: w / 2 + (Math.random() - 0.5) * T * 4, y: ry, vx: (Math.random() - 0.5) * 6, vy: -5, life: 0, max: 6, color: 'rgba(255,230,150,0.8)', size: 2, gravity: 0, glow: true });
      break;
    case 'home':
      if (Math.random() < 0.4) particles.push({ x: rx, y: ry, vx: 2, vy: 1, life: 0, max: 6, color: 'rgba(255,240,210,0.3)', size: 2, gravity: 0 });
      break;
  }
}

export function stepFx(dt: number, region: Region, w: number, h: number, dark: boolean): void {
  ambientClock += dt;
  const rate = region === 'vault' ? 0.08 : region === 'meadow' ? 0.35 : 0.5;
  while (ambientClock > rate) {
    ambientClock -= rate;
    spawnAmbient(region, w, h, dark);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life += dt;
    if (p.life >= p.max) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = streaks.length - 1; i >= 0; i--) {
    streaks[i]!.t += dt;
    if (streaks[i]!.t > 0.25) streaks.splice(i, 1);
  }
  for (let i = rocks.length - 1; i >= 0; i--) {
    rocks[i]!.t += dt;
    if (rocks[i]!.t > 0.45) {
      burst(rocks[i]!.at, 12, ['#6a6e78', '#8a8e98', '#4a4e58'], { speed: 80, up: 40, gravity: 300, max: 0.5 });
      rocks.splice(i, 1);
    }
  }
  shake = Math.max(0, shake - dt * 30);
  if (flash) {
    flash.t += dt;
    if (flash.t > flash.duration) flash = null;
  }
  if (held) {
    held.t += dt;
    if (held.t > held.duration) held = null;
  }
  fadeIn = Math.max(0, fadeIn - dt * 3);
}

export function shakeOffset(): Vec2 {
  if (shake <= 0) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * shake * 2, y: (Math.random() - 0.5) * shake * 2 };
}

/** World-space effects, drawn over entities but under the darkness. */
export function drawFxWorld(ctx: CanvasRenderingContext2D): void {
  for (const s of streaks) {
    const k = Math.min(1, s.t / 0.12);
    const x = s.from.x + (s.to.x - s.from.x) * k;
    const y = s.from.y + (s.to.y - s.from.y) * k;
    ctx.strokeStyle = 'rgba(255,230,180,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - (s.to.x - s.from.x) * 0.12, y - (s.to.y - s.from.y) * 0.12);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  for (const r of rocks) {
    const k = Math.min(1, r.t / 0.45);
    const y = r.at.y - (1 - k * k) * T * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(r.at.x, r.at.y + T * 0.3, T * 0.3 * k, T * 0.12 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a7e88';
    ctx.fillRect(r.at.x - T * 0.25, y - T * 0.25, T * 0.5, T * 0.45);
    ctx.fillStyle = '#9a9ea8';
    ctx.fillRect(r.at.x - T * 0.2, y - T * 0.25, T * 0.3, T * 0.12);
  }
}

/** Particles, drawn last so glowing ones read even in the dark. */
export function drawParticles(ctx: CanvasRenderingContext2D, glowOnly: boolean): void {
  for (const p of particles) {
    if (glowOnly !== !!p.glow) continue;
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/** Screen-space overlays: the hurt/gold flash and the room fade-in. */
export function drawOverlays(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (flash) {
    ctx.globalAlpha = 1 - flash.t / flash.duration;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (fadeIn > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fadeIn})`;
    ctx.fillRect(0, 0, w, h);
  }
}
