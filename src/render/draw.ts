/**
 * Composes one frame: the baked terrain, animated tiles, depth-sorted
 * entities with CK among them, effects, the darkness of unlit rooms (only
 * CK's Sunstone glow pushes it back), the collar's pulse, and the
 * screen-space flashes and fades.
 */
import type { GameMap, GameState, TrapEntity, Vec2 } from '@/game/types';
import { computeCollarReading } from '@/game/collar';
import { mapStateOf, visibleEntities } from '@/game/world';
import { rollerPosition, spikesUp } from '@/game/hazards';
import { propSprite } from './sprites';
import { getItem } from '@/content/items';
import { TILE_SIZE } from './constants';
import { PALETTES } from './palette';
import { drawAnimatedTiles, renderTerrain } from './tiles';
import { drawEntity } from './entities';
import { drawCK, NAP_AFTER } from './ck';
import { blit } from './pixel';
import { itemSprite } from './sprites';
import { drawFxGround, drawFxWorld, drawIrisAndBanner, drawOverlays, drawParticles, fx, shakeOffset } from './fx';
import { drawSurround } from './surround';
import { drawRoomLight, drawVignette } from './atmosphere';
import { pawAffordance } from '@/game/affordance';
import { MAPS } from '@/content/maps';

const T = TILE_SIZE;

export interface View {
  /** CK's interpolated position, in tiles. */
  pos: Vec2;
  walking: boolean;
  time: number;
  /** The game clock (ms) — the same one timed hazards run on. */
  clock: number;
  /** 0..1 height of CK's hop, if mid-air. */
  hop: number;
  /** Seconds since CK last did anything — drives sitting, washing and napping. */
  idle: number;
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
  const ms = mapStateOf(state, map.id);
  const dug = Object.keys(ms.dug).sort().join('|');
  const collapsed = Object.keys(ms.collapsed).sort().join('|');
  const k = `${map.id}#${dug}#${collapsed}`;
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
      (entity.kind === 'decoration' && (entity.spriteId === 'carving' || entity.spriteId === 'moonCarving')) ||
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

  drawSurround(ctx, map, view.camera, view.width, view.height);
  ctx.drawImage(terrainFor(map, state), 0, 0);
  drawAnimatedTiles(ctx, map, view.time);

  if (map.region === 'vault') drawSunbeam(ctx, map, view.time);

  drawTimedGround(ctx, map, state, view);
  drawFxGround(ctx);

  // Entities, solid dressing and CK, back to front.
  type Drawable = { y: number; draw: () => void };
  const drawables: Drawable[] = visibleEntities(map, state).map(({ entity, pos }) => ({
    y: pos.y,
    draw: () => drawEntity(ctx, map, entity, pos.x, pos.y, state, view.time),
  }));
  for (const d of map.dressing) {
    if (!d.solid) continue;
    drawables.push({
      y: d.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(d.pos.x * T + T / 2, d.pos.y * T + T * 0.86, T * 0.4, T * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        blit(ctx, propSprite(d.sprite), d.pos.x * T, d.pos.y * T, T);
      },
    });
  }
  for (const roller of map.entities) {
    if (roller.kind !== 'roller') continue;
    const active = state.timed?.rollers.find((r) => r.id === roller.id);
    if (!active) continue;
    const at = rollerPosition(roller, active);
    drawables.push({ y: at.y, draw: () => drawBoulder(ctx, at, active.index === 0 && active.left > roller.stepMs, view.time) });
  }
  drawables.sort((a, b) => a.y - b.y);

