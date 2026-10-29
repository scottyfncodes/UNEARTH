import { describe, expect, it } from 'vitest';
import { reduce } from '@/game/engine';
import { attemptInteract, ECHO_FLAG } from '@/game/interact';
import { pawAffordance } from '@/game/affordance';
import { createEngineContext, createInitialState } from '@/content/initialState';
import { MAPS } from '@/content/maps';
import { echoMarks } from '@/render/echo';
import type { Direction, GameEvent, GameState } from '@/game/types';

const ctx = createEngineContext();

function inHush(flags: Record<string, boolean> = { [ECHO_FLAG]: true }): GameState {
  const s = createInitialState();
  return { ...s, mapId: 'hush', player: { pos: { x: 5, y: 5 }, facing: 'right' }, flags: { ...s.flags, dadLeft: true, ...flags }, inventory: ['idol_sunstone'] };
}

describe('the mew', () => {
  it('is something CK learns from Pip, and only answers in the dark', () => {
    expect(attemptInteract(ctx.maps, inHush({})).events).toEqual([]);
    expect(pawAffordance(ctx.maps, inHush({}))).toBeNull();
    expect(attemptInteract(ctx.maps, inHush()).events).toEqual([{ type: 'echo' }]);
    expect(pawAffordance(ctx.maps, inHush())?.verb).toBe('Mew');
    const lit = { ...inHush(), mapId: 'meadow', player: { pos: { x: 7, y: 6 }, facing: 'down' as const } };
    expect(attemptInteract(ctx.maps, lit).events).not.toContainEqual({ type: 'echo' });
  });

  it('Pip teaches it, and says so the first time only', () => {
    let s: GameState = { ...createInitialState(), mapId: 'crypt1', player: { pos: { x: 11, y: 9 }, facing: 'right' }, flags: { dadLeft: true } };
    let events: GameEvent[] = [];
    do {
      const r = reduce(ctx, s, { type: 'interact' });
      s = r.state;
      events = r.events;
    } while (s.dialogue);
    expect(events).toEqual([{ type: 'talk-end', flag: ECHO_FLAG }]);
    expect(s.flags[ECHO_FLAG]).toBe(true);
  });

  it('shows the Hush for what it is: the stones, the drop, the way out, the loose ceiling', () => {
    const marks = echoMarks(MAPS.hush!, inHush(), { x: 5, y: 5 }, 12);
    const at = (x: number, y: number) => marks.filter((m) => m.x === x && m.y === y).map((m) => m.kind);
    expect(at(7, 4)).toContain('crumble');
    expect(at(10, 8)).toContain('crumble');
    expect(at(8, 4)).toContain('pit');
    expect(at(0, 5)).toContain('way');
    expect(at(3, 3)).toContain('danger');
    expect(at(2, 2)).toEqual([]); // plain floor says nothing
    // Nothing beyond the mew's reach.
    expect(echoMarks(MAPS.hush!, inHush(), { x: 5, y: 5 }, 3).every((m) => Math.hypot(m.x - 5, m.y - 5) <= 3)).toBe(true);
  });
});

describe('the Hush', () => {
  function trot(s: GameState, clock: { t: number }, dir: Direction): { s: GameState; events: GameEvent[] } {
    let r = reduce(ctx, s, { type: 'move', direction: dir });
    const events = [...r.events];
    for (let i = 0; i < 3; i++) {
      clock.t += 50;
      r = reduce(ctx, r.state, { type: 'tick', dt: 50, now: clock.t });
      events.push(...r.events);
    }
    return { s: r.state, events };
  }

  it('drops CK who takes the branch that runs out over nothing', () => {
    let s = inHush();
    const clock = { t: 0 };
    const log: GameEvent[] = [];
    for (const dir of ['right', 'right', 'down', 'down', 'right', 'right', 'right', 'down'] as Direction[]) {
      const r = trot(s, clock, dir);
      s = r.s;
      log.push(...r.events);
    }
    expect(s.player.pos).toEqual({ x: 10, y: 8 });
    // Nowhere to go but back, and the way back has already gone.
    for (let i = 0; i < 30 && !log.some((e) => e.type === 'fall'); i++) {
      clock.t += 50;
      const r = reduce(ctx, s, { type: 'tick', dt: 50, now: clock.t });
      s = r.state;
      log.push(...r.events);
    }
    expect(log.map((e) => e.type)).toContain('fall');
    expect(s.hearts).toBeLessThan(inHush().hearts);
  });

  it('lets the stones settle once CK is back on solid ground', () => {
    let s = inHush();
    const clock = { t: 0 };
    let r = trot(s, clock, 'right'); // onto the first stone…
    r = trot(r.s, clock, 'left'); // …and straight back off it
    s = r.s;
    const log: GameEvent[] = [];
    for (let i = 0; i < 20; i++) {
      clock.t += 50;
      const t = reduce(ctx, s, { type: 'tick', dt: 50, now: clock.t });
      s = t.state;
      log.push(...t.events);
    }
    expect(log.map((e) => e.type)).toEqual(['crumble', 'settle']);
    expect(Object.keys(s.mapStates.hush!.collapsed)).toEqual([]);
  });
});
