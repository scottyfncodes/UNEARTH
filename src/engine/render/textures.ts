/**
 * Procedural textures. Generated once at runtime into offscreen canvases so
 * the game ships with no image assets and still looks like dirt.
 */
import { mulberry32 } from '@/core/rng';
import type { GroundPalette } from '@/core/types';

export type Surface = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Surface {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Ground tile for the detecting view.
 *
 * Every mark is drawn with wraparound so the tile is genuinely seamless —
 * without that, a tiled fill shows a hard grid on screen.
 */
export function groundTile(palette: GroundPalette, size = 256, seed = 7): Surface {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(seed);

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, size, size);

  /** Runs `paint` at every wrapped position the element could straddle. */
  const wrapped = (x: number, y: number, radius: number, paint: (px: number, py: number) => void) => {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * size;
        const py = y + oy * size;
        if (px + radius < 0 || px - radius > size || py + radius < 0 || py - radius > size) continue;
        paint(px, py);
      }
    }
  };

  // Broad tonal blotches give the ground large-scale variation.
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 24 + rng() * 70;
    const tone = rng() < 0.5 ? palette.mid : palette.light;
    wrapped(x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, hexA(tone, 0.42));
      g.addColorStop(1, hexA(tone, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Fine grain: thousands of tiny marks read as grass or grit at any zoom.
  const marks = palette.scatter === 'grass' ? 2600 : 2000;
  for (let i = 0; i < marks; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const a = 0.05 + rng() * 0.22;
    const wide = rng() < 0.2;
    const jitter = rng() - 0.5;
    const len = 2 + rng() * 5;
    const spread = rng() - 0.5;
    wrapped(x, y, 8, (px, py) => {
      ctx.strokeStyle = hexA(rng() < 0.4 ? palette.detail : palette.mid, a);
      ctx.lineWidth = wide ? 1.6 : 0.9;
      ctx.beginPath();
      if (palette.scatter === 'grass') {
        ctx.moveTo(px, py);
        ctx.lineTo(px + jitter * 2, py - len);
      } else {
        ctx.moveTo(px, py);
        ctx.lineTo(px + spread * 3, py + jitter * 3);
      }
      ctx.stroke();
    });
  }

  // Darker speckle for depth.
  for (let i = 0; i < 400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 1 + rng() * 2;
    const alpha = 0.04 + rng() * 0.1;
    wrapped(x, y, 4, (px, py) => {
      ctx.fillStyle = hexA('#000000', alpha);
      ctx.fillRect(px, py, w, w);
    });
  }

  return canvas;
}

/** Soil texture used inside the excavation pit. */
export function soilTile(size = 256, seed = 21, tint = '#4a3527'): Surface {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(seed);

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1 + rng() * 7;
    const light = rng();
    ctx.fillStyle =
      light < 0.34
        ? hexA('#000000', 0.16 + rng() * 0.2)
        : light < 0.7
          ? hexA('#7a5a41', 0.14 + rng() * 0.2)
          : hexA('#2a1c14', 0.2 + rng() * 0.22);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few pebbles and root threads so the soil has objects in it, not just noise.
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.strokeStyle = hexA('#3d2a1c', 0.5);
    ctx.lineWidth = 0.8 + rng();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + rng() * 16 - 8, y + rng() * 10, x + rng() * 24 - 12, y + rng() * 18 - 9);
    ctx.stroke();
  }

  return canvas;
}

/** Hard debris (stone / compacted clay) drawn over soil. */
export function stoneTile(size = 192, seed = 55): Surface {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(seed);
  ctx.fillStyle = '#584a41';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 3 + rng() * 13;
    ctx.fillStyle = rng() < 0.5 ? hexA('#7d6d61', 0.55) : hexA('#3a2f29', 0.6);
    ctx.beginPath();
    const pts = 5 + Math.floor(rng() * 3);
    for (let p = 0; p < pts; p++) {
      const a = (p / pts) * Math.PI * 2;
      const rr = r * (0.6 + rng() * 0.6);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

/** #rrggbb + alpha → rgba() string. */
export function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
