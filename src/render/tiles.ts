/**
 * Terrain. Each region has its own floor and wall treatment, walls are
 * auto-tiled (a lit top face over a front face wherever open floor sits
 * below, which is what gives a flat grid its sense of depth), and the whole
 * static layer is baked once per room and only rebuilt when something in it
 * actually changes — a patch dug up, say.
 */
import type { GameMap, MapRuntimeState, Region, TileType } from '@/game/types';
import { key } from '@/game/types';
import { TILE_SIZE } from './constants';
import { hash } from './pixel';
import { PALETTES, type RegionPalette } from './palette';

const A = TILE_SIZE / 16; // screen pixels per art pixel

function rect(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(px + x * A, py + y * A, w * A, h * A);
}

function isWallish(t: TileType | undefined): boolean {
  return t === 'wall' || t === 'catGap';
}

function tileAt(map: GameMap, x: number, y: number): TileType | undefined {
  return map.tiles[y]?.[x];
}

// ── floors ────────────────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D, region: Region, pal: RegionPalette, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const n = hash(x, y);
  rect(ctx, px, py, 0, 0, 16, 16, pal.floor);
  switch (region) {
    case 'home': {
      // Floorboards: horizontal planks with staggered seams.
      for (let row = 0; row < 4; row++) {
        rect(ctx, px, py, 0, row * 4 + 3, 16, 1, pal.floorAccent);
        const seam = Math.floor(hash(x, y * 4 + row) * 14) + 1;
        rect(ctx, px, py, seam, row * 4, 1, 3, pal.floorAccent);
      }
      break;
    }
    case 'meadow': {
      for (let i = 0; i < 6; i++) {
        const gx = Math.floor(hash(x, y, i) * 15);
        const gy = Math.floor(hash(x, y, i + 9) * 14) + 1;
        rect(ctx, px, py, gx, gy, 1, 2, pal.floorAccent);
      }
      if (n > 0.86) {
        const fx = 3 + Math.floor(hash(x, y, 3) * 10);
        const fy = 3 + Math.floor(hash(x, y, 4) * 10);
        rect(ctx, px, py, fx, fy, 1, 1, n > 0.93 ? '#f2e14e' : '#ffffff');
      }
      break;
    }
    case 'well':
    case 'temple':
    case 'crypt':
    case 'vault': {
      // Flagstones: a 2×2 grid of slabs with mortar and the odd crack.
      rect(ctx, px, py, 0, 0, 16, 1, pal.floorAccent);
      rect(ctx, px, py, 0, 0, 1, 16, pal.floorAccent);
      rect(ctx, px, py, 0, 8, 16, 1, pal.floorAccent);
      rect(ctx, px, py, 8, (x + y) % 2 === 0 ? 0 : 8, 1, 8, pal.floorAccent);
      if (n > 0.8) {
        const cx = 3 + Math.floor(hash(x, y, 2) * 8);
        rect(ctx, px, py, cx, 4, 1, 2, pal.floorAccent);
        rect(ctx, px, py, cx + 1, 6, 1, 2, pal.floorAccent);
      }
      if (region === 'well' && n < 0.3) rect(ctx, px, py, 2 + Math.floor(n * 20), 10, 3, 2, '#5f7a3f'); // moss
      if (region === 'vault' && (x + y) % 2 === 0) {
        rect(ctx, px, py, 3, 3, 2, 2, pal.floorAccent);
        rect(ctx, px, py, 11, 11, 2, 2, pal.floorAccent);
      }
      break;
    }
  }
}

function drawPath(ctx: CanvasRenderingContext2D, region: Region, pal: RegionPalette, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  if (region !== 'meadow') {
    // Indoors a "path" is where feet have worn the flagstones smooth.
    drawFloor(ctx, region, pal, x, y);
    rect(ctx, px, py, 2, 0, 12, 16, 'rgba(255,255,255,0.06)');
    return;
  }
  rect(ctx, px, py, 0, 0, 16, 16, '#b89a64');
  for (let i = 0; i < 5; i++) {
    rect(ctx, px, py, Math.floor(hash(x, y, i) * 15), Math.floor(hash(x, y, i + 5) * 15), 1, 1, '#a0844f');
    rect(ctx, px, py, Math.floor(hash(x, y, i + 20) * 15), Math.floor(hash(x, y, i + 30) * 15), 1, 1, '#cdb07a');
  }
}

// ── walls ─────────────────────────────────────────────────────────────────

