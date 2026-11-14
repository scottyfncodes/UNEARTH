/**
 * The isometric projection. Everything in the iso renderer is drawn at
 * native art resolution (one canvas pixel is one art pixel) and scaled up
 * by a whole number of device pixels, so every pixel on screen is the same
 * chunky square.
 *
 * The game still lives on its grid: x runs down-right on screen, y runs
 * down-left, and a tile is a 32×16 diamond. Height lifts things straight up.
 */
export const HALF_W = 16;
export const HALF_H = 8;
/** One step of terrain elevation, in art pixels. */
export const STEP = 4;
/** How far the diorama's earth block shows below ground level. */
export const STRATA = 44;
/** The tallest a wall is ever drawn. */
export const WALL_MAX = 40;

export interface Pt {
  x: number;
  y: number;
}

/** Grid point (continuous, tile x spans [x, x+1]) at height h → iso world pixels. */
export function project(gx: number, gy: number, h = 0): Pt {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H - h };
}

/** The centre of a tile's top face at height h. */
export function tileCenter(x: number, y: number, h = 0): Pt {
  return project(x + 0.5, y + 0.5, h);
}
