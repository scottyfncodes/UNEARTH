import { useEffect, useRef, useState } from 'react';
import { eachPixel, GLYPH_HEIGHT, integerScale, measure } from '@/render/pixelFont';

/** Device pixel ratio and viewport size, kept current across resizes and zooms. */
export function useViewport(): { dpr: number; vw: number; vh: number } {
  const read = () => ({ dpr: window.devicePixelRatio || 1, vw: window.innerWidth, vh: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const onResize = () => setVp(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

const OUTLINE = '#2a1a10';
const SHADOW = '#120c07';

/**
 * Words drawn in the game's own pixels. `size` is the rough cap height in
 * CSS pixels; the real size snaps to a whole number of screen pixels per
 * font pixel so the letters stay razor-sharp. The `title` look gets an
 * outline, a drop shadow and a two-tone fill; plain text gets a 1px shadow
 * unless `shadow` is off. The words themselves are there for screen readers.
 */
export function PixelText({
  text,
  label = text,
  size,
  maxWidth = 340,
  color = '#e9e2d0',
  lower,
  title = false,
  shadow = true,
}: {
  text: string;
  label?: string;
  size: number;
  maxWidth?: number;
  color?: string;
  /** A second fill for the bottom rows of each glyph. */
  lower?: string;
  title?: boolean;
  shadow?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { dpr } = useViewport();
  const pad = title ? 2 : shadow ? 1 : 0;
  const box = measure(text);
  const cw = box.width + pad * 2;
  const ch = box.height + pad * 2;
  const k = integerScale(cw, size / GLYPH_HEIGHT, maxWidth, dpr);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    const ink: [number, number, number][] = [];
    eachPixel(text, box.width, 3, (x, y, row) => ink.push([x + pad, y + pad, row]));
    if (title) {
      ctx.fillStyle = SHADOW;
      for (const [x, y] of ink) ctx.fillRect(x - 1, y, 3, 3);
      ctx.fillStyle = OUTLINE;
      for (const [x, y] of ink) ctx.fillRect(x - 1, y - 1, 3, 3);
    } else if (shadow) {
      ctx.fillStyle = SHADOW;
      for (const [x, y] of ink) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
    for (const [x, y, row] of ink) {
      ctx.fillStyle = lower && row >= 4 ? lower : color;
      ctx.fillRect(x, y, 1, 1);
    }
  }, [text, title, shadow, color, lower, cw, ch, pad, box.width]);

  return (
    <>
      <canvas
        ref={ref}
        width={cw}
        height={ch}
        className="pixel-text"
        style={{ width: (cw * k) / dpr, height: (ch * k) / dpr }}
        aria-hidden="true"
      />
      <span className="hidden-visually">{label}</span>
    </>
  );
}
