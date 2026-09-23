import { describe, expect, it } from 'vitest';
import { buildMap } from '@/game/mapBuilder';
import { reduce, type EngineContext } from '@/game/engine';
import { isDoorOpen } from '@/game/world';
import type { DoorEntity, GameState } from '@/game/types';
import { baseState } from './fixtures';

/**
 * The mechanics added for CK's full journey: item-gated exits, treats,
 * secret nooks, knock-over decorations, the story warp, flag-gated NPCs and
 * weighted-plate doors. One small purpose-built world exercises all of them.
 */
const hall = buildMap({
  id: 'hall',
  name: 'Hall',
  region: 'crypt',
  dark: true,
  chapter: { number: 'II', title: 'Test' },
  rows: [
    '##########',
    '#s.......#',
    '#........#',
    '#..P.P...#',
    '#........>',
    '######D###',
  ],
  entities: [
    { kind: 'item', id: 'treat1', pos: { x: 2, y: 1 }, itemId: 'fish', heals: 1 },
    { kind: 'decoration', id: 'vase', pos: { x: 8, y: 1 }, spriteId: 'vase', givesItem: 'shiny', line: 'Bap.', afterLine: 'Already broken.' },
    { kind: 'decoration', id: 'bed', pos: { x: 8, y: 3 }, spriteId: 'bed', warpTo: { mapId: 'nook', pos: { x: 1, y: 1 } } },
    { kind: 'npc', id: 'ghost', pos: { x: 5, y: 1 }, name: 'Ghost', sprite: 'bat', lines: ['Boo.'], requiresFlag: 'spooky' },
    { kind: 'block', id: 'b1', pos: { x: 3, y: 2 } },
    { kind: 'block', id: 'b2', pos: { x: 5, y: 2 } },
    { kind: 'door', id: 'weighted', pos: { x: 6, y: 5 }, opensWhenBlocksOn: [{ x: 3, y: 3 }, { x: 5, y: 3 }] },
  ],
  exits: [{ at: { x: 9, y: 4 }, toMap: 'nook', spawn: { x: 1, y: 1 }, requiresItem: 'lamp', lockedMessage: 'Too dark.' }],
  defaultSpawn: { x: 1, y: 4 },
});

const nook = buildMap({
  id: 'nook',
  name: 'Nook',
  region: 'crypt',
  rows: ['####', '#..#', '####'],
  entities: [],
  defaultSpawn: { x: 1, y: 1 },
});

const ctx: EngineContext = { maps: { hall, nook }, recipes: [] };

function inHall(overrides: Partial<GameState> = {}): GameState {
  return baseState({ mapId: 'hall', player: { pos: { x: 1, y: 4 }, facing: 'right' }, ...overrides });
}

describe('map builder extras', () => {
  it('records secret nooks and keeps dark/chapter metadata', () => {
    expect(hall.secrets).toEqual({ '1,1': true });
    expect(hall.tiles[1]![1]).toBe('floor');
    expect(hall.dark).toBe(true);
    expect(hall.chapter).toEqual({ number: 'II', title: 'Test' });
  });
});

describe('item-gated exits', () => {
  it('refuse CK without the item, and let CK through with it', () => {
    const blocked = reduce(ctx, inHall({ player: { pos: { x: 8, y: 4 }, facing: 'right' } }), { type: 'move', direction: 'right' });
    expect(blocked.events).toEqual([{ type: 'exit-locked', message: 'Too dark.' }]);
    expect(blocked.state.mapId).toBe('hall');

    const through = reduce(ctx, inHall({ player: { pos: { x: 8, y: 4 }, facing: 'right' }, inventory: ['lamp'] }), {
      type: 'move',
      direction: 'right',
    });
    expect(through.state.mapId).toBe('nook');
    expect(through.events).toEqual([{ type: 'transition', toMap: 'nook', firstVisit: true }]);
    expect(through.state.flags['visited:nook']).toBe(true);
  });

  it('reports a repeat visit as not the first', () => {
    const state = inHall({ player: { pos: { x: 8, y: 4 }, facing: 'right' }, inventory: ['lamp'], flags: { 'visited:nook': true } });
    const result = reduce(ctx, state, { type: 'move', direction: 'right' });
    expect(result.events).toEqual([{ type: 'transition', toMap: 'nook', firstVisit: false }]);
  });
});

describe('treats', () => {
  it('restore a heart instead of going in the satchel, capped at max', () => {
    const hurt = reduce(ctx, inHall({ hearts: 1, player: { pos: { x: 2, y: 2 }, facing: 'up' } }), { type: 'move', direction: 'up' });
    expect(hurt.events).toEqual([{ type: 'heal', itemId: 'fish' }]);
    expect(hurt.state.hearts).toBe(2);
    expect(hurt.state.inventory).toEqual([]);

    const full = reduce(ctx, inHall({ hearts: 3, player: { pos: { x: 2, y: 2 }, facing: 'up' } }), { type: 'move', direction: 'up' });
    expect(full.state.hearts).toBe(3);
  });
});

