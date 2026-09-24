import { describe, expect, it } from 'vitest';
import { reduce } from '@/game/engine';
import { createEngineContext, createInitialState } from '@/content/initialState';
import { MAPS } from '@/content/maps';
import { SHINY_IDS } from '@/content/items';
import { FIELD_NOTE_PAGES } from '@/content/clues';
import { isBlocked, isHazardTile } from '@/game/world';
import { spikesUp } from '@/game/hazards';
import { key, step, type Direction, type GameEvent, type GameState, type Vec2 } from '@/game/types';

/**
 * Plays the whole game, start to credits, through the real engine and the
 * real authored maps. Movement is never teleported: `walkTo` pathfinds with
 * the engine's own collision rules and dispatches genuine move actions, so a
 * wall in the wrong place, an unreachable item or a broken exit fails here
 * rather than in a player's hands. It detours around every trap tile the way
 * a careful player would, and where a trap has to be crossed it does what a
 * player learns to do: hops the trigger strip, keeps moving on the crumbling
 * bridge, waits for the spikes to drop, and ducks into an alcove while the
 * boulder goes past. Time only passes when `tick` says so.
 */
const ctx = createEngineContext();

class Run {
  state: GameState = createInitialState();
  log: GameEvent[] = [];
  clock = 0;

  do(action: Parameters<typeof reduce>[2]): GameEvent[] {
    const result = reduce(ctx, this.state, action);
    this.state = result.state;
    this.log.push(...result.events);
    return result.events;
  }

  /** Let `ms` of game time pass, in frame-sized steps. */
  tick(ms: number): GameEvent[] {
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 50) {
      const dt = Math.min(50, ms - t);
      this.clock += dt;
      events.push(...this.do({ type: 'tick', dt, now: this.clock }));
    }
    return events;
  }

  get map() {
    return MAPS[this.state.mapId]!;
  }

  private dangerous(pos: Vec2): boolean {
    return isHazardTile(this.map, pos);
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
      if (events.some((e) => e.type === 'trap-hit' || e.type === 'bump' || e.type === 'trap-armed')) {
        throw new Error(`${this.state.mapId}: walk to ${key(goal)} was interrupted by ${JSON.stringify(events)}`);
      }
    }
  }

  /** Turn to face a direction without stepping. */
  face(dir: Direction): void {
    this.do({ type: 'turn', direction: dir });
    expect(this.state.player.facing).toBe(dir);
  }

  /** One brisk step — the pace of a held d-pad. */
  trot(dir: Direction): GameEvent[] {
    const events = this.do({ type: 'move', direction: dir });
    events.push(...this.tick(140));
    return events;
  }

  hop(dir: Direction): void {
    this.face(dir);
    const events = this.do({ type: 'jump' });
    expect(events[0]?.type, `${this.state.mapId}: hop ${dir} failed`).toBe('jump');
    this.tick(300);
  }

  dig(dir: Direction): GameEvent[] {
    this.face(dir);
    return this.do({ type: 'dig' });
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

  /** Wait until the spike rhythm in this room has just dropped. */
  waitForSpikesDown(trapId: string): void {
    const trap = this.map.entities.find((e) => e.id === trapId)!;
    if (trap.kind !== 'trap') throw new Error('not a trap');
    let guard = 0;
    while (!(spikesUp(trap, this.clock).up === false && spikesUp(trap, this.clock - 60).up === true) && guard++ < 200) this.tick(20);
  }
}

