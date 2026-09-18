/**
 * CK, drawn as a small blocky pixel-grid sprite rather than an image asset —
 * cheap, crisp at any scale, and easy to keep consistent across the four
 * facings. Left is the right-facing grid mirrored at draw time.
 */
import type { Direction } from '@/game/types';

const CK_PALETTE: Record<string, string> = {
  F: '#d99a4e',
  S: '#7a4a24',
  W: '#f4ead9',
  E: '#1b1f1c',
  P: '#c96a63',
};

const DOWN = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FEFFEF.', '.FFPPFF.', '.SFFFFS.', '.FFWWFF.', '.S....S.'];
const DOWN_ALT = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FEFFEF.', '.FFPPFF.', '.SFFFFS.', '.FFWWFF.', '..S..S..'];
const UP = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FFSSFF.', '.FFFFFF.', '.SFFFFS.', '.FFSSFF.', '...SS...'];
const UP_ALT = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FFSSFF.', '.FFFFFF.', '.SFFFFS.', '.FFSSFF.', '..S..S..'];
const RIGHT = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FFFFEF.', '.FFFPFF.', '.SFFFFS.', 'SFFWWFF.', '.S....S.'];
const RIGHT_ALT = ['.S....S.', '.SFFFFS.', '.FFFFFF.', '.FFFFEF.', '.FFFPFF.', '.SFFFFS.', '.FFWWFFS', '..S..S..'];

function framesFor(facing: Direction): { a: string[]; b: string[]; mirror: boolean } {
  switch (facing) {
    case 'down':
      return { a: DOWN, b: DOWN_ALT, mirror: false };
    case 'up':
      return { a: UP, b: UP_ALT, mirror: false };
    case 'right':
      return { a: RIGHT, b: RIGHT_ALT, mirror: false };
    case 'left':
      return { a: RIGHT, b: RIGHT_ALT, mirror: true };
  }
}

export function drawCK(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  facing: Direction,
  walkToggle: boolean,
): void {
  const { a, b, mirror } = framesFor(facing);
  const grid = walkToggle ? b : a;
  const cell = size / 8;

  ctx.save();
  if (mirror) {
    ctx.translate(px + size, py);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(px, py);
  }

  for (let row = 0; row < 8; row++) {
    const line = grid[row]!;
    for (let col = 0; col < 8; col++) {
      const ch = line[col]!;
      if (ch === '.') continue;
      ctx.fillStyle = CK_PALETTE[ch] ?? '#000';
      ctx.fillRect(col * cell, row * cell, cell + 0.5, cell + 0.5);
    }
  }
  ctx.restore();
}