describe('secret nooks', () => {
  it('chime exactly once', () => {
    const first = reduce(ctx, inHall({ player: { pos: { x: 1, y: 2 }, facing: 'up' } }), { type: 'move', direction: 'up' });
    expect(first.events).toEqual([{ type: 'secret' }]);
    expect(first.state.mapStates.hall?.foundSecrets['1,1']).toBe(true);

    const away = reduce(ctx, first.state, { type: 'move', direction: 'down' });
    const again = reduce(ctx, away.state, { type: 'move', direction: 'up' });
    expect(again.events).toEqual([]);
  });
});

describe('knock-over decorations', () => {
  it('drop their item once, then only show the after-line', () => {
    const state = inHall({ player: { pos: { x: 7, y: 1 }, facing: 'right' } });
    const first = reduce(ctx, state, { type: 'interact' });
    expect(first.events).toEqual([
      { type: 'flavor', line: 'Bap.' },
      { type: 'knock', itemId: 'shiny' },
    ]);
    expect(first.state.inventory).toEqual(['shiny']);

    const second = reduce(ctx, first.state, { type: 'interact' });
    expect(second.events).toEqual([{ type: 'flavor', line: 'Already broken.' }]);
    expect(second.state.inventory).toEqual(['shiny']);
  });

  it('are solid — CK bumps into a vase rather than walking through it', () => {
    const result = reduce(ctx, inHall({ player: { pos: { x: 7, y: 1 }, facing: 'right' } }), { type: 'move', direction: 'right' });
    expect(result.events).toEqual([{ type: 'bump' }]);
    expect(result.state.player.pos).toEqual({ x: 7, y: 1 });
  });

  it('can warp CK to another map — the story time-skip', () => {
    const result = reduce(ctx, inHall({ player: { pos: { x: 7, y: 3 }, facing: 'right' } }), { type: 'interact' });
    expect(result.events).toEqual([{ type: 'warp', toMap: 'nook' }]);
    expect(result.state.mapId).toBe('nook');
    expect(result.state.player.pos).toEqual({ x: 1, y: 1 });
  });
});

describe('flag-gated NPCs', () => {
  it('are absent until their flag is set', () => {
    const facing = inHall({ player: { pos: { x: 4, y: 1 }, facing: 'right' } });
    expect(reduce(ctx, facing, { type: 'interact' }).events).toEqual([]);
    const spooky = reduce(ctx, { ...facing, flags: { spooky: true } }, { type: 'interact' });
    expect(spooky.events).toEqual([{ type: 'talk-start' }]);
  });
});

describe('weighted-plate doors', () => {
  const door = hall.entities.find((e): e is DoorEntity => e.id === 'weighted')!;

  it('open once a block rests on every plate, and stay open (they latch)', () => {
    let state = inHall({ player: { pos: { x: 3, y: 1 }, facing: 'down' } });
    expect(isDoorOpen(door, state, hall)).toBe(false);

    state = reduce(ctx, state, { type: 'move', direction: 'down' }).state; // b1 -> (3,3)
    expect(isDoorOpen(door, state, hall)).toBe(false);

    state = { ...state, player: { pos: { x: 5, y: 1 }, facing: 'down' } };
    const solved = reduce(ctx, state, { type: 'move', direction: 'down' }); // b2 -> (5,3)
    expect(solved.events).toEqual([{ type: 'push' }, { type: 'door-open', doorId: 'weighted' }]);
    state = solved.state;
    expect(isDoorOpen(door, state, hall)).toBe(true);

    // Shoving a block back off its plate doesn't shut the door again.
    state = { ...state, player: { pos: { x: 4, y: 3 }, facing: 'right' } };
    state = reduce(ctx, state, { type: 'move', direction: 'right' }).state;
    expect(isDoorOpen(door, state, hall)).toBe(true);
  });

  it('loose blocks reset when CK leaves the room', () => {
    let state = inHall({ player: { pos: { x: 3, y: 1 }, facing: 'down' }, inventory: ['lamp'] });
    state = reduce(ctx, state, { type: 'move', direction: 'down' }).state;
    expect(state.mapStates.hall?.movedBlocks.b1).toEqual({ x: 3, y: 3 });
    state = { ...state, player: { pos: { x: 8, y: 4 }, facing: 'right' } };
    state = reduce(ctx, state, { type: 'move', direction: 'right' }).state;
    expect(state.mapId).toBe('nook');
    expect(state.mapStates.hall?.movedBlocks).toEqual({});
  });
});
