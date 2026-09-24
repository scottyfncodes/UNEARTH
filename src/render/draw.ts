/**
 * Composes one frame: the baked terrain, animated tiles, depth-sorted
 * entities with CK among them, effects, the darkness of unlit rooms (only
 * CK's Sunstone glow pushes it back), the collar's detector pulse, and the
 * screen-space flashes and fades.
 */
import type { GameMap, GameState, Vec2 } from '@/game/types';
import { computeDetectorReading } from '@/game/detector';
import { mapStateOf, visibleEntities } from '@/game/world';
import { getItem } from '@/content/items';
import { TILE_SIZE } from './constants';
import { PALETTES } from './palette';
import { drawAnimatedTiles, renderTerrain } from './tiles';
import { drawEntity } from './entities';
import { drawCK } from './ck';
import { blit } from './pixel';
import { itemSprite } from './sprites';
import { drawFxWorld, drawOverlays, drawParticles, fx, shakeOffset } from './fx';

const T = TILE_SIZE;

export interface View {
  /** CK's interpolated position, in tiles. */
  pos: Vec2;
  walking: boolean;
  time: number;
  /** Top-left of the visible window, in world pixels. */
  camera: Vec2;
  /** Size of the visible window (the canvas), in world pixels. */
  width: number;
  height: number;
}

/**
 * Where the camera should sit to keep CK centred without showing past the
 * room's edges; a room smaller than the window is centred in it instead.
 */
export function cameraTarget(map: GameMap, focus: Vec2, width: number, height: number): Vec2 {
  const axis = (worldSize: number, view: number, at: number) => {
    if (worldSize <= view) return (worldSize - view) / 2;
    return Math.max(0, Math.min(worldSize - view, at - view / 2));
  };
  return {
    x: axis(map.width * T, width, focus.x * T + T / 2),
    y: axis(map.height * T, height, focus.y * T + T / 2),
  };
}

// ── baked terrain, rebuilt only when a room's terrain actually changes ────

let terrainCanvas: HTMLCanvasElement | null = null;
let terrainKey = '';

function terrainFor(map: GameMap, state: GameState): HTMLCanvasElement {
  const dug = Object.keys(mapStateOf(state, map.id).dug).sort().join('|');
  const k = `${map.id}#${dug}`;
  if (terrainCanvas && terrainKey === k) return terrainCanvas;
  terrainCanvas ??= document.createElement('canvas');
  terrainCanvas.width = map.width * T;
  terrainCanvas.height = map.height * T;
  renderTerrain(terrainCanvas.getContext('2d')!, map, mapStateOf(state, map.id));
  terrainKey = k;
  return terrainCanvas;
}

// ── darkness ──────────────────────────────────────────────────────────────

let darkCanvas: HTMLCanvasElement | null = null;

