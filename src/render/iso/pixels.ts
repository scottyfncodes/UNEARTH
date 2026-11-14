/**
 * Small pixel-honest drawing helpers for the iso view: shapes plotted one
 * art pixel at a time (canvas arcs would anti-alias into mush once scaled),
 * plus the handful of tiny sprites only this view needs.
 */
import { baked } from '@/render/pixel';
import { eachPixel, measure } from '@/render/pixelFont';

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1): void {
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** An outlined or filled ellipse with a 2:1 ground-plane feel. */
export function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, filled: boolean): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  if (filled) {
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2, 1);
    }
    return;
  }
  const steps = Math.max(16, Math.round(rx * 4));
  let last = '';
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    const k = `${x},${y}`;
    if (k === last) continue;
    last = k;
    ctx.fillRect(x, y, 1, 1);
  }
}

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 400; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Pixel text from the game's own 5×7 font. */
export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, shadow?: string): void {
  const { lines } = measure(s.toUpperCase());
  const width = Math.max(...lines.map((l) => measure(l).width));
  const ink = (c: string, ox: number, oy: number) => {
    ctx.fillStyle = c;
    eachPixel(s.toUpperCase(), width, 3, (gx, gy) => ctx.fillRect(Math.round(x + gx + ox), Math.round(y + gy + oy), 1, 1));
  };
  if (shadow) ink(shadow, 0, 1);
  ink(color, 0, 0);
}

export function textWidth(s: string): number {
  return measure(s.toUpperCase()).width;
}

// ── tiny sprites ────────────────────────────────────────────────────────

function rows(id: string, lines: string[], pal: Record<string, string>): HTMLCanvasElement {
  return baked(id, (p) => p.rows(lines, pal), lines[0]!.length, lines.length);
}

const LEAF = { g: '#6f9c47', G: '#4c7634', d: '#3a2a1c', l: '#93bb5c' };

/** A fern at the foot of a wall, in two sway frames. */
export function fern(frame: number): HTMLCanvasElement {
  return frame === 0
    ? rows('iso:fern0', ['....l....', '.l..g..g.', '..g.G.g..', 'g..gGg..g', '.g.gGg.g.', '..gGGGg..', '...GGG...'], LEAF)
    : rows('iso:fern1', ['.....l...', '..l..g..g', '..g.G.g..', '.g.gGg.g.', '.g.gGg.g.', '..gGGGg..', '...GGG...'], LEAF);
}

export function tuft(frame: number): HTMLCanvasElement {
  return frame === 0 ? rows('iso:tuft0', ['.l.g.', 'g.gGg', '.gGG.', '..G..'], LEAF) : rows('iso:tuft1', ['..l.g', '.g.Gg', '.gGG.', '..G..'], LEAF);
}

/** The gold "this does something" marker. */
export function marker(fresh: boolean): HTMLCanvasElement {
  return fresh
    ? rows('iso:marker1', ['kkkkkkk', 'kyYYYyk', '.kyYyk.', '..kyk..', '...k...'], { k: '#2a1a0c', y: '#d9a441', Y: '#ffe08a' })
    : rows('iso:marker0', ['.....', '.kkk.', '..k..'], { k: 'rgba(250,245,230,0.7)' });
}

/** An exit chevron pointing up-right; mirrored and flipped for the others. */
export function chevron(): HTMLCanvasElement {
  return rows('iso:chevron', ['..ccc', '...cc', '..c.c', '.c...'], { c: 'rgba(255,240,200,0.75)' });
}

/** The thought bubble and its glyphs. */
const BUBBLE_GLYPHS: Record<string, string[]> = {
  '?': ['.kk.', 'k..k', '..k.', '....', '..k.'],
  '!': ['.k.', '.k.', '.k.', '...', '.k.'],
  '…': ['.....', '.....', '.....', '.....', 'k.k.k'],
  '♥': ['.k.k.', 'kkkkk', 'kkkkk', '.kkk.', '..k..'],
  '♪': ['..kk', '..k.', '..k.', 'kkk.', 'kk..'],
};

export function bubble(char: string): HTMLCanvasElement {
  const glyph = BUBBLE_GLYPHS[char] ?? BUBBLE_GLYPHS['?']!;
  const color = char === '!' ? '#c0392b' : char === '♥' ? '#e05a6a' : '#2a1a10';
  return baked(`iso:bubble:${char}`, (p) => {
    p.rect(1, 0, 9, 1, '#2a1a10');
    p.rect(0, 1, 1, 7, '#2a1a10');
    p.rect(10, 1, 1, 7, '#2a1a10');
    p.rect(1, 8, 9, 1, '#2a1a10');
    p.rect(1, 1, 9, 7, '#fbf6e8');
    p.px(3, 9, '#2a1a10');
    p.px(2, 10, '#2a1a10');
    p.px(3, 8, '#fbf6e8');
    const w = glyph[0]!.length;
    p.rows(glyph, { k: color }, Math.floor((11 - w) / 2), 2);
  }, 11, 11);
}

/** The little drop shadow under anything that stands on the floor. */
export function shadow(w: number): HTMLCanvasElement {
  return baked(`iso:shadow:${w}`, (p) => {
    const rx = w / 2;
    const ry = Math.max(1.5, w / 4);
    for (let y = 0; y < Math.ceil(ry * 2); y++) {
      const dy = y + 0.5 - ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)));
      const x0 = Math.round(rx - half);
      p.rect(x0, y, Math.round(rx + half) - x0, 1, 'rgba(10,6,4,0.34)');
    }
  }, w, Math.ceil(Math.max(1.5, w / 4) * 2));
}

/** A checkerboard, for the x-ray dither when CK is behind something. */
export function checker(w: number, h: number): HTMLCanvasElement {
  return baked(`iso:checker:${w}x${h}`, (p) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 2 === 0) p.px(x, y, '#000');
  }, w, h);
}
