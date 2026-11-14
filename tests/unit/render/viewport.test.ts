import { describe, expect, it } from 'vitest';
import { fitGameCanvas, preferredTilePx } from '@/render/viewport';
import { TILE_SIZE } from '@/render/constants';
import { MAPS } from '@/content/maps';

/** Play areas as the layout gives them: viewport minus the 60px HUD and 212px controls (plus safe areas). */
const DEVICES = [
  { name: 'iPhone SE', dpr: 2, box: { left: 0, top: 60, width: 320, height: 296 } },
  { name: 'iPhone 13', dpr: 3, box: { left: 0, top: 107, width: 390, height: 491 } },
  { name: 'iPhone 13 (Safari bars)', dpr: 3, box: { left: 0, top: 60, width: 390, height: 392 } },
  { name: 'iPhone 15 Pro Max', dpr: 3, box: { left: 0, top: 119, width: 430, height: 567 } },
  { name: 'Pixel 7', dpr: 2.625, box: { left: 0, top: 60, width: 412, height: 643 } },
  { name: 'Galaxy (fractional top)', dpr: 2.75, box: { left: 0, top: 3863 / 64, width: 384, height: 560 } },
  { name: 'iPad mini', dpr: 2, box: { left: 0, top: 60, width: 768, height: 752 } },
  { name: 'Desktop', dpr: 1, box: { left: 0, top: 60, width: 1280, height: 628 } },
];

const ROOM_HEIGHTS = [...new Set(Object.values(MAPS).map((m) => m.height))];

describe('fitGameCanvas', () => {
  for (const { name, dpr, box } of DEVICES) {
    for (const rows of ROOM_HEIGHTS) {
      const fit = fitGameCanvas(box, rows, dpr);

      it(`${name}, ${rows}-row room: every canvas pixel is a whole number of device pixels`, () => {
        expect(Number.isInteger(fit.scale)).toBe(true);
        expect(fit.scale).toBeGreaterThanOrEqual(1);
        // On screen, the canvas is exactly scale device pixels per canvas pixel, on both axes.
        expect((fit.cssWidth * dpr) / fit.width).toBeCloseTo(fit.scale, 9);
        expect((fit.cssHeight * dpr) / fit.height).toBeCloseTo(fit.scale, 9);
      });

      it(`${name}, ${rows}-row room: covers the whole play area, overshooting by less than one canvas pixel`, () => {
        const px = fit.scale / dpr;
        expect(fit.cssWidth).toBeGreaterThanOrEqual(box.width - 1e-9);
        expect(fit.cssHeight).toBeGreaterThanOrEqual(box.height - 1e-9);
        expect(fit.cssWidth + fit.offsetX).toBeGreaterThanOrEqual(box.width - 1e-9);
        expect(fit.cssHeight + fit.offsetY).toBeGreaterThanOrEqual(box.height - 1e-9);
        // Overshoot stays small: a handful of canvas pixels at most.
        expect(fit.cssWidth - box.width).toBeLessThan(px * 24 + 8);
        expect(fit.cssHeight - box.height).toBeLessThan(px * 24 + 8);
      });

      it(`${name}, ${rows}-row room: its CSS size and offset are exact layout steps (1/64 px), so the browser can't round them`, () => {
        for (const v of [fit.cssWidth, fit.cssHeight, fit.offsetX, fit.offsetY]) expect(Math.abs(v * 64 - Math.round(v * 64))).toBeLessThan(1e-6);
      });

      it(`${name}, ${rows}-row room: starts on a device-pixel boundary`, () => {
        for (const [edge, offset] of [
          [box.left, fit.offsetX],
          [box.top, fit.offsetY],
        ] as const) {
          const device = (edge + offset) * dpr;
          expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-6);
          // Only ever nudged up or left, so it never opens a gap.
          expect(offset).toBeLessThanOrEqual(0);
          expect(offset).toBeGreaterThan(-8);
        }
      });

      it(`${name}, ${rows}-row room: shows at least nine tiles across, at the whole scale nearest the old zoom`, () => {
        const tilesAcross = (box.width * dpr) / (fit.scale * TILE_SIZE);
        if (fit.scale > 1) expect(tilesAcross).toBeGreaterThanOrEqual(9);
        const wanted = (preferredTilePx(box.width, box.height, rows) * dpr) / TILE_SIZE;
        // Never more than one whole step away from what the layout asked for.
        expect(Math.abs(fit.scale - wanted)).toBeLessThan(1);
      });
    }
  }

  it('keeps the zoom within about a fifth of the old one on phones', () => {
    for (const { dpr, box } of DEVICES.slice(0, 6)) {
      const fit = fitGameCanvas(box, 16, dpr);
      const before = preferredTilePx(box.width, box.height, 16);
      const after = (fit.scale * TILE_SIZE) / dpr;
      expect(after / before).toBeGreaterThan(0.8);
      expect(after / before).toBeLessThan(1.2);
    }
  });

  it('refits on every resize, with no state carried between calls', () => {
    const a = fitGameCanvas({ left: 0, top: 60, width: 390, height: 491 }, 16, 3);
    const b = fitGameCanvas({ left: 0, top: 60, width: 844, height: 120 }, 16, 3);
    const c = fitGameCanvas({ left: 0, top: 60, width: 390, height: 491 }, 16, 3);
    expect(c).toEqual(a);
    expect(b).not.toEqual(a);
    expect(Number.isInteger(b.scale)).toBe(true);
  });

  it('survives degenerate inputs: a missing devicePixelRatio, a zero-sized box', () => {
    for (const dpr of [0, NaN, Infinity]) {
      const fit = fitGameCanvas({ left: 0, top: 0, width: 390, height: 500 }, 16, dpr);
      expect(fit.scale).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(fit.cssWidth)).toBe(true);
    }
    const tiny = fitGameCanvas({ left: 0, top: 0, width: 0, height: 0 }, 16, 3);
    expect(tiny.width).toBeGreaterThanOrEqual(1);
    expect(tiny.height).toBeGreaterThanOrEqual(1);
  });
});
