/**
 * The collar doesn't say "dig here" — it says "something's near," and lets
 * the tile kind (buried vs. mechanism) hint at what kind of something. A
 * buried reading rewards digging; a mechanism reading rewards caution.
 */
import type { GameMap, GameState, Vec2 } from './types';
import { isTrapDisarmed, mapStateOf } from './world';

export type SignalKind = 'buried' | 'mechanism' | null;

export interface DetectorReading {
  strength: number;
  kind: SignalKind;
  distance: number;
}

export const DETECTOR_RADIUS = 5;

function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function strengthFor(distance: number): number {
  return Math.max(0, 1 - distance / (DETECTOR_RADIUS + 1));
}

export function computeDetectorReading(map: GameMap, state: GameState, from: Vec2 = state.player.pos): DetectorReading {
  const mapState = mapStateOf(state, map.id);
  let best: DetectorReading = { strength: 0, kind: null, distance: Infinity };

  for (const tileKey of Object.keys(map.buried)) {
    if (mapState.dug[tileKey]) continue;
    const [x, y] = tileKey.split(',').map(Number) as [number, number];
    const distance = chebyshev(from, { x, y });
    if (distance <= DETECTOR_RADIUS && distance < best.distance) {
      best = { strength: strengthFor(distance), kind: 'buried', distance };
    }
  }

  for (const entity of map.entities) {
    if (entity.kind !== 'trap' || !entity.detectable || isTrapDisarmed(entity, state)) continue;
    const distance = chebyshev(from, entity.pos);
    if (distance <= DETECTOR_RADIUS && distance < best.distance) {
      best = { strength: strengthFor(distance), kind: 'mechanism', distance };
    }
  }

  return best;
}
