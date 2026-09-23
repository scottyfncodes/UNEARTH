/**
 * Core types for UNEARTH's top-down adventure engine.
 *
 * The world is authored as fixed-size tile grids ("maps"). Terrain is
 * immutable per map; anything that changes at runtime (a dug tile, a pushed
 * block, an opened door) lives in per-map runtime state instead, keyed by
 * tile coordinate or entity id. That split is what keeps movement, digging,
 * and puzzle logic pure and testable without touching rendering.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vec2 {
  x: number;
  y: number;
}

export function key(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

export function vecEquals(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function step(pos: Vec2, dir: Direction): Vec2 {
  switch (dir) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    case 'right':
      return { x: pos.x + 1, y: pos.y };
  }
}

/**
 * Static terrain kinds. Runtime overrides (dug, opened, moved) live in
 * MapRuntimeState. Doors, switches, blocks, traps and decorations are NOT
 * terrain — they're entities that sit on top of an ordinary floor tile, so
 * their state (open/closed, pushed, disarmed) never has to fight the grid.
 */
/** `path` is walkable floor drawn as a trodden track — purely visual. */
export type TileType = 'floor' | 'path' | 'wall' | 'water' | 'diggable' | 'catGap' | 'plate' | 'hazard' | 'exit';

export interface ExitDef {
  /** Tile position on this map that triggers the transition when stepped on. */
  at: Vec2;
  toMap: string;
  spawn: Vec2;
  spawnFacing?: Direction;
  /** Optional progression gate — the exit is inert until this flag is set. */
  requiresFlag?: string;
  /** Optional inventory gate — the exit is inert until CK carries this item. */
  requiresItem?: string;
  /** Shown if the exit is gated and its requirement isn't met yet. */
  lockedMessage?: string;
}

export interface NpcEntity {
  kind: 'npc';
  id: string;
  pos: Vec2;
  name: string;
  /** Which pixel sprite the renderer draws — 'dad', 'tortoise', 'bat', 'crow'… */
  sprite: string;
  lines: string[];
  /** Checked top-to-bottom; first flag present in state wins over `lines`. */
  flagLines?: { flag: string; lines: string[] }[];
  /** If set, this flag being true removes the NPC from the map entirely. */
  vanishesWhenFlag?: string;
  /** Set true the moment the currently-active line sequence is read to the end. */
  onCompleteFlag?: string;
  /** Hidden (not present, not interactable) until this flag is set. */
  requiresFlag?: string;
}

export interface ItemEntity {
  kind: 'item';
  id: string;
  pos: Vec2;
  itemId: string;
  /** Hidden (not present, not interactable) until this flag is set. */
  requiresFlag?: string;
  /** A treat: restores this many hearts on pickup instead of going in the satchel. */
  heals?: number;
}

export interface DoorEntity {
  kind: 'door';
  id: string;
  pos: Vec2;
  /** Artifact id that unlocks this door on interact. */
  requiresArtifact?: string;
  /** Flag set by a switch/lever elsewhere that, once true, opens this door. */
  opensOnFlag?: string;
  /** Opens while a pushable block rests on every one of these tiles. */
  opensWhenBlocksOn?: Vec2[];
  lockedMessage?: string;
}

export interface SwitchEntity {
  kind: 'switch';
  id: string;
  pos: Vec2;
  /** Flag name set permanently true when CK interacts with this lever. */
  setsFlag: string;
}

export interface BlockEntity {
  kind: 'block';
  id: string;
  pos: Vec2;
}

export interface TrapEntity {
  kind: 'trap';
  id: string;
  pos: Vec2;
  trapType: 'dart' | 'fallingRock';
  /** Tile position of the plate that arms/fires this trap. */
  triggerPlate: Vec2;
  /** The trap's metal mechanism shows up on the detector as a warning. */
  detectable?: boolean;
}

export interface ClueNoteEntity {
  kind: 'clueNote';
  id: string;
  pos: Vec2;
  clueId: string;
  /** Hidden until this flag is set — e.g. a note left behind after someone leaves. */
  requiresFlag?: string;
}

