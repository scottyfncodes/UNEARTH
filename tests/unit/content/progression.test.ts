import { describe, expect, it } from 'vitest';
import { reduce } from '@/game/engine';
import { createEngineContext, createInitialState } from '@/content/initialState';
import { MAPS } from '@/content/maps';
import { SHINY_IDS } from '@/content/items';
import { FIELD_NOTE_PAGES } from '@/content/clues';
import { isBlocked, isTrapDisarmed } from '@/game/world';
import { key, step, type Direction, type GameEvent, type GameState, type Vec2 } from '@/game/types';

/**
 * Plays the whole game, start to credits, through the real engine and the
 * real authored maps. Movement is never teleported: `walkTo` pathfinds with
 * the engine's own collision rules and dispatches genuine move actions, so a
 * wall in the wrong place, an unreachable item or a broken exit fails here
 * rather than in a player's hands. It also detours around live trap plates,
 * the way a careful player would, and collects every shiny on the way.
 */
const ctx = createEngineContext();

class Run {
  state: GameState = createInitialState();
  log: GameEvent[] = [];

  do(action: Parameters<typeof reduce>[2]): GameEvent[] {
    const result = reduce(ctx, this.state, action);
    this.state = result.state;
    this.log.push(...result.events);
    return result.events;
  }

  get map() {
    return MAPS[this.state.mapId]!;
  }

  private dangerous(pos: Vec2): boolean {
    return this.map.entities.some(
      (e) => e.kind === 'trap' && e.triggerPlate.x === pos.x && e.triggerPlate.y === pos.y && !isTrapDisarmed(e, this.state),
    );
  }

  private isExit(pos: Vec2): boolean {
    return this.map.exits.some((ex) => ex.at.x === pos.x && ex.at.y === pos.y);
  }

  /** Breadth-first walk to (x, y) on the current map using real moves. */
  walkTo(x: number, y: number): void {
    const goal = { x, y };
    const start = this.state.player.pos;
    const prev = new Map<string, { from: Vec2; dir: Direction }>();
    const seen = new Set([key(start)]);
    const queue: Vec2[] = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.x === x && cur.y === y) break;
      for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
        const next = step(cur, dir);
        const k = key(next);
        if (seen.has(k)) continue;
        const isGoal = next.x === x && next.y === y;
        if (isBlocked(this.map, this.state, next)) continue;
        if (!isGoal && (this.dangerous(next) || this.isExit(next))) continue;
        seen.add(k);
        prev.set(k, { from: cur, dir });
        queue.push(next);
      }
    }
    if (!seen.has(key(goal))) throw new Error(`${this.state.mapId}: no safe path from ${key(start)} to ${key(goal)}`);

    const dirs: Direction[] = [];
    for (let at: Vec2 = goal; key(at) !== key(start); ) {
      const p = prev.get(key(at))!;
      dirs.unshift(p.dir);
      at = p.from;
    }
    for (const dir of dirs) {
      const events = this.do({ type: 'move', direction: dir });
      if (events.some((e) => e.type === 'trap-hit' || e.type === 'bump')) {
        throw new Error(`${this.state.mapId}: walk to ${key(goal)} was interrupted by ${JSON.stringify(events)}`);
      }
    }
  }

  /** Turn to face a solid tile (a bump turns CK without moving). */
  face(dir: Direction): void {
    const before = this.state.player.pos;
    this.do({ type: 'move', direction: dir });
    expect(this.state.player.pos, `face(${dir}) moved CK`).toEqual(before);
  }

  /** Step through an exit and land on `mapId`. */
  leave(dir: Direction, mapId: string): void {
    this.do({ type: 'move', direction: dir });
    expect(this.state.mapId).toBe(mapId);
  }

  talkThrough(): void {
    this.do({ type: 'interact' });
    let guard = 0;
    while (this.state.dialogue && guard++ < 20) this.do({ type: 'interact' });
  }
}

