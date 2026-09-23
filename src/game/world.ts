/**
 * Read-only helpers for resolving what's actually at a tile once runtime
 * state (dug patches, taken items, opened doors, pushed blocks, disarmed
 * traps, story flags) is layered on top of a map's fixed terrain grid.
 */
import { emptyMapState, key, vecEquals, type Entity, type GameMap, type GameState, type MapRuntimeState, type TileType, type Vec2 } from './types';

export function mapStateOf(state: GameState, mapId: string = state.mapId): MapRuntimeState {
  const stored = state.mapStates[mapId];
  if (!stored) return emptyMapState();
  // Tolerate a map state saved before a field existed.
  return stored.foundSecrets && stored.usedDecorations ? stored : { ...emptyMapState(), ...stored };
}

export function inBounds(map: GameMap, pos: Vec2): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < map.width && pos.y < map.height;
}

export function terrainAt(map: GameMap, pos: Vec2): TileType | null {
  if (!inBounds(map, pos)) return null;
  return map.tiles[pos.y]![pos.x]!;
}

/** Terrain after runtime overrides — a dug patch of dirt reads as floor. */
export function resolvedTerrainAt(map: GameMap, mapState: MapRuntimeState, pos: Vec2): TileType | null {
  const raw = terrainAt(map, pos);
  if (raw === 'diggable' && mapState.dug[key(pos)]) return 'floor';
  return raw;
}

function entityVisible(entity: Entity, state: GameState, mapState: MapRuntimeState): boolean {
  if ('requiresFlag' in entity && entity.requiresFlag && !state.flags[entity.requiresFlag]) return false;
  if (entity.kind === 'item' && mapState.takenItems[entity.id]) return false;
  if (entity.kind === 'npc' && entity.vanishesWhenFlag && state.flags[entity.vanishesWhenFlag]) return false;
  return true;
}

function entityPos(entity: Entity, mapState: MapRuntimeState): Vec2 {
  if (entity.kind === 'block') return mapState.movedBlocks[entity.id] ?? entity.pos;
  return entity.pos;
}

/** All entities currently present at `pos`, accounting for runtime state. */
export function entitiesAt(map: GameMap, state: GameState, pos: Vec2, mapState = mapStateOf(state, map.id)): Entity[] {
  return map.entities.filter((e) => entityVisible(e, state, mapState) && vecEquals(entityPos(e, mapState), pos));
}

/** Every entity on `map` currently visible, at its resolved (possibly pushed) position. */
export function visibleEntities(map: GameMap, state: GameState): { entity: Entity; pos: Vec2 }[] {
  const mapState = mapStateOf(state, map.id);
  return map.entities.filter((e) => entityVisible(e, state, mapState)).map((entity) => ({ entity, pos: entityPos(entity, mapState) }));
}

/** Where every block on `map` currently rests. */
export function blockPositions(map: GameMap, mapState: MapRuntimeState): Vec2[] {
  return map.entities.filter((e) => e.kind === 'block').map((e) => entityPos(e, mapState));
}

export function isDoorOpen(entity: Extract<Entity, { kind: 'door' }>, state: GameState, map?: GameMap): boolean {
  if (entity.opensOnFlag && state.flags[entity.opensOnFlag]) return true;
  const mapState = mapStateOf(state, map?.id);
  if (mapState.openedDoors[entity.id]) return true;
  if (entity.opensWhenBlocksOn && map) {
    const blocks = blockPositions(map, mapState);
    return entity.opensWhenBlocksOn.every((p) => blocks.some((b) => vecEquals(b, p)));
  }
  return false;
}

export function isTrapDisarmed(entity: Extract<Entity, { kind: 'trap' }>, state: GameState): boolean {
  return !!mapStateOf(state).disarmedTraps[entity.id];
}

/** Whether CK can occupy `pos` right now — terrain, entities, everything. */
export function isBlocked(map: GameMap, state: GameState, pos: Vec2): boolean {
  const mapState = mapStateOf(state, map.id);
  const terrain = resolvedTerrainAt(map, mapState, pos);
  if (terrain === null) return true;
  if (terrain === 'wall' || terrain === 'water' || terrain === 'diggable') return true;

  const entities = entitiesAt(map, state, pos, mapState);
  const blockHere = entities.some((e) => e.kind === 'block');

  // A pit is only safe once a pushed block bridges it; the block IS the floor there.
  if (terrain === 'hazard') return !blockHere;
  if (blockHere) return true;

  for (const entity of entities) {
    if (entity.kind === 'door' && !isDoorOpen(entity, state, map)) return true;
    if (entity.kind === 'npc') return true;
    if (entity.kind === 'decoration' && !entity.walkable) return true;
  }
  return false;
}

export function findEntity(map: GameMap, id: string): Entity | undefined {
  return map.entities.find((e) => e.id === id);
}
