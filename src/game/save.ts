/**
 * A minimal localStorage save — flags, inventory, clues, position, hearts.
 * No slots, no cloud sync: this is a personal-project save, not a service.
 */
import type { GameState } from './types';

// v2: the world was rebuilt around CK's full journey; v1 positions no longer mean anything.
const SAVE_KEY = 'unearth.save.v2';

type Persisted = Omit<GameState, 'dialogue' | 'timed'>;

/** Dialogue and timed hazards are moments, not progress — neither is saved. */
export function serialize(state: GameState): string {
  const { dialogue: _dialogue, timed: _timed, ...persisted } = state;
  return JSON.stringify(persisted);
}

export function deserialize(json: string, fallback: GameState): GameState {
  try {
    const parsed = JSON.parse(json) as Partial<Persisted> & { timed?: unknown };
    const { timed: _timed, ...rest } = parsed;
    return { ...fallback, ...rest, dialogue: null };
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
