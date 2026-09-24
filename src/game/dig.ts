/**
 * Digging: face a patch of soft ground and dig. There is no mound saying
 * "here" — soft ground is everywhere outdoors and in plenty of places
 * indoors, and most of it hides nothing. The collar, the room, and CK's own
 * nose are how you decide where a dig is worth it.
 *
 * Three honest outcomes: something worth having, junk (the collar heard it
 * too — just duller), or dirt. And one joke: a hole somebody already dug,
 * a long time ago.
 */
import type { GameEvent, GameState, MapRegistry } from './types';
import { key, step } from './types';
import { addClue, addItem } from './inventory';
import { dressingAt, entitiesAt, isSoftGround, mapStateOf } from './world';

export type DigCheck = 'soft' | 'hard' | 'dug' | 'old';

/** What a dig in front of CK would meet, without doing it — so the UI can play the dig before it lands. */
export function checkDig(maps: MapRegistry, state: GameState): DigCheck {
  const map = maps[state.mapId]!;
  const target = step(state.player.pos, state.player.facing);
  if (!isSoftGround(map, target)) return 'hard';
  if (dressingAt(map, target)?.solid) return 'hard';
  if (entitiesAt(map, state, target).some((e) => e.kind !== 'decoration' || !e.walkable)) return 'hard';
  const tileKey = key(target);
  if (mapStateOf(state, map.id).dug[tileKey]) return 'dug';
  if (map.oldHoles[tileKey]) return 'old';
  return 'soft';
}

export function attemptDig(maps: MapRegistry, state: GameState): { state: GameState; events: GameEvent[] } {
  const map = maps[state.mapId]!;
  const target = step(state.player.pos, state.player.facing);
  const mapState = mapStateOf(state, map.id);
  const tileKey = key(target);

  const check = checkDig(maps, state);
  if (check === 'hard') return { state, events: [{ type: 'dig-hard' }] };
  if (check === 'dug') return { state, events: [{ type: 'dig-empty' }] };
  if (check === 'old') return { state, events: [{ type: 'dig-old' }] };

  const dug = { ...mapState.dug, [tileKey]: true as const };
  let next: GameState = { ...state, mapStates: { ...state.mapStates, [map.id]: { ...mapState, dug } } };

  const buried = map.buried[tileKey];
  if (!buried) return { state: next, events: [{ type: 'dig-empty' }] };
  if (buried.junk !== undefined) {
    const events: GameEvent[] = [{ type: 'dig-junk', line: buried.junk }];
    if (buried.clueId && !next.clues.includes(buried.clueId)) {
      next = addClue(next, buried.clueId);
      events.push({ type: 'clue', clueId: buried.clueId });
    }
    return { state: next, events };
  }

  next = addItem(next, buried.itemId);
  return { state: next, events: [{ type: 'reveal', itemId: buried.itemId }] };
}
