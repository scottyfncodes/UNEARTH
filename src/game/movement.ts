/**
 * CK moves one tile at a time — classic grid-stepped adventure movement.
 * Facing always updates, even when the step itself is blocked, so bumping
 * into a wall still turns CK to face it (readable, and it's how you aim a
 * dig or a push). CK can also turn on the spot, which is how you sweep the
 * collar around to find which way a signal is coming from, and hop two
 * tiles forward, clearing whatever low thing or narrow gap sits between.
 *
 * Walking and hopping share one arrival rule: whatever CK lands on — an
 * item, a nook, a trigger strip, a crumbling tile, an exit — reacts the same
 * way however CK got there. The tile CK hops *over* reacts to nothing,
 * which is exactly why hopping a trigger strip is the quiet way across.
 */
import type { CurioEntity, Direction, Entity, GameEvent, GameMap, GameState, MapRegistry, TrapEntity, Vec2 } from './types';
import { emptyTimed, key, step } from './types';
import { addClue, addItem, setFlag } from './inventory';
import {
  dressingAt,
  entitiesAt,
  isBlocked,
  isDoorOpen,
  isHazardTile,
  isTrapDisarmed,
  mapStateOf,
  resolvedTerrainAt,
  terrainAt,
} from './world';

type BlockEntity = Extract<Entity, { kind: 'block' }>;

function blockAt(maps: MapRegistry, state: GameState, pos: Vec2): BlockEntity | undefined {
  const map = maps[state.mapId]!;
  return entitiesAt(map, state, pos).find((e): e is BlockEntity => e.kind === 'block');
}

/** Can a block be pushed onto `pos`? Pits accept exactly one block and become a bridge. */
function isPushDestinationOpen(maps: MapRegistry, state: GameState, pos: Vec2): boolean {
  const map = maps[state.mapId]!;
  const terrain = terrainAt(map, pos);
  if (terrain === null || terrain === 'wall' || terrain === 'water' || terrain === 'catGap' || terrain === 'exit') {
    return false;
  }
  if (blockAt(maps, state, pos)) return false;
  if (dressingAt(map, pos)?.solid) return false;
  if (entitiesAt(map, state, pos).some((e) => (e.kind === 'door' && !isDoorOpen(e, state, map)) || e.kind === 'npc' || (e.kind === 'decoration' && !e.walkable))) return false;
  return true;
}

export function visitedFlag(mapId: string): string {
  return `visited:${mapId}`;
}

/** Puts CK on another map and remembers that it has been visited. Anything mid-flight in the old room stops. */
export function enterMap(state: GameState, mapId: string, pos: Vec2, facing: Direction): GameState {
  const { timed: _timed, ...rest } = state;
  return {
    ...rest,
    mapId,
    player: { pos, facing },
    safe: pos,
    mapStates: { ...state.mapStates, [mapId]: mapStateOf(state, mapId) },
    flags: { ...state.flags, [visitedFlag(mapId)]: true },
  };
}

/**
 * A weighted-plate door, once its plates are all covered, stays open for
 * good — so resetting the room's blocks later can never lock CK out.
 */
function latchWeightedDoors(map: GameMap, state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let next = state;
  for (const door of map.entities) {
    if (door.kind !== 'door' || !door.opensWhenBlocksOn) continue;
    const mapState = mapStateOf(next, map.id);
    if (mapState.openedDoors[door.id] || !isDoorOpen(door, next, map)) continue;
    next = {
      ...next,
      mapStates: { ...next.mapStates, [map.id]: { ...mapState, openedDoors: { ...mapState.openedDoors, [door.id]: true } } },
    };
    events.push({ type: 'door-open', doorId: door.id });
  }
  return { state: next, events };
}

/**
 * Leaving a room puts its loose blocks back where they started, so a block
 * shoved into a corner can never softlock a puzzle, and lets any crumbled
 * floor settle back. A block that bridges a pit is progress, not a
 * mistake — it stays.
 */
function resetRoom(map: GameMap, state: GameState): GameState {
  const mapState = mapStateOf(state, map.id);
  const kept: Record<string, Vec2> = {};
  for (const [id, pos] of Object.entries(mapState.movedBlocks)) {
    if (terrainAt(map, pos) === 'hazard') kept[id] = pos;
  }
  const blocksSame = Object.keys(kept).length === Object.keys(mapState.movedBlocks).length;
  const nothingCollapsed = Object.keys(mapState.collapsed).length === 0;
  if (blocksSame && nothingCollapsed) return state;
  return { ...state, mapStates: { ...state.mapStates, [map.id]: { ...mapState, movedBlocks: kept, collapsed: {} } } };
}

function legacyPlateTrap(map: GameMap, state: GameState, platePos: Vec2): TrapEntity | undefined {
  return map.entities.find(
    (e): e is TrapEntity =>
      e.kind === 'trap' && !!e.triggerPlate && e.triggerPlate.x === platePos.x && e.triggerPlate.y === platePos.y && !isTrapDisarmed(e, state),
  );
}

