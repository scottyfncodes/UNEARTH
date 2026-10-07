import { useEffect, useRef } from 'react';
import { dispatch, game } from '@/core/game';
import { MAPS } from '@/content/maps';
import { cameraTarget, drawFrame } from '@/render/draw';
import { fx, stepFx } from '@/render/fx';
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

const LOOK: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The colour of the little kick of dust behind CK's paws, by region. */
const PUFF: Record<string, string> = {
  home: 'rgba(230,210,180,0.5)',
  meadow: 'rgba(200,220,160,0.55)',
  well: 'rgba(190,190,160,0.5)',
  temple: 'rgba(200,196,184,0.55)',
  crypt: 'rgba(150,164,190,0.45)',
  vault: 'rgba(240,210,150,0.6)',
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
  const leadRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    const start = last;
    let lastMovedAt = -1;
    let lastTile = '';
    let lastMap = '';

    const lead = leadRef.current;
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const time = (now - start) / 1000;

      // Time passes for traps only while the world is actually on screen —
      // and holds for a beat on a hit, so an impact lands.
      const frozen = fx.isFrozen();
      const paused = isBlocking() || !!game.get().dialogue;
      if (!paused && !frozen) {
        gameClock += dt * 1000;
        const before = game.get();
        if (needsTick(MAPS[before.mapId]!, before)) dispatch({ type: 'tick', dt: dt * 1000, now: gameClock });
      }

      const state = game.get();
      const map = MAPS[state.mapId]!;
      // Size the window to the box the layout gives us. A room should fill
      // the play area top to bottom where it can — a phone is tall — while
      // showing between nine and eleven tiles across, so the art stays big
      // and the camera still has somewhere to follow CK. Whatever is left
      // over past the room's edges is drawn as the region carrying on.
      const box = canvas.parentElement!.getBoundingClientRect();
      const fillHeight = box.height / map.height;
      const tilePx = Math.max(8, Math.min(box.width / 9, Math.max(box.width / 11, fillHeight)));
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
        const f = LOOK[state.player.facing];
        lead.x = f.x * 0.9;
        lead.y = f.y * 0.9;
        const snap = cameraTarget(map, { x: state.player.pos.x + lead.x, y: state.player.pos.y + lead.y }, w, h);
        camera.x = snap.x;
        camera.y = snap.y;
      }
      const tile = `${state.player.pos.x},${state.player.pos.y}`;
      if (tile !== lastTile) {
        if (lastTile && !isHopping() && lastMap === state.mapId) {
          audio.step(map.region);
          const [px, py] = lastTile.split(',').map(Number) as [number, number];
          fx.puff({ x: px, y: py }, PUFF[map.region]);
        }
        lastTile = tile;
        lastMap = state.mapId;
        lastMovedAt = time;
      }
      // The collar pings on its own clock whenever nothing modal is up.
      if (!paused) {
        const reading = computeDetectorReading(map, state);
        audio.detector(reading);
      }
      const sdt = frozen ? 0 : dt;
      const hop = isHopping() ? stepHop(motion, sdt) : 0;
      if (!hop) stepMotion(motion, state.player.pos.x, state.player.pos.y, sdt);

      // The camera leads a little in the direction CK is facing, so you see
      // more of where you're going than where you've been.
      const facing = LOOK[state.player.facing];
      lead.x += (facing.x * 0.9 - lead.x) * Math.min(1, dt * 3);
      lead.y += (facing.y * 0.9 - lead.y) * Math.min(1, dt * 3);
      const aim = cameraTarget(map, { x: motion.x + lead.x, y: motion.y + lead.y }, w, h);
      const ease = Math.min(1, dt * 8);
      camera.x += (aim.x - camera.x) * ease;
      camera.y += (aim.y - camera.y) * ease;

      stepFx(sdt, map.region, map.width * TILE_SIZE, map.height * TILE_SIZE, !!map.dark);
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
