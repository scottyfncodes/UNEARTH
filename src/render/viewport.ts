/**
 * How big to make the game canvas, and how to place it, so the pixel art
 * lands on whole device pixels.
 *
 * The renderer draws TILE_SIZE canvas pixels per tile (two per art pixel).
 * If the canvas is then stretched by a fractional amount to fill the play
 * area, neighbouring art pixels come out one device pixel wider or narrower
 * than each other, and the art shimmers as the camera moves. So instead,
 * every canvas pixel gets a whole number of device pixels. The canvas is
 * sized to cover the play area at that scale, and its top-left corner is
 * snapped to the device-pixel grid. Anything past the edge is clipped by the
 * viewport.
 *
 * The zoom follows the same intent as before: fill a phone's play area top
 * to bottom where it can, with nine to eleven tiles across. Of the
 * whole-number scales, the one closest to that size wins, and the view
 * never shows fewer than nine tiles across.
 */
import { TILE_SIZE } from './constants';

export interface PlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasFit {
  /** Device pixels per canvas pixel: always a whole number. */
  scale: number;
  /** The canvas's backing size, in canvas (world) pixels. */
  width: number;
  height: number;
  /** Its on-screen size in CSS pixels: covers the play box. */
  cssWidth: number;
  cssHeight: number;
  /** CSS offset that puts its top-left corner on a device-pixel boundary. */
  offsetX: number;
  offsetY: number;
}

/** The tile size, in CSS pixels, the layout asks for (the rule the game has always used). */
export function preferredTilePx(boxWidth: number, boxHeight: number, mapHeight: number): number {
  const fillHeight = boxHeight / mapHeight;
  return Math.max(8, Math.min(boxWidth / 9, Math.max(boxWidth / 11, fillHeight)));
}

export function fitGameCanvas(box: PlayBox, mapHeight: number, dpr: number): CanvasFit {
  const ratio = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  const wanted = (preferredTilePx(box.width, box.height, mapHeight) * ratio) / TILE_SIZE;
  const tilesAcross = (s: number) => (box.width * ratio) / (s * TILE_SIZE);
  let scale = 1;
  let best = Infinity;
  for (const s of [Math.floor(wanted), Math.ceil(wanted)]) {
    if (s < 1) continue;
    // Zooming in so far that fewer than nine tiles show is never the better choice.
    if (s > 1 && tilesAcross(s) < 9) continue;
    const off = Math.abs(Math.log(s / wanted));
    if (off < best) {
      best = off;
      scale = s;
    }
  }
  // Shift up/left (never down/right, which would open a gap) onto the device grid,
  // then grow the canvas by the same amount so it still covers the box.
  const offsetX = snapEdge(box.left, ratio);
  const offsetY = snapEdge(box.top, ratio);
  const width = representableSize(Math.max(1, Math.ceil(((box.width - offsetX) * ratio) / scale)), scale, ratio);
  const height = representableSize(Math.max(1, Math.ceil(((box.height - offsetY) * ratio) / scale)), scale, ratio);
  return {
    scale,
    width,
    height,
    cssWidth: (width * scale) / ratio,
    cssHeight: (height * scale) / ratio,
    offsetX,
    offsetY,
  };
}

/**
 * Browsers lay elements out in 1/64 CSS px. A canvas whose CSS size falls
 * between two of those steps is rounded, and then its pixels are no longer
 * an exact whole multiple, which brings back one odd-width column in every
 * few hundred. So: the smallest canvas size, at least `min`, whose CSS
 * size is an exact layout step.
 */
const LAYOUT_STEP = 64;

function exact(css: number): boolean {
  return Math.abs(css * LAYOUT_STEP - Math.round(css * LAYOUT_STEP)) < 1e-6;
}

export function representableSize(min: number, scale: number, ratio: number): number {
  for (let n = min; n < min + 256; n++) if (exact((n * scale) / ratio)) return n;
  return min;
}

/** The smallest shift up/left (≤ 0, in CSS px, a layout step) that puts `edge` on a device-pixel boundary. */
export function snapEdge(edge: number, ratio: number): number {
  for (let k = 0; k < LAYOUT_STEP * 8; k++) {
    const o = -k / LAYOUT_STEP;
    const device = (edge + o) * ratio;
    if (Math.abs(device - Math.round(device)) < 1e-6) return o;
  }
  return 0;
}
