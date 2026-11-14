/**
 * The room as a diorama: a floor baked once, a wall piece per wall tile
 * (drawn in depth order so CK can walk behind them), and a block of earth
 * under the whole thing with its strata showing at the cut edges.
 *
 * The floor is not new art. It is the game's own top-down terrain, drawn
 * by the same code the flat renderer uses, and then resampled onto iso
 * diamonds pixel by pixel. Every room's flagstones, soft earth, trigger
 * bricks, holes and scatter come across for free, with the same tells in
 * the same places, which is what keeps the hunt honest in both views.
 *
 * Walls cut themselves away: a wall is only as tall as it can be without
 * hiding a walkable tile behind it. Back walls rise full height; walls
 * between CK and the camera drop to a cut-through stub, like the open side
 * of a dollhouse. That rule is automatic, so it needs no authoring per room.
 */
import type { GameMap, MapRuntimeState, TileType } from '@/game/types';
import { TILE_SIZE } from '@/render/constants';
import { PALETTES } from '@/render/palette';
import { hash } from '@/render/pixel';
import { renderTerrain } from '@/render/tiles';
import { mix, PixelBuffer, rgb, shade, type RGB } from './buffer';
import { HALF_H, HALF_W, project, STEP, STRATA, WALL_MAX } from './project';
import { architecture, heightSteps } from './rooms';

/** Flat dressing that actually stands up: drawn upright, not pressed into the floor. */
export const UPRIGHT_FLAT = new Set(['candles', 'wildflowers', 'tallGrass', 'stake', 'spentDarts', 'web']);

export interface WallPiece {
  x: number;
  y: number;
  /** World position of the piece canvas's top-left. */
  wx: number;
  wy: number;
  canvas: HTMLCanvasElement;
  top: number;
}

