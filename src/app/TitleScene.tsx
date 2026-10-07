import { useEffect, useRef } from 'react';
import { buildMap } from '@/game/mapBuilder';
import { emptyMapState } from '@/game/types';
import { renderTerrain } from '@/render/tiles';
import { propSprite } from '@/render/sprites';
import { blit } from '@/render/pixel';
import { drawCK, NAP_AFTER, SIT_AFTER } from '@/render/ck';
import { TILE_SIZE } from '@/render/constants';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';

const T = TILE_SIZE;

/** A little patch of the Meadow for CK to sit in — built from the game's own tiles. */
const PATCH = buildMap({
  id: 'title_patch',
  name: '',
  region: 'meadow',
  softGround: true,
  rows: ['......', '......', '......'],
  props: ['b.h.*b', '.*...h', 'hL.m.*'],
  entities: [],
  defaultSpawn: { x: 3, y: 1 },
});

const CK_X = 2.5 * T;
const CK_Y = 0.95 * T;

/**
 * The first thing anyone sees: CK, in the grass, being a cat. Left alone it
 * sits, washes and eventually naps; tap it and it trills and bounces. A
 * butterfly wanders past. It says "this is a cat game" before a word does.
 */
export function TitleScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ground = document.createElement('canvas');
    ground.width = PATCH.width * T;
    ground.height = PATCH.height * T;
    renderTerrain(ground.getContext('2d')!, PATCH, emptyMapState());

    const start = performance.now();
    // Start already sitting, so the very first frame is a cat at rest.
    let restingSince = -SIT_AFTER;
    let hopAt = -10;
    let heartAt = -10;
    pokeRef.current = () => {
      const t = (performance.now() - start) / 1000;
      audio.unlock();
      audio.mrrp();
      haptics.tap();
      restingSince = t;
      hopAt = t;
      heartAt = t;
    };

    let raf = 0;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(ground, 0, 0);
      for (const d of PATCH.dressing) {
        if (d.solid) blit(ctx, propSprite(d.sprite), d.pos.x * T, d.pos.y * T, T);
      }

      const idle = t - restingSince;
      const hopK = Math.min(1, (t - hopAt) / 0.38);
      const lift = hopK < 1 ? Math.sin(hopK * Math.PI) * T * 0.4 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(CK_X + T / 2, CK_Y + T * 0.9, T * (0.36 - lift / T / 6), T * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCK(ctx, CK_X, CK_Y - lift, T, { facing: 'down', walking: false, time: t + 1, idle });

      if (idle >= NAP_AFTER) {
        const asleep = idle - NAP_AFTER;
        ctx.fillStyle = '#f4ead2';
        for (let i = 0; i < 3; i++) {
          const age = asleep * 0.45 - i / 3;
          if (age < 0) continue;
          const k = age % 1;
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.85;
          ctx.font = `bold ${Math.round(T * (0.3 + k * 0.18))}px monospace`;
          ctx.fillText('z', CK_X + T * (0.75 + k * 0.35), CK_Y + T * (0.4 - k * 0.9));
        }
        ctx.globalAlpha = 1;
      }

      const heartK = (t - heartAt) / 1.1;
      if (heartK >= 0 && heartK < 1) {
        ctx.globalAlpha = 1 - heartK;
        ctx.fillStyle = '#ef8f95';
        ctx.font = `bold ${Math.round(T * 0.42)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', CK_X + T / 2, CK_Y - T * 0.25 - heartK * T * 0.6);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }

      // A butterfly on a lazy figure-of-eight.
      const bx = (Math.sin(t * 0.37) * 0.42 + 0.5) * canvas.width;
      const by = (Math.sin(t * 0.74) * 0.22 + 0.3) * canvas.height + Math.sin(t * 9) * 1.5;
      const open = Math.sin(t * 18) > 0;
      ctx.fillStyle = '#f6e7a8';
      ctx.fillRect(Math.round(bx) - (open ? 4 : 2), Math.round(by) - 2, open ? 3 : 2, 3);
      ctx.fillRect(Math.round(bx) + 1, Math.round(by) - 2, open ? 3 : 2, 3);
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 2, 4);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      pokeRef.current = null;
    };
  }, []);

  return (
    <button type="button" className="title-scene" aria-label="Say hello to CK" onClick={() => pokeRef.current?.()}>
      <canvas ref={ref} width={PATCH.width * T} height={PATCH.height * T} className="title-scene__canvas" aria-hidden="true" />
    </button>
  );
}
