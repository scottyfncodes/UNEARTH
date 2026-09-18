/**
 * The single dispatch point: one action in, one new state + a list of
 * semantic events out. Every action is followed by an auto-assembly check,
 * so fragments click together the instant CK is carrying the full set,
 * regardless of whether the last one came from digging or a house pickup.
 */
import type { Action, GameEvent, GameState, MapRegistry } from './types';
import { attemptMove } from './movement';
import { attemptDig } from './dig';
import { attemptInteract } from './interact';
import { findAssembly, type ArtifactRecipe } from './artifacts';
import { addItem, removeItems } from './inventory';

export type { MapRegistry } from './types';

export interface EngineContext {
  maps: MapRegistry;
  recipes: readonly ArtifactRecipe[];
}

function applyAutoAssembly(state: GameState, recipes: readonly ArtifactRecipe[]): { state: GameState; events: GameEvent[] } {
  const found = findAssembly(state.inventory, recipes);
  if (!found) return { state, events: [] };
  const next = addItem(removeItems(state, found.consumed), found.artifactId);
  return { state: next, events: [{ type: 'assemble', artifactId: found.artifactId }] };
}

export function reduce(ctx: EngineContext, state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  let result: { state: GameState; events: GameEvent[] };
  switch (action.type) {
    case 'move':
      result = attemptMove(ctx.maps, state, action.direction);
      break;
    case 'dig':
      result = attemptDig(ctx.maps, state);
      break;
    case 'interact':
      result = attemptInteract(ctx.maps, state);
      break;
    case 'toggleTool':
      result = { state: { ...state, tool: state.tool === 'detector' ? 'paws' : 'detector' }, events: [] };
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(exhaustive)}`);
    }
  }
  const assembled = applyAutoAssembly(result.state, ctx.recipes);
  return { state: assembled.state, events: [...result.events, ...assembled.events] };
}
