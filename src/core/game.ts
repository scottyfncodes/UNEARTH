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
  const { state, events } = reduce(ctx, game.get(), action);
  game.set(state);
  for (const event of events) {
    for (const listener of [...eventListeners]) listener(event);
  }
  if (events.length > 0) saveGame(state);
  return events;
}

export function resetSave(): void {
  game.set(createInitialState());
}
