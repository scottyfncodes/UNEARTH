import type { GameState } from '@/game/types';
import { MAPS } from './maps';
import { RECIPES } from './recipes';
import type { EngineContext } from '@/game/engine';

export function createInitialState(): GameState {
  const home = MAPS.home!;
  return {
    mapId: home.id,
    player: { pos: home.defaultSpawn, facing: 'down' },
    hearts: 3,
    maxHearts: 3,
    tool: 'detector',
    detectorOn: true,
    inventory: [],
    flags: {},
    clues: [],
    mapStates: {},
    dialogue: null,
  };
}

export function createEngineContext(): EngineContext {
  return { maps: MAPS, recipes: RECIPES };
}
