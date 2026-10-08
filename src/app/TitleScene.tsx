import { useEffect, useRef } from 'react';
import { buildMap } from '@/game/mapBuilder';
import { emptyMapState, type Direction, type Entity } from '@/game/types';
import { createInitialState } from '@/content/initialState';
import { drawAnimatedTiles, renderTerrain } from '@/render/tiles';
import { drawEntity } from '@/render/entities';
import { drawRoomLight } from '@/render/atmosphere';
import { propSprite } from '@/render/sprites';
import { blit } from '@/render/pixel';
import { drawCK, SIT_AFTER } from '@/render/ck';
import { TILE_SIZE } from '@/render/constants';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { useViewport } from './PixelText';

const T = TILE_SIZE;

/**
 * The morning it starts, built from the game's own tiles: CK's front room,
 * the book knocked off the shelf, Dad's old note on the floor, the door
 * open — and outside, the trail running off through the grass toward the
 * old ruins.
 */
const HOME = buildMap({
  id: 'title_home',
  name: '',
  region: 'home',
  rows: ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#####>######'],
  entities: [],
  defaultSpawn: { x: 5, y: 4 },
});

const TRAIL = buildMap({
  id: 'title_trail',
  name: '',
  region: 'meadow',
  softGround: true,
  rows: [
    '.....:......',
    '.....::.....',
    '......:.....',
    '......::....',
    '.......:....',
    '......::....',
    '......:.....',
    '.....::.....',
    '.....:......',
  ],
  props: [
    'Tb.h.....*bT',
    'b..*...h...b',
    'h.I...h..s..',
    '.j..*....o.i',
    'i.s..I...I.s',
    '.h..*.....h.',
    'I..i...*.j..',
    '.o..h...i..s',
    'i...I...O..i',
  ],
  entities: [],
  defaultSpawn: { x: 5, y: 0 },
});

const ROOM: Entity[] = [
  { kind: 'decoration', id: 't_shelf', pos: { x: 2, y: 1 }, spriteId: 'bookshelf' },
  { kind: 'decoration', id: 't_desk', pos: { x: 4, y: 1 }, spriteId: 'desk' },
  { kind: 'decoration', id: 't_plant', pos: { x: 10, y: 1 }, spriteId: 'plant' },
  { kind: 'decoration', id: 't_rug', pos: { x: 6, y: 3 }, spriteId: 'rug', walkable: true },
  { kind: 'decoration', id: 't_bowl', pos: { x: 9, y: 4 }, spriteId: 'bowl' },
  { kind: 'decoration', id: 't_bed', pos: { x: 10, y: 4 }, spriteId: 'catBed' },
  { kind: 'clueNote', id: 't_note', pos: { x: 4, y: 4 }, clueId: 'clue_old_note' },
];

const STATE = createInitialState();
// The book has already come off the shelf: that's how the note got out.
STATE.mapStates[HOME.id] = { ...emptyMapState(), usedDecorations: { t_shelf: true } };

const SCENE_W = HOME.width * T;

const CK = { x: 5 * T, y: 4 * T };

/**
 * CK's little routine while you decide: sit facing you (blinking, now and
 * then washing a paw), glance at the note with a flick of the tail, then
 * look back at the shelf with one ear turned. Never long enough to nap.
 */
function routine(t: number): { facing: Direction; idle: number } {
  const s = t % 15;
  if (s < 8.5) return { facing: 'down', idle: SIT_AFTER + s };
  if (s < 12) return { facing: 'left', idle: SIT_AFTER + (s - 8.5) };
  return { facing: 'up', idle: SIT_AFTER + (s - 12) };
}

/**
 * The first thing anyone sees: the real game, at rest. Tap CK and it trills
 * and bounces; the note flutters, the morning light comes in, a butterfly
 * wanders the trail. Scaled by whole screen pixels only, so it stays crisp.
 */
