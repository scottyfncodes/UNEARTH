/**
 * CK in three-quarter view. The grid's four directions are the screen's
 * four diagonals in iso, so CK gets two new facings, front-right and
 * back-right, each mirrored for the other side. Sitting, washing and
 * napping reuse CK's own front-on frames: a cat that sits down turns to
 * look at you anyway.
 *
 * Everything is drawn at 1:1 art pixels on whole-pixel positions. No
 * squash-and-stretch scaling here; the bounce comes from whole-pixel hops,
 * so CK never smears.
 */
import type { Direction } from '@/game/types';
import { baked } from '@/render/pixel';
import { CK_PALETTE, DOWN, GROOM, idleMood, SIT, SIT_BLINK, SLEEP } from '@/render/ck';

const FR = [
  '................',
  '.....kk.....kk..',
  '.....kok...kok..',
  '.kk..kpokkkopok.',
  'kok.kooOoOOoOook',
  'kok.kooooooooook',
  'kok.koeooooWeook',
  '.kokkoeooooeeook',
  '..kooooowwwpwwwk',
  '..kooOkowwwkkwwk',
  '.kooOooOkkcccyk.',
  '.kooOooOokwwwwk.',
  '.koooooooowwwk..',
  '.kowwoooooowwwk.',
  '.kowk.kowk.kowk.',
  '.kkk..kkk..kkk..',
];
const FR_STEP = [...FR.slice(0, 14), '..kowkkowk.kowk.', '..kkk.kkk...kkk.'];
const FR_BLINK = [...FR.slice(0, 6), 'kok.kooooooooook', '.kokkokooookkook', ...FR.slice(8)];

const BR = [
  '................',
  '......kk.....kk.',
  '......kok...kok.',
  '......kookkkook.',
  '.....koooOoOoook',
  '.....kooOooOoook',
  '.kk..koOooooOook',
  'kok..kooooooooOk',
  'kok...kooooooOk.',
  '.kok.kkkccccck..',
  '..kokooOooOoook.',
  '..kooOooOooOook.',
  '.kooooOooOoook..',
  '.koooooooooook..',
  '.kook....kook...',
  '.kkk.....kkk....',
];
const BR_STEP = [...BR.slice(0, 14), '.kook...kook....', '..kkk...kkk.....'];
// One ear swivels back: something behind CK made a sound.
const BR_EAR = ['................', '......kk........', '......kok....kk.', '......kookkkkook', ...BR.slice(4)];

function frame(id: string, rows: string[]): HTMLCanvasElement {
  return baked(`ckiso:${id}`, (p) => p.rows(rows, CK_PALETTE));
}

/** Front-facing on screen (toward the camera) for grid right and down. */
export function facesCamera(facing: Direction): boolean {
  return facing === 'right' || facing === 'down';
}

/** Grid down and left run toward the screen's left, so those frames are mirrored. */
export function mirrored(facing: Direction): boolean {
  return facing === 'down' || facing === 'left';
}

export interface IsoPose {
  facing: Direction;
  walking: boolean;
  time: number;
  holding: boolean;
  digging: boolean;
  bristling: boolean;
  idle: number;
}

/** Which baked frame to show, and whether to mirror it. */
export function ckFrame(pose: IsoPose): { sprite: HTMLCanvasElement; mirror: boolean; bob: number } {
  const front = facesCamera(pose.facing);
  const step = pose.walking && Math.floor(pose.time * 7) % 2 === 1;
  const blink = !pose.walking && pose.time % 3.7 < 0.13;
  if (pose.holding) return { sprite: frame('hold', DOWN), mirror: false, bob: -1 };
  const mood = pose.walking || pose.digging ? 'stand' : idleMood(front ? 'down' : 'up', pose.idle);
  if (mood === 'nap') return { sprite: frame('sleep', SLEEP), mirror: false, bob: Math.sin(pose.time * 1.8) > 0 ? 0 : 1 };
  if (mood === 'sit') return { sprite: blink ? frame('sit-blink', SIT_BLINK) : frame('sit', SIT), mirror: false, bob: 0 };
  if (mood === 'groom') {
    const lick = Math.floor(pose.time * 5) % 2 === 0;
    return { sprite: lick ? frame('groom', GROOM) : frame('sit-blink', SIT_BLINK), mirror: false, bob: 0 };
  }
  const mirror = mirrored(pose.facing);
  if (pose.digging) {
    // Nose down, paws going: a two-pixel scrabble.
    const beat = Math.floor(pose.time * 12) % 2 === 0;
    return { sprite: front ? frame('fr', FR) : frame('br', BR), mirror, bob: beat ? 1 : 0 };
  }
  if (front) return { sprite: blink ? frame('fr-blink', FR_BLINK) : step ? frame('fr-step', FR_STEP) : frame('fr', FR), mirror, bob: step ? -1 : 0 };
  return { sprite: step ? frame('br-step', BR_STEP) : mood === 'ear' ? frame('br-ear', BR_EAR) : frame('br', BR), mirror, bob: step ? -1 : 0 };
}

export function drawFrameAt(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, mirror: boolean): void {
  if (!mirror) {
    ctx.drawImage(sprite, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + sprite.width, y);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}