/**
 * One heart lost, CK moved to `knockbackTo`. On the last heart CK scampers
 * back to the room's entrance with a full set instead — nothing is lost.
 */
export function applyDamage(state: GameState, knockbackTo: Vec2, safeSpawn: Vec2): { state: GameState; knockedOut: boolean } {
  const hearts = state.hearts - 1;
  if (hearts <= 0) {
    const { timed: _timed, ...rest } = state;
    return { state: { ...rest, hearts: state.maxHearts, player: { ...state.player, pos: safeSpawn }, safe: safeSpawn }, knockedOut: true };
  }
  return { state: { ...state, hearts, player: { ...state.player, pos: knockbackTo } }, knockedOut: false };
}

function curioInReach(map: GameMap, state: GameState, pos: Vec2): CurioEntity | undefined {
  const used = mapStateOf(state, map.id).usedDecorations;
  return map.entities.find(
    (e): e is CurioEntity =>
      e.kind === 'curio' &&
      !used[e.id] &&
      !(e.requiresFlag && !state.flags[e.requiresFlag]) &&
      Math.max(Math.abs(e.pos.x - pos.x), Math.abs(e.pos.y - pos.y)) <= (e.radius ?? 1),
  );
}

/** Sets off a delayed trap from a trigger tile — by CK or by a kicked pebble. */
export function armTrapsAt(map: GameMap, state: GameState, at: Vec2, armedFrom: Vec2, events: GameEvent[]): GameState {
  let next = state;
  for (const trap of map.entities) {
    if (trap.kind !== 'trap' || !trap.triggers || isTrapDisarmed(trap, next)) continue;
    if (!trap.triggers.some((t) => t.x === at.x && t.y === at.y)) continue;
    const timed = next.timed ?? emptyTimed();
    if (timed.strikes.some((s) => s.trapId === trap.id)) continue;
    next = { ...next, timed: { ...timed, strikes: [...timed.strikes, { trapId: trap.id, left: trap.delayMs ?? 0, armedFrom, at }] } };
    events.push({ type: 'trap-armed', trapId: trap.id, trapType: trap.trapType, at });
  }
  return next;
}

/** Everything that happens because CK has just arrived on `to`, however CK got there. */
function arrive(maps: MapRegistry, state: GameState, from: Vec2, to: Vec2, events: GameEvent[], priorState: GameState): GameState {
  const map = maps[state.mapId]!;
  let next = state;

  const item = entitiesAt(map, next, to).find((e): e is Extract<Entity, { kind: 'item' }> => e.kind === 'item');
  if (item) {
    const mapState = mapStateOf(next, map.id);
    next = {
      ...next,
      mapStates: { ...next.mapStates, [map.id]: { ...mapState, takenItems: { ...mapState.takenItems, [item.id]: true } } },
    };
    if (item.heals) {
      next = { ...next, hearts: Math.min(next.maxHearts, next.hearts + item.heals) };
      events.push({ type: 'heal', itemId: item.itemId });
    } else {
      next = addItem(next, item.itemId);
      events.push({ type: 'pickup', itemId: item.itemId });
    }
    if (item.setsFlag) next = setFlag(next, item.setsFlag);
  }

  const secretKey = key(to);
  if (map.secrets[secretKey] && !mapStateOf(next, map.id).foundSecrets[secretKey]) {
    const mapState = mapStateOf(next, map.id);
    next = {
      ...next,
      mapStates: { ...next.mapStates, [map.id]: { ...mapState, foundSecrets: { ...mapState.foundSecrets, [secretKey]: true } } },
    };
    events.push({ type: 'secret' });
  }

  const curio = curioInReach(map, next, to);
  if (curio) {
    const mapState = mapStateOf(next, map.id);
    next = {
      ...next,
      mapStates: { ...next.mapStates, [map.id]: { ...mapState, usedDecorations: { ...mapState.usedDecorations, [curio.id]: true } } },
    };
    events.push({ type: 'curio', id: curio.id, bubble: curio.bubble, ...(curio.line ? { line: curio.line } : {}) });
    if (curio.clueId && !next.clues.includes(curio.clueId)) {
      next = addClue(next, curio.clueId);
      events.push({ type: 'clue', clueId: curio.clueId });
    }
  }

  const terrain = resolvedTerrainAt(map, mapStateOf(next, map.id), to);
  if (terrain === 'plate') {
    const trap = legacyPlateTrap(map, next, to);
    if (trap) {
      const { state: hurt, knockedOut } = applyDamage(next, from, map.defaultSpawn);
      next = hurt;
      events.push({ type: 'trap-hit', trapId: trap.id, trapType: trap.trapType, from: trap.pos, at: to });
      if (knockedOut) events.push({ type: 'knockout' });
      return next;
    }
  }

  // A save from before `safe` existed (or a fresh load) still knows where CK just was.
  if (!next.safe && !isHazardTile(map, from)) next = { ...next, safe: from };
  next = armTrapsAt(map, next, to, next.safe ?? from, events);

  if (terrain === 'crumble') {
    const timed = next.timed ?? emptyTimed();
    if (!timed.crumbling.some((c) => c.key === key(to))) {
      next = { ...next, timed: { ...timed, crumbling: [...timed.crumbling, { key: key(to), left: CRUMBLE_MS }] } };
      events.push({ type: 'crumble-start', at: to });
    }
  }

  if (!isHazardTile(map, to)) next = { ...next, safe: to };

  const exit = map.exits.find((ex) => ex.at.x === to.x && ex.at.y === to.y);
  if (exit) {
    next = resetRoom(map, next);
    next = enterMap(next, exit.toMap, exit.spawn, exit.spawnFacing ?? next.player.facing);
    events.push({
      type: 'transition',
      toMap: exit.toMap,
      firstVisit: !priorState.flags[visitedFlag(exit.toMap)],
      ...(exit.hidden && exit.fallMessage ? { fall: exit.fallMessage } : {}),
    });
  }
  return next;
}

