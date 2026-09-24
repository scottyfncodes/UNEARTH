/**
 * A tiny pixel-art toolkit. Every sprite in the game is authored at 16×16
 * "art pixels" — either as text rows (characters mapped to colours) or with
 * a handful of primitives — then baked once into an offscreen canvas and
 * scaled up with smoothing off. No image assets, and nothing is redrawn
 * pixel-by-pixel per frame.
 */
export const ART = 16;

export interface Painter {
  px(x: number, y: number, color: string): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  /** A filled pixel circle (distance test), centre in art pixels. */
  disc(cx: number, cy: number, r: number, color: string): void;
  ring(cx: number, cy: number, r: number, color: string): void;
  /** Stamp text rows; '.' is transparent, every other char looks up `palette`. */
  rows(lines: string[], palette: Record<string, string>, ox?: number, oy?: number): void;
  line(x0: number, y0: number, x1: number, y1: number, color: string): void;
}

function makePainter(ctx: CanvasRenderingContext2D, w: number, h: number): Painter {
  const px = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  return {
    px,
    rect(x, y, rw, rh, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
    },
    disc(cx, cy, r, color) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r) px(x, y, color);
        }
      }
    },
    ring(cx, cy, r, color) {
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r && d > r - 1.1) px(x, y, color);
        }
      }
    },
    rows(lines, palette, ox = 0, oy = 0) {
      lines.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const ch = line[x]!;
          if (ch === '.' || ch === ' ') continue;
          const color = palette[ch];
          if (color) px(ox + x, oy + y, color);
        }
      });
    },
    line(x0, y0, x1, y1, color) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= steps; i++) px(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, color);
    },
  };
}

const cache = new Map<string, HTMLCanvasElement>();

/** Bakes (once) and returns an offscreen canvas for `id`, drawn by `paint`. */
export function baked(id: string, paint: (p: Painter) => void, w = ART, h = ART): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paint(makePainter(ctx, w, h));
  cache.set(id, canvas);
  return canvas;
}

/** Draws a baked sprite scaled to `size` screen pixels, optionally mirrored. */
export function blit(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
  mirror = false,
): void {
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.save();
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, size, (size * sprite.height) / sprite.width);
    ctx.restore();
    return;
  }
  ctx.drawImage(sprite, x, y, size, (size * sprite.height) / sprite.width);
}

/** Cheap deterministic per-tile noise so identical tiles don't look stamped. */
export function hash(x: number, y: number, salt = 0): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
