/**
 * Cat-specific traversal.
 *
 * Deliberately not a physics system. CK's own collision radius (see
 * PLAYER_RADIUS in systems/explore.ts) already decides what he can physically
 * walk through — there is no separate, larger "human" collider in this game
 * to mechanically exclude. What this module adds is the narrative layer on
 * top: a way for a site to say "this gap is CK's alone" and have that claim
 * be a checkable number instead of just a comment, plus the trigger zones
 * that credit CK for using one.
 */
import type { CatRouteZone } from '@/content/sites/types';

/** Minimum clear width CK's own body can fit through, metres. */
export const CAT_GAP_MIN = 0.5;

/** Reference minimum for a full-grown adult — below this, a person doesn't fit. */
export const HUMAN_GAP_MIN = 1.1;

export function isCatPassable(clearWidthM: number): boolean {
  return clearWidthM >= CAT_GAP_MIN;
}

export function isHumanPassable(clearWidthM: number): boolean {
  return clearWidthM >= HUMAN_GAP_MIN;
}

/** A gap CK fits through that a grown adult would not — the point of a cat route. */
export function isCatOnlyGap(clearWidthM: number): boolean {
  return isCatPassable(clearWidthM) && !isHumanPassable(clearWidthM);
}

/**
 * The cat route CK is currently standing inside, if any — closest first, so
 * two overlapping zones never fight over which one fires.
 */
export function activeCatRoute(x: number, z: number, routes: readonly CatRouteZone[]): CatRouteZone | null {
  let best: CatRouteZone | null = null;
  let bestDist = Infinity;
  for (const route of routes) {
    const dist = Math.hypot(x - route.position.x, z - route.position.z);
    if (dist > route.radius) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = route;
    }
  }
  return best;
}
