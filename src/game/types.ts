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
/**
 * `path` is walkable floor drawn as a trodden track — purely visual.
 * `diggable` is soft, walkable earth: it looks like ordinary ground and most
 * of it hides nothing at all. `trigger` is a floor brick that is very
 * slightly wrong — the trigger strip of a delayed trap. `crumble` is a
 * cracked tile that gives way shortly after CK stands on it. `spikes` is a
 * floor studded with holes that a spike trap pushes blades up through.
 */
export type TileType =
  | 'floor'
  | 'path'
  | 'wall'
  | 'water'
  | 'diggable'
  | 'catGap'
  | 'plate'
  | 'hazard'
  | 'exit'
  | 'trigger'
  | 'crumble'
  | 'spikes';

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
  /**
   * A hidden exit: drawn as ordinary ground (with whatever dressing sits on
   * it) rather than a threshold, so stepping on it is a surprise — a rotten
   * tarp over an old trench, say.
   */
  hidden?: boolean;
  /** Shown as CK drops through a hidden exit. */
  fallMessage?: string;
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
  /** Picking this up sets a story flag — e.g. lifting an idol off its pedestal. */
  setsFlag?: string;
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
  /** How a closed door reads: a crack in an otherwise ordinary wall, say. */
  look?: 'crackedWall';
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

export type TrapType = 'dart' | 'fallingRock' | 'spikes';

/**
 * A trap. `pos` is its mechanism — the dart holes in a wall, the loose
 * ceiling stone, the spike housing — which is what the collar warbles at.
 *
 * Three ways a trap can go off:
 *  - `triggerPlate` (legacy): stepping on that one tile fires instantly.
 *  - `triggers` + `delayMs`: stepping on any trigger tile goes *click*, and
 *    the trap strikes its `lane` a moment later. Whoever is still standing
 *    in the lane when it does gets hit; whoever kept moving hears it hiss
 *    past behind them. Hopping clean over a trigger never sets it off.
 *  - `period` (spikes): blades rise through the `lane` on a fixed rhythm,
 *    no trigger at all — a timing problem, not an observation one.
 */
export interface TrapEntity {
  kind: 'trap';
  id: string;
  pos: Vec2;
  trapType: TrapType;
  /** Legacy: the single plate that fires this trap instantly. */
  triggerPlate?: Vec2;
  /** Tiles that arm this trap when CK (or a kicked pebble) lands on them. */
  triggers?: Vec2[];
  /** Tiles the trap actually strikes. Defaults to the triggers themselves (or, for a rock, just the tile that set it off). */
  lane?: Vec2[];
  /** Milliseconds between the click and the strike. */
  delayMs?: number;
  /** Spikes: full cycle length, how long the blades stay up, and a phase offset. */
  period?: number;
  upMs?: number;
  offsetMs?: number;
  /** The trap's metal mechanism shows up on the detector as a warning. */
  detectable?: boolean;
}

/**
 * Something big that rolls along a fixed path once a flag is set — a boulder
 * shaken loose by lifting an idol, say. It flattens anything it rolls over
 * (comically, and never fatally), then shatters at the end of its path and
 * sets `rolled:<id>`, which a cracked-wall door can open on.
 */
export interface RollerEntity {
  kind: 'roller';
  id: string;
  /** Always path[0]. */
  pos: Vec2;
  path: Vec2[];
  /** Milliseconds per tile once it is rolling. */
  stepMs: number;
  /** A beat of rumbling before it starts moving — the "oh no" moment. */
  windupMs: number;
  startsOnFlag: string;
}

/**
 * An invisible spot that makes CK *notice* something the first time CK
 * comes close: ears up, a little thought bubble, sometimes a line. Most are
 * just curiosity — a beetle, a smell, a draught. Some are the first hint
 * that something is buried nearby. Only CK's reaction gives any of it away.
 */
export interface CurioEntity {
  kind: 'curio';
  id: string;
  pos: Vec2;
  /** Chebyshev distance at which CK notices. Defaults to 1. */
  radius?: number;
  bubble: '?' | '!' | '…' | '♥' | '♪';
  line?: string;
  clueId?: string;
  requiresFlag?: string;
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
  /**
   * A loose pebble: pawing it sends it skittering in CK's facing direction
   * until something stops it. If it comes to rest on a trap trigger, the
   * trap goes off — on the pebble, not on CK. Very cat, and very useful.
   */
  kick?: boolean;
}

export type Entity =
  | NpcEntity
  | ItemEntity
  | DoorEntity
  | SwitchEntity
  | BlockEntity
  | TrapEntity
  | ClueNoteEntity
  | DecorationEntity
  | RollerEntity
  | CurioEntity;

/**
 * What lies under a patch of soft ground. Most soft ground hides nothing;
 * some hides junk — which the collar hears too, just duller — and a little
 * of it hides something worth the dig.
 */
export type BuriedItem = { itemId: string; junk?: undefined } | { junk: string; itemId?: undefined; clueId?: string };

