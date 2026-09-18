/**
 * CK moves one tile at a time — classic grid-stepped adventure movement.
 * Facing always updates, even when the step itself is blocked, so bumping
 * into a wall still turns CK to face it (readable, and it's how you aim a
 * dig or a push).
 */
import type { Direction, Entity, GameEvent, GameState, MapRegistry, TrapEntity, Vec2 } from './types';
import { step } from './types';
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
  if (entitiesAt(map, state, pos).some((e) => (e.kind === 'door' && !isDoorOpen(e, state)) || e.kind === 'npc')) return false;
  return true;
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
    return { state: next, events };
  }

  const gatedExit = map.exits.find((ex) => ex.at.x === to.x && ex.at.y === to.y && ex.requiresFlag && !next.flags[ex.requiresFlag]);
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
    next = addItem(next, item.itemId);
    events.push({ type: 'pickup', itemId: item.itemId });
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
    const targetMap = maps[exit.toMap]!;
    next = {
      ...next,
      mapId: exit.toMap,
      player: { pos: exit.spawn, facing: exit.spawnFacing ?? next.player.facing },
      mapStates: { ...next.mapStates, [targetMap.id]: mapStateOf(next, targetMap.id) },
    };
    events.push({ type: 'transition', toMap: exit.toMap });
  }

  return { state: next, events };
}
