/**
 * Every item and every prop in the world, drawn at 16×16 art pixels with
 * the painter primitives and baked once. Items are also drawn on the
 * find-card and in the satchel from these exact sprites.
 */
import { baked, type Painter } from './pixel';
import { DRESSING_ART } from './dressing';

const K = '#1a140e';
const GOLD = '#f2c14e';
const GOLD_D = '#b8862a';
const BRONZE = '#c98a3f';
const BRONZE_D = '#8a5a24';
const MOON = '#dfe6f0';
const MOON_D = '#9aa8bf';
const SILVER = '#d8dde3';
const SILVER_D = '#8e98a4';
const STONE = '#8b8778';
const STONE_D = '#5f5c51';
const STONE_L = '#aaa594';
const WOOD = '#8a5a34';
const WOOD_D = '#5c3a20';
const WOOD_L = '#a8744a';

// ── items ─────────────────────────────────────────────────────────────────

const ITEM_ART: Record<string, (p: Painter) => void> = {
  keyHandle: (p) => {
    p.ring(6, 6, 4, K);
    p.ring(6, 6, 3, BRONZE);
    p.rect(9, 5, 4, 3, K);
    p.rect(9, 6, 3, 1, BRONZE);
    p.px(5, 4, '#f5c27a');
  },
  keyBlade: (p) => {
    p.rect(3, 7, 9, 3, K);
    p.rect(3, 8, 8, 1, BRONZE);
    p.rect(9, 9, 2, 3, K);
    p.rect(9, 10, 1, 1, BRONZE);
    p.rect(6, 9, 2, 2, K);
    p.px(6, 10, BRONZE);
  },
  key: (p) => {
    p.ring(5, 7, 4, K);
    p.ring(5, 7, 3, BRONZE);
    p.rect(8, 6, 7, 3, K);
    p.rect(8, 7, 6, 1, BRONZE);
    p.rect(12, 8, 2, 3, K);
    p.px(12, 9, BRONZE);
    p.px(4, 5, '#ffe1a0');
  },
  moonCrescent: (p) => {
    // Inside the moon, outside the bite.
    shape(p, (x, y) => {
      const d = Math.hypot(x - 8, y - 8);
      if (d > 6 || Math.hypot(x - 11, y - 6.5) < 5) return null;
      return d > 5 ? MOON_D : MOON;
    });
  },
  moonFace: (p) => {
    p.disc(8, 8, 5, MOON_D);
    p.disc(8, 8, 4, MOON);
    p.ring(8, 8, 2, MOON_D);
    p.px(7, 7, MOON_D);
    p.px(9, 7, MOON_D);
  },
  moonRim: (p) => {
    // The lower curve of the moon's edge.
    shape(p, (x, y) => {
      const d = Math.hypot(x - 8, y - 6);
      if (y < 7 || d > 7 || d < 4.6) return null;
      return d > 6 ? MOON_D : MOON;
    });
  },
  moonSeal: (p) => {
    p.disc(8, 8, 7, '#6f7fa0');
    p.disc(8, 8, 6, MOON);
    p.ring(8, 8, 4, MOON_D);
    p.ring(8, 8, 2, '#b5c6e6');
    p.px(6, 5, '#ffffff');
    p.px(5, 6, '#ffffff');
  },
  sunstone: (p) => {
    p.disc(8, 9, 6, '#b0521c');
    p.disc(8, 9, 5, '#f08a24');
    p.disc(8, 9, 3, '#ffc24a');
    p.disc(7, 8, 1.5, '#fff1b0');
    p.rect(7, 1, 2, 2, '#ffd36a');
    p.px(3, 3, '#ffd36a');
    p.px(12, 3, '#ffd36a');
  },
  bell: (p) => {
    p.rect(4, 3, 8, 2, '#b0303a');
    p.disc(8, 9, 5, GOLD_D);
    p.disc(8, 9, 4, GOLD);
    p.rect(3, 11, 10, 2, GOLD_D);
    p.rect(7, 12, 2, 2, K);
    p.px(6, 7, '#fff4c0');
  },
  fish: (p) => {
    p.disc(7, 8, 4, '#5a8fb8');
    p.disc(7, 8, 3, '#8fc3e6');
    p.rect(11, 6, 1, 5, '#5a8fb8');
    p.rect(12, 5, 2, 7, '#8fc3e6');
    p.px(5, 7, K);
    p.px(8, 9, '#c9e6f7');
  },
  button: (p) => {
    p.disc(8, 8, 5, '#a8334a');
    p.disc(8, 8, 4, '#e0506a');
    p.px(7, 7, K);
    p.px(9, 7, K);
    p.px(7, 9, K);
    p.px(9, 9, K);
    p.px(6, 5, '#ffb0c0');
  },
  thimble: (p) => {
    p.rect(5, 5, 6, 8, SILVER_D);
    p.rect(6, 4, 4, 1, SILVER_D);
    p.rect(6, 5, 4, 7, SILVER);
    for (let y = 6; y < 12; y += 2) for (let x = 6; x < 10; x += 2) p.px(x, y, SILVER_D);
  },
  bottlecap: (p) => {
    p.disc(8, 8, 5, '#8a1c1c');
    p.disc(8, 8, 4, '#d23a2a');
    p.disc(8, 8, 2, '#f2d0c0');
    for (let a = 0; a < 12; a++) p.px(8 + Math.round(Math.cos((a / 12) * Math.PI * 2) * 5.5), 8 + Math.round(Math.sin((a / 12) * Math.PI * 2) * 5.5), '#8a1c1c');
  },
  marble: (p) => {
    p.disc(8, 8, 5, '#1f4f9a');
    p.disc(8, 8, 4, '#3a86d8');
    p.rect(6, 7, 5, 2, '#a8e0ff');
    p.px(6, 5, '#ffffff');
  },
  jingle: (p) => {
    p.disc(8, 8, 5, GOLD_D);
    p.disc(8, 8, 4, GOLD);
    p.rect(4, 8, 8, 1, GOLD_D);
    p.px(8, 10, K);
    p.rect(7, 2, 2, 2, GOLD_D);
    p.px(6, 6, '#fff4c0');
  },
  spoon: (p) => {
    p.disc(5, 5, 3, SILVER_D);
    p.disc(5, 5, 2, SILVER);
    p.line(7, 7, 13, 13, SILVER_D);
    p.line(7, 8, 12, 13, SILVER);
  },
  ring: (p) => {
    p.ring(8, 9, 5, '#8a4a1c');
    p.ring(8, 9, 4, '#d88a4a');
    p.disc(8, 4, 2, '#7fd6c8');
  },
  coin: (p) => {
    p.disc(8, 8, 5, BRONZE_D);
    p.disc(8, 8, 4, BRONZE);
    eared(p, 8, 8, BRONZE_D);
  },
  tooth: (p) => {
    p.rect(5, 4, 6, 5, GOLD_D);
    p.rect(6, 4, 4, 5, GOLD);
    p.rect(5, 9, 2, 4, GOLD_D);
    p.rect(9, 9, 2, 4, GOLD_D);
    p.px(6, 5, '#fff4c0');
  },
  earring: (p) => {
    p.ring(8, 4, 2, GOLD);
    p.disc(8, 10, 3, '#d8d2c8');
    p.disc(8, 10, 2, '#f7f3ea');
    p.px(7, 9, '#ffffff');
  },
  watch: (p) => {
    p.rect(7, 1, 2, 2, GOLD_D);
    p.disc(8, 9, 6, GOLD_D);
    p.disc(8, 9, 5, '#f5ecd2');
    p.line(8, 9, 8, 6, K);
    p.line(8, 9, 10, 10, K);
  },
  compass: (p) => {
    p.disc(8, 8, 5.5, BRONZE_D);
    p.disc(8, 8, 4.5, '#f4eedc');
    p.rect(7, 1, 2, 2, BRONZE);
    p.line(8, 8, 11, 5, '#c0392b');
    p.line(8, 8, 5, 11, K);
    p.px(8, 8, K);
    p.px(6, 5, '#ffffff');
  },
  lens: (p) => {
    p.ring(7, 7, 4.5, GOLD_D);
    p.disc(7, 7, 3.6, '#bfe3f0');
    p.px(5, 5, '#ffffff');
    p.px(6, 5, '#ffffff');
    p.line(10, 10, 14, 14, WOOD_D);
    p.line(11, 10, 14, 13, WOOD);
  },
  scarab: (p) => {
    p.disc(8, 9, 4.5, GOLD_D);
    p.disc(8, 8.5, 3.8, GOLD);
    p.rect(8, 5, 1, 8, GOLD_D);
    p.disc(8, 4, 2, GOLD_D);
    for (const y of [7, 9, 11]) {
      p.px(3, y, GOLD_D);
      p.px(12, y, GOLD_D);
    }
    p.px(6, 7, '#fff4c0');
  },
  star: (p) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 6.5 : 2.8;
      pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]);
    }
    for (let i = 0; i < 10; i++) p.line(pts[i]![0], pts[i]![1], pts[(i + 1) % 10]![0], pts[(i + 1) % 10]![1], SILVER_D);
    p.disc(8, 8.5, 2.8, SILVER);
    p.px(7, 7, '#ffffff');
  },
  glassEye: (p) => {
    p.disc(8, 8, 6, '#c8c4bc');
    p.disc(8, 8, 5, '#f7f5f0');
    p.disc(9, 8, 3, '#3a9a6a');
    p.disc(9, 8, 1.5, K);
    p.px(7, 6, '#ffffff');
  },
};

