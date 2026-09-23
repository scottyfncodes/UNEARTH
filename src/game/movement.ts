/**
 * CK moves one tile at a time — classic grid-stepped adventure movement.
 * Facing always updates, even when the step itself is blocked, so bumping
 * into a wall still turns CK to face it (readable, and it's how you aim a
 * dig or a push).
 */
import type { Direction, Entity, GameEvent, GameMap, GameState, MapRegistry, TrapEntity, Vec2 } from './types';
import { key, step } from './types';
import { addItem } from './inventory';
import { entitiesAt, isBlocked, isDoorOpen, isTrapDisarmed, mapStateOf, resolvedTerrainAt, terrainAt } from './world';

type BlockEntity = Extract<Entity, { kind: 'block' }>;

function blockAt(maps: MapRegistry, state: GameState, pos: Vec2): BlockEntity | undefined {
  const map = maps[state.mapId]!;
  return entitiesAt(map, state, pos).find((e): e is BlockEntity => e.kind === 'block');
}

/** Can a block be pushed onto `pos`? Pits accept exactly one block and become a bridge. */
function isPushDestinationOpen(maps: MapRegistry, state: GameState, pos: Vec2): boolean {
  const map = maps[state.mapId]!;
  const terrain = terrainAt(map, pos);
  if (terrain === null || terrain === 'wall' || terrain === 'water' || terrain === 'diggable' || terrain === 'catGap') {
    return false;
  }
  if (blockAt(maps, state, pos)) return false;
  if (entitiesAt(map, state, pos).some((e) => (e.kind === 'door' && !isDoorOpen(e, state, map)) || e.kind === 'npc' || (e.kind === 'decoration' && !e.walkable))) return false;
  return true;
}

export function visitedFlag(mapId: string): string {
  return `visited:${mapId}`;
}

/** Puts CK on another map and remembers that it has been visited. */
export function enterMap(state: GameState, mapId: string, pos: Vec2, facing: Direction): GameState {
  return {
    ...state,
    mapId,
    player: { pos, facing },
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
 * shoved into a corner can never softlock a puzzle. A block that bridges a
 * pit is progress, not a mistake — it stays.
 */
function resetLooseBlocks(map: GameMap, state: GameState): GameState {
  const mapState = mapStateOf(state, map.id);
  const kept: Record<string, Vec2> = {};
  for (const [id, pos] of Object.entries(mapState.movedBlocks)) {
    if (terrainAt(map, pos) === 'hazard') kept[id] = pos;
  }
  if (Object.keys(kept).length === Object.keys(mapState.movedBlocks).length) return state;
  return { ...state, mapStates: { ...state.mapStates, [map.id]: { ...mapState, movedBlocks: kept } } };
}

function firingTrapAt(maps: MapRegistry, state: GameState, platePos: Vec2): TrapEntity | undefined {
  const map = maps[state.mapId]!;
  return map.entities.find(
    (e): e is TrapEntity =>
      e.kind === 'trap' && e.triggerPlate.x === platePos.x && e.triggerPlate.y === platePos.y && !isTrapDisarmed(e, state),
  );
}

function applyTrapDamage(state: GameState, knockbackTo: Vec2, safeSpawn: Vec2): { state: GameState; knockedOut: boolean } {
  const hearts = state.hearts - 1;
  if (hearts <= 0) {
    return { state: { ...state, hearts: state.maxHearts, player: { ...state.player, pos: safeSpawn } }, knockedOut: true };
  }
  return { state: { ...state, hearts, player: { ...state.player, pos: knockbackTo } }, knockedOut: false };
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

  const gatedExit = map.exits.find(
    (ex) =>
      ex.at.x === to.x &&
      ex.at.y === to.y &&
      ((ex.requiresFlag && !next.flags[ex.requiresFlag]) || (ex.requiresItem && !next.inventory.includes(ex.requiresItem))),
  );
  if (gatedExit) {
    events.push({ type: 'exit-locked', message: gatedExit.lockedMessage ?? "That way isn't open yet." });
    return { state: next, events };
  }

  if (isBlocked(map, next, to)) {
    events.push({ type: 'bump' });
    return { state: next, events };
  }

  next = { ...next, player: { pos: to, facing: direction } };

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

  const terrain = resolvedTerrainAt(map, mapStateOf(next, map.id), to);
  if (terrain === 'plate') {
    const trap = firingTrapAt(maps, next, to);
    if (trap) {
      const { state: hurt, knockedOut } = applyTrapDamage(next, from, map.defaultSpawn);
      next = hurt;
      events.push({ type: 'trap-hit' });
      if (knockedOut) events.push({ type: 'knockout' });
    }
  }

  const exit = map.exits.find((ex) => ex.at.x === to.x && ex.at.y === to.y);
  if (exit) {
    next = resetLooseBlocks(map, next);
    next = enterMap(next, exit.toMap, exit.spawn, exit.spawnFacing ?? next.player.facing);
    events.push({ type: 'transition', toMap: exit.toMap, firstVisit: !state.flags[visitedFlag(exit.toMap)] });
  }

  return { state: next, events };
}
