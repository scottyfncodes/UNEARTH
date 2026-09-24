/**
 * The collar is a direction finder, not a "you are near it" light.
 *
 * Three things shape a reading:
 *  - proximity — how close CK is to the source. It sets how fast the collar
 *    pings: faster means closer, whichever way CK is facing.
 *  - aim — how squarely CK is facing it. Facing away, the ping is dull and
 *    muffled; turning toward it, it sharpens and brightens. So you can hear
 *    "it's close, but I'm facing the wrong way", turn on the spot, and hear
 *    it snap into focus.
 *  - obstruction — every wall between CK and the source muffles it further.
 *
 * When the source sits exactly on the tile CK is facing, the reading is
 * `locked`: that is the "there it is" chirp, and it is the only reading that
 * says *this* tile rather than *that way*.
 *
 * Junk is audible too — a tin, a nail, a tent peg. It rings duller than the
 * real thing, which a patient listener learns to tell apart. A mechanism
 * (usually a trap) warbles low instead.
 */
import type { GameMap, GameState, Vec2 } from './types';
import { step } from './types';
import { isTrapDisarmed, mapStateOf } from './world';

export type SignalKind = 'buried' | 'mechanism' | null;

export interface DetectorReading {
  /** Overall 0..1 — what the HUD bars show. */
  strength: number;
  kind: SignalKind;
  /** Euclidean distance in tiles to the source. */
  distance: number;
  /** 0..1 from distance alone: sets the ping rate. */
  proximity: number;
  /** 0..1 from facing alone: sets the ping's clarity. */
  aim: number;
  /** The source is exactly on the tile CK is facing. */
  locked: boolean;
  /** Buried readings only: whether it rings like treasure or like junk. */
  junk: boolean;
}

export const DETECTOR_RADIUS = 5;

const FACING: Record<GameState['player']['facing'], Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Walls strictly between `a` and `b` on a straight line — each muffles the signal. */
function wallsBetween(map: GameMap, a: Vec2, b: Vec2): number {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  let walls = 0;
  let last = '';
  for (let i = 1; i < steps; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
    const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
    const k = `${x},${y}`;
    if (k === last) continue;
    last = k;
    if (map.tiles[y]?.[x] === 'wall') walls++;
  }
  return walls;
}

function aimAt(from: Vec2, facing: Vec2, source: Vec2): number {
  const dx = source.x - from.x;
  const dy = source.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 1;
  const cos = (dx * facing.x + dy * facing.y) / len;
  return Math.max(0, cos);
}

const NOTHING: DetectorReading = { strength: 0, kind: null, distance: Infinity, proximity: 0, aim: 0, locked: false, junk: false };

export function computeDetectorReading(map: GameMap, state: GameState, from: Vec2 = state.player.pos): DetectorReading {
  const mapState = mapStateOf(state, map.id);
  const facing = FACING[state.player.facing];
  const ahead = step(from, state.player.facing);
  let best = NOTHING;

  const consider = (source: Vec2, kind: Exclude<SignalKind, null>, junk: boolean) => {
    const distance = Math.hypot(source.x - from.x, source.y - from.y);
    if (distance > DETECTOR_RADIUS + 0.5) return;
    const proximity = Math.max(0, 1 - distance / (DETECTOR_RADIUS + 1));
    const aim = aimAt(from, facing, source);
    const muffle = Math.pow(0.55, wallsBetween(map, from, source));
    const locked = source.x === ahead.x && source.y === ahead.y;
    // Facing away still hears it — just faintly. Facing it, it is loud.
    const strength = Math.min(1, proximity * (0.3 + 0.7 * aim) * muffle * (junk ? 0.85 : 1) + (locked ? 0.1 : 0));
    if (strength > best.strength) best = { strength, kind, distance, proximity: proximity * muffle, aim, locked, junk };
  };

  for (const [tileKey, buried] of Object.entries(map.buried)) {
    if (mapState.dug[tileKey]) continue;
    const [x, y] = tileKey.split(',').map(Number) as [number, number];
    consider({ x, y }, 'buried', buried.junk !== undefined);
  }

  for (const entity of map.entities) {
    if (entity.kind !== 'trap' || !entity.detectable || isTrapDisarmed(entity, state)) continue;
    consider(entity.pos, 'mechanism', false);
  }

  return best;
}
