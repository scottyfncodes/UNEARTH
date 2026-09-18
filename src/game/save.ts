/**
 * A minimal localStorage save — flags, inventory, clues, position, hearts.
 * No slots, no cloud sync: this is a personal-project save, not a service.
 */
import type { GameState } from './types';

const SAVE_KEY = 'unearth.save.v1';

type Persisted = Omit<GameState, 'dialogue'>;

export function serialize(state: GameState): string {
  const { dialogue: _dialogue, ...persisted } = state;
  return JSON.stringify(persisted);
}

export function deserialize(json: string, fallback: GameState): GameState {
  try {
    const parsed = JSON.parse(json) as Partial<Persisted>;
    return { ...fallback, ...parsed, dialogue: null };
  } catch {
    return fallback;
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SAVE_KEY, serialize(state));
  } catch {
    // Storage full or disabled — the game keeps running without a save.
  }
}

export function loadGame(fallback: GameState): GameState {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(SAVE_KEY);
    return raw ? deserialize(raw, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function clearSave(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
