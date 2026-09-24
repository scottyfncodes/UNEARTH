/**
 * Time. Most of UNEARTH is turn-based — nothing happens until CK moves —
 * but the best traps are about *moments*: the click under your paw and the
 * half-second before the darts come, the tile that holds just long enough,
 * the blades that rise on a beat, the boulder you hear before you see.
 *
 * The UI sends a `tick` with the time since the last one (`dt`) and the game
 * clock (`now`), and only while nothing modal is on screen, so a find card
 * never lets a boulder catch up. Countdowns (strikes, crumbling tiles,
 * rollers) run on `dt`; rhythms (spikes) run on `now`. A tick with nothing
 * in flight returns the very same state object, so an idle room costs
 * nothing and saves nothing.
 */
import type { ActiveRoller, GameEvent, GameMap, GameState, MapRegistry, RollerEntity, TimedState, TrapEntity, Vec2 } from './types';
import { emptyTimed, key } from './types';
import { applyDamage } from './movement';
import { setFlag } from './inventory';
import { isTrapDisarmed, mapStateOf, trapLane } from './world';

export function rolledFlag(rollerId: string): string {
  return `rolled:${rollerId}`;
}

function onTile(pos: Vec2, tiles: Vec2[]): boolean {
  return tiles.some((t) => t.x === pos.x && t.y === pos.y);
}

export function spikesUp(trap: TrapEntity, now: number): { up: boolean; cycle: number } {
  const period = trap.period ?? 2000;
  const t = now + (trap.offsetMs ?? 0);
  return { up: ((t % period) + period) % period < (trap.upMs ?? period / 3), cycle: Math.floor(t / period) };
}

function hasRhythm(map: GameMap): boolean {
  return map.entities.some((e) => e.kind === 'trap' && e.trapType === 'spikes');
}

function startableRollers(map: GameMap, state: GameState, timed: TimedState): RollerEntity[] {
  return map.entities.filter(
    (e): e is RollerEntity =>
      e.kind === 'roller' && !!state.flags[e.startsOnFlag] && !state.flags[rolledFlag(e.id)] && !timed.rollers.some((r) => r.id === e.id),
  );
}

/** Whether a tick could possibly change anything in this room right now. */
export function needsTick(map: GameMap, state: GameState): boolean {
  const timed = state.timed;
  if (timed && (timed.strikes.length || timed.rollers.length || timed.crumbling.length)) return true;
  if (hasRhythm(map)) return true;
  return startableRollers(map, state, timed ?? emptyTimed()).length > 0;
}