export interface IsoTerrain {
  key: string;
  /** Canvas pixel = world pixel + origin. */
  ox: number;
  oy: number;
  floor: HTMLCanvasElement;
  walls: WallPiece[];
  /** Lintels and other spans CK walks under. */
  spans: WallPiece[];
  /** Ground elevation in pixels for every tile (walls: their base). */
  elev: number[][];
  /** Top of each wall, keyed "x,y". */
  wallTop: Map<string, number>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const isWallish = (t: TileType | undefined) => t === 'wall' || t === 'catGap';

function tile(map: GameMap, x: number, y: number): TileType | undefined {
  return map.tiles[y]?.[x];
}

/** Ground elevation (px) of a walkable tile; walls stand on their highest neighbour. */
export function floorElev(map: GameMap, x: number, y: number): number {
  return heightSteps(map, x, y) * STEP;
}

function baseElev(map: GameMap, x: number, y: number): number {
  let best = 0;
  for (const [dx, dy] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const) {
    const t = tile(map, x + dx, y + dy);
    if (t && !isWallish(t)) best = Math.max(best, floorElev(map, x + dx, y + dy));
  }
  return best;
}

const LEVELS = [6, 14, 24, WALL_MAX];

/**
 * How tall a wall can stand without hiding a walkable tile behind it: for
 * every open tile up-screen of it in its own column (or half-overlapping a
 * neighbouring one), the wall's top must stay below that tile's centre.
 */
export function wallHeight(map: GameMap, x: number, y: number): number {
  let allowed = WALL_MAX;
  const base = baseElev(map, x, y);
  for (let b = 0; b < map.height; b++) {
    for (let a = 0; a < map.width; a++) {
      const t = tile(map, a, b)!;
      if (t === 'wall') continue;
      const d = x + y - (a + b);
      if (d <= 0) continue;
      const col = Math.abs(a - b - (x - y));
      if (col > 1) continue;
      const h = floorElev(map, a, b) - base + d * HALF_H - (col === 0 ? HALF_H : HALF_H / 2);
      allowed = Math.min(allowed, h);
    }
  }
  let level = LEVELS[0]!;
  for (const l of LEVELS) if (l <= allowed) level = l;
  return level;
}

// ── strata: the cut face of the diorama's block of earth ─────────────────

const STRATA_BANDS: { to: number; c: RGB }[] = [
  { to: 6, c: rgb('#4c4a46') }, // foundation course
  { to: 17, c: rgb('#5a4130') }, // loam
  { to: 28, c: rgb('#755638') }, // clay
  { to: STRATA, c: rgb('#3b322c') }, // bedrock
];

function strataColor(depth: number, col: number, salt: number): RGB | null {
  const ragged = STRATA - Math.floor(hash(col, salt, 9) * 5);
  if (depth >= ragged) return null;
  const wobble = Math.floor(hash(Math.floor(col / 3), salt, 4) * 3) - 1;
  let c = STRATA_BANDS[STRATA_BANDS.length - 1]!.c;
  for (const band of STRATA_BANDS) {
    if (depth + wobble < band.to) {
      c = band.c;
      break;
    }
  }
  const n = hash(col, depth, salt);
  if (depth < 6) {
    // Dressed stone: block joints.
    if (depth === 0) return shade(c, 1.25);
    if (depth === 5 || (col + (depth < 3 ? 0 : 4)) % 9 === 0) return shade(c, 0.7);
  } else if (n > 0.965) return shade(c, 1.45); // a pebble
  else if (n < 0.03) return shade(c, 0.6);
  // A root threading down through the loam, and the odd bone in the clay.
  if (depth >= 6 && depth < 20 && hash(Math.floor(col / 7), salt, 2) > 0.7 && col % 7 === Math.floor(depth / 4) % 3) return rgb('#2e2016');
  if (depth >= 21 && depth < 25 && hash(Math.floor(col / 11), salt, 6) > 0.82 && col % 11 > 6) return rgb('#d8ccb0');
  if (depth >= ragged - 2) return shade(c, 0.75);
  return shade(c, 0.94 + n * 0.12);
}

// ── stone faces ──────────────────────────────────────────────────────────

function stoneFace(base: RGB, along: number, z: number, salt: number, course = 5): RGB {
  const row = Math.floor(z / course);
  const inRow = z - row * course;
  const joint = (Math.floor(along) + (row % 2) * 4) % 8 === 0;
  if (inRow < 1 || joint) return shade(base, 0.72);
  const n = hash(Math.floor((along + (row % 2) * 4) / 8), row, salt);
  return shade(base, 0.9 + n * 0.18);
}

// ── the bake ─────────────────────────────────────────────────────────────

interface Source {
  data: Uint8ClampedArray;
  w: number;
}

function sourceFor(map: GameMap, ms: MapRuntimeState): Source {
  const canvas = document.createElement('canvas');
  canvas.width = map.width * TILE_SIZE;
  canvas.height = map.height * TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // The flat renderer's own ground, minus anything that stands upright.
  const flat: GameMap = { ...map, dressing: map.dressing.filter((d) => !d.solid && !UPRIGHT_FLAT.has(d.sprite)) };
  renderTerrain(ctx, flat, ms);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width };
}

function sample(src: Source, x: number, y: number, u: number, v: number): RGB {
  const px = x * TILE_SIZE + Math.min(TILE_SIZE - 1, Math.floor(u * 2));
  const py = y * TILE_SIZE + Math.min(TILE_SIZE - 1, Math.floor(v * 2));
  const i = (py * src.w + px) * 4;
  return [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!];
}

/** Visit every pixel of a tile's top diamond: (screen x, screen y, u, v) with u, v in 0..16. */
function eachDiamondPixel(cb: (sx: number, sy: number, u: number, v: number) => void): void {
  for (let sy = 0; sy < 16; sy++) {
    for (let sx = -16; sx < 16; sx++) {
      const u = sy + 0.5 + (sx + 0.5) / 2;
      const v = sy + 0.5 - (sx + 0.5) / 2;
      if (u < 0 || u >= 16 || v < 0 || v >= 16) continue;
      cb(sx, sy, u, v);
    }
  }
}

/**
 * A face of a tile's prism. `side` 'left' is the tile's south face (screen
 * lower-left), 'right' its east face. Calls back with the along-edge
 * coordinate (0..16) and elevation z for every pixel between lo and hi.
 */