/** Paints every art pixel whose centre `fn` gives a colour for. */
function shape(p: Painter, fn: (x: number, y: number) => string | null): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = fn(x + 0.5, y + 0.5);
      if (c) p.px(x, y, c);
    }
  }
}

/** The keepers' mark: a circle with two pointed ears. */
function eared(p: Painter, cx: number, cy: number, color: string): void {
  p.ring(cx, cy + 1, 2.5, color);
  p.px(cx - 2, cy - 2, color);
  p.px(cx + 1, cy - 2, color);
}

export function itemSprite(sprite: string): HTMLCanvasElement {
  return baked(`item:${sprite}`, (p) => {
    const art = ITEM_ART[sprite];
    if (art) art(p);
    else {
      p.disc(8, 8, 4, GOLD_D);
      p.disc(8, 8, 3, GOLD);
    }
  });
}

// ── props ─────────────────────────────────────────────────────────────────

const PROP_ART: Record<string, (p: Painter, alt: boolean) => void> = {
  bookshelf: (p, knocked) => {
    p.rect(1, 1, 14, 15, WOOD_D);
    p.rect(2, 2, 12, 13, WOOD);
    for (const y of [2, 7, 12]) p.rect(2, y + 3, 12, 1, WOOD_D);
    const books = ['#b04a3a', '#3a6ab0', '#d9a441', '#4a8a4a', '#8a4a8a', '#c9b27a'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        if (knocked && row === 0 && i === 2) continue;
        p.rect(3 + i * 2, 2 + row * 5, 1, 3, books[(i + row * 2) % books.length]!);
      }
    }
  },
  desk: (p) => {
    p.rect(1, 6, 14, 3, WOOD_D);
    p.rect(1, 6, 14, 2, WOOD_L);
    p.rect(2, 9, 2, 6, WOOD_D);
    p.rect(12, 9, 2, 6, WOOD_D);
    p.rect(3, 3, 5, 3, '#e9e2d0');
    p.rect(4, 4, 3, 1, '#8a8062');
    p.rect(10, 2, 1, 4, '#3a3a3a');
    p.disc(10, 2, 1, '#3a3a3a');
  },
  table: (p) => {
    p.rect(0, 5, 16, 4, WOOD_D);
    p.rect(0, 5, 16, 3, WOOD_L);
    p.rect(1, 9, 2, 6, WOOD_D);
    p.rect(13, 9, 2, 6, WOOD_D);
    p.rect(9, 2, 3, 3, '#f4f1ea');
    p.rect(12, 3, 1, 1, '#f4f1ea');
    p.px(10, 1, '#cfcfcf');
  },
  vase: (p, knocked) => {
    if (knocked) {
      p.rect(0, 9, 16, 4, WOOD_D);
      p.rect(0, 9, 16, 3, WOOD_L);
      p.disc(8, 7, 3, '#2f6fa0');
      p.rect(3, 6, 6, 3, '#3f86c0');
      p.rect(11, 6, 2, 3, '#3f86c0');
      return;
    }
    p.rect(0, 9, 16, 4, WOOD_D);
    p.rect(0, 9, 16, 3, WOOD_L);
    p.disc(8, 5, 3.6, '#2f6fa0');
    p.disc(8, 5, 2.6, '#3f86c0');
    p.rect(7, 0, 3, 2, '#2f6fa0');
    p.px(6, 4, '#a8d6f5');
  },
  rug: (p) => {
    p.rect(0, 2, 16, 12, '#8a2c2c');
    p.rect(1, 3, 14, 10, '#b04040');
    p.rect(3, 5, 10, 6, '#d9a441');
    p.rect(4, 6, 8, 4, '#b04040');
    for (let x = 0; x < 16; x += 2) {
      p.px(x, 1, '#d9c9a0');
      p.px(x, 14, '#d9c9a0');
    }
  },
  bowl: (p) => {
    p.rect(3, 9, 10, 4, '#2f6fa0');
    p.rect(2, 8, 12, 2, '#3f86c0');
    p.rect(4, 8, 8, 1, '#1d3d5a');
    p.rect(5, 12, 6, 1, '#1d3d5a');
  },
  catBed: (p) => {
    p.disc(8, 10, 6.5, '#6a3a5a');
    p.disc(8, 10, 5, '#9a5a8a');
    p.disc(8, 10.5, 3.5, '#e8c8d8');
  },
  plant: (p) => {
    p.rect(5, 11, 6, 5, '#a0522d');
    p.rect(4, 10, 8, 2, '#c0703d');
    for (const [x, y] of [[8, 2], [5, 4], [11, 4], [7, 6], [10, 7], [4, 8], [12, 8]] as const) {
      p.disc(x, y, 2, '#3f7a3a');
      p.px(x, y - 1, '#6fae5a');
    }
    p.px(11, 4, '#e8964a'); // bite mark, orange-ish
  },
  stone: (p) => {
    p.disc(8, 10, 5.5, STONE_D);
    p.disc(8, 9.5, 4.8, STONE);
    p.rect(5, 7, 4, 1, STONE_L);
    eared(p, 9, 9, STONE_D);
  },
  sign: (p) => {
    p.rect(7, 6, 2, 10, WOOD_D);
    p.rect(1, 2, 14, 6, WOOD_D);
    p.rect(2, 3, 12, 4, WOOD_L);
    p.rect(3, 4, 5, 1, WOOD_D);
    p.rect(3, 5, 8, 1, WOOD_D);
    p.px(14, 4, WOOD_L);
  },
  flowers: (p) => {
    for (const [x, y, c] of [[3, 5, '#f2e14e'], [11, 3, '#f28aa0'], [7, 10, '#ffffff'], [12, 12, '#b08af2'], [4, 12, '#f28aa0']] as const) {
      p.rect(x, y + 1, 1, 2, '#3f7a3a');
      p.disc(x + 0.5, y, 1.4, c);
    }
  },
  statue: (p) => {
    p.rect(3, 12, 10, 4, STONE_D);
    p.rect(4, 12, 8, 3, STONE);
    p.rect(5, 4, 6, 8, STONE_D);
    p.rect(6, 4, 4, 8, STONE);
    p.disc(8, 3, 2.5, STONE);
    p.rect(5, 6, 1, 4, STONE_L);
    p.px(7, 3, STONE_D);
    p.px(9, 3, STONE_D);
  },
  catStatue: (p) => {
    p.rect(3, 13, 10, 3, STONE_D);
    p.rect(4, 13, 8, 2, STONE);
    p.disc(8, 10, 4, STONE_D);
    p.disc(8, 10, 3.2, STONE);
    p.disc(8, 5, 3, STONE);
    p.rect(5, 1, 2, 3, STONE);
    p.rect(9, 1, 2, 3, STONE);
    p.px(7, 5, STONE_D);
    p.px(9, 5, STONE_D);
    p.rect(12, 7, 1, 6, STONE_D);
    p.px(5, 4, STONE_L);
  },
  scorch: (p) => {
    p.disc(8, 8, 5, 'rgba(20,14,10,0.55)');
    p.disc(8, 8, 3, 'rgba(20,14,10,0.6)');
    for (const [x, y] of [[4, 5], [11, 6], [6, 11], [12, 11]] as const) {
      p.rect(x, y, 3, 1, '#6a5a4a');
      p.px(x + 3, y, '#c0392b');
    }
  },
  pedestal: (p) => {
    p.rect(2, 12, 12, 4, STONE_D);
    p.rect(3, 11, 10, 3, STONE);
    p.rect(4, 3, 8, 9, STONE_D);
    p.rect(5, 3, 6, 9, STONE);
    p.rect(3, 1, 10, 3, STONE_D);
    p.rect(4, 1, 8, 2, STONE_L);
    p.rect(6, 6, 4, 1, STONE_D);
    p.rect(6, 8, 4, 1, STONE_D);
  },
  mural: (p) => {
    p.rect(0, 1, 16, 14, '#6a5a44');
    p.rect(1, 2, 14, 12, '#c9a878');
    // tall figures bowing to a small eared one
    for (const x of [2, 5]) {
      p.rect(x, 5, 2, 7, '#7a3a2a');
      p.disc(x + 1, 5, 1.2, '#7a3a2a');
    }
    p.rect(10, 9, 3, 3, '#2a2a3a');
    p.disc(11.5, 8, 1.6, '#2a2a3a');
    p.px(10, 6, '#2a2a3a');
    p.px(12, 6, '#2a2a3a');
    p.rect(13, 6, 1, 4, '#2a2a3a');
  },
  brazier: (p, lit) => {
    p.rect(5, 10, 6, 6, '#3a3a3a');
    p.rect(3, 7, 10, 3, '#5a5a5a');
    p.rect(4, 8, 8, 1, '#2a2a2a');
    if (lit) {
      p.disc(8, 5, 3, '#f08a24');
      p.disc(8, 5, 1.8, '#ffd36a');
    }
  },
  bones: (p) => {
    p.line(3, 8, 12, 8, '#e8e2d0');
    for (let x = 5; x <= 11; x += 2) {
      p.line(x, 6, x, 10, '#d8d2c0');
    }
    p.disc(13, 8, 1.6, '#e8e2d0');
    p.px(13, 8, K);
  },
  carving: (p) => {
    p.rect(1, 2, 14, 13, STONE_D);
    p.rect(2, 3, 12, 11, '#6a7080');
    eared(p, 8, 7, '#b5c6e6');
    for (let x = 3; x < 13; x += 3) p.rect(x, 12, 2, 1, '#b5c6e6');
  },
  hat: (p) => {
    p.rect(2, 10, 12, 3, '#8a6a3a');
    p.rect(4, 5, 8, 6, '#b08850');
    p.rect(4, 9, 8, 1, '#5a3a20');
    for (const [x, y] of [[5, 6], [9, 7], [11, 11], [3, 11]] as const) p.px(x, y, '#d8d2c0');
  },
  lantern: (p) => {
    p.rect(7, 1, 2, 2, '#3a3a3a');
    p.rect(5, 3, 6, 10, '#3a3a3a');
    p.rect(6, 4, 4, 8, '#5a5a4a');
    p.rect(4, 13, 8, 2, '#3a3a3a');
    p.px(7, 8, '#2a2a2a');
  },
  catMural: (p) => {
    p.rect(0, 0, 16, 16, '#6a4a24');
    p.rect(1, 1, 14, 14, '#e0bf80');
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]] as const) {
      p.disc(x, y + 1, 2, '#7a3a2a');
      p.px(x - 1, y - 1, '#7a3a2a');
      p.px(x + 1, y - 1, '#7a3a2a');
    }
    eared(p, 8, 8, GOLD_D);
  },
  hollow: (p) => {
    p.disc(8, 9, 7, '#8a6a3a');
    p.disc(8, 9, 6, '#6a4a24');
    p.disc(8, 9.5, 5, '#4a3218');
    p.rect(4, 3, 2, 3, '#6a4a24');
    p.rect(10, 3, 2, 3, '#6a4a24');
    p.px(6, 7, '#d0a860');
  },
};

export function propSprite(spriteId: string, alt = false): HTMLCanvasElement {
  return baked(`prop:${spriteId}:${alt ? 1 : 0}`, (p) => {
    const art = PROP_ART[spriteId];
    const dressing = DRESSING_ART[spriteId];
    if (art) art(p, alt);
    else if (dressing) dressing(p);
    else {
      p.rect(4, 3, 8, 12, STONE_D);
      p.rect(5, 3, 6, 11, STONE);
    }
  });
}

export const KNOCKABLE = new Set(['vase', 'bookshelf']);
