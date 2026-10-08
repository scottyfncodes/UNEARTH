import { describe, expect, it } from 'vitest';
import { canSpell, GLYPH_HEIGHT, GLYPHS, integerScale, lineWidth, measure } from '@/render/pixelFont';
import { MAPS } from '@/content/maps';

describe('pixel font', () => {
  it('has square-cut glyphs: seven rows, every row the same width', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(GLYPH_HEIGHT);
      expect(new Set(rows.map((r) => r.length)).size, ch).toBe(1);
    }
  });

  it('can spell everything the title screen says, including every room name', () => {
    for (const text of ['UNEARTH', "DAD'S GONE OUT.\nCK'S ON THE CASE.", 'FOLLOW THE TRAIL', 'KEEP DIGGING', "SOUND ON. THE COLLAR SINGS\nWHEN SOMETHING'S BURIED.", '16/16 SHINIES · 5/5 PAGES']) {
      expect(canSpell(text), text).toBe(true);
    }
    for (const map of Object.values(MAPS)) expect(canSpell(`CK IS IN ${map.name}`), map.name).toBe(true);
  });

  it('measures lines with one pixel between letters', () => {
    expect(lineWidth('UNEARTH')).toBe(7 * 5 + 6);
    expect(measure('A\nAB', 3)).toMatchObject({ width: 11, height: 17 });
  });

  it('scales by whole screen pixels, never past the width it is given', () => {
    expect(integerScale(41, 6, 320, 2)).toBe(12);
    expect(integerScale(41, 6, 160, 2)).toBe(7);
    expect(integerScale(41, 0.1, 320, 1)).toBe(1);
    expect(integerScale(1000, 6, 100, 1)).toBe(1);
  });
});
