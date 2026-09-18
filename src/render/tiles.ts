import type { TileType } from '@/game/types';
import { TILE_SIZE } from './constants';
import type { RegionPalette } from './palette';

/** Cheap deterministic "noise" so identical tiles don't look perfectly flat. */
function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: TileType,
  x: number,
  y: number,
  palette: RegionPalette,
): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const s = TILE_SIZE;

  switch (tile) {
    case 'floor': {
      ctx.fillStyle = palette.floor;
      ctx.fillRect(px, py, s, s);
      if (hash(x, y) > 0.72) {
        ctx.fillStyle = palette.floorAccent;
        ctx.fillRect(px + s * 0.62, py + s * 0.62, s * 0.16, s * 0.16);
      }
      if (hash(x + 91, y + 7) > 0.85) {
        ctx.fillStyle = palette.floorAccent;
        ctx.fillRect(px + s * 0.18, py + s * 0.22, s * 0.12, s * 0.12);
      }
      break;
    }
    case 'wall': {
      ctx.fillStyle = palette.wall;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = palette.wallTop;
      ctx.fillRect(px, py, s, s * 0.28);
      ctx.fillStyle = palette.wall;
      ctx.fillRect(px + s * 0.08, py + s * 0.4, s * 0.84, s * 0.06);
      break;
    }
    case 'water': {
      ctx.fillStyle = palette.water;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      const bob = Math.sin((x + y) * 1.7) * 0.5 + 0.5;
      ctx.fillRect(px + s * 0.2, py + s * (0.3 + bob * 0.2), s * 0.6, s * 0.08);
      break;
    }
    case 'diggable': {
      ctx.fillStyle = palette.diggable;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = palette.diggableSpeck;
      for (const [dx, dy] of [
        [0.2, 0.25],
        [0.55, 0.4],
        [0.35, 0.65],
        [0.72, 0.7],
      ]) {
        ctx.fillRect(px + s * dx, py + s * dy, s * 0.1, s * 0.1);
      }
      break;
    }
    case 'catGap': {
      ctx.fillStyle = palette.wall;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = palette.catGap;
      ctx.fillRect(px + s * 0.32, py, s * 0.36, s);
      break;
    }
    case 'plate': {
      ctx.fillStyle = palette.floor;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = palette.plate;
      ctx.fillRect(px + s * 0.16, py + s * 0.16, s * 0.68, s * 0.68);
      ctx.strokeStyle = palette.wall;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + s * 0.16, py + s * 0.16, s * 0.68, s * 0.68);
      break;
    }
    case 'hazard': {
      ctx.fillStyle = palette.hazard;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + s * 0.1, py + s * 0.1, s * 0.8, s * 0.8);
      break;
    }
    case 'exit': {
      ctx.fillStyle = palette.floor;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = palette.exit;
      ctx.fillRect(px + s * 0.1, py, s * 0.8, s * 0.4);
      break;
    }
  }
}
