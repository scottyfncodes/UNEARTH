import { describe, expect, it } from 'vitest';
import { idleMood, NAP_AFTER, SIT_AFTER } from '@/render/ck';

describe('idleMood', () => {
  it('stands while CK has just done something', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) expect(idleMood(facing, 0)).toBe('stand');
    expect(idleMood('down', SIT_AFTER - 0.1)).toBe('stand');
  });

  it('sits down facing the player, and washes now and then', () => {
    expect(idleMood('down', SIT_AFTER + 0.5)).toBe('sit');
    const moods = new Set<string>();
    for (let t = SIT_AFTER; t < NAP_AFTER; t += 0.1) moods.add(idleMood('down', t));
    expect(moods).toEqual(new Set(['sit', 'groom']));
  });

  it('flicks its tail facing sideways and listens behind facing away', () => {
    const side = new Set<string>();
    const back = new Set<string>();
    for (let t = SIT_AFTER; t < NAP_AFTER; t += 0.1) {
      side.add(idleMood('right', t));
      back.add(idleMood('up', t));
    }
    expect(side).toEqual(new Set(['stand', 'flick']));
    expect(back).toEqual(new Set(['stand', 'ear']));
  });

  it('naps eventually, whichever way it was facing', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) expect(idleMood(facing, NAP_AFTER + 1)).toBe('nap');
  });
});
