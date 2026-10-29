import { describe, expect, it } from 'vitest';
import { NARRATOR, pauseAfter, speaks, syllable, voiceFor, VOICES } from '@/engine/voices';
import { MAPS } from '@/content/maps';

describe('voices', () => {
  it('gives everyone CK can talk to a voice of their own', () => {
    const sprites = new Set<string>();
    for (const map of Object.values(MAPS)) for (const e of map.entities) if (e.kind === 'npc') sprites.add(e.sprite);
    for (const sprite of sprites) expect(voiceFor(sprite), sprite).not.toBe(NARRATOR);
  });

  it('sounds like who it is: Shellby is slow and low, Pip is quick and high', () => {
    expect(VOICES.tortoise!.base).toBeLessThan(VOICES.dad!.base);
    expect(VOICES.tortoise!.cps).toBeLessThan(VOICES.dad!.cps);
    expect(VOICES.bat!.base).toBeGreaterThan(VOICES.magpie!.base);
  });

  it('says the same letter the same way every time', () => {
    const v = VOICES.magpie!;
    expect(syllable(v, 'k', 0.2, false)).toEqual(syllable(v, 'K', 0.2, false));
  });

  it('stays inside the voice range, and lifts at the end of a question', () => {
    const v = VOICES.dad!;
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      const semis = 12 * Math.log2(syllable(v, ch, 0.1, false).freq / v.base);
      expect(Math.abs(semis)).toBeLessThanOrEqual(v.range + 1e-9);
    }
    expect(syllable(v, 'a', 0.95, true).freq).toBeGreaterThan(syllable(v, 'a', 0.95, false).freq);
  });

  it('speaks every other letter, never punctuation, and breathes at the end of a sentence', () => {
    expect(speaks('a', 0)).toBe(true);
    expect(speaks('a', 1)).toBe(false);
    expect(speaks('!', 0)).toBe(false);
    expect(pauseAfter('.')).toBeGreaterThan(pauseAfter(','));
    expect(pauseAfter('a')).toBe(0);
  });
});
