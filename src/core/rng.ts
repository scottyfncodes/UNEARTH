/** Deterministic RNG so a seeded field can be regenerated identically. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function intRange(rng: Rng, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** Weighted choice. Returns null when the pool is empty or all weights are 0. */
export function weightedPick<T>(rng: Rng, items: readonly { item: T; weight: number }[]): T | null {
  let total = 0;
  for (const entry of items) total += Math.max(0, entry.weight);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const entry of items) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.item;
  }
  return items[items.length - 1]!.item;
}

/** Smooth 1D value noise — used to make detector signals breathe. */
export function valueNoise1D(seed: number) {
  const rng = mulberry32(seed);
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) table[i] = rng() * 2 - 1;
  return (t: number): number => {
    const i = Math.floor(t);
    const f = t - i;
    const a = table[i & 255]!;
    const b = table[(i + 1) & 255]!;
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function uid(prefix = 'x'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