describe("CK's whole journey", () => {
  it('plays from the prologue to the credits, collecting every shiny', () => {
    const run = new Run();

    // ── Prologue ────────────────────────────────────────────────────────
    run.walkTo(7, 8);
    run.face('down'); // Dad is standing in the doorway
    run.talkThrough();
    expect(run.state.flags.dadLeft).toBe(true);

    run.walkTo(7, 9);
    expect(run.do({ type: 'move', direction: 'down' })[0]?.type).toBe('exit-locked');

    run.walkTo(2, 2);
    run.face('up');
    run.do({ type: 'interact' });
    expect(run.state.clues).toContain('clue_old_note');

    run.walkTo(5, 7);
    run.face('up');
    run.do({ type: 'interact' }); // the vase
    run.walkTo(14, 1); // the closet, through the cat-gap

    run.walkTo(7, 9);
    run.leave('down', 'meadow');

    // ── The Meadow ──────────────────────────────────────────────────────
    run.walkTo(12, 5);
    run.face('up');
    run.do({ type: 'dig' });
    run.walkTo(2, 2); // the pond island
    run.walkTo(14, 6);
    run.leave('right', 'well');

    // ── The Old Well, before the Sunstone ──────────────────────────────
    run.walkTo(8, 6);
    expect(run.do({ type: 'move', direction: 'up' })[0]?.type).toBe('exit-locked');
    run.walkTo(6, 4);
    run.do({ type: 'interact' }); // page 3 — why CK needs a light
    run.walkTo(7, 8);
    run.face('down');
    run.do({ type: 'dig' });
    run.walkTo(14, 1); // the nook
    run.walkTo(1, 6);
    run.leave('left', 'meadow');
    run.walkTo(7, 11);
    run.leave('down', 'temple1');

    // ── Chapter I ───────────────────────────────────────────────────────
    run.walkTo(6, 3);
    run.do({ type: 'interact' }); // Field Notes, page 1
    run.walkTo(4, 4);
    run.face('up');
    run.do({ type: 'dig' });
    run.walkTo(3, 6);
    run.face('down');
    run.do({ type: 'dig' });
    run.walkTo(14, 5); // through the crack behind the statue
    expect(run.state.inventory).toContain('key_bronze');
    run.walkTo(7, 11);
    run.leave('down', 'temple2');

    run.walkTo(4, 9);
    run.walkTo(2, 8); // secret nook with the coin
    run.walkTo(7, 11);
    run.face('down');
    expect(run.do({ type: 'interact' })).toEqual([{ type: 'door-open', doorId: 'door_sanctum' }]);
    run.leave('down', 'temple3');

    run.walkTo(7, 5);
    expect(run.state.inventory).toContain('idol_sunstone');
    run.walkTo(4, 8);
    run.face('down');
    run.do({ type: 'dig' });
    run.walkTo(4, 6);
    run.do({ type: 'interact' }); // page 2

    // Back up to the meadow and over to the well.
    run.walkTo(7, 1);
    run.leave('up', 'temple2');
    run.walkTo(7, 1);
    run.leave('up', 'temple1');
    run.walkTo(7, 1);
    run.leave('up', 'meadow');
    run.walkTo(14, 6);
    run.leave('right', 'well');
    run.walkTo(8, 6);
    run.leave('up', 'crypt1');

    // ── Chapter II ──────────────────────────────────────────────────────
    run.walkTo(14, 4);
    run.face('down');
    run.do({ type: 'dig' });
    expect(run.state.inventory).toContain('moon_crescent');
    run.walkTo(2, 8);
    run.face('down');
    run.do({ type: 'dig' });
    run.walkTo(7, 11);
    run.leave('down', 'crypt2');

    run.walkTo(3, 4);
    run.do({ type: 'move', direction: 'down' });
    run.do({ type: 'move', direction: 'down' });
    run.walkTo(11, 4);
    run.do({ type: 'move', direction: 'down' });
    expect(run.do({ type: 'move', direction: 'down' })).toEqual([
      { type: 'push' },
      { type: 'door-open', doorId: 'door_gallery' },
    ]);
    run.walkTo(1, 10); // the alcove: the watch and the moon's face
    run.walkTo(13, 11);
    run.do({ type: 'interact' }); // page 4
    run.walkTo(7, 11);
    run.leave('down', 'crypt3');

    run.walkTo(10, 3);
    run.face('up');
    run.do({ type: 'dig' });
    expect(run.state.inventory).toContain('moon_seal');
    run.walkTo(3, 7);
    run.face('down');
    run.do({ type: 'dig' });
    run.walkTo(7, 11);
    run.face('down');
    expect(run.do({ type: 'interact' })).toEqual([{ type: 'door-open', doorId: 'door_moon' }]);
    run.leave('down', 'passage');

    run.walkTo(5, 3);
    run.do({ type: 'interact' }); // the last page, read where it lies
    run.walkTo(7, 5);
    run.leave('down', 'vault');

    // ── Chapter III ─────────────────────────────────────────────────────
    run.walkTo(7, 3);
    expect(run.state.inventory).toContain('keepers_bell');
    run.walkTo(7, 6);
    run.face('down');
    const nap = run.do({ type: 'interact' });
    expect(nap.map((e) => e.type)).toEqual(['flavor', 'warp']);
    expect(run.state.mapId).toBe('home');
    expect(run.state.flags.napTaken).toBe(true);

    // ── Twenty minutes later ───────────────────────────────────────────
    run.talkThrough(); // Dad is right there, groceries in hand
    expect(run.state.flags.gameComplete).toBe(true);

    for (const id of SHINY_IDS) expect(run.state.inventory, `missing shiny ${id}`).toContain(id);
    for (const page of FIELD_NOTE_PAGES) expect(run.state.clues, `missing ${page.id}`).toContain(page.id);
    expect(run.log.some((e) => e.type === 'trap-hit')).toBe(false);
    expect(run.log.filter((e) => e.type === 'secret').length).toBeGreaterThanOrEqual(4);
  });

  it('the hidden lever still opens the sanctum without the key', () => {
    const run = new Run();
    run.state = { ...run.state, mapId: 'temple2', player: { pos: { x: 7, y: 1 }, facing: 'down' }, flags: { dadLeft: true } };
    run.walkTo(7, 4);
    run.walkTo(7, 5);
    expect(run.do({ type: 'move', direction: 'left' })).toEqual([{ type: 'push' }]); // block into the pit
    run.walkTo(2, 5);
    expect(run.do({ type: 'interact' })).toEqual([{ type: 'switch-on', switchId: 'switch_shortcut' }]);
    run.walkTo(7, 11);
    run.leave('down', 'temple3');
    expect(run.state.inventory).not.toContain('key_bronze');
  });
});

describe('world bookkeeping', () => {
  it('places every shiny exactly once, somewhere in the world', () => {
    const placements: string[] = [];
    for (const map of Object.values(MAPS)) {
      for (const e of map.entities) {
        if (e.kind === 'item') placements.push(e.itemId);
        if (e.kind === 'decoration' && e.givesItem) placements.push(e.givesItem);
      }
      for (const b of Object.values(map.buried)) placements.push(b.itemId);
    }
    for (const id of SHINY_IDS) expect(placements.filter((p) => p === id), id).toHaveLength(1);
    expect(SHINY_IDS).toHaveLength(12);
  });

  it('never parks a secret nook where nothing can reach it', () => {
    for (const map of Object.values(MAPS)) {
      for (const k of Object.keys(map.secrets)) expect(map.tiles[Number(k.split(',')[1])]![Number(k.split(',')[0])]).toBe('floor');
    }
  });
});
