import { describe, expect, it } from 'vitest';
import {
  activeCatRoute,
  CAT_GAP_MIN,
  HUMAN_GAP_MIN,
  isCatOnlyGap,
  isCatPassable,
  isHumanPassable,
} from '@/systems/traversal';
import type { CatRouteZone } from '@/content/sites/types';

describe('gap classification', () => {
  it('nothing passes a gap narrower than the cat minimum', () => {
    expect(isCatPassable(CAT_GAP_MIN - 0.01)).toBe(false);
    expect(isCatPassable(CAT_GAP_MIN)).toBe(true);
  });

  it('a human needs the wider human minimum', () => {
    expect(isHumanPassable(HUMAN_GAP_MIN - 0.01)).toBe(false);
    expect(isHumanPassable(HUMAN_GAP_MIN)).toBe(true);
  });

  it('a gap wide enough for a human is never "cat-only"', () => {
    expect(isCatOnlyGap(HUMAN_GAP_MIN)).toBe(false);
    expect(isCatOnlyGap(HUMAN_GAP_MIN + 1)).toBe(false);
  });

  it('a gap too narrow for anything is never "cat-only" either', () => {
    expect(isCatOnlyGap(CAT_GAP_MIN - 0.01)).toBe(false);
  });

  it('is cat-only exactly in the band between the two minimums', () => {
    const midpoint = (CAT_GAP_MIN + HUMAN_GAP_MIN) / 2;
    expect(isCatOnlyGap(midpoint)).toBe(true);
  });
});

const ROUTE: CatRouteZone = {
  id: 'gap',
  kind: 'squeeze',
  position: { x: 10, y: 0, z: 6 },
  radius: 1.2,
  clearWidthM: 0.8,
  grantsFlag: 'used_gap',
  note: 'Barely wide enough for a cat.',
};

describe('activeCatRoute', () => {
  it('is null when CK is nowhere near any route', () => {
    expect(activeCatRoute(0, 0, [ROUTE])).toBeNull();
  });

  it('finds the route CK is standing inside', () => {
    expect(activeCatRoute(10, 6.5, [ROUTE])?.id).toBe('gap');
  });

  it('respects the route radius as a hard edge', () => {
    expect(activeCatRoute(10, 6 + 1.19, [ROUTE])?.id).toBe('gap');
    expect(activeCatRoute(10, 6 + 1.5, [ROUTE])).toBeNull();
  });

  it('picks the closest route when zones overlap', () => {
    const near: CatRouteZone = { ...ROUTE, id: 'near', position: { x: 10, y: 0, z: 6.2 } };
    expect(activeCatRoute(10, 6.3, [ROUTE, near])?.id).toBe('near');
  });
});