export interface DecorationEntity {
  kind: 'decoration';
  id: string;
  pos: Vec2;
  spriteId: string;
  /** Floor-level detail (a rug, scorch marks) CK can walk over. Decorations are solid otherwise. */
  walkable?: boolean;
  /** Inspecting this decoration (interact) reveals a clue, no pickup. */
  clueId?: string;
  /** Purely flavor line shown on interact when there's no clue. */
  line?: string;
  requiresFlag?: string;
  /**
   * Knock-over: the first interact bats this off its perch and drops an item
   * (very cat). The decoration is then drawn knocked over and shows
   * `afterLine` on later interacts.
   */
  givesItem?: string;
  /** Set true on the first interact — a story beat hung on looking at something. */
  setsFlag?: string;
  afterLine?: string;
  /** After interacting, CK is moved here — used for the story's one big time-skip. */
  warpTo?: { mapId: string; pos: Vec2; facing?: Direction };
}

export type Entity =
  | NpcEntity
  | ItemEntity
  | DoorEntity
  | SwitchEntity
  | BlockEntity
  | TrapEntity
  | ClueNoteEntity
  | DecorationEntity;

export interface BuriedItem {
  itemId: string;
}

export type MapRegistry = Record<string, GameMap>;

export interface GameMap {
  id: string;
  name: string;
  /** Region identity, drives the palette used to render this map. */
  region: Region;
  /** Unlit: the renderer only shows what CK's light reaches. */
  dark?: boolean;
  /** A chapter title card shown the first time CK arrives. */
  chapter?: { number: string; title: string };
  width: number;
  height: number;
  tiles: TileType[][];
  entities: Entity[];
  /** Tile coords (keyed "x,y") that hide a buried item under a diggable tile. */
  buried: Record<string, BuriedItem>;
  exits: ExitDef[];
  /** Tile CK lands on when entering this map with no better spawn info. */
  defaultSpawn: Vec2;
  /** Hidden nooks (keyed "x,y") that chime and count the first time CK steps in. */
  secrets: Record<string, true>;
}

export type Region = 'home' | 'meadow' | 'temple' | 'well' | 'crypt' | 'vault';

export interface MapRuntimeState {
  dug: Record<string, true>;
  takenItems: Record<string, true>;
  openedDoors: Record<string, true>;
  toggledSwitches: Record<string, true>;
  movedBlocks: Record<string, Vec2>;
  disarmedTraps: Record<string, true>;
  foundSecrets: Record<string, true>;
  /** Decorations CK has already knocked over / used. */
  usedDecorations: Record<string, true>;
}

export function emptyMapState(): MapRuntimeState {
  return {
    dug: {},
    takenItems: {},
    openedDoors: {},
    toggledSwitches: {},
    movedBlocks: {},
    disarmedTraps: {},
    foundSecrets: {},
    usedDecorations: {},
  };
}

export type ToolId = 'detector' | 'paws';

export interface DialogueState {
  npcId: string;
  lines: string[];
  index: number;
}

export interface GameState {
  mapId: string;
  player: { pos: Vec2; facing: Direction };
  hearts: number;
  maxHearts: number;
  tool: ToolId;
  detectorOn: boolean;
  /** Fragment ids, tool ids, and assembled artifact ids all live here. */
  inventory: string[];
  flags: Record<string, boolean>;
  clues: string[];
  mapStates: Record<string, MapRuntimeState>;
  dialogue: DialogueState | null;
}

export type GameEvent =
  | { type: 'bump' }
  | { type: 'transition'; toMap: string; firstVisit: boolean }
  | { type: 'secret' }
  | { type: 'heal'; itemId: string }
  | { type: 'knock'; itemId?: string }
  | { type: 'warp'; toMap: string }
  | { type: 'dig-empty' }
  | { type: 'reveal'; itemId: string }
  | { type: 'pickup'; itemId: string }
  | { type: 'assemble'; artifactId: string }
  | { type: 'clue'; clueId: string }
  | { type: 'switch-on'; switchId: string }
  | { type: 'already-done' }
  | { type: 'door-locked'; message: string }
  | { type: 'door-open'; doorId: string }
  | { type: 'push' }
  | { type: 'trap-hit' }
  | { type: 'knockout' }
  | { type: 'talk-start' }
  | { type: 'talk-end' }
  | { type: 'flavor'; line: string }
  | { type: 'exit-locked'; message: string };

export type Action =
  | { type: 'move'; direction: Direction }
  | { type: 'interact' }
  | { type: 'dig' }
  | { type: 'toggleTool' };
