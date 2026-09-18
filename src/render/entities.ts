import type { Entity, GameState } from '@/game/types';
import { isDoorOpen } from '@/game/world';
import { getItem } from '@/content/items';
import { TILE_SIZE } from './constants';
import { ACCENT } from './palette';

const ITEM_COLORS: Record<string, string> = {
  fragment: '#c98a3f',
  artifact: ACCENT.gold,
  trinket: '#9ad3d8',
};

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

export function drawEntity(ctx: CanvasRenderingContext2D, entity: Entity, x: number, y: number, state: GameState): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const s = TILE_SIZE;
  const cx = px + s / 2;
  const cy = py + s / 2;

  switch (entity.kind) {
    case 'npc': {
      ctx.fillStyle = '#3f7a9e';
      ctx.fillRect(px + s * 0.22, py + s * 0.12, s * 0.56, s * 0.76);
      ctx.fillStyle = '#e9c9a0';
      ctx.fillRect(px + s * 0.3, py + s * 0.14, s * 0.4, s * 0.3);
      ctx.fillStyle = '#1b1f1c';
      ctx.fillRect(px + s * 0.36, py + s * 0.24, s * 0.07, s * 0.07);
      ctx.fillRect(px + s * 0.56, py + s * 0.24, s * 0.07, s * 0.07);
      break;
    }
    case 'item': {
      const def = getItem(entity.itemId);
      const color = ITEM_COLORS[def?.kind ?? 'trinket'] ?? ACCENT.gold;
      const bob = Math.sin(performance.now() / 260 + x + y) * s * 0.04;
      drawDiamond(ctx, cx, cy + bob, s * 0.24, color);
      ctx.strokeStyle = ACCENT.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.24 + bob);
      ctx.lineTo(cx + s * 0.24, cy + bob);
      ctx.lineTo(cx, cy + s * 0.24 + bob);
      ctx.lineTo(cx - s * 0.24, cy + bob);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'door': {
      const open = isDoorOpen(entity, state);
      if (open) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px + s * 0.1, py + s * 0.1, s * 0.8, s * 0.8);
        break;
      }
      ctx.fillStyle = '#8a6a35';
      ctx.fillRect(px + s * 0.12, py + s * 0.06, s * 0.76, s * 0.9);
      ctx.fillStyle = ACCENT.gold;
      ctx.fillRect(px + s * 0.45, py + s * 0.46, s * 0.12, s * 0.12);
      ctx.strokeStyle = '#4a3618';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + s * 0.12, py + s * 0.06, s * 0.76, s * 0.9);
      break;
    }
    case 'switch': {
      const on = !!state.flags[entity.setsFlag];
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(px + s * 0.3, py + s * 0.2, s * 0.4, s * 0.6);
      ctx.fillStyle = on ? ACCENT.good : ACCENT.danger;
      ctx.fillRect(px + s * 0.42, py + (on ? s * 0.18 : s * 0.5), s * 0.16, s * 0.3);
      break;
    }
    case 'block': {
      ctx.fillStyle = '#8a7a5c';
      ctx.fillRect(px + s * 0.08, py + s * 0.08, s * 0.84, s * 0.84);
      ctx.strokeStyle = '#4a4030';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + s * 0.08, py + s * 0.08, s * 0.84, s * 0.84);
      ctx.beginPath();
      ctx.moveTo(px + s * 0.08, py + s * 0.5);
      ctx.lineTo(px + s * 0.92, py + s * 0.5);
      ctx.moveTo(px + s * 0.5, py + s * 0.08);
      ctx.lineTo(px + s * 0.5, py + s * 0.92);
      ctx.stroke();
      break;
    }
    case 'trap': {
      ctx.fillStyle = '#5a3030';
      ctx.fillRect(px + s * 0.4, py, s * 0.2, s * 0.3);
      ctx.fillStyle = ACCENT.danger;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.5, py + s * 0.3);
      ctx.lineTo(px + s * 0.62, py + s * 0.42);
      ctx.lineTo(px + s * 0.38, py + s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'clueNote': {
      ctx.fillStyle = '#e9e2d0';
      ctx.fillRect(px + s * 0.28, py + s * 0.22, s * 0.44, s * 0.56);
      ctx.strokeStyle = '#8a8062';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + s * 0.28, py + s * 0.22, s * 0.44, s * 0.56);
      ctx.fillStyle = '#8a8062';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + s * 0.34, py + s * (0.32 + i * 0.12), s * 0.32, s * 0.04);
      break;
    }
    case 'decoration': {
      ctx.fillStyle = '#6b6f5c';
      ctx.fillRect(px + s * 0.24, py + s * 0.14, s * 0.52, s * 0.78);
      ctx.fillStyle = '#565a48';
      ctx.fillRect(px + s * 0.24, py + s * 0.14, s * 0.52, s * 0.16);
      break;
    }
  }
}
