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
 * Widens the exit test for whichever route is already active, metres. CK's
 * position is only sampled once a frame, not continuously, so without this a
 * player idling exactly on a zone's edge could see the crouch pose flicker
 * on and off; leaving needs a slightly more deliberate step out than
 * entering did.
 */
const EXIT_HYSTERESIS_M = 0.15;

/**
 * The cat route CK is currently standing inside, if any — closest first, so
 * two overlapping zones never fight over which one fires. Pass the id of
 * whichever route was active last frame (or null) as `currentId` so leaving
 * one requires clearing its radius by a small margin rather than flickering
 * at the exact boundary.
 */
export function activeCatRoute(
  x: number,
  z: number,
  routes: readonly CatRouteZone[],
  currentId?: string | null,
): CatRouteZone | null {
  let best: CatRouteZone | null = null;
  let bestDist = Infinity;
  for (const route of routes) {
    const dist = Math.hypot(x - route.position.x, z - route.position.z);
    const effectiveRadius = route.id === currentId ? route.radius + EXIT_HYSTERESIS_M : route.radius;
    if (dist > effectiveRadius) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = route;
    }
  }
  return best;
}