function drawWall(ctx: CanvasRenderingContext2D, map: GameMap, region: Region, pal: RegionPalette, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const below = tileAt(map, x, y + 1);
  const front = below !== undefined && !isWallish(below);

  if (region === 'meadow') {
    // Hedges: round leafy tops, a darker base where they meet the grass.
    rect(ctx, px, py, 0, 0, 16, 16, pal.wall);
    for (const [cx, cy] of [
      [4, 4],
      [11, 4],
      [7, 9],
      [13, 11],
      [3, 12],
    ] as const) {
      ctx.fillStyle = pal.wallTop;
      ctx.beginPath();
      ctx.arc(px + cx * A, py + cy * A, 4 * A, 0, Math.PI * 2);
      ctx.fill();
      rect(ctx, px, py, cx - 1, cy - 2, 2, 1, '#5f9a45');
    }
    if (front) rect(ctx, px, py, 0, 13, 16, 3, '#1f3a1c');
    return;
  }

  if (!front) {
    // The top of a wall: a flat cap with a soft rim.
    rect(ctx, px, py, 0, 0, 16, 16, pal.wallTop);
    rect(ctx, px, py, 0, 0, 16, 1, pal.wall);
    if (hash(x, y) > 0.7) rect(ctx, px, py, 5, 6, 3, 1, pal.wall);
    return;
  }

  // A front face: a cap on top, then courses of brick (or wallpaper at home).
  rect(ctx, px, py, 0, 0, 16, 16, pal.wall);
  rect(ctx, px, py, 0, 0, 16, 5, pal.wallTop);
  rect(ctx, px, py, 0, 5, 16, 1, 'rgba(0,0,0,0.35)');
  if (region === 'home') {
    rect(ctx, px, py, 0, 6, 16, 8, '#c9a878');
    for (let i = 0; i < 16; i += 4) rect(ctx, px, py, i + 1, 6, 1, 8, '#b8956a');
    rect(ctx, px, py, 0, 14, 16, 2, '#5c3a20');
    return;
  }
  const mortar = 'rgba(0,0,0,0.3)';
  for (let row = 0; row < 3; row++) {
    const ry = 6 + row * 3 + (row === 2 ? 1 : 0);
    rect(ctx, px, py, 0, ry + 2, 16, 1, mortar);
    const off = row % 2 === 0 ? 0 : 4;
    for (let bx = off; bx < 16; bx += 8) rect(ctx, px, py, bx, ry, 1, 2, mortar);
  }
  rect(ctx, px, py, 0, 15, 16, 1, 'rgba(0,0,0,0.45)');
  if (region === 'vault') rect(ctx, px, py, 6, 8, 4, 1, '#d0a860');
  if (region === 'well' && hash(x, y) > 0.5) rect(ctx, px, py, 2, 12, 4, 2, '#5f7a3f');
}

function drawCatGap(ctx: CanvasRenderingContext2D, map: GameMap, region: Region, pal: RegionPalette, x: number, y: number): void {
  drawWall(ctx, map, region, pal, x, y);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  // A jagged crack just wide enough for a kitten.
  const c = pal.catGap;
  rect(ctx, px, py, 6, 0, 4, 16, c);
  rect(ctx, px, py, 5, 3, 1, 4, c);
  rect(ctx, px, py, 10, 8, 1, 5, c);
  rect(ctx, px, py, 7, 0, 1, 16, 'rgba(0,0,0,0.5)');
}

// ── everything else ───────────────────────────────────────────────────────

function drawDiggable(ctx: CanvasRenderingContext2D, region: Region, pal: RegionPalette, x: number, y: number, dug: boolean): void {
  drawFloor(ctx, region, pal, x, y);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  if (dug) {
    // A filled-in hole: turned earth and a little spoil heap.
    rect(ctx, px, py, 3, 5, 10, 7, pal.diggable);
    rect(ctx, px, py, 4, 6, 8, 5, 'rgba(0,0,0,0.3)');
    rect(ctx, px, py, 11, 10, 4, 3, pal.diggableSpeck);
    return;
  }
  // Soft, tilled dirt — soft enough that paws would sink in.
  rect(ctx, px, py, 2, 3, 12, 10, pal.diggable);
  rect(ctx, px, py, 1, 5, 14, 6, pal.diggable);
  for (const [dx, dy] of [
    [4, 5],
    [9, 4],
    [6, 8],
    [11, 9],
    [3, 10],
  ] as const) {
    rect(ctx, px, py, dx, dy, 2, 1, pal.diggableSpeck);
  }
  rect(ctx, px, py, 2, 12, 12, 1, 'rgba(0,0,0,0.25)');
}

function drawPlate(ctx: CanvasRenderingContext2D, region: Region, pal: RegionPalette, x: number, y: number): void {
  drawFloor(ctx, region, pal, x, y);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  rect(ctx, px, py, 3, 3, 10, 10, 'rgba(0,0,0,0.35)');
  rect(ctx, px, py, 3, 3, 10, 9, pal.plate);
  rect(ctx, px, py, 4, 4, 8, 1, 'rgba(255,255,255,0.2)');
  rect(ctx, px, py, 6, 6, 4, 4, 'rgba(0,0,0,0.18)');
}

