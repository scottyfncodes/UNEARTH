import { useSyncExternalStore } from 'react';
import { game } from '@/core/game';
import type { GameState } from '@/game/types';

export function useGameState(): GameState {
  return useSyncExternalStore(
    (listener) => game.subscribe(listener),
    () => game.get(),
  );
}
