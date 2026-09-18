/**
 * The vertical slice's world: CK's Home, the Outskirts path, and the
 * Forgotten Temple's three rooms. Small on purpose — every screen here
 * earns its place rather than padding out a bigger, emptier map.
 */
import { buildMap } from '@/game/mapBuilder';
import type { GameMap } from '@/game/types';

const home = buildMap({
  id: 'home',
  name: "CK's Home",
  region: 'home',
  rows: [
    '################',
    '#..............#',
    '#..............#',
    '#....##..##....#',
    '#....#....#....#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '########>#######',
  ],
  entities: [
    {
      kind: 'npc',
      id: 'npc_archaeologist',
      pos: { x: 7, y: 6 },
      name: 'The Archaeologist',
      lines: [
        "There you are. Careful up there, CK — that shelf isn't as sturdy as it looks.",
        "I've got a lead on something past the old ruins. Shouldn't take long.",
        "Hold down the fort. Back before you know it.",
      ],
      onCompleteFlag: 'archaeologistLeft',
      vanishesWhenFlag: 'archaeologistLeft',
    },
    {
      kind: 'clueNote',
      id: 'note_departure',
      pos: { x: 7, y: 6 },
      clueId: 'clue_departure_note',
      requiresFlag: 'archaeologistLeft',
    },
  ],
  exits: [{ at: { x: 8, y: 10 }, toMap: 'outskirts', spawn: { x: 8, y: 1 }, spawnFacing: 'down' }],
  defaultSpawn: { x: 7, y: 2 },
});

const outskirts = buildMap({
  id: 'outskirts',
  name: 'The Outskirts',
  region: 'outskirts',
  rows: [
    '########>#######',
    '#..............#',
    '#..#........#..#',
    '#..#....D...#..#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..#........#..#',
    '#..............#',
    '#..............#',
    '########>#######',
  ],
  entities: [{ kind: 'decoration', id: 'deco_stone', pos: { x: 7, y: 5 }, spriteId: 'stone', clueId: 'clue_worn_stone' }],
  buried: { '8,3': { itemId: 'trinket_button' } },
  exits: [
    { at: { x: 8, y: 0 }, toMap: 'home', spawn: { x: 8, y: 9 }, spawnFacing: 'up' },
    { at: { x: 8, y: 10 }, toMap: 'temple1', spawn: { x: 8, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 8, y: 1 },
});

const temple1 = buildMap({
  id: 'temple1',
  name: 'Forgotten Temple — Entry Hall',
  region: 'temple',
  rows: [
    '########>#######',
    '#..............#',
    '#..............#',
    '#...D..........#',
    '#...........####',
    '#...........g.##',
    '#...........####',
    '#..............#',
    '#..............#',
    '#..............#',
    '########>#######',
  ],
  entities: [
    { kind: 'clueNote', id: 'note_field1', pos: { x: 5, y: 3 }, clueId: 'clue_field_notes_1' },
    { kind: 'decoration', id: 'deco_statue1', pos: { x: 11, y: 5 }, spriteId: 'statue', clueId: 'clue_statue_crack' },
    { kind: 'item', id: 'item_fragment_b', pos: { x: 13, y: 5 }, itemId: 'fragment_bronze_blade' },
  ],
  buried: { '4,3': { itemId: 'fragment_bronze_handle' } },
  exits: [
    { at: { x: 8, y: 0 }, toMap: 'outskirts', spawn: { x: 8, y: 9 }, spawnFacing: 'up' },
    { at: { x: 8, y: 10 }, toMap: 'temple2', spawn: { x: 8, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 8, y: 1 },
});

const temple2 = buildMap({
  id: 'temple2',
  name: 'Forgotten Temple — Puzzle Chamber',
  region: 'temple',
  rows: [
    '########>#######',
    '#####..........#',
    '#####..........#',
    '#####..........#',
    '#....#.........#',
    '#....^..P......#',
    '#....#.........#',
    '#####..........#',
    '#####..........#',
    '#####..........#',
    '########>#######',
  ],
  entities: [
    { kind: 'block', id: 'block_1', pos: { x: 6, y: 5 } },
    { kind: 'trap', id: 'trap_dart1', pos: { x: 8, y: 5 }, trapType: 'dart', triggerPlate: { x: 8, y: 5 }, detectable: true },
    { kind: 'decoration', id: 'deco_crack_floor', pos: { x: 9, y: 4 }, spriteId: 'crack', line: 'Scorch marks streak the floor ahead. Something in these walls still works.' },
    { kind: 'switch', id: 'switch_shortcut', pos: { x: 2, y: 5 }, setsFlag: 'sanctumUnlockedByShortcut' },
    {
      kind: 'door',
      id: 'door_sanctum',
      pos: { x: 8, y: 10 },
      requiresArtifact: 'key_bronze',
      opensOnFlag: 'sanctumUnlockedByShortcut',
      lockedMessage: "The bronze fittings hum faintly. This door wants its key — or another way in.",
    },
  ],
  exits: [
    { at: { x: 8, y: 0 }, toMap: 'temple1', spawn: { x: 8, y: 9 }, spawnFacing: 'up' },
    { at: { x: 8, y: 10 }, toMap: 'temple3', spawn: { x: 8, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 8, y: 1 },
});

const temple3 = buildMap({
  id: 'temple3',
  name: 'Forgotten Temple — Inner Sanctum',
  region: 'temple',
  rows: [
    '########>#######',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '################',
  ],
  entities: [
    { kind: 'item', id: 'item_idol', pos: { x: 8, y: 5 }, itemId: 'idol_sunstone' },
    { kind: 'clueNote', id: 'note_field2', pos: { x: 5, y: 5 }, clueId: 'clue_field_notes_2' },
    { kind: 'decoration', id: 'deco_carving', pos: { x: 11, y: 5 }, spriteId: 'carving', clueId: 'clue_inscription' },
  ],
  exits: [{ at: { x: 8, y: 0 }, toMap: 'temple2', spawn: { x: 8, y: 9 }, spawnFacing: 'up' }],
  defaultSpawn: { x: 8, y: 1 },
});

export const MAPS: Record<string, GameMap> = { home, outskirts, temple1, temple2, temple3 };
