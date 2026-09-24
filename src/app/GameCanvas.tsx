import { useEffect, useRef } from 'react';
import { dispatch, game } from '@/core/game';
import { MAPS } from '@/content/maps';
import { cameraTarget, drawFrame } from '@/render/draw';
import { stepFx } from '@/render/fx';
import { audio } from '@/engine/audio';
import { computeDetectorReading } from '@/game/detector';
import { needsTick } from '@/game/hazards';
import { dismissCard, isBlocking, ui } from '@/core/ui';
import { createMotion, isHopping, snapMotion, stepHop, stepMotion } from '@/render/motion';
import { TILE_SIZE } from '@/render/constants';
import type { Direction } from '@/game/types';
import { pressDig, pressDirection, pressInteract, pressJump, releaseDirection } from './controls';

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

/**
 * The game clock, in ms. It only runs while nothing modal is on screen, so
 * a find card or a conversation freezes every dart, stone and boulder in
 * place — and spikes keep their rhythm exactly where they left off.
 */
let gameClock = 0;
export function currentClock(): number {
  return gameClock;
}

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

      // Time passes for traps only while the world is actually on screen.
      const paused = isBlocking() || !!game.get().dialogue;
      if (!paused) {
        gameClock += dt * 1000;
        const before = game.get();
        if (needsTick(MAPS[before.mapId]!, before)) dispatch({ type: 'tick', dt: dt * 1000, now: gameClock });
      }

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
        if (lastTile && !isHopping()) audio.step();
        lastTile = tile;
        lastMovedAt = time;
      }
      // The collar pings on its own clock whenever nothing modal is up.
      if (!paused) {
        const reading = computeDetectorReading(map, state);
        audio.detector(reading);
      }
      const hop = isHopping() ? stepHop(motion, dt) : 0;
      if (!hop) stepMotion(motion, state.player.pos.x, state.player.pos.y, dt);

      const aim = cameraTarget(map, motion, w, h);
      const ease = Math.min(1, dt * 8);
      camera.x += (aim.x - camera.x) * ease;
      camera.y += (aim.y - camera.y) * ease;

      stepFx(dt, map.region, map.width * TILE_SIZE, map.height * TILE_SIZE, !!map.dark);
      // Keep the walk cycle going briefly after each step so held-down
      // movement reads as one continuous trot rather than a stutter.
      const walking = time - lastMovedAt < 0.22 && !hop;
      drawFrame(ctx, map, state, { pos: { x: motion.x, y: motion.y }, walking, time, clock: gameClock, hop, camera, width: w, height: h });
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
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) dispatch({ type: 'interact' });
        return;
      }
      const dir = KEY_DIRECTION[e.code];
      if (dir) {
        e.preventDefault();
        // The controller runs its own steady walk; the OS key-repeat would only make CK skid.
        if (!e.repeat) pressDirection(dir);
        return;
      }
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') pressInteract();
      else if (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') pressDig();
      else if (e.code === 'KeyZ' || e.code === 'KeyJ' || e.code === 'KeyC') pressJump();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEY_DIRECTION[e.code];
      if (dir) releaseDirection(dir);
    };
    const onBlur = () => releaseDirection();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" role="img" aria-label="UNEARTH game view" />;
}