  const ckRow = view.pos.y;
  let ckDrawn = false;
  const drawPlayer = () => {
    // CK's shadow stays on the ground while CK is in the air.
    if (view.hop > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(view.pos.x * T + T / 2, view.pos.y * T + T * 0.88, T * (0.3 - view.hop * 0.08), T * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const lift = view.hop * T * 0.55;
    // Squash and stretch, pivoting on CK's feet: long in the air, wide on landing.
    const land = fx.squashScale();
    const sx = land.sx * (1 - view.hop * 0.1);
    const sy = land.sy * (1 + view.hop * 0.14);
    const footX = view.pos.x * T + T / 2;
    const footY = view.pos.y * T + T - lift;
    ctx.save();
    ctx.translate(footX, footY);
    ctx.scale(sx, sy);
    ctx.translate(-footX, -footY);
    drawCK(ctx, view.pos.x * T, view.pos.y * T - lift, T, {
      facing: state.player.facing,
      walking: view.walking,
      time: view.time,
      holding: fx.isHolding(),
      digging: fx.isDigging(),
      bristling: bristling(map, state),
      idle: view.idle,
    });
    ctx.restore();
    if (view.idle >= NAP_AFTER && !fx.isHolding()) drawSnooze(ctx, view);
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
  for (const d of drawables) {
    if (!ckDrawn && d.y > ckRow) {
      drawPlayer();
      ckDrawn = true;
    }
    d.draw();
  }
  if (!ckDrawn) drawPlayer();

  drawSpikes(ctx, map, view);
  drawRoomLight(ctx, map, view.time);
  drawFocusMarker(ctx, state, view);
  drawBubble(ctx, view);
  drawFxWorld(ctx);
  drawParticles(ctx, false);

  if (map.dark) drawDarkness(ctx, map, state, view);
  drawParticles(ctx, true);

  // The collar: a ring that pulses faster the closer CK is, and sharper the
  // more squarely CK faces the source. Facing away it is a soft smudge;
  // locked on, it tightens and flashes. It never points.
  {
    const reading = computeCollarReading(map, state);
    if (reading.kind) {
      const cx = view.pos.x * T + T / 2;
      const cy = view.pos.y * T + T / 2 - view.hop * T * 0.55;
      const speed = 1.5 + reading.proximity * 7;
      const phase = (view.time * speed) % 1;
      const color = reading.kind === 'mechanism' ? '231,76,60' : reading.junk ? '214,178,110' : '242,193,78';
      const clarity = 0.25 + reading.aim * 0.75;
      for (const offset of [0, 0.5]) {
        const p = (phase + offset) % 1;
        ctx.strokeStyle = `rgba(${color},${(1 - p) * (0.15 + reading.strength * 0.6) * clarity})`;
        ctx.lineWidth = 1 + clarity * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, T * (0.45 + p * (0.5 + reading.proximity * 0.9)), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (reading.locked && reading.kind === 'buried') {
        const pulse = 0.5 + Math.sin(view.time * 12) * 0.5;
        ctx.strokeStyle = `rgba(255,245,200,${0.35 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.52, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
  drawVignette(ctx, map, view.width, view.height);
  drawOverlays(ctx, view.width, view.height);
  drawIrisAndBanner(
    ctx,
    view.width,
    view.height,
    { x: view.pos.x * T + T / 2 - view.camera.x, y: view.pos.y * T + T / 2 - view.camera.y },
    T,
  );
}

/**
 * A small marker over whatever Paw would touch: bright gold and bobbing for
 * something CK hasn't had from it yet, a faint tick for the rest. Scenery
 * that would only get a sniff gets nothing — the marker means "this does
 * something".
 */
function drawFocusMarker(ctx: CanvasRenderingContext2D, state: GameState, view: View): void {
  if (view.hop > 0 || fx.isHolding() || fx.isDigging()) return;
  const aff = pawAffordance(MAPS, state);
  if (!aff || aff.verb === 'Sniff') return;
  if (aff.at.x === state.player.pos.x && aff.at.y === state.player.pos.y) return;
  const cx = aff.at.x * T + T / 2;
  const bob = Math.sin(view.time * 5) * 2;
  const y = aff.at.y * T - T * 0.12 + bob;
  const s = aff.fresh ? 5 : 3.5;
  if (aff.fresh) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,215,120,0.25)';
    ctx.beginPath();
    ctx.arc(cx, y - s * 0.3, s * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = aff.fresh ? '#f2c14e' : 'rgba(250,245,230,0.6)';
  ctx.strokeStyle = 'rgba(30,18,8,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s, y - s);
  ctx.lineTo(cx + s, y - s);
  ctx.lineTo(cx, y + s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** For the UI: the sprite id an item draws with. */
export function spriteOf(itemId: string): string {
  return getItem(itemId)?.sprite ?? 'coin';
}

// ── timed hazards ─────────────────────────────────────────────────────────

/** CK's fur stands up near a live mechanism — a cat's own trap sense. */
function bristling(map: GameMap, state: GameState): boolean {
  if ((state.timed?.strikes.length ?? 0) > 0 || (state.timed?.crumbling.length ?? 0) > 0) return true;
  const reading = computeCollarReading(map, state);
  return reading.kind === 'mechanism' && reading.proximity > 0.6;
}

function drawTimedGround(ctx: CanvasRenderingContext2D, map: GameMap, state: GameState, view: View): void {
  const timed = state.timed;
  // Loose pebbles under a cracked ceiling: the falling-rock telegraph.
  for (const e of map.entities) {
    if (e.kind !== 'trap' || e.trapType !== 'fallingRock') continue;
    for (const t of e.triggers ?? []) {
      ctx.fillStyle = 'rgba(160,170,190,0.5)';
      for (const [dx, dy] of [
        [0.25, 0.3],
        [0.66, 0.24],
        [0.55, 0.7],
      ] as const) {
        ctx.fillRect(t.x * T + T * dx, t.y * T + T * dy, 3, 2);
      }
    }
  }
  if (!timed) return;
  // A falling stone: its shadow grows on the floor, and grit trickles down.
  for (const strike of timed.strikes) {
    const trap = map.entities.find((e): e is TrapEntity => e.kind === 'trap' && e.id === strike.trapId);
    if (!trap || trap.trapType !== 'fallingRock') continue;
    const total = trap.delayMs ?? 600;
    const k = 1 - Math.max(0, strike.left) / total;
    const cx = strike.at.x * T + T / 2;
    const cy = strike.at.y * T + T * 0.6;
    ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, T * (0.15 + k * 0.35), T * (0.08 + k * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,190,170,0.8)';
    for (let i = 0; i < 4; i++) {
      const fy = ((view.time * 3 + i * 0.27) % 1) * T;
      ctx.fillRect(cx - T * 0.2 + i * T * 0.13, strike.at.y * T - T * 0.5 + fy, 2, 2);
    }
  }
  // A stone about to go: it shivers.
  for (const c of timed.crumbling) {
    const [x, y] = c.key.split(',').map(Number) as [number, number];
    const k = 1 - c.left / 750;
    const jx = Math.sin(view.time * 60) * k * 1.5;
    ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.45})`;
    ctx.fillRect(x * T + 2 + jx, y * T + 2, T - 4, T - 4);
  }
}

function drawSpikes(ctx: CanvasRenderingContext2D, map: GameMap, view: View): void {
  for (const e of map.entities) {
    if (e.kind !== 'trap' || e.trapType !== 'spikes') continue;
    const { up } = spikesUp(e, view.clock);
    // A small tremble just before they come up — the beat you learn to hear.
    const soon = !up && spikesUp(e, view.clock + 220).up;
    for (const t of e.lane ?? []) {
      const px = t.x * T;
      const py = t.y * T;
      for (const hy of [3, 8, 13]) {
        for (const hx of [3, 8, 13]) {
          const bx = px + (hx / 16) * T;
          const by = py + (hy / 16) * T;
          if (up) {
            ctx.fillStyle = '#c8ccd6';
            ctx.beginPath();
            ctx.moveTo(bx - 3, by + 2);
            ctx.lineTo(bx, by - 7);
            ctx.lineTo(bx + 3, by + 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#7a808c';
            ctx.fillRect(bx, by - 6, 1.5, 8);
          } else if (soon) {
            ctx.fillStyle = 'rgba(200,204,214,0.7)';
            ctx.fillRect(bx - 1, by - 2, 2, 2);
          }
        }
      }
    }
  }
}

function drawBoulder(ctx: CanvasRenderingContext2D, at: Vec2, windingUp: boolean, time: number): void {
  const cx = at.x * T + T / 2 + (windingUp ? Math.sin(time * 50) * 1.5 : 0);
  const cy = at.y * T + T / 2;
  const r = T * 0.62;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.8, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5f5c51';
  ctx.beginPath();
  ctx.arc(cx, cy - T * 0.1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8b8778';
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - T * 0.1 - r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  // Tumbling seams, so it visibly rolls.
  const spin = (at.x + at.y) * 2.2;
  ctx.strokeStyle = '#4a4840';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(cx, cy - T * 0.1, r * 0.55, a, a + 0.9);
    ctx.stroke();
  }
}

/** Small z's drifting up off a sleeping cat. */
function drawSnooze(ctx: CanvasRenderingContext2D, view: View): void {
  const asleep = view.idle - NAP_AFTER;
  for (let i = 0; i < 3; i++) {
    const age = asleep * 0.45 - i / 3;
    if (age < 0) continue;
    const k = age % 1;
    const x = view.pos.x * T + T * (0.72 + k * 0.35 + Math.sin((k + i) * 6) * 0.05);
    const y = view.pos.y * T + T * (0.35 - k * 0.9);
    const s = Math.round(T * (0.3 + k * 0.18));
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.85;
    ctx.fillStyle = '#f4ead2';
    ctx.font = `bold ${s}px monospace`;
    ctx.strokeStyle = 'rgba(20,14,8,0.75)';
    ctx.lineWidth = 2;
    ctx.strokeText('z', x, y);
    ctx.fillText('z', x, y);
  }
  ctx.globalAlpha = 1;
}

/** CK's little thought bubble — "?" at a curiosity, "!" at a surprise, "…" at a sniff. */
function drawBubble(ctx: CanvasRenderingContext2D, view: View): void {
  const b = fx.bubbleInfo();
  if (!b) return;
  const pop = Math.min(1, b.progress * 8);
  const fade = b.progress > 0.8 ? 1 - (b.progress - 0.8) / 0.2 : 1;
  const x = view.pos.x * T + T * 0.78;
  const y = view.pos.y * T - T * 0.35 - view.hop * T * 0.55 - pop * 3;
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#fbf6e8';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1.5;
  const w = T * 0.5 * pop;
  const h = T * 0.44 * pop;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h / 2 - 1);
  ctx.lineTo(x - 7, y + h / 2 + 5);
  ctx.lineTo(x, y + h / 2 - 1);
  ctx.fill();
  if (pop >= 1) {
    ctx.fillStyle = b.char === '!' ? '#c0392b' : b.char === '♥' ? '#e05a6a' : '#2a1a10';
    ctx.font = `bold ${Math.round(T * 0.34)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.char, x, y + 1);
  }
  ctx.globalAlpha = 1;
}