function eachFacePixel(side: 'left' | 'right', lo: number, hi: number, cb: (sx: number, sy: number, along: number, z: number) => void): void {
  for (let i = 0; i < 16; i++) {
    const sx = side === 'left' ? -16 + i : i;
    const t = (i + 0.5) / 16;
    // The edge's ground line, relative to the tile's top vertex.
    const edgeY = side === 'left' ? 8 + 8 * t : 16 - 8 * t;
    for (let z = Math.ceil(lo); z < hi; z++) {
      const sy = Math.floor(edgeY - z - 0.5);
      cb(sx, sy, side === 'left' ? i : 16 - i, z);
      // The 2:1 slope means some columns need a second pixel to close gaps.
      if (z === Math.ceil(lo)) cb(sx, sy + 1, side === 'left' ? i : 16 - i, z - 0.5);
    }
  }
}

const pieceCache = new Map<string, { walls: WallPiece[]; spans: WallPiece[] }>();

export function bakeTerrain(map: GameMap, ms: MapRuntimeState, key: string): IsoTerrain {
  const pal = PALETTES[map.region];
  const W = map.width;
  const H = map.height;
  const pad = 8;
  const ox = H * HALF_W + pad;
  const oy = WALL_MAX + 16 + pad;
  const width = (W + H) * HALF_W + pad * 2;
  const height = (W + H) * HALF_H + oy + STRATA + pad;
  const buf = new PixelBuffer(width, height);
  const src = sourceFor(map, ms);

  const elev: number[][] = [];
  for (let y = 0; y < H; y++) {
    elev.push([]);
    for (let x = 0; x < W; x++) elev[y]!.push(isWallish(tile(map, x, y)) ? baseElev(map, x, y) : floorElev(map, x, y));
  }
  const wallTop = new Map<string, number>();
  const arch = architecture(map.id);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isWallish(tile(map, x, y))) wallTop.set(`${x},${y}`, elev[y]![x]! + (arch.pillars[`${x},${y}`] ?? wallHeight(map, x, y)));
    }
  }

  const riser = rgb(pal.floorAccent);
  const order: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) order.push([x, y]);
  order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);

  for (const [x, y] of order) {
    const t = tile(map, x, y)!;
    const top = project(x, y, 0);
    const bx = top.x + ox;
    const by = top.y + oy;
    const salt = x * 31 + y * 17;
    const walled = isWallish(t);
    const h = elev[y]![x]!;

    if (!walled) {
      const north = isWallish(tile(map, x, y - 1));
      const west = isWallish(tile(map, x - 1, y));
      const southLower = (tile(map, x, y + 1) === undefined || (!isWallish(tile(map, x, y + 1)) && elev[y + 1]![x]! < h));
      const eastLower = (tile(map, x + 1, y) === undefined || (!isWallish(tile(map, x + 1, y)) && elev[y]![x + 1]! < h));
      eachDiamondPixel((sx, sy, u, v) => {
        let c = sample(src, x, y, u, v);
        // Contact shadow where the floor meets a wall behind it.
        if (north && v < 3) c = shade(c, 0.66 + v * 0.1);
        if (west && u < 3) c = shade(c, 0.7 + u * 0.09);
        // A lit lip on any edge that steps down.
        if (southLower && v >= 15) c = shade(c, 1.22);
        if (eastLower && u >= 15) c = shade(c, 1.12);
        buf.set(bx + sx, by + sy - h, c);
      });
    }

    // Risers and the earth block's cut faces.
    for (const side of ['left', 'right'] as const) {
      const nx = side === 'left' ? x : x + 1;
      const ny = side === 'left' ? y + 1 : y;
      const n = tile(map, nx, ny);
      const edge = n === undefined;
      const from = walled ? 0 : h;
      const to = edge ? -STRATA - 1 : isWallish(n) ? from : elev[ny]![nx]!;
      if (to >= from) continue;
      eachFacePixel(side, to, from, (sx, sy, along, z) => {
        let c: RGB | null;
        if (z >= 0) {
          c = stoneFace(shade(riser, side === 'left' ? 0.85 : 0.68), along, z, salt, 4);
        } else {
          const col = side === 'left' ? x * 16 + along : 1000 + y * 16 + (16 - along);
          c = strataColor(Math.floor(-z), Math.floor(col), side === 'left' ? 1 : 2);
          if (c && side === 'right') c = shade(c, 0.78);
        }
        if (c) buf.set(bx + sx, by + sy, c);
      });
    }
  }

  // Walls and spans never change while CK is in a room (a dig only changes
  // the floor), so they are baked once per room and reused.
  let pieces = pieceCache.get(map.id);
  if (!pieces) {
    const walls: WallPiece[] = [];
    for (const [x, y] of order) {
      const t = tile(map, x, y)!;
      if (isWallish(t)) walls.push(bakeWall(map, x, y, elev, wallTop, t === 'catGap'));
    }
    const spans = arch.lintels.map((l) => bakeLintel(map, l.x, l.y, elev[l.y]![l.x]! + l.lo, elev[l.y]![l.x]! + l.hi));
    pieces = { walls, spans };
    pieceCache.clear();
    pieceCache.set(map.id, pieces);
  }
  const { walls, spans } = pieces;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y] of [
    [0, H],
    [W, 0],
  ] as const) {
    const p = project(x, y);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  return {
    key,
    ox,
    oy,
    floor: buf.toCanvas(),
    walls,
    spans,
    elev,
    wallTop,
    bounds: { minX, maxX, minY: -WALL_MAX - 8, maxY: (W + H) * HALF_H + STRATA },
  };
}

