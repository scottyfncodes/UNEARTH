import { useEffect, useRef } from 'react';
import { dispatch, game } from '@/core/game';
import { MAPS } from '@/content/maps';
import { cameraTarget, drawFrame } from '@/render/draw';
import { stepFx } from '@/render/fx';
import { audio } from '@/engine/audio';
import { computeDetectorReading } from '@/game/detector';
import { dismissCard, isBlocking, ui } from '@/core/ui';
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
  const cameraRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    const start = last;
    let lastMovedAt = -1;
    let lastTile = '';

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const time = (now - start) / 1000;
      const state = game.get();
      const map = MAPS[state.mapId]!;
      // Size the window to the box the layout gives us: about eleven tiles
      // across on a phone, fewer rows than a room so the camera has to follow.
      const box = canvas.parentElement!.getBoundingClientRect();
      const tilePx = Math.max(8, Math.min(box.width / 11, box.height / 8.5));
      const w = Math.round((box.width / tilePx) * TILE_SIZE);
      const h = Math.round((box.height / tilePx) * TILE_SIZE);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const motion = motionRef.current;
      const camera = cameraRef.current;
      if (lastMapRef.current !== state.mapId) {
        lastMapRef.current = state.mapId;
        snapMotion(motion, state.player.pos.x, state.player.pos.y);
        const snap = cameraTarget(map, state.player.pos, w, h);
        camera.x = snap.x;
        camera.y = snap.y;
      }
      const tile = `${state.player.pos.x},${state.player.pos.y}`;
      if (tile !== lastTile) {
        if (lastTile) audio.step();
        lastTile = tile;
        lastMovedAt = time;
      }
      // The collar pings on its own clock whenever nothing modal is up.
      if (!state.dialogue && !isBlocking()) {
        const reading = computeDetectorReading(map, state);
        audio.detector(reading.strength, reading.kind);
      }
      stepMotion(motion, state.player.pos.x, state.player.pos.y, dt);

      const aim = cameraTarget(map, motion, w, h);
      const ease = Math.min(1, dt * 8);
      camera.x += (aim.x - camera.x) * ease;
      camera.y += (aim.y - camera.y) * ease;

      stepFx(dt, map.region, map.width * TILE_SIZE, map.height * TILE_SIZE, !!map.dark);
      // Keep the walk cycle going briefly after each step so held-down
      // movement reads as one continuous trot rather than a stutter.
      const walking = time - lastMovedAt < 0.22;
      drawFrame(ctx, map, state, { pos: { x: motion.x, y: motion.y }, walking, time, camera, width: w, height: h });
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBlocking()) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          if (ui.get().cards.length > 0) dismissCard();
        }
        return;
      }
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

    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" role="img" aria-label="UNEARTH game view" />;
}
