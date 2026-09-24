/**
 * Turns an ASCII legend + rows into a GameMap. Authoring maps as text
 * keeps a whole screen's layout readable in one glance and diffable in review
 * — exactly what a dense, secret-filled 8-bit screen needs.
 *
 * A map has two layers of text: `rows` is terrain, and the optional `props`
 * is set dressing laid over it — the pottery, rubble, roots and old tools
 * that turn a room into a site. Dressing is never interactive; it is the
 * noise that makes the signal worth hunting for.
 */
import type { BuriedItem, Dressing, Entity, ExitDef, GameMap, TileType, Vec2 } from './types';

const LEGEND: Record<string, TileType> = {
  '#': 'wall',
  '~': 'water',
  D: 'diggable',
  ',': 'diggable',
  g: 'catGap',
  P: 'plate',
  '^': 'hazard',
  '>': 'exit',
  ':': 'path',
  '=': 'trigger',
  '%': 'crumble',
  x: 'spikes',
};

type PropSpec = { sprite: string; solid?: boolean; low?: boolean };

/**
 * Set-dressing legend. Solid props block CK; `low` ones can be hopped over.
 * Anything else is flat on the ground and walkable.
 */
export const PROP_LEGEND: Record<string, PropSpec> = {
  // Tall and solid — nothing gets over these.
  b: { sprite: 'bush', solid: true },
  T: { sprite: 'tree', solid: true },
  s: { sprite: 'standingStone', solid: true },
  i: { sprite: 'column', solid: true },
  O: { sprite: 'masonry', solid: true },
  S: { sprite: 'sarcophagus', solid: true },
  n: { sprite: 'tent', solid: true },
  c: { sprite: 'crate', solid: true },
  K: { sprite: 'wheelbarrow', solid: true },
  V: { sprite: 'tallUrn', solid: true },
  // Low and solid — a hop clears them.
  t: { sprite: 'stump', solid: true, low: true },
  r: { sprite: 'rock', solid: true, low: true },
  f: { sprite: 'fence', solid: true, low: true },
  l: { sprite: 'log', solid: true, low: true },
  u: { sprite: 'urn', solid: true, low: true },
  o: { sprite: 'rubble', solid: true, low: true },
  I: { sprite: 'columnStump', solid: true, low: true },
  j: { sprite: 'fallenColumn', solid: true, low: true },
  a: { sprite: 'statueHead', solid: true, low: true },
  k: { sprite: 'bucket', solid: true, low: true },
  B: { sprite: 'sieve', solid: true, low: true },
  // Flat on the ground — walk right over.
  '*': { sprite: 'wildflowers' },
  h: { sprite: 'tallGrass' },
  m: { sprite: 'molehill' },
  p: { sprite: 'shards' },
  U: { sprite: 'brokenUrn' },
  v: { sprite: 'roots' },
  q: { sprite: 'skull' },
  e: { sprite: 'boneScatter' },
  z: { sprite: 'web' },
  y: { sprite: 'pickaxe' },
  Y: { sprite: 'shovel' },
  w: { sprite: 'puddle' },
  C: { sprite: 'candles' },
  M: { sprite: 'moss' },
  A: { sprite: 'floorArrow' },
  X: { sprite: 'chalkX' },
  '+': { sprite: 'stake' },
  d: { sprite: 'spentDarts' },
  L: { sprite: 'leaves' },
  G: { sprite: 'glyph' },
  Q: { sprite: 'tarp' },
  H: { sprite: 'hay' },
  N: { sprite: 'pebbles' },
};

export interface MapSpec {
  id: string;
  name: string;
  region: GameMap['region'];
  rows: string[];
  /** Optional dressing layer, same size as `rows`; '.' or ' ' is nothing. */
  props?: string[];
  entities: Entity[];
  buried?: Record<string, BuriedItem>;
  exits?: ExitDef[];
  defaultSpawn: Vec2;
  dark?: boolean;
  chapter?: GameMap['chapter'];
  softGround?: boolean;
  /** Tiles dug long ago, keyed "x,y". */
  oldHoles?: string[];
}

export function buildMap(spec: MapSpec): GameMap {
  const height = spec.rows.length;
  const width = spec.rows[0]?.length ?? 0;
  spec.rows.forEach((row, i) => {
    if (row.length !== width) {
      throw new Error(`Map "${spec.id}" row ${i} has length ${row.length}, expected ${width}`);
    }
  });
  // `s` marks a secret nook: ordinary floor that chimes the first time CK finds it.
  const secrets: Record<string, true> = {};
  const tiles: TileType[][] = spec.rows.map((row, rowIndex) => {
    return row.split('').map((ch, colIndex) => {
      if (ch === '.') return 'floor';
      if (ch === 's') {
        secrets[`${colIndex},${rowIndex}`] = true;
        return 'floor';
      }
      const tile = LEGEND[ch];
      if (!tile) throw new Error(`Unknown map tile '${ch}' in "${spec.id}" at (${colIndex},${rowIndex})`);
      return tile;
    });
  });

  const dressing: Dressing[] = [];
  if (spec.props) {
    if (spec.props.length !== height) throw new Error(`Map "${spec.id}" props has ${spec.props.length} rows, expected ${height}`);
    spec.props.forEach((row, y) => {
      if (row.length !== width) throw new Error(`Map "${spec.id}" props row ${y} has length ${row.length}, expected ${width}`);
      for (let x = 0; x < width; x++) {
        const ch = row[x]!;
        if (ch === '.' || ch === ' ') continue;
        const prop = PROP_LEGEND[ch];
        if (!prop) throw new Error(`Unknown prop '${ch}' in "${spec.id}" at (${x},${y})`);
        const under = tiles[y]![x]!;
        if (prop.solid && (under === 'wall' || under === 'exit' || under === 'catGap')) {
          throw new Error(`Solid prop '${ch}' sits on ${under} in "${spec.id}" at (${x},${y})`);
        }
        dressing.push({ pos: { x, y }, sprite: prop.sprite, solid: !!prop.solid, low: !!prop.low });
      }
    });
  }

  const oldHoles: Record<string, true> = {};
  for (const k of spec.oldHoles ?? []) oldHoles[k] = true;

  return {
    id: spec.id,
    name: spec.name,
    region: spec.region,
    width,
    height,
    tiles,
    entities: spec.entities,
    buried: spec.buried ?? {},
    exits: spec.exits ?? [],
    defaultSpawn: spec.defaultSpawn,
    secrets,
    dressing,
    oldHoles,
    ...(spec.softGround ? { softGround: true } : {}),
    ...(spec.dark ? { dark: true } : {}),
    ...(spec.chapter ? { chapter: spec.chapter } : {}),
  };
}
