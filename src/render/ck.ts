/**
 * CK — a small orange tabby with a teal collar and a brass tag — plus the
 * cast CK meets along the way. Authored as 16×16 text rows so each frame is
 * readable and diffable here, then baked once.
 */
import type { Direction } from '@/game/types';
import { baked, blit } from './pixel';

const CK: Record<string, string> = {
  k: '#2a1a10',
  o: '#e8964a',
  O: '#b8662a',
  w: '#fbf0dc',
  p: '#ef8f95',
  e: '#1b1f1c',
  W: '#ffffff',
  c: '#2fa39a',
  y: '#f2c14e',
};

const DOWN = [
  '................',
  '..kk........kk..',
  '..kok......kok..',
  '..kpokkkkkkopk..',
  '.koooOoOOoOoook.',
  '.kooooooooooook.',
  '.koWeooooooWeok.',
  '.koeeooooooeeok.',
  '.kwwoooppooowwk.',
  '..kwwwwkkwwwwk..',
  '...kkcccycckk...',
  '...kooooooook...',
  '..kooOwwwwOook..',
  '..koowwwwwwook..',
  '..kowwkkkkwwok..',
  '...kkk....kkk...',
];
const DOWN_STEP = [...DOWN.slice(0, 14), '..kowwk..kwwok..', '..kkk......kkk..'];
const DOWN_BLINK = [...DOWN.slice(0, 6), '.kooooooooooook.', '.kokkooooookkok.', ...DOWN.slice(8)];

const UP = [
  '................',
  '..kk........kk..',
  '..kok......kok..',
  '..kookkkkkkook..',
  '.koooOoOOoOoook.',
  '.kooooOooOooook.',
  '.kooOooooooOook.',
  '.koooOooooOoook.',
  '.kooooooooooook.',
  '..kooooooooook..',
  '...kkcccccckk...',
  '...kooOooOook...',
  '..kooOooooOook..',
  '..kooooOOooook..',
  '..kook....kook..',
  '...kkk....kkk...',
];
const UP_STEP = [...UP.slice(0, 14), '..kook...kook...', '..kkk.....kkk...'];

const RIGHT = [
  '................',
  '.........kk..kk.',
  '.........kokkok.',
  '........kpooopok',
  '........koOoOook',
  '.......koooooWek',
  '.......koooooeek',
  '.......koooowwpk',
  '.ko.....kowwwwk.',
  '.kokkkkkkcccyk..',
  '.koOooOooOooook.',
  '..kooooooooowwk.',
  '..kowwwwwwwwwwk.',
  '..kook....kook..',
  '..kook....kook..',
  '..kkkk....kkkk..',
];
const RIGHT_STEP = [...RIGHT.slice(0, 13), '..kook...kook...', '.kook.....kook..', '.kkkk.....kkkk..'];

function frame(id: string, rows: string[]): HTMLCanvasElement {
  return baked(`ck:${id}`, (p) => p.rows(rows, CK));
}

export interface CkPose {
  facing: Direction;
  walking: boolean;
  /** Seconds, for the walk cycle and the idle blink. */
  time: number;
  /** Arms-up "found it!" — always drawn facing the player. */
  holding?: boolean;
  /** Head down, bum up, paws going. */
  digging?: boolean;
  /** Fur standing up: something nearby is a trap. */
  bristling?: boolean;
}

export function drawCK(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pose: CkPose): void {
  const step = pose.walking && Math.floor(pose.time * 7) % 2 === 1;
  // A slow blink every few seconds while idle — the cheapest way to make a sprite feel alive.
  const blink = !pose.walking && pose.time % 3.7 < 0.13;
  const facing = pose.holding ? 'down' : pose.facing;
  let sprite: HTMLCanvasElement;
  let mirror = false;
  switch (facing) {
    case 'down':
      sprite = blink ? frame('down-blink', DOWN_BLINK) : step ? frame('down-step', DOWN_STEP) : frame('down', DOWN);
      break;
    case 'up':
      sprite = step ? frame('up-step', UP_STEP) : frame('up', UP);
      break;
    case 'right':
    case 'left':
      sprite = step ? frame('right-step', RIGHT_STEP) : frame('right', RIGHT);
      mirror = facing === 'left';
      break;
  }
  if (pose.digging && !pose.holding) {
    // Scrabbling: a fast squash-and-stretch, nose to the ground.
    const beat = Math.floor(pose.time * 12) % 2 === 0;
    const squash = beat ? 0.86 : 0.94;
    ctx.save();
    ctx.translate(x + size / 2, y + size);
    ctx.scale(beat ? 1.06 : 1, squash);
    blit(ctx, sprite, -size / 2, -size, size, mirror);
    ctx.restore();
    return;
  }
  // A small hop on each step; a proud stretch when holding something up.
  const bob = pose.holding ? -size * 0.08 : step ? -size * 0.04 : 0;
  blit(ctx, sprite, x, y + bob, size, mirror);
  if (pose.bristling && !pose.holding) {
    // Three little tufts of standing-up fur.
    const u = size / 16;
    ctx.fillStyle = '#b8662a';
    const twitch = Math.floor(pose.time * 6) % 2;
    for (const [dx, dy] of [
      [2, 3 + twitch],
      [13, 3 + twitch],
      [8, 1],
    ] as const) {
      ctx.fillRect(x + dx * u, y + bob + dy * u, u, 2 * u);
    }
  }
}