function drawDarkness(ctx: CanvasRenderingContext2D, map: GameMap, state: GameState, view: View): void {
  const w = map.width * T;
  const h = map.height * T;
  darkCanvas ??= document.createElement('canvas');
  if (darkCanvas.width !== w || darkCanvas.height !== h) {
    darkCanvas.width = w;
    darkCanvas.height = h;
  }
  const d = darkCanvas.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, w, h);
  d.fillStyle = 'rgba(2,3,8,0.97)';
  d.fillRect(0, 0, w, h);

  // The Sunstone's glow, flickering slightly like something alive.
  const lit = state.inventory.includes('idol_sunstone');
  const cx = view.pos.x * T + T / 2;
  const cy = view.pos.y * T + T / 2;
  const flicker = 1 + Math.sin(view.time * 7.3) * 0.025 + Math.sin(view.time * 13.1) * 0.015;
  const r = (lit ? 3.4 : 1.2) * T * flicker;
  d.globalCompositeOperation = 'destination-out';
  const g = d.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  d.fillStyle = g;
  d.fillRect(0, 0, w, h);

  // Unread notes and the keepers' carvings glow faintly — enough to wander toward.
  for (const { entity, pos } of visibleEntities(map, state)) {
    const glows =
      (entity.kind === 'clueNote' && !state.clues.includes(entity.clueId)) ||
      (entity.kind === 'decoration' && entity.spriteId === 'carving') ||
      (entity.kind === 'door' && entity.requiresArtifact === 'moon_seal');
    if (!glows) continue;
    const ex = pos.x * T + T / 2;
    const ey = pos.y * T + T / 2;
    const eg = d.createRadialGradient(ex, ey, 0, ex, ey, T * 0.9);
    eg.addColorStop(0, 'rgba(0,0,0,0.6)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = eg;
    d.fillRect(ex - T, ey - T, T * 2, T * 2);
  }

  ctx.drawImage(darkCanvas, 0, 0);

  if (lit) {
    ctx.globalCompositeOperation = 'lighter';
    const warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    warm.addColorStop(0, 'rgba(255,160,70,0.16)');
    warm.addColorStop(1, 'rgba(255,160,70,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── the vault's sunbeam ───────────────────────────────────────────────────

function drawSunbeam(ctx: CanvasRenderingContext2D, map: GameMap, time: number): void {
  const hollow = map.entities.find((e) => e.kind === 'decoration' && e.spriteId === 'hollow');
  if (!hollow) return;
  const cx = hollow.pos.x * T + T / 2;
  const base = hollow.pos.y * T + T / 2;
  const sway = Math.sin(time * 0.5) * 0.04 + 1;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 0, 0, base + T);
  g.addColorStop(0, 'rgba(255,225,140,0)');
  g.addColorStop(1, `rgba(255,225,140,${0.28 * sway})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - T * 0.6, 0);
  ctx.lineTo(cx + T * 0.6, 0);
  ctx.lineTo(cx + T * 1.3, base + T * 0.6);
  ctx.lineTo(cx - T * 1.3, base + T * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ── the frame ─────────────────────────────────────────────────────────────

export function drawFrame(ctx: CanvasRenderingContext2D, map: GameMap, state: GameState, view: View): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTES[map.region].bg;
  ctx.fillRect(0, 0, view.width, view.height);

  const shake = shakeOffset();
  ctx.save();
  ctx.translate(Math.round(shake.x - view.camera.x), Math.round(shake.y - view.camera.y));

  ctx.drawImage(terrainFor(map, state), 0, 0);
  drawAnimatedTiles(ctx, map, view.time);

  if (map.region === 'vault') drawSunbeam(ctx, map, view.time);

  // Entities and CK, back to front.
  const entities = visibleEntities(map, state).sort((a, b) => a.pos.y - b.pos.y);
  const ckRow = view.pos.y;
  let ckDrawn = false;
  const drawPlayer = () => {
    drawCK(ctx, view.pos.x * T, view.pos.y * T, T, {
      facing: state.player.facing,
      walking: view.walking,
      time: view.time,
      holding: fx.isHolding(),
    });
    const held = fx.heldSprite();
    if (held) {
      // The classic: hold the find up over your head.
      const rise = Math.min(1, held.progress * 5);
      const size = T * (0.6 + rise * 0.2);
      const hx = view.pos.x * T + (T - size) / 2;
      const hy = view.pos.y * T - T * 0.55 - rise * T * 0.15;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,230,150,0.25)';
      ctx.beginPath();
      ctx.arc(hx + size / 2, hy + size / 2, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      blit(ctx, itemSprite(held.sprite), hx, hy, size);
    }
  };
  for (const { entity, pos } of entities) {
    if (!ckDrawn && pos.y > ckRow) {
      drawPlayer();
      ckDrawn = true;
    }
    drawEntity(ctx, map, entity, pos.x, pos.y, state, view.time);
  }
  if (!ckDrawn) drawPlayer();

  drawFxWorld(ctx);
  drawParticles(ctx, false);

  if (map.dark) drawDarkness(ctx, map, state, view);
  drawParticles(ctx, true);

  // The collar: a ring that pulses faster and brighter the closer CK gets.
  if (state.tool === 'detector' && state.detectorOn) {
    const reading = computeDetectorReading(map, state);
    if (reading.kind) {
      const cx = view.pos.x * T + T / 2;
      const cy = view.pos.y * T + T / 2;
      const speed = 2 + reading.strength * 8;
      const phase = (view.time * speed) % 1;
      const color = reading.kind === 'mechanism' ? '231,76,60' : '242,193,78';
      for (const offset of [0, 0.5]) {
        const p = (phase + offset) % 1;
        ctx.strokeStyle = `rgba(${color},${(1 - p) * (0.35 + reading.strength * 0.5)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, T * (0.45 + p * (0.6 + reading.strength * 0.9)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
  drawOverlays(ctx, view.width, view.height);
}

/** For the UI: the sprite id an item draws with. */
export function spriteOf(itemId: string): string {
  return getItem(itemId)?.sprite ?? 'coin';
}
