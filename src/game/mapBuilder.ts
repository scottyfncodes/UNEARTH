/**
 * Turns an ASCII legend + row strings into a GameMap. Authoring maps as text
 * keeps a whole screen's layout readable in one glance and diffable in review
 * — exactly what a dense, secret-filled 8-bit screen needs.
 */
import type { BuriedItem, Entity, ExitDef, GameMap, TileType, Vec2 } from './types';

const LEGEND: Record<string, TileType> = {
  '#': 'wall',
  '~': 'water',
  D: 'diggable',
  g: 'catGap',
  P: 'plate',
  '^': 'hazard',
  '>': 'exit',
  ':': 'path',
};

export interface MapSpec {
  id: string;
  name: string;
  region: GameMap['region'];
  rows: string[];
  entities: Entity[];
  buried?: Record<string, BuriedItem>;
  exits?: ExitDef[];
  defaultSpawn: Vec2;
  dark?: boolean;
  chapter?: GameMap['chapter'];
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
    ...(spec.dark ? { dark: true } : {}),
    ...(spec.chapter ? { chapter: spec.chapter } : {}),
  };
}
