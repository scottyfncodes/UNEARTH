/**
 * Light for the rooms that have it. Dark rooms already get the Sunstone's
 * glow; lit rooms get the light of the place they are: clouds drifting over
 * the meadow, shafts falling through the temple's broken ceiling, the
 * morning coming in through the windows at home — plus a vignette tinted
 * to the region, so each area has its own air.
 */
import type { GameMap } from '@/game/types';
import { TILE_SIZE } from './constants';

const T = TILE_SIZE;

export function drawRoomLight(ctx: CanvasRenderingContext2D, map: GameMap, time: number): void {
  if (map.dark) return;
  const W = map.width * T;
  const H = map.height * T;
  switch (map.region) {
    case 'meadow': {
      // Cloud shadows sliding slowly across the grass.
      for (let i = 0; i < 3; i++) {
        const span = W + T * 16;
        const x = ((time * (9 + i * 3) + i * span * 0.37) % span) - T * 8;
        const y = H * (0.2 + i * 0.3) + Math.sin(time * 0.1 + i) * T;
        const rx = T * (4.5 + i);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
        g.addColorStop(0, 'rgba(8,30,18,0.2)');
        g.addColorStop(0.6, 'rgba(8,30,18,0.1)');
        g.addColorStop(1, 'rgba(8,30,18,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Warm sun from the top-left.
      ctx.globalCompositeOperation = 'lighter';
      const sun = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H));
      sun.addColorStop(0, 'rgba(255,230,160,0.12)');
      sun.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'temple': {
      // Shafts of daylight through cracks in the ceiling, drifting with the hours.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.2 + i * 0.32) + Math.sin(time * 0.15 + i * 2) * T * 0.6;
        const top = T * 0.5;
        const len = H * 0.75;
        const slant = T * 2.2;
        const g = ctx.createLinearGradient(cx, top, cx + slant, top + len);
        const a = 0.07 + 0.03 * Math.sin(time * 0.6 + i * 1.3);
        g.addColorStop(0, `rgba(255,236,190,${a})`);
        g.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.35, top);
        ctx.lineTo(cx + T * 0.35, top);
        ctx.lineTo(cx + slant + T * 1.1, top + len);
        ctx.lineTo(cx + slant - T * 1.1, top + len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'home': {
      // Morning through two windows in the back wall.
      ctx.globalCompositeOperation = 'lighter';
      for (const fx of [0.28, 0.6]) {
        const cx = W * fx;
        const top = T * 1.1;
        const g = ctx.createLinearGradient(cx, top, cx + T * 1.5, top + T * 5);
        g.addColorStop(0, 'rgba(255,214,150,0.16)');
        g.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.7, top);
        ctx.lineTo(cx + T * 0.7, top);
        ctx.lineTo(cx + T * 2.6, top + T * 5);
        ctx.lineTo(cx + T * 0.4, top + T * 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    default:
      break;
  }
}

const TINT: Record<GameMap['region'], string> = {
  home: '24,12,4',
  meadow: '4,18,8',
  well: '6,12,10',
  temple: '6,8,14',
  crypt: '2,4,10',
  vault: '30,18,4',
};

/** Screen-space vignette, tinted to the region. */
export function drawVignette(ctx: CanvasRenderingContext2D, map: GameMap, w: number, h: number): void {
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  g.addColorStop(0, `rgba(${TINT[map.region]},0)`);
  g.addColorStop(1, `rgba(${TINT[map.region]},${map.dark ? 0.3 : 0.42})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
