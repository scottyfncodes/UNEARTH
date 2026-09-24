import { describe, expect, it } from 'vitest';
import { buildMap } from '@/game/mapBuilder';
import { reduce, type EngineContext } from '@/game/engine';
import { computeDetectorReading } from '@/game/detector';
import { checkDig } from '@/game/dig';
import { needsTick, rolledFlag } from '@/game/hazards';
import { mapStateOf } from '@/game/world';
import type { Action, GameEvent, GameState } from '@/game/types';
import { baseState } from './fixtures';

/**
 * The exploration pass: hidden digs, junk, the directional collar, hopping,
 * turning on the spot, and every timed hazard — delayed dart strips,
 * falling stones, crumbling floors, spike rhythms and a rolling boulder.
 * One small purpose-built world per concern.
 */

// A corridor with a dart strip across it, holes in the west wall.
//   x: 0123456
const gallery = buildMap({
  id: 'gallery',
  name: 'Gallery',
  region: 'temple',
  rows: [
    '#######', // 0
    '#.....#', // 1
    '#.....#', // 2
    '#=====#', // 3  trigger strip
    '#.....#', // 4
    '#.....#', // 5
    '#######', // 6
  ],
  props: ['.......', '.......', '...o...', '.......', '.......', '.i.....', '.......'],
  entities: [
    {
      kind: 'trap',
      id: 'darts',
      pos: { x: 0, y: 3 },
      trapType: 'dart',
      triggers: [1, 2, 3, 4, 5].map((x) => ({ x, y: 3 })),
      delayMs: 400,
      detectable: true,
    },
    { kind: 'decoration', id: 'pebble', pos: { x: 4, y: 1 }, spriteId: 'pebble', walkable: true, kick: true },
  ],
  defaultSpawn: { x: 3, y: 1 },
});

// Soft ground, junk, a real find, an old hole, and a wall between.
const field = buildMap({
  id: 'field',
  name: 'Field',
  region: 'meadow',
  softGround: true,
  rows: ['#########', '#.......#', '#...#...#', '#.......#', '#########'],
  entities: [],
  buried: {
    '6,1': { itemId: 'gem' },
    '2,3': { junk: 'A tin.', clueId: 'tinClue' },
  },
  oldHoles: ['1,1'],
  defaultSpawn: { x: 1, y: 3 },
});

// A crumbling bridge with a one-tile gap to hop, and a rhythm of spikes.
const span = buildMap({
  id: 'span',
  name: 'Span',
  region: 'crypt',
  rows: ['#######', '#.....#', '#^%^%^#', '#^%^^^#', '#^%^^^#', '#.xxx.#', '#######'],
  entities: [
    {
      kind: 'trap',
      id: 'spikes',
      pos: { x: 3, y: 5 },
      trapType: 'spikes',
      lane: [
        { x: 2, y: 5 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
      ],
      period: 1000,
      upMs: 400,
    },
  ],
  defaultSpawn: { x: 2, y: 1 },
});

// A boulder that rolls down a lane once an idol is lifted, and smashes a wall.
const sanctum = buildMap({
  id: 'sanctum',
  name: 'Sanctum',
  region: 'temple',
  rows: ['#######', '#.....#', '#.....#', '#.....#', '#######'],
  entities: [
    { kind: 'item', id: 'idol', pos: { x: 5, y: 3 }, itemId: 'idol', setsFlag: 'took' },
    {
      kind: 'roller',
      id: 'rock',
      pos: { x: 1, y: 2 },
      path: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 })),
      stepMs: 100,
      windupMs: 200,
      startsOnFlag: 'took',
    },
    { kind: 'door', id: 'crack', pos: { x: 5, y: 1 }, look: 'crackedWall', opensOnFlag: rolledFlag('rock') },
  ],
  defaultSpawn: { x: 1, y: 1 },
});

const ctx: EngineContext = { maps: { gallery, field, span, sanctum }, recipes: [] };