function bakeWall(map: GameMap, x: number, y: number, elev: number[][], wallTop: Map<string, number>, catGap: boolean): WallPiece {
  const pal = PALETTES[map.region];
  const top = wallTop.get(`${x},${y}`)!;
  const base = elev[y]![x]!;
  const tall = top - base >= 24;
  const stub = top - base <= 8;
  const capC = mix(rgb(pal.wallTop), rgb('#9a9486'), 0.35);
  const faceC = mix(rgb(pal.wall), rgb('#6a6458'), 0.45);
  const w = 34;
  const h = top + 18;
  const buf = new PixelBuffer(w, h);
  // Piece-local: the tile's top vertex at ground level sits at (17, top).
  const ax = 17;
  const ay = top;
  const salt = x * 13 + y * 7;

  for (const side of ['left', 'right'] as const) {
    const nx = side === 'left' ? x : x + 1;
    const ny = side === 'left' ? y + 1 : y;
    const n = tile(map, nx, ny);
    // Down to the neighbour's ground: if the neighbour is a wall it stands in
    // front and paints over whatever of this face it hides.
    const lo = n === undefined ? 0 : elev[ny]![nx]!;
    if (lo >= top) continue;
    const open = n !== undefined && !isWallish(n);
    eachFacePixel(side, lo, top, (sx, sy, along, z) => {
      let c = stoneFace(shade(faceC, side === 'left' ? 1 : 0.74), along, z, salt + (side === 'left' ? 0 : 99));
      // Damp darkening at the foot of the wall.
      if (z - lo < 2) c = shade(c, 0.8);
      // A cat-sized arch through the base: the only way into the alcove.
      if (catGap && open && z - lo < 10) {
        const dx = Math.abs(along - 8);
        if (dx < 4 && z - lo < 10 - (dx > 2.5 ? 2 : 0)) c = rgb('#0b0c0f');
      }
      buf.set(ax + sx, ay + sy, c);
    });
    // Ivy down the taller faces.
    if (tall && open && hash(x, y, side === 'left' ? 3 : 5) > 0.45) {
      const along = 3 + Math.floor(hash(x, y, 11) * 10);
      const len = 8 + Math.floor(hash(x, y, 12) * (top - lo - 10));
      for (let k = 0; k < len; k++) {
        const z = top - 1 - k;
        const i = side === 'left' ? along : 16 - along;
        const sx = side === 'left' ? -16 + i : i;
        const t = (i + 0.5) / 16;
        const edgeY = side === 'left' ? 8 + 8 * t : 16 - 8 * t;
        const sy = Math.floor(edgeY - z - 0.5);
        const wig = Math.round(Math.sin(k * 0.7 + x) * 0.8);
        buf.set(ax + sx + wig, ay + sy, rgb(k % 5 === 0 ? '#7da04c' : '#4d7236'));
        if (k % 4 === 1) buf.set(ax + sx + wig + (k % 8 === 1 ? 1 : -1), ay + sy, rgb('#6c9442'));
      }
    }
  }

  // The cap. Its rim only shows where the wall mass actually ends, so a run
  // of wall reads as one slab, not a grid of blocks.
  const exposed = (dx: number, dy: number) => {
    const n = tile(map, x + dx, y + dy);
    return n === undefined || !isWallish(n) || wallTop.get(`${x + dx},${y + dy}`) !== top;
  };
  const edgeN = exposed(0, -1);
  const edgeW = exposed(-1, 0);
  const edgeS = exposed(0, 1);
  const edgeE = exposed(1, 0);
  eachDiamondPixel((sx, sy, u, v) => {
    let c: RGB;
    const front = (edgeS && v >= 15) || (edgeE && u >= 15);
    const back = (edgeN && v < 1) || (edgeW && u < 1);
    // World-aligned noise, so neighbouring caps continue each other.
    const wu = x * 16 + u;
    const wv = y * 16 + v;
    if (stub) {
      // Cut through: the rubble core of the wall shows, edged in dressed stone.
      c = shade(capC, 0.6 + hash(Math.floor(wu / 2), Math.floor(wv / 2), 3) * 0.16);
      if (front) c = shade(capC, 1.12);
      else if (back) c = shade(capC, 0.9);
    } else {
      c = shade(capC, 0.9 + hash(Math.floor(wu / 4), Math.floor(wv / 4), 1) * 0.14);
      if (front) c = shade(capC, 1.18);
      else if (back) c = shade(capC, 0.78);
      // Moss gathers on the tops of old walls.
      // Big, soft clumps rather than an even camouflage: low-frequency patch, ragged edge.
      const patch = hash(Math.floor(wu / 9), Math.floor(wv / 9), 5);
      if (patch > 0.68 && hash(Math.floor(wu / 2), Math.floor(wv / 2), 6) > 0.35) c = mix(c, rgb(patch > 0.85 ? '#7d9a4a' : '#5f7d3c'), 0.65);
    }
    buf.set(ax + sx, sy, c);
  });

  const p = project(x, y, 0);
  return { x, y, wx: p.x - ax, wy: p.y - ay, canvas: buf.toCanvas(), top };
}

