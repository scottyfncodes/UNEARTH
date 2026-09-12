import { useSyncExternalStore } from 'react';
import { game, type GameState } from '@/core/gameState';

/** Subscribes a component to the game store. */
export function useGame<T>(select: (state: GameState) => T): T {
  return useSyncExternalStore(
    (cb) => game.subscribe(cb),
    () => select(game.get()),
  );
}

export function useGameState(): GameState {
  return useSyncExternalStore(
    (cb) => game.subscribe(cb),
    () => game.get(),
  );
}