/** Where a rolling thing is drawn right now, in fractional tiles. */
export function rollerPosition(roller: RollerEntity, active: ActiveRoller): Vec2 {
  const a = roller.path[active.index]!;
  if (active.index === 0 && active.left > roller.stepMs) return a;
  const b = roller.path[Math.min(active.index + 1, roller.path.length - 1)]!;
  const k = 1 - Math.min(1, Math.max(0, active.left / roller.stepMs));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

export function tick(maps: MapRegistry, state: GameState, dt: number, now: number): { state: GameState; events: GameEvent[] } {
  const map = maps[state.mapId]!;
  if (!needsTick(map, state)) return { state, events: [] };

  const events: GameEvent[] = [];
  let next = state;
  let timed: TimedState = { ...(state.timed ?? emptyTimed()) };

  const hurt = (knockTo: Vec2): boolean => {
    const result = applyDamage({ ...next, timed }, knockTo, map.defaultSpawn);
    next = result.state;
    if (result.knockedOut) {
      events.push({ type: 'knockout' });
      timed = emptyTimed();
    }
    return result.knockedOut;
  };

  // ── rollers waking up ────────────────────────────────────────────────
  for (const roller of startableRollers(map, next, timed)) {
    timed = { ...timed, rollers: [...timed.rollers, { id: roller.id, index: 0, left: roller.windupMs + roller.stepMs }] };
    events.push({ type: 'roller-start', id: roller.id });
  }

  // ── delayed strikes ──────────────────────────────────────────────────
  if (timed.strikes.length) {
    const remaining = [];
    for (const strike of timed.strikes) {
      const left = strike.left - dt;
      if (left > 0) {
        remaining.push({ ...strike, left });
        continue;
      }
      const trap = map.entities.find((e): e is TrapEntity => e.kind === 'trap' && e.id === strike.trapId);
      if (!trap || isTrapDisarmed(trap, next)) continue;
      const lane = trapLane(trap, strike.at);
      events.push({ type: 'trap-fire', trapId: trap.id, trapType: trap.trapType, from: trap.pos, lane });
      if (onTile(next.player.pos, lane)) {
        const at = next.player.pos;
        events.push({ type: 'trap-hit', trapId: trap.id, trapType: trap.trapType, from: trap.pos, at });
        if (hurt(strike.armedFrom)) break;
      } else {
        events.push({ type: 'trap-miss', trapId: trap.id, trapType: trap.trapType });
      }
    }
    timed = { ...timed, strikes: events.some((e) => e.type === 'knockout') ? [] : remaining };
  }

  // ── crumbling floor ──────────────────────────────────────────────────
  if (timed.crumbling.length) {
    const remaining = [];
    for (const c of timed.crumbling) {
      const left = c.left - dt;
      if (left > 0) {
        remaining.push({ ...c, left });
        continue;
      }
      const [x, y] = c.key.split(',').map(Number) as [number, number];
      const mapState = mapStateOf(next, map.id);
      next = { ...next, mapStates: { ...next.mapStates, [map.id]: { ...mapState, collapsed: { ...mapState.collapsed, [c.key]: true } } } };
      events.push({ type: 'crumble', at: { x, y } });
      if (key(next.player.pos) === c.key) {
        // CK drops, scrabbles out, and the loose stones settle back where they were.
        events.push({ type: 'fall' });
        const ms = mapStateOf(next, map.id);
        next = { ...next, mapStates: { ...next.mapStates, [map.id]: { ...ms, collapsed: {} } } };
        remaining.length = 0;
        if (hurt(next.safe ?? map.defaultSpawn)) break;
        break;
      }
    }
    timed = { ...timed, crumbling: events.some((e) => e.type === 'fall' || e.type === 'knockout') ? [] : remaining };
  }

  // ── spikes, on the beat ──────────────────────────────────────────────
  for (const trap of map.entities) {
    if (trap.kind !== 'trap' || trap.trapType !== 'spikes' || isTrapDisarmed(trap, next)) continue;
    const { up, cycle } = spikesUp(trap, now);
    if (!up || !onTile(next.player.pos, trap.lane ?? []) || timed.spikeHits[trap.id] === cycle) continue;
    timed = { ...timed, spikeHits: { ...timed.spikeHits, [trap.id]: cycle } };
    events.push({ type: 'trap-hit', trapId: trap.id, trapType: 'spikes', from: trap.pos, at: next.player.pos });
    hurt(next.safe ?? map.defaultSpawn);
  }

  // ── rolling things ───────────────────────────────────────────────────
  if (timed.rollers.length) {
    const remaining: ActiveRoller[] = [];
    for (const active of timed.rollers) {
      const roller = map.entities.find((e): e is RollerEntity => e.kind === 'roller' && e.id === active.id);
      if (!roller) continue;
      let cur = { ...active, left: active.left - dt };
      let done = false;
      while (cur.left <= 0) {
        if (cur.index + 1 >= roller.path.length - 1) {
          done = true;
          break;
        }
        cur = { ...cur, index: cur.index + 1, left: cur.left + roller.stepMs };
      }
      // Rolling over CK: flattened, once per tile, never moved — it just keeps going.
      const here = roller.path[cur.index]!;
      const moving = !(cur.index === 0 && cur.left > roller.stepMs);
      if (moving && !done && here.x === next.player.pos.x && here.y === next.player.pos.y && cur.hitIndex !== cur.index) {
        cur = { ...cur, hitIndex: cur.index };
        events.push({ type: 'roller-hit', id: roller.id });
        hurt(next.player.pos);
      }
      if (done) {
        next = setFlag(next, rolledFlag(roller.id));
        events.push({ type: 'roller-stop', id: roller.id, at: roller.path[roller.path.length - 1]! });
      } else {
        remaining.push(cur);
      }
    }
    timed = { ...timed, rollers: remaining };
  }

  const counting = timed.strikes.length > 0 || timed.rollers.length > 0 || timed.crumbling.length > 0;
  // A rhythm ticking over with nobody on it changes nothing: keep the same object.
  if (!counting && events.length === 0) return { state, events };
  next = { ...next, timed };
  return { state: next, events };
}