export function TitleScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pokeRef = useRef<(() => void) | null>(null);
  const { dpr, vw, vh } = useViewport();
  // Whole screen pixels per canvas pixel — about one CSS pixel each, so the
  // art is the size the game draws it. A narrow phone crops the room's
  // walls a little rather than shrinking the art; then as much of the trail
  // as fits in the top of the screen, running on past the bottom into the dark.
  const k = Math.max(1, Math.round(dpr));
  const viewW = Math.min(SCENE_W, Math.floor((vw * dpr) / k));
  const offsetX = Math.floor((SCENE_W - viewW) / 2);
  const tileCss = (T * k) / dpr;
  const trailRows = Math.max(3, Math.min(TRAIL.height, Math.floor((vh * 0.58) / tileCss) - HOME.height));
  const sceneH = (HOME.height + trailRows) * T;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const ground = document.createElement('canvas');
    ground.width = SCENE_W;
    ground.height = (HOME.height + TRAIL.height) * T;
    const g = ground.getContext('2d')!;
    renderTerrain(g, HOME, STATE.mapStates[HOME.id]!);
    g.save();
    g.translate(0, HOME.height * T);
    renderTerrain(g, TRAIL, emptyMapState());
    g.restore();

    const start = performance.now();
    let hopAt = -10;
    let heartAt = -10;
    let raf = 0;

    const draw = (now: number) => {
      const t = still ? 0 : (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-offsetX, 0);
      ctx.drawImage(ground, 0, 0);
      drawAnimatedTiles(ctx, HOME, t);

      // The trail's trees, stones and broken columns, back to front.
      ctx.save();
      ctx.translate(0, HOME.height * T);
      drawAnimatedTiles(ctx, TRAIL, t);
      for (const d of TRAIL.dressing) {
        if (!d.solid) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(d.pos.x * T + T / 2, d.pos.y * T + T * 0.86, T * 0.4, T * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        blit(ctx, propSprite(d.sprite), d.pos.x * T, d.pos.y * T, T);
      }
      drawRoomLight(ctx, TRAIL, t);
      ctx.restore();

      for (const e of ROOM) drawEntity(ctx, HOME, e, e.pos.x, e.pos.y, STATE, t);

      const now2 = (now - start) / 1000;
      const hopK = Math.min(1, (now2 - hopAt) / 0.38);
      const lift = hopK < 1 ? Math.sin(hopK * Math.PI) * T * 0.4 : 0;
      const pose = routine(t);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(CK.x + T / 2, CK.y + T * 0.9, T * 0.34, T * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCK(ctx, CK.x, CK.y - lift, T, { facing: pose.facing, walking: false, time: t + 1, idle: pose.idle });
      drawRoomLight(ctx, HOME, t);

      const heartK = (now2 - heartAt) / 1.1;
      if (heartK >= 0 && heartK < 1) {
        ctx.globalAlpha = 1 - heartK;
        ctx.fillStyle = '#ef8f95';
        ctx.font = `bold ${Math.round(T * 0.42)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', CK.x + T / 2, CK.y - T * 0.25 - heartK * T * 0.6);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }

      if (!still) {
        // A butterfly drifting along the trail.
        const bx = (Math.sin(t * 0.37) * 0.4 + 0.5) * SCENE_W;
        const by = HOME.height * T + (Math.sin(t * 0.74) * 0.3 + 0.4) * trailRows * T + Math.sin(t * 9) * 1.5;
        const open = Math.sin(t * 18) > 0;
        ctx.fillStyle = '#f6e7a8';
        ctx.fillRect(Math.round(bx) - (open ? 4 : 2), Math.round(by) - 2, open ? 3 : 2, 3);
        ctx.fillRect(Math.round(bx) + 1, Math.round(by) - 2, open ? 3 : 2, 3);
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 2, 4);
      }
      ctx.restore();

      if (!still || now2 - heartAt < 1.2) raf = requestAnimationFrame(draw);
    };

    pokeRef.current = () => {
      audio.unlock();
      audio.mrrp();
      haptics.tap();
      const t = (performance.now() - start) / 1000;
      if (!still) hopAt = t;
      heartAt = t;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      pokeRef.current = null;
    };
  }, [trailRows, offsetX]);

  return (
    <button
      type="button"
      className="title-scene"
      aria-label="Say hello to CK"
      onClick={() => pokeRef.current?.()}
      style={{ width: (viewW * k) / dpr, height: (sceneH * k) / dpr }}
    >
      <canvas ref={ref} width={viewW} height={sceneH} className="title-scene__canvas" aria-hidden="true" />
    </button>
  );
}
