/**
 * The live game store: one Store<GameState>, one dispatch function. Anything
 * that needs to react to a state change (HUD, canvas, audio) subscribes;
 * anything that wants to change state calls dispatch() and gets the events
 * that resulted, so it can play a sound or show a toast without the engine
 * needing to know sound or toasts exist.
 */
import type { Action, GameEvent, GameState } from '@/game/types';
import { createEngineContext, createInitialState } from '@/content/initialState';
import { reduce } from '@/game/engine';
import { loadGame, saveGame } from '@/game/save';
import { Store } from './store';

const ctx = createEngineContext();

export const game = new Store<GameState>(loadGame(createInitialState()));

export type EventListener = (event: GameEvent) => void;
const eventListeners = new Set<EventListener>();

export function onGameEvent(listener: EventListener): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function dispatch(action: Action): GameEvent[] {
  const before = game.get();
  const { state, events } = reduce(ctx, before, action);
  game.set(state);
  for (const event of events) {
    for (const listener of [...eventListeners]) listener(event);
  }
  // Any change is saved — a plain step included, so a reload never loses ground.
  if (state !== before) saveGame(state);
  return events;
}

/** Whether this save has any progress at all — decides Begin vs Continue. */
export function hasProgress(): boolean {
  const s = game.get();
  const fresh = createInitialState();
  return (
    s.mapId !== fresh.mapId ||
    s.player.pos.x !== fresh.player.pos.x ||
    s.player.pos.y !== fresh.player.pos.y ||
    Object.keys(s.flags).length > 0 ||
    s.inventory.length > 0
  );
}

export function resetSave(): void {
  const fresh = createInitialState();
  game.set(fresh);
  saveGame(fresh);
}
