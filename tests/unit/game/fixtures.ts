import { buildMap } from '@/game/mapBuilder';
import type { ArtifactRecipe } from '@/game/artifacts';
import type { EngineContext } from '@/game/engine';
import type { GameState } from '@/game/types';

/**
 * A small hand-built two-room world exercising every mechanic: walls, a
 * diggable buried fragment, a cat-only gap, a movable block bridging a pit,
 * a pressure-plate dart trap, a switch- and artifact-gated door, an NPC with
 * a completion flag, a clue note, a decoration, a free-standing pickup, and
 * a flag-gated exit to a second room.
 */
export const room1 = buildMap({
  id: 'room1',
  name: 'Test Room 1',
  region: 'temple',
  rows: ['########', '#...DD.#', '#^.g#..#', '#....P.#', '#.....>#', '########'],
  entities: [
    {
      kind: 'npc',
      id: 'npc1',
      pos: { x: 1, y: 1 },
      name: 'Guide',
      lines: ['Hi there.', 'See you around.'],
      onCompleteFlag: 'metGuide',
      vanishesWhenFlag: 'metGuide',
    },
    {
      kind: 'door',
      id: 'door1',
      pos: { x: 6, y: 1 },
      requiresArtifact: 'key1',
      opensOnFlag: 'leverPulled',
      lockedMessage: 'Locked tight.',
    },
    { kind: 'switch', id: 'switch1', pos: { x: 2, y: 4 }, setsFlag: 'leverPulled' },
    { kind: 'block', id: 'block1', pos: { x: 1, y: 3 } },
    { kind: 'trap', id: 'trap1', pos: { x: 5, y: 3 }, trapType: 'dart', triggerPlate: { x: 5, y: 3 }, detectable: true },
    { kind: 'clueNote', id: 'note1', pos: { x: 3, y: 4 }, clueId: 'clueA' },
    { kind: 'decoration', id: 'deco1', pos: { x: 5, y: 4 }, spriteId: 'rock', clueId: 'clueB' },
    { kind: 'item', id: 'itemFragA', pos: { x: 6, y: 2 }, itemId: 'fragA' },
  ],
  buried: { '4,1': { itemId: 'fragB' } },
  exits: [{ at: { x: 6, y: 4 }, toMap: 'room2', spawn: { x: 1, y: 1 }, spawnFacing: 'down', requiresFlag: 'canLeave', lockedMessage: 'Not yet.' }],
  defaultSpawn: { x: 1, y: 4 },
});

export const room2 = buildMap({
  id: 'room2',
  name: 'Test Room 2',
  region: 'temple',
  rows: ['####', '#..#', '#..#', '####'],
  entities: [],
  defaultSpawn: { x: 1, y: 1 },
});

export const RECIPES: ArtifactRecipe[] = [{ id: 'key1', name: 'Test Key', requires: ['fragA', 'fragB'] }];

export const CTX: EngineContext = { maps: { room1, room2 }, recipes: RECIPES };

export function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    mapId: 'room1',
    player: { pos: { x: 1, y: 4 }, facing: 'down' },
    hearts: 3,
    maxHearts: 3,
    tool: 'detector',
    detectorOn: true,
    inventory: [],
    flags: {},
    clues: [],
    mapStates: {},
    dialogue: null,
    ...overrides,
  };
}
