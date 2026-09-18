/**
 * Digging is one action, one tile, one outcome: face a soft patch of ground
 * and press the action button. No sweeping, no tool durability — the
 * detector already told you where to look.
 */
import type { GameEvent, GameState, MapRegistry } from './types';
import { key, step } from './types';
import { addItem } from './inventory';
import { mapStateOf, terrainAt } from './world';

export function attemptDig(maps: MapRegistry, state: GameState): { state: GameState; events: GameEvent[] } {
  const map = maps[state.mapId]!;
  const target = step(state.player.pos, state.player.facing);
  const terrain = terrainAt(map, target);
  const mapState = mapStateOf(state, map.id);
  const tileKey = key(target);

  if (terrain !== 'diggable' || mapState.dug[tileKey]) {
    return { state, events: [{ type: 'dig-empty' }] };
  }

  const dug = { ...mapState.dug, [tileKey]: true as const };
  let next: GameState = { ...state, mapStates: { ...state.mapStates, [map.id]: { ...mapState, dug } } };

  const buried = map.buried[tileKey];
  if (!buried) {
    return { state: next, events: [{ type: 'dig-empty' }] };
  }

  next = addItem(next, buried.itemId);
  return { state: next, events: [{ type: 'reveal', itemId: buried.itemId }] };
}
