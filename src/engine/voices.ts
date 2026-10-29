/**
 * Everyone who talks to CK has a voice: not words, a little run of pitched
 * syllables, one per couple of letters, so you hear who is speaking and how.
 * Shellby is slow and low, the magpie chatters, Mortimer grumbles, Pip squeaks.
 *
 * Pure data and arithmetic: the same letter always lands on the same pitch, so
 * a name sounds the same every time it is said, and a question lifts at the end.
 */

export interface Voice {
  /** Centre pitch in Hz. */
  base: number;
  /** How far, in semitones, syllables wander either side of the centre. */
  range: number;
  wave: OscillatorType;
  /** Length of one syllable, seconds. */
  len: number;
  /** Letters revealed per second. */
  cps: number;
  /** Each syllable slides to base × slide over its length. */
  slide: number;
  gain: number;
}

const DAD: Voice = { base: 165, range: 5, wave: 'triangle', len: 0.075, cps: 36, slide: 0.94, gain: 0.11 };

export const VOICES: Record<string, Voice> = {
  dad: DAD,
  dadGroceries: DAD,
  tortoise: { base: 104, range: 3, wave: 'triangle', len: 0.13, cps: 19, slide: 0.88, gain: 0.12 },
  magpie: { base: 880, range: 9, wave: 'square', len: 0.035, cps: 50, slide: 1.18, gain: 0.05 },
  mole: { base: 150, range: 4, wave: 'sawtooth', len: 0.055, cps: 30, slide: 0.84, gain: 0.06 },
  bat: { base: 1320, range: 7, wave: 'sine', len: 0.032, cps: 44, slide: 1.3, gain: 0.07 },
};

/** Anyone not listed above: the room, a carving, a voice from nowhere. */
export const NARRATOR: Voice = { base: 420, range: 4, wave: 'triangle', len: 0.05, cps: 40, slide: 1, gain: 0.06 };

export function voiceFor(sprite: string | undefined): Voice {
  return (sprite && VOICES[sprite]) || NARRATOR;
}

const VOWELS = new Set('aeiouy');

/** Whether this character gets a syllable: every other letter, and never punctuation. */
export function speaks(ch: string, letterIndex: number): boolean {
  return /[a-z0-9]/i.test(ch) && letterIndex % 2 === 0;
}

/**
 * The pitch and length of the syllable on `ch`. `progress` (0-1) is how far
 * through the line it is, so a question can rise over its last stretch.
 */
export function syllable(voice: Voice, ch: string, progress: number, question: boolean): { freq: number; len: number } {
  const c = ch.toLowerCase().charCodeAt(0);
  const span = voice.range * 2 + 1;
  let semis = ((c * 7) % span) - voice.range;
  if (question && progress > 0.7) semis += Math.round((progress - 0.7) * 20);
  const vowel = VOWELS.has(ch.toLowerCase());
  return { freq: voice.base * Math.pow(2, semis / 12), len: voice.len * (vowel ? 1.35 : 1) };
}

/** Extra milliseconds to hold after `ch` before the next letter, the way people breathe. */
export function pauseAfter(ch: string): number {
  if (ch === ',' || ch === ';' || ch === ':') return 130;
  if (ch === '.' || ch === '!' || ch === '?') return 260;
  if (ch === '…') return 380;
  return 0;
}
