import type { GameState } from './types';

export function addItem(state: GameState, itemId: string): GameState {
  if (state.inventory.includes(itemId)) return state;
  return { ...state, inventory: [...state.inventory, itemId] };
}

export function removeItems(state: GameState, itemIds: string[]): GameState {
  const drop = new Set(itemIds);
  return { ...state, inventory: state.inventory.filter((id) => !drop.has(id)) };
}

export function addClue(state: GameState, clueId: string): GameState {
  if (state.clues.includes(clueId)) return state;
  return { ...state, clues: [...state.clues, clueId] };
}

export function setFlag(state: GameState, flag: string, value = true): GameState {
  if (state.flags[flag] === value) return state;
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

export function hasFlag(state: GameState, flag: string): boolean {
  return !!state.flags[flag];
}