describe("CK's whole journey", () => {
  it('plays from the prologue to the credits, collecting every shiny, without ever being hit', () => {
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
    expect(run.dig('up')).toEqual([{ type: 'reveal', itemId: 'shiny_bottlecap' }]);
    run.walkTo(2, 2); // the pond island
    run.walkTo(1, 9);
    run.leave('left', 'digsite');

    // ── Dad's Old Dig Site ─────────────────────────────────────────────
    run.walkTo(12, 2);
    run.face('up');
    run.do({ type: 'interact' }); // the dig log
    expect(run.state.clues).toContain('clue_dig_log');
    run.walkTo(7, 3);
    expect(run.dig('left')).toEqual([{ type: 'reveal', itemId: 'shiny_compass' }]);
    run.walkTo(1, 1); // nook behind the hedge
    run.walkTo(3, 11); // …and straight through the rotten tarp
    expect(run.state.mapId).toBe('trench');
    expect(run.log.some((e) => e.type === 'transition' && !!e.fall)).toBe(true);
    run.walkTo(2, 5);
    run.walkTo(10, 1);
    run.leave('up', 'digsite');
    run.walkTo(16, 7);
    run.leave('right', 'meadow');
    run.walkTo(14, 6);
    run.leave('right', 'well');

    // ── The Old Well, before the Sunstone ──────────────────────────────
    run.walkTo(8, 6);
    expect(run.do({ type: 'move', direction: 'up' })[0]?.type).toBe('exit-locked');
    run.walkTo(6, 4);
    run.do({ type: 'interact' }); // page 3 — why CK needs a light
    run.walkTo(7, 8);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'shiny_jingle' }]);
    run.walkTo(14, 1); // the nook
    run.walkTo(1, 6);
    run.leave('left', 'meadow');
    run.walkTo(7, 11);
    run.leave('down', 'temple1');

    // ── Chapter I ───────────────────────────────────────────────────────
    run.walkTo(6, 3);
    run.do({ type: 'interact' }); // Field Notes, page 1
    run.walkTo(11, 6);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'fragment_bronze_handle' }]);
    run.walkTo(4, 7);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'shiny_ring' }]);
    run.walkTo(14, 5); // through the crack behind the statue
    expect(run.state.inventory).toContain('key_bronze');
    // The dart corridor: hop the strip of wrong-looking bricks.
    run.walkTo(7, 10);
    run.hop('down');
    expect(run.state.player.pos).toEqual({ x: 7, y: 12 });
    run.walkTo(7, 14);
    run.leave('down', 'temple2');

    // The coin nook sits behind the strip: step on, and straight off again.
    run.walkTo(4, 8);
    expect(run.trot('down').map((e) => e.type)).toContain('trap-armed');
    run.trot('left');
    expect(run.tick(600).map((e) => e.type)).toContain('trap-miss');
    run.walkTo(2, 8); // secret nook with the coin
    run.walkTo(3, 9);
    run.trot('right'); // onto the strip again…
    run.trot('up'); // …and off it before it fires
    expect(run.tick(600).map((e) => e.type)).toContain('trap-miss');
    run.walkTo(7, 8);
    run.hop('down'); // the quiet way across
    run.walkTo(7, 11);
    run.face('down');
    expect(run.do({ type: 'interact' })).toEqual([{ type: 'door-open', doorId: 'door_sanctum' }]);
    run.leave('down', 'temple3');

    run.walkTo(3, 14);
    run.do({ type: 'interact' }); // page 2
    run.walkTo(12, 15);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'shiny_tooth' }]);
    run.walkTo(7, 14); // lift the Sunstone…
    expect(run.state.inventory).toContain('idol_sunstone');
    expect(run.tick(50).map((e) => e.type)).toContain('roller-start');
    run.walkTo(7, 10);
    run.walkTo(6, 9); // …and duck into the alcove
    let guard = 0;
    while (!run.state.flags['rolled:boulder_sanctum'] && guard++ < 200) run.tick(100);
    expect(run.log.some((e) => e.type === 'roller-hit')).toBe(false);
    expect(run.log.some((e) => e.type === 'roller-stop')).toBe(true);
    run.walkTo(14, 3); // behind the wall it smashed
    run.walkTo(13, 2);
    expect(run.state.inventory).toContain('shiny_scarab');

    // Back up to the meadow and over to the well.
    run.walkTo(7, 1);
    run.leave('up', 'temple2');
    run.walkTo(7, 10);
    run.hop('up');
    run.walkTo(7, 1);
    run.leave('up', 'temple1');
    run.walkTo(7, 12);
    run.hop('up');
    run.walkTo(7, 1);
    run.leave('up', 'meadow');
    run.walkTo(14, 6);
    run.leave('right', 'well');
    run.walkTo(8, 6);
    run.leave('up', 'crypt1');

    // ── Chapter II ──────────────────────────────────────────────────────
    run.walkTo(14, 4);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'moon_crescent' }]);
    run.walkTo(2, 8);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'shiny_earring' }]);
    run.walkTo(7, 11);
    run.leave('down', 'chasm');

    // The Crumbling Span: never stop, hop the gaps, grab the star on the way.
    run.walkTo(4, 2);
    run.do({ type: 'interact' }); // Dad's scratched warning
    run.walkTo(7, 2);
    run.trot('down');
    run.trot('down');
    run.hop('down');
    run.trot('down');
    run.trot('right');
    run.trot('right');
    run.hop('right'); // out to the pillar island
    run.trot('up');
    run.trot('right');
    expect(run.state.inventory).toContain('shiny_star');
    for (let i = 0; i < 5; i++) run.trot('down');
    expect(run.state.player.pos).toEqual({ x: 12, y: 11 });
    run.walkTo(7, 12);
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
    run.walkTo(7, 10);
    // The spikes: wait for them to drop, then go.
    run.waitForSpikesDown('spikes_alcove');
    for (let i = 0; i < 4; i++) run.trot('left');
    run.walkTo(1, 10); // the alcove: the watch and the moon's face
    run.walkTo(3, 10);
    run.waitForSpikesDown('spikes_alcove');
    for (let i = 0; i < 4; i++) run.trot('right');
    run.walkTo(13, 11);
    run.do({ type: 'interact' }); // page 4
    run.walkTo(7, 11);
    run.leave('down', 'crypt3');

    run.walkTo(10, 3);
    expect(run.dig('up')).toContainEqual({ type: 'reveal', itemId: 'moon_rim' });
    expect(run.state.inventory).toContain('moon_seal');
    run.walkTo(3, 7);
    expect(run.dig('down')).toEqual([{ type: 'reveal', itemId: 'shiny_glasseye' }]);
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
    expect(run.log.filter((e) => e.type === 'trap-hit' || e.type === 'fall' || e.type === 'roller-hit')).toEqual([]);
    expect(run.log.filter((e) => e.type === 'secret').length).toBeGreaterThanOrEqual(5);
    expect(run.log.filter((e) => e.type === 'curio').length).toBeGreaterThanOrEqual(8);
  });

  it('the hidden lever still opens the sanctum without the key', () => {
    const run = new Run();
    run.state = { ...run.state, mapId: 'temple2', player: { pos: { x: 7, y: 1 }, facing: 'down' }, flags: { dadLeft: true } };
    run.walkTo(6, 5);
    expect(run.do({ type: 'move', direction: 'left' })).toEqual([{ type: 'push' }]); // block into the pit
    run.walkTo(2, 5);
    expect(run.do({ type: 'interact' })).toEqual([{ type: 'switch-on', switchId: 'switch_shortcut' }]);
    run.walkTo(7, 8);
    run.hop('down');
    run.walkTo(7, 11);
    run.leave('down', 'temple3');
    expect(run.state.inventory).not.toContain('key_bronze');
  });

  it('the block in the puzzle chamber cannot simply be hopped', () => {
    const run = new Run();
    run.state = { ...run.state, mapId: 'temple2', player: { pos: { x: 6, y: 5 }, facing: 'left' }, flags: { dadLeft: true } };
    expect(run.do({ type: 'jump' })).toEqual([{ type: 'jump-blocked' }]);
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
      for (const b of Object.values(map.buried)) if (b.itemId) placements.push(b.itemId);
    }
    for (const id of SHINY_IDS) expect(placements.filter((p) => p === id), id).toHaveLength(1);
    expect(SHINY_IDS).toHaveLength(16);
  });

  it('never parks a secret nook where nothing can reach it', () => {
    for (const map of Object.values(MAPS)) {
      for (const k of Object.keys(map.secrets)) expect(map.tiles[Number(k.split(',')[1])]![Number(k.split(',')[0])]).toBe('floor');
    }
  });
});