function run(state: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = reduce(ctx, s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

let clock = 0;
function wait(state: GameState, ms: number): { state: GameState; events: GameEvent[] } {
  const actions: Action[] = [];
  for (let t = 0; t < ms; t += 50) {
    clock += 50;
    actions.push({ type: 'tick', dt: 50, now: clock });
  }
  return run(state, ...actions);
}

const at = (mapId: string, x: number, y: number, facing: GameState['player']['facing'] = 'down', extra: Partial<GameState> = {}) =>
  baseState({ mapId, player: { pos: { x, y }, facing }, safe: { x, y }, ...extra });

describe('turning on the spot', () => {
  it('changes facing without moving, and is a no-op when already facing', () => {
    const s = at('field', 3, 3, 'down');
    const turned = run(s, { type: 'turn', direction: 'left' });
    expect(turned.state.player).toEqual({ pos: { x: 3, y: 3 }, facing: 'left' });
    expect(run(turned.state, { type: 'turn', direction: 'left' }).state).toBe(turned.state);
  });
});

describe('digging for real', () => {
  it('lets CK walk over soft ground — there is no mound to bump into', () => {
    expect(run(at('field', 3, 3, 'right'), { type: 'move', direction: 'right' }).state.player.pos).toEqual({ x: 4, y: 3 });
  });

  it('turns up junk (with its line, and any clue it carries) as well as real finds', () => {
    const junk = run(at('field', 1, 3, 'right'), { type: 'dig' });
    expect(junk.events).toEqual([
      { type: 'dig-junk', line: 'A tin.' },
      { type: 'clue', clueId: 'tinClue' },
    ]);
    const real = run(at('field', 5, 1, 'right'), { type: 'dig' });
    expect(real.events).toEqual([{ type: 'reveal', itemId: 'gem' }]);
  });

  it("knows somebody else's old hole when it sees one, and never digs it again", () => {
    const s = at('field', 2, 1, 'left');
    expect(checkDig(ctx.maps, s)).toBe('old');
    expect(run(s, { type: 'dig' }).events).toEqual([{ type: 'dig-old' }]);
  });

  it('will not dig stone, and says so', () => {
    const s = at('gallery', 3, 1, 'down');
    expect(checkDig(ctx.maps, s)).toBe('hard');
  });
});

describe('the directional collar', () => {
  it('is louder facing the source than facing away, at the same distance', () => {
    const lone = buildMap({ id: 'l', name: 'L', region: 'meadow', softGround: true, rows: ['#######', '#.....#', '#######'], entities: [], buried: { '4,1': { itemId: 'gem' } }, defaultSpawn: { x: 2, y: 1 } });
    const toward = computeDetectorReading(lone, baseState({ mapId: 'l', player: { pos: { x: 2, y: 1 }, facing: 'right' } }));
    const away = computeDetectorReading(lone, baseState({ mapId: 'l', player: { pos: { x: 2, y: 1 }, facing: 'left' } }));
    expect(toward.kind).toBe('buried');
    expect(toward.proximity).toBeCloseTo(away.proximity);
    expect(toward.aim).toBeGreaterThan(away.aim);
    expect(toward.strength).toBeGreaterThan(away.strength * 2);
  });

  it('locks on only when the source is the very tile in front', () => {
    expect(computeDetectorReading(field, at('field', 5, 1, 'right')).locked).toBe(true);
    expect(computeDetectorReading(field, at('field', 4, 1, 'right')).locked).toBe(false);
  });

  it('hears junk as junk', () => {
    const r = computeDetectorReading(field, at('field', 1, 3, 'right'));
    expect(r.junk).toBe(true);
    expect(r.locked).toBe(true);
  });

  it('is muffled by a wall in the way', () => {
    const make = (row: string) =>
      buildMap({ id: 'w', name: 'W', region: 'meadow', softGround: true, rows: ['#####', row, '#####'], entities: [], buried: { '3,1': { itemId: 'gem' } }, defaultSpawn: { x: 1, y: 1 } });
    const s = baseState({ mapId: 'w', player: { pos: { x: 1, y: 1 }, facing: 'right' } });
    const open = computeDetectorReading(make('#...#'), s);
    const walled = computeDetectorReading(make('#.#.#'), s);
    expect(walled.distance).toBe(open.distance);
    expect(walled.strength).toBeLessThan(open.strength * 0.7);
  });
});

describe('hopping', () => {
  it('clears a trigger strip without setting it off', () => {
    const r = run(at('gallery', 3, 2, 'down'), { type: 'jump' });
    expect(r.events).toEqual([{ type: 'jump', from: { x: 3, y: 2 }, to: { x: 3, y: 4 } }]);
    expect(r.state.timed).toBeUndefined();
  });

  it('clears low rubble but not a tall column, and never a wall', () => {
    expect(run(at('gallery', 3, 1, 'down'), { type: 'jump' }).events[0]?.type).toBe('jump');
    expect(run(at('gallery', 1, 4, 'down'), { type: 'jump' }).events).toEqual([{ type: 'jump-blocked' }]);
    expect(run(at('gallery', 1, 1, 'up'), { type: 'jump' }).events).toEqual([{ type: 'jump-blocked' }]);
  });

  it('hops a one-tile gap but not two', () => {
    expect(run(at('span', 2, 2, 'right'), { type: 'jump' }).state.player.pos).toEqual({ x: 4, y: 2 });
    expect(run(at('span', 2, 3, 'right'), { type: 'jump' }).events).toEqual([{ type: 'jump-blocked' }]);
  });
});

describe('a delayed dart strip', () => {
  it('clicks when stepped on, then hits CK if CK is still standing there', () => {
    const armed = run(at('gallery', 3, 2, 'down'), { type: 'move', direction: 'down' });
    expect(armed.events).toEqual([{ type: 'trap-armed', trapId: 'darts', trapType: 'dart', at: { x: 3, y: 3 } }]);
    expect(armed.state.hearts).toBe(3);
    const later = wait(armed.state, 450);
    expect(later.events.map((e) => e.type)).toEqual(['trap-fire', 'trap-hit']);
    expect(later.state.hearts).toBe(2);
    expect(later.state.player.pos).toEqual({ x: 3, y: 2 }); // knocked back where CK came from
  });

  it('misses CK if CK keeps moving', () => {
    const armed = run(at('gallery', 3, 2, 'down'), { type: 'move', direction: 'down' }, { type: 'move', direction: 'down' });
    const later = wait(armed.state, 450);
    expect(later.events.map((e) => e.type)).toEqual(['trap-fire', 'trap-miss']);
    expect(later.state.hearts).toBe(3);
  });

  it('sends a pawed pebble skittering until something stops it', () => {
    const r = run(at('gallery', 5, 1, 'left'), { type: 'interact' });
    expect(r.events).toEqual([{ type: 'kick', from: { x: 4, y: 1 }, to: { x: 1, y: 1 } }]);
    expect(mapStateOf(r.state, 'gallery').movedDecorations.pebble).toEqual({ x: 1, y: 1 });
  });

  it('a pebble that lands on the strip fires the trap at nobody', () => {
    // CK stands on (4,1)'s far side facing down with the pebble ahead at (4,2)? Put it there first.
    const s = at('gallery', 4, 1, 'down', {
      mapStates: { gallery: { ...mapStateOf(baseState({ mapId: 'gallery' }), 'gallery'), movedDecorations: { pebble: { x: 4, y: 2 } } } },
    });
    const kicked = run(s, { type: 'interact' });
    expect(kicked.events).toEqual([
      { type: 'kick', from: { x: 4, y: 2 }, to: { x: 4, y: 3 } },
      { type: 'trap-armed', trapId: 'darts', trapType: 'dart', at: { x: 4, y: 3 } },
    ]);
    const later = wait(kicked.state, 450);
    expect(later.events.map((e) => e.type)).toEqual(['trap-fire', 'trap-miss']);
  });
});

describe('crumbling stone', () => {
  it('holds while CK keeps moving, and gives way behind', () => {
    let s = run(at('span', 2, 1, 'down'), { type: 'move', direction: 'down' }).state;
    expect(s.timed?.crumbling).toHaveLength(1);
    s = wait(s, 150).state;
    s = run(s, { type: 'move', direction: 'down' }).state;
    const behind = wait(s, 650);
    expect(behind.events).toContainEqual({ type: 'crumble', at: { x: 2, y: 2 } });
    expect(behind.events.some((e) => e.type === 'fall')).toBe(false);
    expect(mapStateOf(behind.state, 'span').collapsed['2,2']).toBe(true);
  });

  it('drops CK who stands still, back to the last safe tile, and settles back', () => {
    const on = run(at('span', 2, 1, 'down'), { type: 'move', direction: 'down' }).state;
    const later = wait(on, 800);
    expect(later.events.map((e) => e.type)).toEqual(['crumble', 'fall']);
    expect(later.state.player.pos).toEqual({ x: 2, y: 1 });
    expect(later.state.hearts).toBe(2);
    expect(mapStateOf(later.state, 'span').collapsed).toEqual({});
  });
});

describe('spikes on a rhythm', () => {
  it('hits CK standing in the lane when they rise, once per beat, and sends CK back', () => {
    clock = 900; // spikes are down (400ms up of every 1000)
    const s = run(at('span', 1, 5, 'right', { safe: { x: 1, y: 5 } }), { type: 'move', direction: 'right' }).state;
    expect(s.player.pos).toEqual({ x: 2, y: 5 });
    const up = wait(s, 150);
    expect(up.events.map((e) => e.type)).toEqual(['trap-hit']);
    expect(up.state.player.pos).toEqual({ x: 1, y: 5 });
  });

  it('means nothing to a tick when nobody is on them', () => {
    const s = at('span', 1, 1);
    expect(needsTick(span, s)).toBe(true);
    expect(run(s, { type: 'tick', dt: 50, now: 100 }).state).toBe(s);
  });
});

describe('the rolling boulder', () => {
  it('wakes when the idol is lifted, rolls its path, flattens CK once, and smashes the wall', () => {
    let s = run(at('sanctum', 4, 3, 'right'), { type: 'move', direction: 'right' }).state;
    expect(s.flags.took).toBe(true);
    const start = wait(s, 50);
    expect(start.events).toContainEqual({ type: 'roller-start', id: 'rock' });
    // Stand in its path.
    s = { ...start.state, player: { pos: { x: 3, y: 2 }, facing: 'down' } };
    const rolled = wait(s, 1000);
    const types = rolled.events.map((e) => e.type);
    expect(types.filter((t) => t === 'roller-hit')).toHaveLength(1);
    expect(types).toContain('roller-stop');
    expect(rolled.state.hearts).toBe(2);
    expect(rolled.state.flags[rolledFlag('rock')]).toBe(true);
    expect(rolled.state.timed?.rollers ?? []).toEqual([]);
    // And it never comes back.
    expect(wait(rolled.state, 500).events).toEqual([]);
  });

  it('misses CK who got out of the way', () => {
    let s = run(at('sanctum', 4, 3, 'right'), { type: 'move', direction: 'right' }).state;
    s = wait(s, 1200).state;
    expect(s.flags[rolledFlag('rock')]).toBe(true);
    expect(s.hearts).toBe(3);
  });
});

describe('curiosity', () => {
  it('notices a curio once, the first time CK comes near', () => {
    const map = buildMap({
      id: 'nook',
      name: 'Nook',
      region: 'meadow',
      rows: ['#####', '#...#', '#####'],
      entities: [{ kind: 'curio', id: 'c', pos: { x: 3, y: 1 }, bubble: '?', line: 'Hm.' }],
      defaultSpawn: { x: 1, y: 1 },
    });
    const c: EngineContext = { maps: { nook: map }, recipes: [] };
    const s0 = baseState({ mapId: 'nook', player: { pos: { x: 1, y: 1 }, facing: 'right' } });
    const first = reduce(c, s0, { type: 'move', direction: 'right' });
    expect(first.events).toEqual([{ type: 'curio', id: 'c', bubble: '?', line: 'Hm.' }]);
    const back = reduce(c, first.state, { type: 'move', direction: 'left' });
    const again = reduce(c, back.state, { type: 'move', direction: 'right' });
    expect(again.events).toEqual([]);
  });

  it('gives inert set dressing a sniff and nothing more', () => {
    expect(run(at('gallery', 3, 1, 'down'), { type: 'interact' }).events).toEqual([{ type: 'sniff' }]);
  });
});
