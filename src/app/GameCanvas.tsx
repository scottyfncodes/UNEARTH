import { useEffect, useRef } from 'react';
import { dispatch, game } from '@/core/game';
import { MAPS } from '@/content/maps';
import { drawFrame } from '@/render/draw';
import { createMotion, snapMotion, stepMotion } from '@/render/motion';
import { TILE_SIZE } from '@/render/constants';
import type { Direction } from '@/game/types';

const KEY_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionRef = useRef(createMotion(0, 0));
  const lastMapRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const state = game.get();
      const map = MAPS[state.mapId]!;
      const w = map.width * TILE_SIZE;
      const h = map.height * TILE_SIZE;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      if (lastMapRef.current !== state.mapId) {
        lastMapRef.current = state.mapId;
        snapMotion(motionRef.current, state.player.pos.x, state.player.pos.y);
      }
      stepMotion(motionRef.current, state.player.pos.x, state.player.pos.y, dt);

      const walkToggle = Math.floor(now / 220) % 2 === 0;
      drawFrame(ctx, map, state, walkToggle, motionRef.current);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (game.get().dialogue) {
        if (e.code === 'Space' || e.code === 'Enter') dispatch({ type: 'interact' });
        return;
      }
      const dir = KEY_DIRECTION[e.code];
      if (dir) {
        dispatch({ type: 'move', direction: dir });
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') dispatch({ type: 'interact' });
      else if (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') dispatch({ type: 'dig' });
      else if (e.code === 'KeyZ' || e.code === 'Tab') {
        e.preventDefault();
        dispatch({ type: 'toggleTool' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" role="img" aria-label="UNEARTH game view" />;
}