// ── the cast ──────────────────────────────────────────────────────────────

const DAD_PAL: Record<string, string> = {
  k: '#231a12',
  h: '#c49a5c',
  H: '#6b4226',
  s: '#f0c49a',
  e: '#1b1f1c',
  b: '#7a5132',
  g: '#c9b27a',
  G: '#a38e5a',
  p: '#4f607a',
  n: '#8a6a3a',
};
const DAD = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '..kkHHHHHHHHkk..',
  '.khhhhhhhhhhhhk.',
  '..kkssssssssk...',
  '....ksesssesk...',
  '....ksssssssk...',
  '....kbsbbbsbk...',
  '.....kbbbbbk....',
  '...kgggGgggggk..',
  '..kggggGggggggk.',
  '..ksgggGgggggsk.',
  '...kppppppppk...',
  '...kpppk.kpppk..',
  '...kkkkk.kkkkk..',
];

const TORTOISE_PAL: Record<string, string> = { k: '#1f2a18', g: '#6f9a52', G: '#46703a', y: '#d6c08a', s: '#a3b872', e: '#1b1f1c' };
const TORTOISE = [
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkgGGgkk....',
  '...kgGgggggGk...',
  '..kgggGgGgGggk..',
  '..kgGggggggGgk..',
  '..kggGgGgGgggk..',
  '.kyyyyyyyyyyyyk.',
  '.kssk.ksssk.kssk',
  '..kk..kesek..kk.',
  '......ksssk.....',
  '.......kkk......',
  '................',
  '................',
];

const BAT_PAL: Record<string, string> = { k: '#150f1c', b: '#7a6a8e', B: '#4a3c5e', y: '#f2c14e', p: '#ef8f95' };
const BAT = [
  '................',
  '................',
  '................',
  '.....k....k.....',
  '.....kbkkbk.....',
  'k...kbbbbbbk...k',
  'kk.kbybbbbybk.kk',
  'kBkkbbbppbbbkkBk',
  'kBBBbbbbbbbbBBBk',
  'kBBkBbbbbbbBkBBk',
  'kBk.kBbbbbBk.kBk',
  'kk...kBbbBk...kk',
  'k.....kkkk.....k',
  '................',
  '................',
  '................',
];

const MAGPIE_PAL: Record<string, string> = { k: '#111316', w: '#f4f1ea', W: '#ffffff', b: '#2c3e7a', y: '#d9a441' };
const MAGPIE = [
  '................',
  '................',
  '................',
  '......kkk.......',
  '.....kkkkk......',
  '.....kWkkkyy....',
  '.....kkkkk......',
  '....kkwwwkk.....',
  '...kbkwwwwkk....',
  '..kbbkwwwwwk....',
  '.kbbbkkwwwkk....',
  'kbbb..kkkkk.....',
  'kbb....y..y.....',
  'k......y..y.....',
  '................',
  '................',
];

const MOLE_PAL: Record<string, string> = { k: '#1a1410', m: '#4a3a34', M: '#6a564c', p: '#ef9aa8', w: '#f4f1ea', d: '#6b4a2e', D: '#84603f' };
const MOLE = [
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kmmmmmmk....',
  '...kmMmmmmMmk...',
  '...kmwkmmkwmk...',
  '...kmmmppmmmk...',
  '..kpkmmppmmkpk..',
  '..kppkmmmmkppk..',
  '...kkmMmmMmkk...',
  '.ddddkmmmmkdddd.',
  'dDDddddddddddDDd',
  'ddDDddDDddDDdddd',
  '................',
];

const NPCS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  mole: { rows: MOLE, pal: MOLE_PAL },
  dad: { rows: DAD, pal: DAD_PAL },
  dadGroceries: { rows: DAD, pal: DAD_PAL },
  tortoise: { rows: TORTOISE, pal: TORTOISE_PAL },
  bat: { rows: BAT, pal: BAT_PAL },
  magpie: { rows: MAGPIE, pal: MAGPIE_PAL },
};

export function drawNpc(ctx: CanvasRenderingContext2D, sprite: string, x: number, y: number, size: number, time: number): void {
  const def = NPCS[sprite] ?? NPCS.dad!;
  const img = baked(`npc:${sprite}`, (p) => {
    p.rows(def.rows, def.pal);
    if (sprite === 'dadGroceries') {
      // A paper grocery bag with a leek sticking out, tucked under one arm.
      p.rect(12, 9, 4, 5, '#b98c55');
      p.rect(12, 9, 4, 1, '#8a6436');
      p.rect(13, 6, 1, 3, '#6fae4a');
      p.rect(14, 5, 1, 4, '#8fcf5f');
    }
  });
  // Everyone breathes a little; the bat flaps and hovers.
  const bob =
    sprite === 'bat' ? Math.sin(time * 5) * size * 0.08 : sprite === 'magpie' ? (Math.floor(time * 2) % 3 === 0 ? -size * 0.04 : 0) : Math.sin(time * 1.6) * size * 0.015;
  blit(ctx, img, x, y + bob, size);
}
