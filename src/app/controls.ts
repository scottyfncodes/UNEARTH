/**
 * One place that turns "the player pressed something" into game actions,
 * shared by the touch buttons and the keyboard so both feel identical.
 *
 * Direction: pressing a direction CK isn't facing turns CK on the spot
 * first; keep holding and CK sets off walking a beat later. That is what
 * makes sweeping the collar around possible — tap to turn and listen —
 * while holding still just walks. Holding walks at a steady trot, which
 * matters: a trot carries CK off a trigger strip before the darts come.
 *
 * Dig: a real dig takes a moment — scoops of dirt, a hole opening — and
 * only then does the ground give up whatever it was hiding. Hop: a short
 * arc two tiles forward. Both briefly lock movement so a hop can't be
 * steered mid-air and a dig can't be walked away from.
 */
import { dispatch, game } from '@/core/game';
import { isBlocking } from '@/core/ui';
import { checkDig } from '@/game/dig';
import { MAPS } from '@/content/maps';
import { step, type Direction } from '@/game/types';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { fx } from '@/render/fx';
import { PALETTES } from '@/render/palette';
import { createEngineContext } from '@/content/initialState';

const ctx = createEngineContext();

export const WALK_REPEAT_MS = 140;
const FIRST_REPEAT_MS = 240;
const TURN_THEN_WALK_MS = 150;
export const DIG_MS = 820;
export const HOP_MS = 300;

let busyUntil = 0;
let held: Direction | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function now(): number {
  return performance.now();
}

export function isBusy(): boolean {
  return now() < busyUntil;
}

function canAct(): boolean {
  return !isBlocking() && !isBusy();
}

function stepOnce(dir: Direction): void {
  if (!canAct()) return;
  const s = game.get();
  if (s.dialogue) return;
  dispatch({ type: 'move', direction: dir });
}

function schedule(ms: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (!held) return;
    stepOnce(held);
    schedule(WALK_REPEAT_MS);
  }, ms);
}

export function pressDirection(dir: Direction): void {
  held = dir;
  const s = game.get();
  if (!canAct() || s.dialogue) {
    // Still let a held button start walking once whatever is in the way clears.
    schedule(WALK_REPEAT_MS);
    return;
  }
  if (s.player.facing !== dir) {
    dispatch({ type: 'turn', direction: dir });
    schedule(TURN_THEN_WALK_MS);
    return;
  }
  stepOnce(dir);
  schedule(FIRST_REPEAT_MS);
}

export function releaseDirection(dir?: Direction): void {
  if (dir && held !== dir) return;
  held = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function pressInteract(): void {
  if (isBlocking() || isBusy()) return;
  dispatch({ type: 'interact' });
}

export function pressDig(): void {
  if (!canAct()) return;
  const s = game.get();
  if (s.dialogue) return;
  const check = checkDig(ctx.maps, s);
  if (check !== 'soft') {
    dispatch({ type: 'dig' });
    return;
  }
  const tile = step(s.player.pos, s.player.facing);
  const soil = PALETTES[MAPS[s.mapId]!.region].diggable;
  busyUntil = now() + DIG_MS;
  fx.startDig(tile, soil, DIG_MS / 1000);
  // Scoop, scoop, scoop — then the ground answers.
  for (let i = 0; i < 4; i++) setTimeout(() => audio.scrape(i), i * 190);
  haptics.tap();
  const mapId = s.mapId;
  setTimeout(() => {
    const cur = game.get();
    // Only land the dig if CK is still exactly where it started (a trap may have moved CK).
    if (cur.mapId === mapId && cur.player.pos.x === s.player.pos.x && cur.player.pos.y === s.player.pos.y && cur.player.facing === s.player.facing) {
      dispatch({ type: 'dig' });
    }
  }, DIG_MS);
}

export function pressJump(): void {
  if (!canAct()) return;
  if (game.get().dialogue) return;
  busyUntil = now() + HOP_MS - 40;
  dispatch({ type: 'jump' });
}

export function lockFor(ms: number): void {
  busyUntil = Math.max(busyUntil, now() + ms);
}
