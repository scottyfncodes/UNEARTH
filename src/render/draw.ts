import type { GameMap, GameState } from '@/game/types';
import { computeDetectorReading } from '@/game/detector';
import { visibleEntities } from '@/game/world';
import { TILE_SIZE } from './constants';
import { PALETTES } from './palette';
import { drawTile } from './tiles';
import { drawEntity } from './entities';
import { drawCK } from './ck';

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  state: GameState,
  walkToggle: boolean,
  playerPixel?: { x: number; y: number },
): void {
  const palette = PALETTES[map.region];
  const w = map.width * TILE_SIZE;
  const h = map.height * TILE_SIZE;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      drawTile(ctx, map.tiles[y]![x]!, x, y, palette);
    }
  }

  const playerPos = playerPixel ?? state.player.pos;
  const entities = visibleEntities(map, state).sort((a, b) => a.pos.y - b.pos.y);
  const playerY = state.player.pos.y;
  let playerDrawn = false;

  const drawPlayer = () => drawCK(ctx, playerPos.x * TILE_SIZE, playerPos.y * TILE_SIZE, TILE_SIZE, state.player.facing, walkToggle);

  for (const { entity, pos } of entities) {
    if (!playerDrawn && pos.y > playerY) {
      drawPlayer();
      playerDrawn = true;
    }
    drawEntity(ctx, entity, pos.x, pos.y, state);
  }
  if (!playerDrawn) drawPlayer();

  if (state.tool === 'detector' && state.detectorOn) {
    const reading = computeDetectorReading(map, state);
    if (reading.kind) {
      const cx = playerPos.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = playerPos.y * TILE_SIZE + TILE_SIZE / 2;
      const pulse = (Math.sin(performance.now() / 180) + 1) / 2;
      const radius = TILE_SIZE * (0.7 + pulse * 0.25 * reading.strength);
      ctx.strokeStyle = reading.kind === 'mechanism' ? 'rgba(192,57,43,0.55)' : 'rgba(217,164,65,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
