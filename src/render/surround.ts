/**
 * What lies past the edge of a room. A phone is taller than most rooms, and
 * a flat black band above and below the play area reads as "unfinished".
 * Instead the region carries on: forest canopy around the meadow, bedrock
 * around the temple and the crypt, the dark of the house around home —
 * dimmed, so the room stays the brightest thing on screen.
 */
import type { GameMap, Region } from '@/game/types';
import { TILE_SIZE } from './constants';
import { baked, blit, hash } from './pixel';
import { PALETTES } from './palette';

const T = TILE_SIZE;

function surroundTile(region: Region, variant: number): HTMLCanvasElement {
  const pal = PALETTES[region];
  return baked(`surround:${region}:${variant}`, (p) => {
    switch (region) {
      case 'meadow': {
        // Dense canopy: overlapping crowns, darker underneath.
        p.rect(0, 0, 16, 16, '#1d3a1a');
        const crowns: [number, number, number][] = [
          [4, 4, 4],
          [12, 3, 4],
          [8, 10, 5],
          [1, 13, 3],
          [15, 12, 4],
        ];
        crowns.forEach(([cx, cy, r], i) => {
          const dx = variant & (1 << i) ? 1 : -1;
          p.disc(cx + dx, cy, r, i % 2 ? '#2a4f24' : '#244620');
          p.disc(cx + dx - 1, cy - 1, r - 2, i % 2 ? '#35602c' : '#2f5828');
          p.px(cx + dx - 1, cy - 2, '#46743a');
        });
        break;
      }
      case 'home': {
        // The house's dark beyond the walls: rough plaster and old timber.
        p.rect(0, 0, 16, 16, '#22170f');
        p.rect(0, 7, 16, 1, '#1a110b');
        p.rect(variant % 2 ? 4 : 11, 0, 1, 7, '#1a110b');
        p.rect(variant % 3 ? 9 : 2, 8, 1, 8, '#1a110b');
        break;
      }
      default: {
        // Bedrock: big, rough, uncut stone in the region's wall colour.
        p.rect(0, 0, 16, 16, pal.wall);
        const shade = 'rgba(0,0,0,0.28)';
        const light = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 4; i++) {
          const x = Math.floor(hash(variant, i, 3) * 12);
          const y = Math.floor(hash(variant, i, 7) * 12);
          const w = 4 + Math.floor(hash(variant, i, 11) * 6);
          p.rect(x, y, w, 1, shade);
          p.rect(x, y + 1, w - 1, 1, light);
        }
        if (region === 'well' && variant % 3 === 0) p.rect(3, 11, 4, 2, '#3e5a2a');
        break;
      }
    }
  });
}

/**
 * Fills every visible tile outside `map` with the region's surround, then
 * darkens it and lays a soft shadow along the room's edge so the room reads
 * as set into the world rather than pasted on top of it.
 */
export function drawSurround(ctx: CanvasRenderingContext2D, map: GameMap, camera: { x: number; y: number }, width: number, height: number): void {
  const x0 = Math.floor(camera.x / T) - 1;
  const y0 = Math.floor(camera.y / T) - 1;
  const x1 = Math.ceil((camera.x + width) / T) + 1;
  const y1 = Math.ceil((camera.y + height) / T) + 1;
  let any = false;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && y >= 0 && x < map.width && y < map.height) continue;
      any = true;
      const v = Math.floor(hash(x, y, 13) * 8);
      blit(ctx, surroundTile(map.region, v), x * T, y * T, T);
    }
  }
  if (!any) return;

  const W = map.width * T;
  const H = map.height * T;
  // Dim the surround so the room stays the focus.
  ctx.fillStyle = map.region === 'meadow' ? 'rgba(4,12,6,0.45)' : 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.rect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
  ctx.rect(0, 0, W, H);
  ctx.fill('evenodd');

  // A shadow cast outward from the room's edge.
  const edge = T * 0.9;
  const strips: [number, number, number, number, number, number, number, number][] = [
    [0, -edge, W, edge, 0, 0, 0, -edge],
    [0, H, W, edge, 0, H, 0, H + edge],
    [-edge, 0, edge, H, 0, 0, -edge, 0],
    [W, 0, edge, H, W, 0, W + edge, 0],
  ];
  for (const [rx, ry, rw, rh, gx0, gy0, gx1, gy1] of strips) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}