function drawHazard(ctx: CanvasRenderingContext2D, region: Region, pal: RegionPalette, x: number, y: number): void {
  drawFloor(ctx, region, pal, x, y);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  rect(ctx, px, py, 1, 1, 14, 14, '#050505');
  rect(ctx, px, py, 1, 1, 14, 2, pal.floorAccent);
  rect(ctx, px, py, 3, 5, 10, 8, '#000000');
}

function drawWater(ctx: CanvasRenderingContext2D, pal: RegionPalette, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  rect(ctx, px, py, 0, 0, 16, 16, pal.water);
  rect(ctx, px, py, 0, 0, 16, 2, 'rgba(0,0,0,0.25)');
}

function drawExit(ctx: CanvasRenderingContext2D, map: GameMap, region: Region, pal: RegionPalette, x: number, y: number): void {
  const onEdge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  if (!onEdge) {
    // An exit in the middle of a room is a way down: the well's stone mouth.
    drawFloor(ctx, region, pal, x, y);
    ctx.fillStyle = '#6a6e62';
    ctx.beginPath();
    ctx.arc(px + 8 * A, py + 8 * A, 7.5 * A, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050605';
    ctx.beginPath();
    ctx.arc(px + 8 * A, py + 8.5 * A, 5 * A, 0, Math.PI * 2);
    ctx.fill();
    rect(ctx, px, py, 3, 3, 10, 1, '#8a8e80');
    return;
  }
  if (region === 'meadow') drawPath(ctx, region, pal, x, y);
  else drawFloor(ctx, region, pal, x, y);
  // A darkened threshold, fading toward the edge of the screen.
  const grad =
    y === 0
      ? ctx.createLinearGradient(0, py + TILE_SIZE, 0, py)
      : y === map.height - 1
        ? ctx.createLinearGradient(0, py, 0, py + TILE_SIZE)
        : x === 0
          ? ctx.createLinearGradient(px + TILE_SIZE, 0, px, 0)
          : ctx.createLinearGradient(px, 0, px + TILE_SIZE, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
}

/** Renders the whole static terrain layer for one room. */
export function renderTerrain(ctx: CanvasRenderingContext2D, map: GameMap, mapState: MapRuntimeState): void {
  const pal = PALETTES[map.region];
  const region = map.region;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y]![x]!;
      switch (tile) {
        case 'floor':
          drawFloor(ctx, region, pal, x, y);
          break;
        case 'path':
          drawPath(ctx, region, pal, x, y);
          break;
        case 'wall':
          drawWall(ctx, map, region, pal, x, y);
          break;
        case 'catGap':
          drawCatGap(ctx, map, region, pal, x, y);
          break;
        case 'diggable':
          drawDiggable(ctx, region, pal, x, y, !!mapState.dug[key({ x, y })]);
          break;
        case 'plate':
          drawPlate(ctx, region, pal, x, y);
          break;
        case 'hazard':
          drawHazard(ctx, region, pal, x, y);
          break;
        case 'water':
          drawWater(ctx, pal, x, y);
          break;
        case 'exit':
          drawExit(ctx, map, region, pal, x, y);
          break;
      }
    }
  }
}

/** Per-frame touches on top of the baked layer: water shimmer, exit chevrons. */
export function drawAnimatedTiles(ctx: CanvasRenderingContext2D, map: GameMap, time: number): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y]![x]!;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (tile === 'water') {
        const phase = time * 1.6 + x * 0.9 + y * 1.3;
        const off = Math.floor((Math.sin(phase) * 0.5 + 0.5) * 8);
        rect(ctx, px, py, 2 + off, 5, 4, 1, 'rgba(255,255,255,0.22)');
        rect(ctx, px, py, 8 - off / 2, 11, 3, 1, 'rgba(255,255,255,0.14)');
      } else if (tile === 'exit') {
        const onEdge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
        if (!onEdge) continue;
        // A small bobbing chevron pointing out of the room.
        const bob = Math.sin(time * 4) * 1.2;
        ctx.fillStyle = 'rgba(255,240,200,0.55)';
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;
        const d = 4 * A;
        ctx.beginPath();
        if (y === 0) {
          ctx.moveTo(cx - d, cy + bob * A);
          ctx.lineTo(cx, cy - d + bob * A);
          ctx.lineTo(cx + d, cy + bob * A);
        } else if (y === map.height - 1) {
          ctx.moveTo(cx - d, cy - bob * A);
          ctx.lineTo(cx, cy + d - bob * A);
          ctx.lineTo(cx + d, cy - bob * A);
        } else if (x === 0) {
          ctx.moveTo(cx + bob * A, cy - d);
          ctx.lineTo(cx - d + bob * A, cy);
          ctx.lineTo(cx + bob * A, cy + d);
        } else {
          ctx.moveTo(cx - bob * A, cy - d);
          ctx.lineTo(cx + d - bob * A, cy);
          ctx.lineTo(cx - bob * A, cy + d);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