/** A stone beam across an open tile: two faces and a cap, hanging in the air. */
function bakeLintel(map: GameMap, x: number, y: number, lo: number, top: number): WallPiece {
  const pal = PALETTES[map.region];
  const capC = mix(rgb(pal.wallTop), rgb('#9a9486'), 0.35);
  const faceC = mix(rgb(pal.wall), rgb('#6a6458'), 0.45);
  const buf = new PixelBuffer(34, top + 18);
  const ax = 17;
  const ay = top;
  for (const side of ['left', 'right'] as const) {
    eachFacePixel(side, lo, top, (sx, sy, along, z) => {
      let c = stoneFace(shade(faceC, side === 'left' ? 1 : 0.74), along, z, x * 5 + y, 5);
      // The underside edge catches no light.
      if (z - lo < 1) c = shade(c, 0.6);
      buf.set(ax + sx, ay + sy, c);
    });
  }
  eachDiamondPixel((sx, sy, u, v) => {
    const front = v >= 15 || u >= 15;
    buf.set(ax + sx, sy, shade(capC, front ? 1.18 : 0.9 + hash(Math.floor((x * 16 + u) / 4), Math.floor(v / 4), 1) * 0.14));
  });
  // A few strands of ivy hanging off the beam.
  for (let i = 0; i < 3; i++) {
    const along = 3 + Math.floor(hash(x, y, 30 + i) * 11);
    const len = 3 + Math.floor(hash(x, y, 40 + i) * 7);
    const t = (along + 0.5) / 16;
    const edgeY = 8 + 8 * t;
    for (let k = 0; k < len; k++) buf.set(ax - 16 + along, ay + Math.floor(edgeY - lo - 0.5) + k, rgb(k % 3 === 2 ? '#7da04c' : '#4d7236'));
  }
  const p = project(x, y, 0);
  return { x, y, wx: p.x - ax, wy: p.y - ay, canvas: buf.toCanvas(), top };
}
