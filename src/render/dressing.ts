/**
 * Set dressing: the clutter that makes a room read as a real site. Pottery,
 * rubble, roots, old tools, bones, moss — plus the few new decorations the
 * hunt needs (a loose pebble, a floor inscription, a couple of carvings).
 * All 16×16, painted with the same primitives as every other sprite and
 * baked once. None of it is meant to shout; most of it is meant to be
 * looked past, which is what lets the things that matter hide among it.
 */
import type { Painter } from './pixel';

const K = '#1a140e';
const STONE = '#8b8778';
const STONE_D = '#5f5c51';
const STONE_L = '#aaa594';
const WOOD = '#8a5a34';
const WOOD_D = '#5c3a20';
const WOOD_L = '#a8744a';
const CLAY = '#b0643a';
const CLAY_D = '#7a4024';
const CLAY_L = '#d08658';
const LEAF = '#3f7a3a';
const LEAF_D = '#2a5a2a';
const LEAF_L = '#6fae5a';
const BONE = '#e8e2d0';
const BONE_D = '#b8b2a0';
const IRON = '#6a6e78';
const IRON_D = '#44474f';
const CANVAS = '#c9b98a';
const CANVAS_D = '#9a8a5c';

export const DRESSING_ART: Record<string, (p: Painter) => void> = {
  // ── outdoors ──────────────────────────────────────────────────────────
  bush: (p) => {
    p.disc(8, 10, 6, LEAF_D);
    p.disc(6, 8, 4, LEAF);
    p.disc(11, 8, 4, LEAF);
    p.disc(8, 6, 3.5, LEAF);
    for (const [x, y] of [[5, 6], [10, 5], [12, 9], [7, 10]] as const) p.px(x, y, LEAF_L);
    p.px(9, 8, '#d94a5a');
  },
  tree: (p) => {
    p.rect(7, 11, 3, 5, WOOD_D);
    p.rect(8, 11, 1, 5, WOOD);
    p.disc(8, 7, 7, LEAF_D);
    p.disc(7, 6, 5.5, LEAF);
    p.disc(10, 5, 3.5, LEAF);
    for (const [x, y] of [[5, 4], [9, 3], [11, 6], [6, 8], [3, 7]] as const) p.px(x, y, LEAF_L);
  },
  standingStone: (p) => {
    p.rect(4, 14, 9, 2, 'rgba(0,0,0,0.25)');
    p.rect(5, 2, 6, 13, STONE_D);
    p.rect(6, 1, 5, 13, STONE);
    p.rect(6, 1, 2, 12, STONE_L);
    p.px(9, 5, STONE_D);
    p.px(8, 9, STONE_D);
    p.rect(6, 12, 2, 2, LEAF);
  },
  stump: (p) => {
    p.rect(3, 9, 10, 6, WOOD_D);
    p.rect(3, 7, 10, 4, WOOD);
    p.ring(8, 9, 3.5, WOOD_L);
    p.ring(8, 9, 1.8, WOOD_L);
    p.rect(1, 14, 3, 1, WOOD_D);
    p.rect(12, 14, 3, 1, WOOD_D);
  },
  rock: (p) => {
    p.disc(8, 11, 5, STONE_D);
    p.disc(7.5, 10, 4.2, STONE);
    p.rect(5, 8, 3, 1, STONE_L);
    p.px(10, 12, STONE_D);
  },
  fence: (p) => {
    p.rect(2, 5, 2, 10, WOOD_D);
    p.rect(12, 7, 2, 8, WOOD_D);
    p.rect(1, 7, 14, 2, WOOD);
    p.rect(1, 11, 9, 2, WOOD);
    p.px(10, 12, WOOD_D);
    p.rect(2, 5, 2, 1, WOOD_L);
  },
  log: (p) => {
    p.rect(1, 8, 14, 6, WOOD_D);
    p.rect(1, 8, 14, 3, WOOD);
    p.disc(14, 11, 2.6, WOOD_L);
    p.ring(14, 11, 1.3, WOOD_D);
    p.rect(5, 7, 2, 2, LEAF);
  },
  wildflowers: (p) => {
    for (const [x, y, c] of [[3, 4, '#f2e14e'], [10, 3, '#f28aa0'], [6, 9, '#ffffff'], [12, 11, '#b08af2'], [2, 12, '#f28aa0']] as const) {
      p.rect(x, y + 1, 1, 2, LEAF);
      p.px(x, y, c);
      p.px(x + 1, y, c);
    }
  },
  tallGrass: (p) => {
    for (const x of [3, 5, 7, 9, 11, 13]) {
      const h = 3 + ((x * 7) % 4);
      p.line(x, 14, x + (x % 3) - 1, 14 - h, x % 2 ? LEAF_L : LEAF);
    }
  },
  molehill: (p) => {
    // Deliberately the old "dig here" mound. It is a mole. It is always a mole.
    p.disc(8, 11, 5, '#5a3e26');
    p.disc(8, 10, 4, '#6b4a2e');
    for (const [x, y] of [[6, 9], [9, 8], [10, 11], [5, 12]] as const) p.px(x, y, '#84603f');
  },
  leaves: (p) => {
    for (const [x, y, c] of [[3, 4, '#c98a3f'], [10, 6, '#b8662a'], [6, 11, '#d9a441'], [12, 12, '#8a5a24']] as const) {
      p.rect(x, y, 2, 1, c);
      p.px(x + 1, y + 1, c);
    }
  },
  hay: (p) => {
    for (let i = 0; i < 9; i++) p.line(3 + i, 12 - (i % 3), 5 + i, 9 + (i % 2), i % 2 ? '#d9c070' : '#b8a050');
  },
  puddle: (p) => {
    p.disc(8, 10, 4.5, 'rgba(60,110,140,0.55)');
    p.rect(5, 9, 3, 1, 'rgba(255,255,255,0.35)');
  },
  moss: (p) => {
    for (const [x, y, r] of [[5, 6, 2.5], [9, 8, 3], [6, 11, 2], [12, 12, 1.8]] as const) p.disc(x, y, r, 'rgba(90,130,60,0.6)');
  },
  pebbles: (p) => {
    for (const [x, y] of [[3, 5], [9, 4], [6, 10], [12, 9], [4, 13], [11, 13]] as const) {
      p.rect(x, y, 2, 1, STONE_L);
      p.px(x, y + 1, STONE_D);
    }
  },

  // ── dig-site kit ──────────────────────────────────────────────────────
  tent: (p) => {
    // Collapsed, one pole still up, grown through with weeds.
    p.rect(1, 9, 14, 6, CANVAS_D);
    p.rect(2, 7, 11, 5, CANVAS);
    p.line(3, 11, 11, 7, CANVAS_D);
    p.rect(12, 2, 1, 10, WOOD_D);
    p.rect(4, 13, 1, 2, LEAF);
    p.rect(9, 12, 1, 3, LEAF_L);
  },
  crate: (p) => {
    p.rect(2, 4, 12, 11, WOOD_D);
    p.rect(3, 5, 10, 9, WOOD);
    p.line(3, 5, 12, 13, WOOD_D);
    p.rect(3, 5, 10, 1, WOOD_L);
    p.rect(5, 8, 5, 2, '#d9c9a0');
  },
  bucket: (p) => {
    p.rect(4, 7, 8, 7, IRON_D);
    p.rect(5, 7, 6, 6, IRON);
    p.ring(8, 6, 4, IRON_D);
    p.rect(4, 7, 8, 1, '#8e929a');
  },
  sieve: (p) => {
    p.rect(1, 6, 14, 8, WOOD_D);
    p.rect(2, 7, 12, 6, '#7a7e70');
    for (let x = 3; x < 14; x += 2) p.rect(x, 7, 1, 6, '#5a5e50');
    for (let y = 8; y < 13; y += 2) p.rect(2, y, 12, 1, '#5a5e50');
  },
  wheelbarrow: (p) => {
    p.rect(2, 6, 10, 5, '#3a6a8a');
    p.rect(3, 6, 8, 2, '#5a8aaa');
    p.disc(4, 12, 2.5, K);
    p.px(4, 12, IRON);
    p.line(11, 9, 15, 13, WOOD_D);
    p.line(10, 10, 14, 14, WOOD_D);
    p.px(8, 7, '#b8662a');
  },
  stake: (p) => {
    p.rect(7, 5, 2, 9, WOOD);
    p.rect(7, 5, 2, 1, '#d94a3a');
    p.line(0, 8, 7, 7, 'rgba(240,240,220,0.7)');
    p.line(9, 7, 15, 9, 'rgba(240,240,220,0.7)');
  },
  pickaxe: (p) => {
    p.line(3, 13, 11, 5, WOOD);
    p.line(7, 3, 14, 8, IRON);
    p.line(8, 3, 14, 7, IRON_D);
  },
  shovel: (p) => {
    p.line(4, 3, 10, 11, WOOD);
    p.rect(9, 10, 4, 4, IRON);
    p.rect(10, 13, 2, 1, IRON_D);
    p.rect(3, 2, 3, 1, WOOD_D);
  },
  tarp: (p) => {
    p.rect(0, 1, 16, 14, '#4f6a58');
    p.rect(1, 2, 14, 12, '#5f7e68');
    p.rect(0, 1, 16, 1, '#6f8e78');
    p.disc(8, 8, 3, 'rgba(0,0,0,0.12)');
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]] as const) p.px(x, y, '#c9b27a');
    p.rect(4, 5, 3, 1, '#4a3a28');
  },
  chalkX: (p) => {
    p.line(5, 5, 11, 11, 'rgba(240,240,230,0.75)');
    p.line(11, 5, 5, 11, 'rgba(240,240,230,0.75)');
  },

  // ── ruins ─────────────────────────────────────────────────────────────
  column: (p) => {
    p.rect(3, 13, 10, 3, STONE_D);
    p.rect(4, 1, 8, 13, STONE);
    for (const x of [5, 7, 9]) p.rect(x, 2, 1, 11, STONE_D);
    p.rect(3, 0, 10, 2, STONE_L);
    p.rect(4, 5, 1, 2, LEAF);
  },
  columnStump: (p) => {
    p.rect(3, 12, 10, 3, STONE_D);
    p.rect(4, 6, 8, 7, STONE);
    for (const x of [5, 7, 9]) p.rect(x, 7, 1, 5, STONE_D);
    p.line(4, 6, 7, 5, STONE_L);
    p.line(7, 5, 11, 7, STONE_L);
  },
  fallenColumn: (p) => {
    p.rect(0, 7, 16, 7, STONE_D);
    p.rect(0, 7, 16, 4, STONE);
    for (const y of [8, 10]) p.rect(0, y, 16, 1, STONE_D);
    p.disc(2, 10, 3, STONE_L);
    p.ring(2, 10, 1.5, STONE_D);
  },
  masonry: (p) => {
    p.rect(1, 6, 9, 8, STONE_D);
    p.rect(2, 6, 7, 5, STONE);
    p.rect(7, 2, 8, 12, STONE_D);
    p.rect(8, 3, 6, 6, STONE_L);
    p.rect(8, 9, 6, 1, STONE_D);
    p.px(4, 8, STONE_D);
  },
  rubble: (p) => {
    for (const [x, y, r] of [[5, 11, 3], [10, 12, 3.2], [8, 8, 2.6], [12, 9, 1.8], [3, 13, 1.6]] as const) {
      p.disc(x, y, r, STONE_D);
      p.disc(x - 0.5, y - 0.5, r - 0.8, STONE);
    }
    p.px(7, 7, STONE_L);
  },
  statueHead: (p) => {
    p.disc(8, 10, 5, STONE_D);
    p.disc(8, 9.5, 4.3, STONE);
    p.rect(4, 4, 2, 3, STONE);
    p.rect(10, 4, 2, 3, STONE);
    p.px(6, 9, K);
    p.px(10, 9, K);
    p.rect(7, 12, 3, 1, STONE_D);
    p.line(11, 6, 12, 12, STONE_L);
  },
  urn: (p) => {
    p.rect(5, 13, 6, 2, CLAY_D);
    p.disc(8, 10, 4, CLAY_D);
    p.disc(8, 9.5, 3.3, CLAY);
    p.rect(6, 4, 4, 3, CLAY);
    p.rect(5, 3, 6, 1, CLAY_D);
    p.rect(6, 9, 4, 1, CLAY_L);
  },
  tallUrn: (p) => {
    p.rect(5, 14, 6, 2, CLAY_D);
    p.disc(8, 9, 5, CLAY_D);
    p.disc(8, 8.5, 4.3, CLAY);
    p.rect(6, 1, 4, 4, CLAY);
    p.rect(5, 0, 6, 1, CLAY_D);
    for (let x = 4; x < 13; x += 2) p.px(x, 9, K);
    p.rect(5, 7, 2, 3, CLAY_L);
  },
  brokenUrn: (p) => {
    p.disc(7, 11, 3.5, CLAY_D);
    p.disc(7, 10.5, 2.8, CLAY);
    p.rect(4, 8, 6, 1, K);
    p.rect(11, 12, 3, 2, CLAY);
    p.rect(12, 9, 2, 2, CLAY_D);
    p.px(3, 13, CLAY_L);
  },
  shards: (p) => {
    for (const [x, y, c] of [[3, 5, CLAY], [9, 4, CLAY_D], [6, 10, CLAY_L], [12, 11, CLAY], [4, 13, CLAY_D]] as const) {
      p.rect(x, y, 2, 1, c);
      p.px(x, y + 1, c);
    }
  },
  roots: (p) => {
    p.line(0, 4, 6, 7, WOOD_D);
    p.line(6, 7, 9, 12, WOOD_D);
    p.line(6, 7, 15, 9, WOOD);
    p.line(9, 12, 13, 15, WOOD);
  },
  skull: (p) => {
    // A small animal skull — the crypt's, not anybody we'd know.
    p.disc(8, 9, 3.6, BONE_D);
    p.disc(8, 8.5, 3, BONE);
    p.px(7, 8, K);
    p.px(9, 8, K);
    p.rect(7, 11, 3, 1, BONE_D);
  },
  boneScatter: (p) => {
    p.line(3, 6, 8, 8, BONE);
    p.px(3, 5, BONE);
    p.px(8, 9, BONE);
    p.line(9, 12, 13, 10, BONE_D);
    p.px(5, 12, BONE);
  },
  web: (p) => {
    const c = 'rgba(230,230,240,0.45)';
    p.line(0, 0, 10, 10, c);
    p.line(0, 5, 10, 10, c);
    p.line(5, 0, 10, 10, c);
    p.line(0, 8, 8, 0, c);
    p.line(0, 3, 3, 0, c);
  },
  candles: (p) => {
    for (const [x, h] of [[4, 5], [8, 7], [11, 4]] as const) {
      p.rect(x, 14 - h, 2, h, '#e8dcc0');
      p.px(x, 13 - h, '#f2c14e');
    }
    p.rect(3, 14, 10, 1, '#d8ccb0');
  },
  floorArrow: (p) => {
    const c = 'rgba(30,24,18,0.45)';
    p.line(8, 3, 8, 12, c);
    p.line(5, 9, 8, 12, c);
    p.line(11, 9, 8, 12, c);
  },
  spentDarts: (p) => {
    for (const [x, y] of [[3, 6], [9, 4], [12, 11]] as const) {
      p.line(x, y, x + 3, y + 1, '#5a5048');
      p.px(x + 3, y + 1, '#c0392b');
    }
  },
  sarcophagus: (p) => {
    p.rect(2, 1, 12, 15, STONE_D);
    p.rect(3, 2, 10, 13, STONE);
    p.disc(8, 5, 2.5, STONE_L);
    p.rect(6, 8, 4, 5, STONE_L);
  },

  // ── decorations the hunt relies on ────────────────────────────────────
  pebble: (p) => {
    p.disc(8, 11, 2.2, STONE_D);
    p.disc(7.6, 10.6, 1.6, STONE_L);
  },
  glyph: (p) => {
    const c = 'rgba(20,16,12,0.5)';
    for (const [x, y] of [[3, 5], [7, 5], [11, 5], [4, 10], [9, 10]] as const) {
      p.rect(x, y, 2, 1, c);
      p.px(x, y + 1, c);
      p.px(x + 1, y + 2, c);
    }
  },
  leapMural: (p) => {
    p.rect(0, 2, 16, 12, STONE_D);
    p.rect(1, 3, 14, 10, '#9a9480');
    // A row of bricks along the bottom, tall figures, darts, and one small leaper.
    for (let x = 2; x < 14; x += 3) p.rect(x, 11, 2, 1, STONE_D);
    for (const x of [3, 6]) {
      p.rect(x, 6, 1, 5, '#6a3a2a');
      p.px(x, 5, '#6a3a2a');
    }
    p.line(1, 7, 4, 7, '#c0392b');
    p.disc(11, 6, 1.4, '#2a2a3a');
    p.px(10, 4, '#2a2a3a');
    p.px(12, 4, '#2a2a3a');
    p.line(8, 9, 10, 7, '#2a2a3a');
    p.line(12, 7, 14, 10, '#2a2a3a');
  },
  boulderMural: (p) => {
    p.rect(0, 2, 16, 12, STONE_D);
    p.rect(1, 3, 14, 10, '#9a9480');
    p.disc(5, 8, 3.5, '#5f5c51');
    p.ring(5, 8, 3.5, K);
    for (const x of [10, 13]) {
      p.rect(x, 6, 1, 4, '#6a3a2a');
      p.px(x, 5, '#6a3a2a');
      p.line(x, 9, x + 1, 11, '#6a3a2a');
    }
    p.line(9, 4, 9, 6, '#6a3a2a');
  },
  moonCarving: (p) => {
    p.rect(1, 1, 14, 14, STONE_D);
    p.rect(2, 2, 12, 12, '#6a7080');
    p.disc(8, 8, 5, '#b5c6e6');
    p.disc(10, 7, 4.2, '#6a7080');
    p.disc(6, 8, 1.2, '#1a1f2a');
    p.px(6, 8, '#b5c6e6');
    p.line(6, 10, 6, 13, 'rgba(181,198,230,0.6)');
  },
};

/** Flat, walkable dressing is baked straight into the terrain; everything else is drawn with the entities. */
export function isFlatDressing(solid: boolean): boolean {
  return !solid;
}
