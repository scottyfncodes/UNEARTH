/**
 * The score, as pure data. Each region gets an eight-bar piece in an
 * A A' B A'' shape, split into layers the audio engine mixes live:
 *
 *   base     bass, lead and the region's arpeggio: always playing
 *   perc     the region's pulse: a kick, a hat, a heartbeat in the crypt
 *   shimmer  high chord tones that swell as the collar closes in on something
 *   drive    a running bass and snare that take over when something is chasing CK
 *
 * Everything is composed from a seed, so a region always plays the same tune.
 * Kept free of the Web Audio API so the shape of every song is testable.
 */
import type { Region } from '@/game/types';

export type Style = 'bouncy' | 'wander' | 'sparse' | 'drone' | 'dream';

export interface Song {
  bpm: number;
  root: number;
  scale: number[];
  /** Scale degrees (0-based) of each of the eight bars' chord roots. */
  bars: number[];
  style: Style;
  seed: number;
}

export const SONGS: Record<Region, Song> = {
  home: { bpm: 104, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bars: [0, 5, 3, 4, 5, 3, 1, 4], style: 'bouncy', seed: 3 },
  meadow: { bpm: 118, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], bars: [0, 3, 5, 4, 3, 4, 5, 4], style: 'wander', seed: 11 },
  well: { bpm: 84, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], bars: [0, 5, 3, 6, 5, 3, 6, 4], style: 'sparse', seed: 7 },
  temple: { bpm: 92, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], bars: [0, 6, 3, 4, 5, 6, 3, 4], style: 'sparse', seed: 19 },
  crypt: { bpm: 70, root: 52, scale: [0, 1, 3, 5, 7, 8, 10], bars: [0, 1, 0, 6, 5, 1, 6, 0], style: 'drone', seed: 23 },
  vault: { bpm: 76, root: 53, scale: [0, 2, 4, 6, 7, 9, 11], bars: [0, 1, 4, 0, 3, 4, 1, 0], style: 'dream', seed: 31 },
};

export const STEPS_PER_BAR = 16;
export const BARS = 8;

export interface Step {
  bass?: number;
  lead?: number;
  arp?: number;
  /** A held harmony note under the B section. */
  counter?: number;
  kick?: boolean;
  hat?: boolean;
  snare?: boolean;
  shimmer?: number;
  driveBass?: number;
  driveSnare?: boolean;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A two-bar phrase of scale degrees (null = rest). */
function motif(r: () => number, density: number, start: number): (number | null)[] {
  const out: (number | null)[] = [];
  let deg = start;
  for (let i = 0; i < 32; i++) {
    const strong = i % 4 === 0;
    if (r() < (strong ? density + 0.25 : density * 0.6)) {
      deg += Math.round((r() - 0.5) * 4);
      deg = Math.max(0, Math.min(9, deg));
      out.push(deg);
    } else out.push(null);
  }
  return out;
}

const DENSITY: Record<Style, number> = { bouncy: 0.62, wander: 0.55, dream: 0.35, sparse: 0.22, drone: 0.22 };

function percussion(style: Style, s: number, bar: number): Pick<Step, 'kick' | 'hat' | 'snare'> {
  switch (style) {
    case 'bouncy':
      return { kick: s % 8 === 0, snare: s === 4 || s === 12, hat: s % 2 === 0 };
    case 'wander':
      return { kick: s === 0 || s === 10, hat: s % 4 === 2 };
    case 'sparse':
      // A low knock on the downbeat and a shaker at the end of every other bar.
      return { kick: s === 0, hat: s === 14 && bar % 2 === 1 };
    case 'drone':
      // A heartbeat: lub-dub.
      return { kick: s === 0 || s === 3 };
    case 'dream':
      return { hat: s % 8 === 4 };
  }
}

/** Builds the whole 128-step loop for a song. */
export function compose(song: Song): Step[] {
  const r = rng(song.seed);
  const len = song.scale.length;
  const note = (degree: number, octave = 0) => {
    const oct = Math.floor(degree / len) + octave;
    return song.root + song.scale[((degree % len) + len) % len]! + oct * 12;
  };
  const density = DENSITY[song.style];
  // One phrase for the A sections, a higher answering one for B: memorable beats random.
  const a = motif(r, density, 2);
  const b = motif(r, density * 0.85, 4);
  const steps: Step[] = [];
  for (let bar = 0; bar < BARS; bar++) {
    const chord = song.bars[bar % song.bars.length]!;
    const inB = bar === 4 || bar === 5;
    const phrase = inB ? b : a;
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const i = (bar % 2) * STEPS_PER_BAR + s;
      const step: Step = { ...percussion(song.style, s, bar) };
      if (song.style === 'drone') {
        if (s === 0) step.bass = note(chord, -1);
        if (s === 8 && r() < 0.5) step.lead = note(chord + 4, 1);
        if (inB && s === 0) step.counter = note(chord + 2);
      } else {
        if (s % (song.style === 'bouncy' ? 4 : 8) === 0) step.bass = note(chord + (s === 8 ? 4 : 0), -1);
        const m = phrase[i];
        const lift = song.style === 'dream' ? 1 : 0;
        if (bar === BARS - 1 && s >= 8) {
          // The last bar comes home: one long chord tone, then air.
          if (s === 8) step.lead = note(chord, lift);
        } else if (m !== null && m !== undefined) {
          // A' nudges the end of its phrase up a step, so the repeat is a reply.
          step.lead = note(m + (bar === 3 && s > 8 ? 1 : 0), lift);
        }
        if (song.style === 'wander' || song.style === 'dream') {
          if (s % 2 === 0) step.arp = note(chord + [0, 2, 4, 7][(s / 2) % 4]!, 1);
        }
        if (inB && s === 0) step.counter = note(chord + 2);
      }
      if (s % 2 === 0) step.shimmer = note(chord + [0, 2, 4, 6][(s / 2) % 4]!, 2);
      if (s % 2 === 0) step.driveBass = note(chord + (s % 8 === 6 ? 4 : 0), -1);
      step.driveSnare = s % 8 === 4;
      steps.push(step);
    }
  }
  return steps;
}

/** Seconds per sixteenth note. */
export function stepLength(song: Song): number {
  return 60 / song.bpm / 4;
}

/** How wet each region's room is: [send level, tail length in seconds]. */
export const ROOMS: Record<Region | 'none', [number, number]> = {
  none: [0.06, 0.8],
  home: [0.07, 0.6],
  meadow: [0.04, 0.9],
  well: [0.32, 2.6],
  temple: [0.22, 2.0],
  crypt: [0.34, 3.0],
  vault: [0.4, 3.6],
};
