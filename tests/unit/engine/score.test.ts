import { describe, expect, it } from 'vitest';
import { BARS, compose, ROOMS, SONGS, STEPS_PER_BAR } from '@/engine/score';

describe('the score', () => {
  it('gives every region a full eight-bar piece', () => {
    for (const [region, song] of Object.entries(SONGS)) {
      expect(song.bars, region).toHaveLength(BARS);
      expect(compose(song), region).toHaveLength(BARS * STEPS_PER_BAR);
    }
  });

  it('always composes the same tune for the same region', () => {
    expect(compose(SONGS.meadow)).toEqual(compose(SONGS.meadow));
  });

  it('keeps every note in its key', () => {
    for (const [region, song] of Object.entries(SONGS)) {
      const inKey = new Set(song.scale.map((d) => d % 12));
      for (const step of compose(song)) {
        for (const n of [step.bass, step.lead, step.arp, step.counter, step.shimmer, step.driveBass]) {
          if (n === undefined) continue;
          expect(inKey.has((((n - song.root) % 12) + 12) % 12), `${region} ${n}`).toBe(true);
        }
      }
    }
  });

  it('has a B section that is its own phrase, and a last bar that comes home', () => {
    for (const song of Object.values(SONGS)) {
      if (song.style === 'drone') continue;
      const steps = compose(song);
      const leads = (bar: number) => steps.slice(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR).map((s) => s.lead);
      expect(leads(4)).not.toEqual(leads(0));
      expect(leads(BARS - 1).slice(9).every((n) => n === undefined)).toBe(true);
    }
  });

  it('carries layers for the collar and for danger under every bar', () => {
    for (const song of Object.values(SONGS)) {
      const steps = compose(song);
      expect(steps.filter((s) => s.shimmer !== undefined)).toHaveLength((BARS * STEPS_PER_BAR) / 2);
      expect(steps.some((s) => s.driveSnare)).toBe(true);
    }
  });

  it('makes the deep places ring more than the open air', () => {
    expect(ROOMS.crypt[0]).toBeGreaterThan(ROOMS.temple[0]);
    expect(ROOMS.temple[0]).toBeGreaterThan(ROOMS.meadow[0]);
    expect(ROOMS.vault[1]).toBeGreaterThan(ROOMS.home[1]);
  });
});