/** How long a cracked tile holds after CK steps on it. Keep moving and it never matters. */
export const CRUMBLE_MS = 750;

function gatedExitAt(map: GameMap, state: GameState, pos: Vec2) {
  return map.exits.find(
    (ex) =>
      ex.at.x === pos.x &&
      ex.at.y === pos.y &&
      ((ex.requiresFlag && !state.flags[ex.requiresFlag]) || (ex.requiresItem && !state.inventory.includes(ex.requiresItem))),
  );
}

export function attemptMove(maps: MapRegistry, state: GameState, direction: Direction): { state: GameState; events: GameEvent[] } {
  const map = maps[state.mapId]!;
  const from = state.player.pos;
  const to = step(from, direction);
  const events: GameEvent[] = [];
  let next: GameState = { ...state, player: { pos: from, facing: direction } };

  // A block already bridging a pit is the floor there, not an obstacle to push further.
  const block = terrainAt(map, to) === 'hazard' ? undefined : blockAt(maps, next, to);
  if (block) {
    const beyond = step(to, direction);
    if (!isPushDestinationOpen(maps, next, beyond)) {
      events.push({ type: 'bump' });
      return { state: next, events };
    }
    const mapState = mapStateOf(next, map.id);
    next = {
      ...next,
      mapStates: {
        ...next.mapStates,
        [map.id]: { ...mapState, movedBlocks: { ...mapState.movedBlocks, [block.id]: beyond } },
      },
      player: { pos: to, facing: direction },
    };
    events.push({ type: 'push' });
    return latchWeightedDoors(map, next, events);
  }

  const gatedExit = gatedExitAt(map, next, to);
  if (gatedExit) {
    events.push({ type: 'exit-locked', message: gatedExit.lockedMessage ?? "That way isn't open yet." });
    return { state: next, events };
  }

  if (isBlocked(map, next, to)) {
    events.push({ type: 'bump' });
    return { state: next, events };
  }

  next = { ...next, player: { pos: to, facing: direction } };
  next = arrive(maps, next, from, to, events, state);
  return { state: next, events };
}

export function attemptTurn(state: GameState, direction: Direction): { state: GameState; events: GameEvent[] } {
  if (state.player.facing === direction) return { state, events: [] };
  return { state: { ...state, player: { ...state.player, facing: direction } }, events: [] };
}

/** Can CK sail over `pos` mid-hop? Low things and one-tile gaps, yes; walls and tall things, no. */
function canHopOver(map: GameMap, state: GameState, pos: Vec2): boolean {
  const mapState = mapStateOf(state, map.id);
  const terrain = resolvedTerrainAt(map, mapState, pos);
  if (terrain === null || terrain === 'wall' || terrain === 'catGap' || terrain === 'exit') return false;
  const dressing = dressingAt(map, pos);
  if (dressing?.solid && !dressing.low) return false;
  for (const e of entitiesAt(map, state, pos, mapState)) {
    if (e.kind === 'door' && !isDoorOpen(e, state, map)) return false;
    if (e.kind === 'npc') return false;
    if (e.kind === 'block' && terrain !== 'hazard') return false;
    if (e.kind === 'decoration' && !e.walkable) return false;
  }
  return true;
}

/**
 * A hop: two tiles forward, touching nothing in between. It clears a
 * one-tile gap, a low heap of rubble, or a trigger strip CK has learned to
 * distrust. It never clears a wall, and it never lands anywhere CK couldn't
 * have walked — no precision, no fall damage, just a cat being a cat.
 */
export function attemptJump(maps: MapRegistry, state: GameState): { state: GameState; events: GameEvent[] } {
  const map = maps[state.mapId]!;
  const from = state.player.pos;
  const dir = state.player.facing;
  const mid = step(from, dir);
  const land = step(mid, dir);
  if (!canHopOver(map, state, mid) || gatedExitAt(map, state, land) || isBlocked(map, state, land)) {
    return { state, events: [{ type: 'jump-blocked' }] };
  }
  const events: GameEvent[] = [{ type: 'jump', from, to: land }];
  let next: GameState = { ...state, player: { pos: land, facing: dir } };
  next = arrive(maps, next, from, land, events, state);
  return { state: next, events };
}