/**
 * Non-interactive set dressing: the pottery, rubble, roots and old tools
 * that make a room feel like a real site. Solid dressing blocks movement;
 * low dressing can be hopped over. Pawing it gets a sniff, nothing more —
 * signal needs noise.
 */
export interface Dressing {
  pos: Vec2;
  sprite: string;
  solid: boolean;
  low: boolean;
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
  /** Set dressing, drawn and collided with but never interacted with. */
  dressing: Dressing[];
  /** Outdoors: every plain floor and path tile is soft enough to dig. */
  softGround?: boolean;
  /** Tiles someone dug long ago — empty, weathered holes. */
  oldHoles: Record<string, true>;
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
  /** Decorations CK has already knocked over / used, and curios already noticed. */
  usedDecorations: Record<string, true>;
  /** Kicked pebbles: where each came to rest, or null if it dropped into a pit. */
  movedDecorations: Record<string, Vec2 | null>;
  /** Crumbling tiles that have given way. Settles back when CK leaves or falls. */
  collapsed: Record<string, true>;
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
    movedDecorations: {},
    collapsed: {},
  };
}

export type ToolId = 'detector' | 'paws';

export interface DialogueState {
  npcId: string;
  lines: string[];
  index: number;
}

/** A delayed trap that has clicked and is about to strike. */
export interface PendingStrike {
  trapId: string;
  left: number;
  /** Where CK stood before stepping onto the trigger — knocked back there on a hit. */
  armedFrom: Vec2;
  /** Tile that set it off (a falling rock lands there). */
  at: Vec2;
}

export interface ActiveRoller {
  id: string;
  /** Index into the roller's path of the tile it currently occupies. */
  index: number;
  /** Milliseconds until it moves to the next tile. */
  left: number;
  /** Path index at which it last flattened CK, so one pass hits once. */
  hitIndex?: number;
}

/**
 * Everything happening *in time* in the current room. Cleared on every room
 * change and never saved: timed hazards are moments, not progress.
 */
export interface TimedState {
  strikes: PendingStrike[];
  rollers: ActiveRoller[];
  crumbling: { key: string; left: number }[];
  /** Spike trap id → the cycle number it last hit CK on. */
  spikeHits: Record<string, number>;
}

export function emptyTimed(): TimedState {
  return { strikes: [], rollers: [], crumbling: [], spikeHits: {} };
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
  /** The last ordinary, trap-free tile CK stood on in this room — where a fall or a spike sends CK back to. */
  safe?: Vec2;
  timed?: TimedState;
}

export type GameEvent =
  | { type: 'bump' }
  | { type: 'transition'; toMap: string; firstVisit: boolean; fall?: string }
  | { type: 'secret' }
  | { type: 'heal'; itemId: string }
  | { type: 'knock'; itemId?: string }
  | { type: 'warp'; toMap: string }
  | { type: 'dig-empty' }
  | { type: 'dig-hard' }
  | { type: 'dig-junk'; line: string }
  | { type: 'dig-old' }
  | { type: 'reveal'; itemId: string }
  | { type: 'pickup'; itemId: string }
  | { type: 'assemble'; artifactId: string }
  | { type: 'clue'; clueId: string }
  | { type: 'switch-on'; switchId: string }
  | { type: 'already-done' }
  | { type: 'door-locked'; message: string }
  | { type: 'door-open'; doorId: string }
  | { type: 'push' }
  | { type: 'trap-hit'; trapId: string; trapType: TrapType; from: Vec2; at: Vec2 }
  | { type: 'trap-armed'; trapId: string; trapType: TrapType; at: Vec2 }
  | { type: 'trap-fire'; trapId: string; trapType: TrapType; from: Vec2; lane: Vec2[] }
  | { type: 'trap-miss'; trapId: string; trapType: TrapType }
  | { type: 'crumble-start'; at: Vec2 }
  | { type: 'crumble'; at: Vec2 }
  | { type: 'fall' }
  | { type: 'roller-start'; id: string }
  | { type: 'roller-hit'; id: string }
  | { type: 'roller-stop'; id: string; at: Vec2 }
  | { type: 'jump'; from: Vec2; to: Vec2 }
  | { type: 'jump-blocked' }
  | { type: 'curio'; id: string; bubble: CurioEntity['bubble']; line?: string }
  | { type: 'sniff' }
  | { type: 'kick'; from: Vec2; to: Vec2 | null }
  | { type: 'knockout' }
  | { type: 'talk-start' }
  | { type: 'talk-end' }
  | { type: 'flavor'; line: string }
  | { type: 'exit-locked'; message: string };

export type Action =
  | { type: 'move'; direction: Direction }
  /** Face a direction without stepping — how you sweep the collar around. */
  | { type: 'turn'; direction: Direction }
  /** Hop two tiles in the facing direction, clearing whatever is in between. */
  | { type: 'jump' }
  | { type: 'interact' }
  | { type: 'dig' }
  | { type: 'toggleTool' }
  /** Time passing: `dt` since the last tick, `now` on the game clock (both ms). */
  | { type: 'tick'; dt: number; now: number };
