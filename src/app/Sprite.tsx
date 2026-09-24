import { useEffect, useRef } from 'react';
import { itemSprite } from '@/render/sprites';
import { drawCK } from '@/render/ck';
import { drawNpc } from '@/render/ck';
import { getItem } from '@/content/items';

/** A crisp pixel-art item icon, drawn from the same sprite the world uses. */
export function ItemIcon({ itemId, size = 48, dim = false }: { itemId: string; size?: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(itemSprite(getItem(itemId)?.sprite ?? 'coin'), 0, 0, canvas.width, canvas.height);
  }, [itemId]);
  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      className={`pixel-icon ${dim ? 'pixel-icon--dim' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** An animated portrait: CK (the default) or any NPC sprite id. */
export function Portrait({ sprite = 'ck', size = 64, facing = 'down' }: { sprite?: string; size?: number; facing?: 'down' | 'right' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (sprite === 'ck') drawCK(ctx, 0, 4, 64, { facing, walking: false, time: t + 1 });
      else drawNpc(ctx, sprite, 0, 4, 64, t);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sprite, facing]);
  return <canvas ref={ref} width={64} height={72} className="pixel-icon" style={{ width: size, height: (size * 72) / 64 }} aria-hidden="true" />;
}
