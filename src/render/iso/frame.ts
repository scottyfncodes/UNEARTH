/**
 * One isometric frame. Same game state, same effects, same affordances as
 * the flat renderer; only the picture is new:
 *
 *   floor (baked) → ground decals → depth-sorted walls, props, plants,
 *   entities and CK → effects → light → collar, marker, bubble → x-ray of
 *   CK through anything standing in front → screen-space vignette, banner,
 *   flashes and the entry iris.
 *
 * The canvas is art resolution; GameCanvas scales it by a whole number of
 * device pixels.
 */
import type { Direction, Entity, GameMap, GameState, Vec2 } from '@/game/types';
import { computeCollarReading } from '@/game/collar';
import { mapStateOf, visibleEntities } from '@/game/world';
import { pawAffordance } from '@/game/affordance';
import { MAPS } from '@/content/maps';
import { getItem } from '@/content/items';
import { TILE_SIZE } from '@/render/constants';
import { PALETTES } from '@/render/palette';
import { baked, hash } from '@/render/pixel';
import { itemSprite, propSprite } from '@/render/sprites';
import { drawNpc, NAP_AFTER } from '@/render/ck';
import { drawEntity } from '@/render/entities';
import { drawOverlays, fx, fxView } from '@/render/fx';
import { ckFrame, drawFrameAt } from './ckIso';
import { bakeTerrain, UPRIGHT_FLAT, type IsoTerrain } from './terrain';
import { project, tileCenter } from './project';
import { bubble, checker, chevron, ellipse, fern, line, marker, px, shadow, text, textWidth, tuft } from './pixels';

export interface IsoView {
  /** CK's interpolated grid position. */
  pos: Vec2;
  walking: boolean;
  time: number;
  dt: number;
  clock: number;
  hop: number;
  idle: number;
  /** Canvas size in art pixels. */
  width: number;
  height: number;
  bristling: boolean;
}

const T = TILE_SIZE;
const isWallish = (t: string | undefined) => t === 'wall' || t === 'catGap';

// ── terrain cache ────────────────────────────────────────────────────────

let terrain: IsoTerrain | null = null;

function terrainFor(map: GameMap, state: GameState): IsoTerrain {
  const ms = mapStateOf(state, map.id);
  const key = `${map.id}#${Object.keys(ms.dug).sort().join('|')}#${Object.keys(ms.collapsed).sort().join('|')}`;
  if (terrain?.key === key) return terrain;
  terrain = bakeTerrain(map, ms, key);
  plants = plantsFor(map, state);
  return terrain;
}

/** Elevation (px) under a continuous grid position, blended across a step. */
function elevAt(t: IsoTerrain, gx: number, gy: number): number {
  const at = (x: number, y: number) => t.elev[Math.max(0, Math.min(t.elev.length - 1, y))]?.[Math.max(0, Math.min(t.elev[0]!.length - 1, x))] ?? 0;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx0 = gx - x0;
  const fy0 = gy - y0;
  const top = at(x0, y0) * (1 - fx0) + at(x0 + 1, y0) * fx0;
  const bottom = at(x0, y0 + 1) * (1 - fx0) + at(x0 + 1, y0 + 1) * fx0;
  return top * (1 - fy0) + bottom * fy0;
}

function tileTopElev(t: IsoTerrain, map: GameMap, x: number, y: number): number {
  if (isWallish(map.tiles[y]?.[x])) return t.wallTop.get(`${x},${y}`) ?? 0;
  return t.elev[y]?.[x] ?? 0;
}

// ── plants: ferns at the feet of walls, a few tufts in the cracks ───────

interface Plant {
  x: number;
  y: number;
  fern: boolean;
  phase: number;
}

let plants: Plant[] = [];

function plantsFor(map: GameMap, state: GameState): Plant[] {
  const taken = new Set<string>();
  for (const d of map.dressing) taken.add(`${d.pos.x},${d.pos.y}`);
  for (const { pos } of visibleEntities(map, state)) taken.add(`${pos.x},${pos.y}`);
  for (const e of map.exits) taken.add(`${e.at.x},${e.at.y}`);
  const out: Plant[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      // Only plain stone floor: plants never sit on soft earth or trigger bricks, where they'd read as a hint.
      if (map.tiles[y]![x] !== 'floor' || taken.has(`${x},${y}`) || map.secrets[`${x},${y}`]) continue;
      const byWall = isWallish(map.tiles[y - 1]?.[x]) || isWallish(map.tiles[y]?.[x - 1]);
      const n = hash(x, y, 21);
      if (byWall && n > 0.55) out.push({ x, y, fern: n > 0.78, phase: hash(x, y, 22) * 6 });
      else if (!byWall && n > 0.94) out.push({ x, y, fern: false, phase: hash(x, y, 22) * 6 });
    }
  }
  return out;
}

// ── flat things pressed into the floor ───────────────────────────────────

/** Resamples a top-down 16×16 sprite onto a floor diamond, so a floor inscription lies on the floor. */
function isoFlat(id: string, sprite: HTMLCanvasElement): HTMLCanvasElement {
  return baked(`isoflat:${id}`, (p) => {
    const sctx = sprite.getContext('2d')!;
    const data = sctx.getImageData(0, 0, sprite.width, sprite.height).data;
    const s = sprite.width / 16;
    for (let sy = 0; sy < 16; sy++) {
      for (let sx = -16; sx < 16; sx++) {
        const u = sy + 0.5 + (sx + 0.5) / 2;
        const v = sy + 0.5 - (sx + 0.5) / 2;
        if (u < 0 || u >= 16 || v < 0 || v >= 16) continue;
        const i = (Math.floor(v * s) * sprite.width + Math.floor(u * s)) * 4;
        if (data[i + 3]! < 40) continue;
        p.px(sx + 16, sy, `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]! / 255})`);
      }
    }
  }, 32, 16);
}

const FLAT_DECOS = new Set(['glyph', 'rug', 'floorArrow', 'chalkX', 'scorch']);

/** A page of Dad's notes, top-down, before it is laid onto the floor diamond. */
function noteSprite(read: boolean): HTMLCanvasElement {
  return baked(`iso:note:${read}`, (p) => {
    p.rect(3, 3, 10, 10, read ? '#c9c2b0' : '#f4eedc');
    p.rect(3, 12, 10, 1, read ? '#a8a08c' : '#d8cfb4');
    p.rect(5, 6, 6, 1, '#8a8062');
    p.rect(5, 9, 4, 1, '#8a8062');
    if (!read) p.rect(10, 3, 3, 3, '#c0392b');
  });
}

// ── drawables ────────────────────────────────────────────────────────────

interface Drawable {
  depth: number;
  /** Tie-break inside one depth: lower draws first. */
  layer: number;
  /** World-space box, for the x-ray test. */
  box: [number, number, number, number];
  occludes: boolean;
  draw: (c: CanvasRenderingContext2D) => void;
}

function billboard(sprite: HTMLCanvasElement, x: number, y: number, elev: number, layer: number, shadowW = 12, lift = 0): Drawable {
  const c = tileCenter(x, y, elev);
  const bx = Math.round(c.x - sprite.width / 2);
  const by = Math.round(c.y - sprite.height + 3 - lift);
  return {
    depth: x + y + 1,
    layer,
    box: [bx, by, sprite.width, sprite.height],
    occludes: true,
    draw: (ctx) => {
      if (shadowW) {
        const s = shadow(shadowW);
        ctx.drawImage(s, Math.round(c.x - s.width / 2), Math.round(c.y - s.height / 2 + 1));
      }
      ctx.drawImage(sprite, bx, by);
    },
  };
}

function entityDrawable(map: GameMap, state: GameState, t: IsoTerrain, entity: Entity, pos: Vec2, time: number): Drawable | null {
  const elev = tileTopElev(t, map, pos.x, pos.y);
  switch (entity.kind) {
    case 'item': {
      const def = getItem(entity.itemId);
      const bob = Math.round(Math.sin(time * 3 + pos.x + pos.y) * 1);
      const d = billboard(itemSprite(def?.sprite ?? 'coin'), pos.x, pos.y, elev, 1, 8, 3 + bob);
      const glint = (time * 0.7 + (pos.x * 7 + pos.y * 13) * 0.1) % 2.4;
      const draw = d.draw;
      d.occludes = false;
      d.draw = (c) => {
        draw(c);
        if (glint < 0.25) {
          const [bx, by] = d.box;
          c.fillStyle = 'rgba(255,255,255,0.95)';
          px(c, bx + 11, by + 2, 1, 3);
          px(c, bx + 10, by + 3, 3, 1);
        }
      };
      return d;
    }
    case 'decoration': {
      const used = !!mapStateOf(state, map.id).usedDecorations[entity.id];
      if (FLAT_DECOS.has(entity.spriteId)) {
        const flat = isoFlat(`${entity.spriteId}:${used}`, propSprite(entity.spriteId, used));
        const top = project(pos.x, pos.y, elev);
        return { depth: pos.x + pos.y, layer: -2, box: [0, 0, 0, 0], occludes: false, draw: (c) => c.drawImage(flat, Math.round(top.x - 16), Math.round(top.y)) };
      }
      const small = entity.walkable;
      const d = billboard(propSprite(entity.spriteId, used), pos.x, pos.y, elev, small ? 0 : 1, small ? 6 : 12);
      d.occludes = !small;
      return d;
    }
    case 'clueNote': {
      const read = state.clues.includes(entity.clueId);
      const flat = isoFlat(`note:${read}`, noteSprite(read));
      const top = project(pos.x, pos.y, elev);
      const lift = read ? 0 : Math.sin(time * 2.4 + pos.x) > 0.6 ? 1 : 0;
      return { depth: pos.x + pos.y, layer: -1, box: [0, 0, 0, 0], occludes: false, draw: (c) => c.drawImage(flat, Math.round(top.x - 16), Math.round(top.y - lift)) };
    }
    case 'npc': {
      const c0 = tileCenter(pos.x, pos.y, elev);
      const bx = Math.round(c0.x - 8);
      const by = Math.round(c0.y - 13);
      return {
        depth: pos.x + pos.y + 1,
        layer: 1,
        box: [bx, by, 16, 16],
        occludes: true,
        draw: (c) => {
          const s = shadow(12);
          c.drawImage(s, Math.round(c0.x - 6), Math.round(c0.y - 1));
          drawNpc(c, entity.sprite, bx, by, 16, time);
        },
      };
    }
    case 'trap':
    case 'curio':
    case 'roller':
      return null;
    default: {
      // Doors, levers and blocks: not in the prototype room yet, so the flat art stands in, at half scale.
      const c0 = tileCenter(pos.x, pos.y, elev);
      return {
        depth: pos.x + pos.y + 1,
        layer: 1,
        box: [Math.round(c0.x - 8), Math.round(c0.y - 13), 16, 16],
        occludes: true,
        draw: (c) => {
          c.save();
          c.translate(Math.round(c0.x - 8), Math.round(c0.y - 13));
          c.scale(0.5, 0.5);
          c.translate(-pos.x * T, -pos.y * T);
          drawEntity(c, map, entity, pos.x, pos.y, state, time);
          c.restore();
        },
      };
    }
  }
}

/** Small dark holes in the wall face a dart trap shoots from. */
function dartHoles(ctx: CanvasRenderingContext2D, map: GameMap, t: IsoTerrain, x: number, y: number): void {
  const base = t.elev[y]?.[x] ?? 0;
  ctx.fillStyle = '#120c08';
  const eastOpen = !isWallish(map.tiles[y]?.[x + 1]);
  const top = project(x, y, 0);
  for (let i = 0; i < 3; i++) {
    const along = 4 + i * 4;
    const tt = (along + 0.5) / 16;
    if (eastOpen) px(ctx, top.x + along, top.y + 16 - 8 * tt - base - 7);
    else px(ctx, top.x - 16 + along, top.y + 8 + 8 * tt - base - 7);
  }
}

// ── camera ───────────────────────────────────────────────────────────────

const cam = { x: 0, y: 0, mapId: '' };
const LEAD: Record<Direction, Vec2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function updateCamera(map: GameMap, t: IsoTerrain, focus: Vec2, facing: Direction, view: IsoView): void {
  const lead = LEAD[facing];
  const aim = project(focus.x + 0.5 + lead.x * 0.8, focus.y + 0.5 + lead.y * 0.8, 0);
  let tx = aim.x - view.width / 2;
  let ty = aim.y - view.height * 0.5;
  const { minX, maxX, minY, maxY } = t.bounds;
  const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  tx = clamp(tx, minX - 20, maxX + 20 - view.width);
  ty = clamp(ty, minY - 12, maxY + 16 - view.height);
  if (cam.mapId !== map.id) {
    cam.mapId = map.id;
    cam.x = tx;
    cam.y = ty;
  }
  const ease = Math.min(1, view.dt * 6);
  cam.x += (tx - cam.x) * ease;
  cam.y += (ty - cam.y) * ease;
}

// ── light ────────────────────────────────────────────────────────────────

interface Shaft {
  x: number;
  y: number;
  w: number;
}

/** Daylight through the broken roof, landing on the floor at these tiles. */
const SHAFTS: Record<string, Shaft[]> = {
  temple1: [
    { x: 7.5, y: 1.2, w: 1.3 },
    { x: 4.2, y: 6.4, w: 0.9 },
    { x: 10.6, y: 7.2, w: 0.7 },
    { x: 7.5, y: 13.4, w: 1 },
  ],
};

function drawLight(ctx: CanvasRenderingContext2D, map: GameMap, t: IsoTerrain, time: number): void {
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, s] of (SHAFTS[map.id] ?? []).entries()) {
    const ground = project(s.x, s.y, elevAt(t, s.x - 0.5, s.y - 0.5));
    const breathe = 0.85 + 0.15 * Math.sin(time * 0.5 + i * 1.7);
    const rx = 15 * s.w;
    // The pool where it lands, in two steps of brightness: banded, not airbrushed.
    ctx.fillStyle = `rgba(255,190,110,${0.07 * breathe})`;
    ellipse(ctx, ground.x, ground.y, rx, rx / 2, true);
    ctx.fillStyle = `rgba(255,210,140,${0.07 * breathe})`;
    ellipse(ctx, ground.x, ground.y, rx * 0.55, rx * 0.27, true);
    // The shaft itself, slanting in from the upper left.
    const topX = ground.x - 40;
    const topY = ground.y - 150;
    const g = ctx.createLinearGradient(topX, topY, ground.x, ground.y);
    g.addColorStop(0, 'rgba(255,230,180,0)');
    g.addColorStop(0.55, `rgba(255,230,180,${0.05 * breathe})`);
    g.addColorStop(1, `rgba(255,220,160,${0.1 * breathe})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(topX - rx * 0.5, topY);
    ctx.lineTo(topX + rx * 0.5, topY);
    ctx.lineTo(ground.x + rx * 0.9, ground.y);
    ctx.lineTo(ground.x - rx * 0.9, ground.y);
    ctx.closePath();
    ctx.fill();
    // Dust turning slowly in the beam.
    ctx.fillStyle = 'rgba(255,240,205,0.55)';
    for (let m = 0; m < 7; m++) {
      const k = (time * 0.04 + m * 0.143 + i * 0.31) % 1;
      const mx = topX + (ground.x - topX) * k + Math.sin(time * 0.7 + m * 2.1) * rx * 0.5;
      const my = topY + (ground.y - topY) * k;
      if (k > 0.25) px(ctx, mx, my);
    }
  }
  // Candlelight: a warm, flickering pool around every candle stand.
  for (const d of map.dressing) {
    if (d.sprite !== 'candles') continue;
    const c = tileCenter(d.pos.x, d.pos.y, elevAt(t, d.pos.x, d.pos.y));
    const f = 1 + Math.sin(time * 9.1 + d.pos.x) * 0.06 + Math.sin(time * 23.7) * 0.04;
    ctx.fillStyle = 'rgba(255,140,50,0.05)';
    ellipse(ctx, c.x, c.y, 30 * f, 15 * f, true);
    ctx.fillStyle = 'rgba(255,160,70,0.06)';
    ellipse(ctx, c.x, c.y, 17 * f, 8.5 * f, true);
    ctx.fillStyle = 'rgba(255,190,100,0.08)';
    ellipse(ctx, c.x, c.y - 7, 5 * f, 5 * f, true);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ── screen-space finishing ───────────────────────────────────────────────

let vignette: { w: number; h: number; c: HTMLCanvasElement } | null = null;

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!vignette || vignette.w !== w || vignette.h !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const v = c.getContext('2d')!;
    const g = v.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.35, w / 2, h * 0.48, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(20,10,4,0)');
    g.addColorStop(1, 'rgba(20,10,4,0.55)');
    v.fillStyle = g;
    v.fillRect(0, 0, w, h);
    vignette = { w, h, c };
  }
  ctx.drawImage(vignette.c, 0, 0);
}

function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const b = fxView.banner();
  if (!b) return;
  const k = b.t / b.duration;
  const inK = Math.min(1, b.t / 0.35);
  const outK = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  const words = b.text.toUpperCase().replace(':', '\n').split('\n').map((s) => s.trim());
  const lineH = 10;
  const tw = Math.max(...words.map(textWidth)) + 16;
  const th = words.length * lineH + 6;
  const x = Math.round(w / 2 - tw / 2);
  const y = Math.round(h * 0.12 - (1 - inK) * 6);
  ctx.globalAlpha = Math.min(inK, outK);
  ctx.fillStyle = 'rgba(12,9,6,0.82)';
  ctx.fillRect(x, y, tw, th);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(x, y, tw, 1);
  ctx.fillRect(x, y + th - 1, tw, 1);
  words.forEach((word, i) => text(ctx, word, Math.round(w / 2 - textWidth(word) / 2), y + 4 + i * lineH, i === 0 && words.length > 1 ? '#d9a441' : '#f1e8d2'));
  ctx.globalAlpha = 1;
}

function drawIris(ctx: CanvasRenderingContext2D, w: number, h: number, focus: Vec2): void {
  const iris = fxView.iris();
  if (iris >= 1) return;
  const e = iris * iris * (3 - 2 * iris);
  const r = Math.hypot(w, h) * e;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(focus.x, focus.y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fill('evenodd');
}

// ── effects in iso ───────────────────────────────────────────────────────

function isoOfWorld(t: IsoTerrain, wx: number, wy: number, lift = 0): Vec2 {
  const gx = wx / T;
  const gy = wy / T;
  return project(gx, gy, elevAt(t, gx - 0.5, gy - 0.5) + lift);
}

function drawParticles(ctx: CanvasRenderingContext2D, t: IsoTerrain, glowOnly: boolean): void {
  for (const p of fxView.particles) {
    if (glowOnly !== !!p.glow) continue;
    let at: Vec2;
    if (p.ox !== undefined && p.oy !== undefined) {
      const o = isoOfWorld(t, p.ox, p.oy, 2);
      at = { x: o.x + (p.x - p.ox) * 0.5, y: o.y + (p.y - p.oy) * 0.5 };
    } else at = isoOfWorld(t, p.x, p.y, 14);
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
    ctx.fillStyle = p.color;
    const s = p.size >= 4 ? 2 : 1;
    ctx.fillRect(Math.round(at.x), Math.round(at.y), s, s);
  }
  ctx.globalAlpha = 1;
}

function drawStreaks(ctx: CanvasRenderingContext2D, t: IsoTerrain): void {
  ctx.fillStyle = 'rgba(255,232,190,0.95)';
  for (const s of fxView.streaks) {
    if (s.t < 0) continue;
    const k = Math.min(1, s.t / 0.12);
    const a = isoOfWorld(t, s.from.x, s.from.y, 7);
    const b = isoOfWorld(t, s.to.x, s.to.y, 7);
    const hx = a.x + (b.x - a.x) * k;
    const hy = a.y + (b.y - a.y) * k;
    line(ctx, hx - (b.x - a.x) * 0.15, hy - (b.y - a.y) * 0.15, hx, hy);
  }
}

function drawDigHole(ctx: CanvasRenderingContext2D, t: IsoTerrain): void {
  const d = fxView.dig();
  if (!d) return;
  const c = tileCenter(d.tile.x, d.tile.y, elevAt(t, d.tile.x, d.tile.y));
  ctx.fillStyle = d.soil;
  ellipse(ctx, c.x, c.y, 2 + d.progress * 7, 1 + d.progress * 3.5, true);
  ctx.fillStyle = '#140c06';
  ellipse(ctx, c.x, c.y + 1, d.progress * 4.5, d.progress * 2, true);
}

// ── the frame ────────────────────────────────────────────────────────────

let occCanvas: HTMLCanvasElement | null = null;

export function drawIsoFrame(ctx: CanvasRenderingContext2D, map: GameMap, state: GameState, view: IsoView): void {
  const t = terrainFor(map, state);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const ckElev = elevAt(t, view.pos.x, view.pos.y);
  updateCamera(map, t, view.pos, state.player.facing, view);
  const shake = fxView.shake();
  const sx = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
  const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
  const camX = Math.round(cam.x) - sx;
  const camY = Math.round(cam.y) - sy;

  ctx.fillStyle = PALETTES[map.region].bg;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(-camX, -camY);

  ctx.drawImage(t.floor, -t.ox, -t.oy);
  drawDigHole(ctx, t);

  // Exit chevrons, bobbing just above the threshold.
  const chev = chevron();
  for (const e of map.exits) {
    if (e.hidden) continue;
    const { x, y } = e.at;
    const dir = y === 0 ? 'up' : y === map.height - 1 ? 'down' : x === 0 ? 'left' : x === map.width - 1 ? 'right' : null;
    if (!dir) continue;
    const c = tileCenter(x, y, t.elev[y]![x]!);
    const bob = Math.round(Math.sin(view.time * 4) * 1.5);
    const flipX = dir === 'left' || dir === 'down';
    const flipY = dir === 'right' || dir === 'down';
    const v = LEAD[dir];
    ctx.save();
    ctx.translate(Math.round(c.x + (v.x - v.y) * bob * 2), Math.round(c.y - 4 + (v.x + v.y) * bob));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(chev, -2, -2);
    ctx.restore();
  }

  // ── depth-sorted world ──
  const drawables: Drawable[] = [];
  for (const w of t.walls) {
    const isDart = map.entities.some((e) => e.kind === 'trap' && e.trapType === 'dart' && e.pos.x === w.x && e.pos.y === w.y);
    drawables.push({
      depth: w.x + w.y + 1,
      layer: 0,
      box: [w.wx, w.wy, w.canvas.width, w.canvas.height],
      occludes: true,
      draw: (c) => {
        c.drawImage(w.canvas, w.wx, w.wy);
        if (isDart) dartHoles(c, map, t, w.x, w.y);
      },
    });
  }
  for (const w of t.spans) {
    // Overhead: drawn after anything standing on its own tile, so CK walks under it.
    drawables.push({ depth: w.x + w.y + 1, layer: 3, box: [w.wx, w.wy, w.canvas.width, w.canvas.height], occludes: true, draw: (c) => c.drawImage(w.canvas, w.wx, w.wy) });
  }
  for (const d of map.dressing) {
    const upright = d.solid || UPRIGHT_FLAT.has(d.sprite);
    if (!upright) continue;
    const elev = t.elev[d.pos.y]![d.pos.x]!;
    const b = billboard(propSprite(d.sprite), d.pos.x, d.pos.y, elev, 1, d.solid ? 12 : 0);
    if (!d.solid) b.occludes = false;
    if (d.sprite === 'candles') {
      const draw = b.draw;
      b.draw = (c) => {
        draw(c);
        // The flames move.
        const [bx, by] = b.box;
        c.fillStyle = Math.sin(view.time * 13 + d.pos.x) > 0 ? '#ffd27a' : '#ff9a3c';
        px(c, bx + 5, by + 4 + (Math.sin(view.time * 17) > 0.3 ? 1 : 0));
        px(c, bx + 10, by + 5 + (Math.sin(view.time * 11 + 1) > 0.3 ? 1 : 0));
      };
    }
    drawables.push(b);
  }
  for (const { entity, pos } of visibleEntities(map, state)) {
    const d = entityDrawable(map, state, t, entity, pos, view.time);
    if (d) drawables.push(d);
  }
  for (const p of plants) {
    const sprite = p.fern ? fern(Math.sin(view.time * 1.3 + p.phase) > 0.2 ? 1 : 0) : tuft(Math.sin(view.time * 1.6 + p.phase) > 0.3 ? 1 : 0);
    // Tucked toward the wall behind them.
    const c = project(p.x + 0.3, p.y + 0.3, t.elev[p.y]![p.x]!);
    const bx = Math.round(c.x - sprite.width / 2);
    const by = Math.round(c.y - sprite.height + 1);
    drawables.push({ depth: p.x + p.y + 0.6, layer: 0, box: [bx, by, sprite.width, sprite.height], occludes: false, draw: (cx) => cx.drawImage(sprite, bx, by) });
  }

  // CK.
  const lift = Math.round(view.hop * 12);
  const ground = project(view.pos.x + 0.5, view.pos.y + 0.5, ckElev);
  const pose = ckFrame({
    facing: state.player.facing,
    walking: view.walking,
    time: view.time,
    holding: fx.isHolding(),
    digging: fx.isDigging(),
    bristling: view.bristling,
    idle: view.idle,
  });
  const ckX = Math.round(ground.x - 8);
  const ckY = Math.round(ground.y - 14 - lift + pose.bob);
  const ckDepth = view.pos.x + view.pos.y + 1;
  const ck: Drawable = {
    depth: ckDepth,
    layer: 2,
    box: [ckX, ckY, 16, 16],
    occludes: false,
    draw: (c) => {
      const s = shadow(view.hop > 0 ? 10 : 12);
      c.drawImage(s, Math.round(ground.x - s.width / 2), Math.round(ground.y - s.height / 2 + 1));
      drawFrameAt(c, pose.sprite, ckX, ckY, pose.mirror);
      if (view.bristling && !fx.isHolding() && view.idle < NAP_AFTER) {
        c.fillStyle = '#b8662a';
        const tw = Math.floor(view.time * 6) % 2;
        px(c, ckX + 7, ckY + 2 + tw, 1, 2);
        px(c, ckX + 12, ckY + 2 + tw, 1, 2);
      }
    },
  };
  drawables.push(ck);
  drawables.sort((a, b) => a.depth - b.depth || a.layer - b.layer);

  const occluders: Drawable[] = [];
  let ckSeen = false;
  for (const d of drawables) {
    d.draw(ctx);
    if (d === ck) ckSeen = true;
    else if (ckSeen && d.occludes && overlaps(d.box, ck.box)) occluders.push(d);
  }

  drawStreaks(ctx, t);
  drawParticles(ctx, t, false);
  drawLight(ctx, map, t, view.time);

  // X-ray: wherever something stands in front of CK, CK shows through as a dithered silhouette.
  if (occluders.length) {
    occCanvas ??= document.createElement('canvas');
    occCanvas.width = 16;
    occCanvas.height = 16;
    const o = occCanvas.getContext('2d')!;
    o.imageSmoothingEnabled = false;
    o.save();
    o.translate(-ckX, -ckY);
    for (const d of occluders) d.draw(o);
    o.restore();
    o.globalCompositeOperation = 'source-in';
    drawFrameAt(o, pose.sprite, 0, 0, pose.mirror);
    o.fillStyle = '#ffe2a8';
    o.fillRect(0, 0, 16, 16);
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(checker(16, 16), (ckX + ckY) % 2 === 0 ? 0 : 1, 0);
    o.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(occCanvas, ckX, ckY);
    ctx.globalAlpha = 1;
  }

  // The collar: rings on the ground around CK, faster the closer, crisper the more squarely aimed.
  const reading = computeCollarReading(map, state);
  if (reading.kind) {
    const speed = 1.5 + reading.proximity * 7;
    const phase = (((view.time * speed) % 1) + 1) % 1;
    const color = reading.kind === 'mechanism' ? '231,76,60' : reading.junk ? '214,178,110' : '242,193,78';
    const clarity = 0.25 + reading.aim * 0.75;
    for (const offset of [0, 0.5]) {
      const p = (phase + offset) % 1;
      ctx.fillStyle = `rgba(${color},${(1 - p) * (0.2 + reading.strength * 0.65) * clarity})`;
      const r = 7 + p * (6 + reading.proximity * 12);
      ellipse(ctx, ground.x, ground.y + 1, r, r / 2, false);
    }
    if (reading.locked && reading.kind === 'buried') {
      const pulse = 0.5 + Math.sin(view.time * 12) * 0.5;
      ctx.fillStyle = `rgba(255,245,200,${0.45 + pulse * 0.45})`;
      ellipse(ctx, ground.x, ground.y + 1, 8, 4, false);
    }
  }

  // The marker over whatever Paw would touch.
  if (view.hop === 0 && !fx.isHolding() && !fx.isDigging()) {
    const aff = pawAffordance(MAPS, state);
    if (aff && aff.verb !== 'Sniff' && !(aff.at.x === state.player.pos.x && aff.at.y === state.player.pos.y)) {
      const m = marker(aff.fresh);
      const top = tileTopElev(t, map, aff.at.x, aff.at.y);
      const c = tileCenter(aff.at.x, aff.at.y, top);
      const tall = isWallish(map.tiles[aff.at.y]?.[aff.at.x]) ? 4 : 20;
      const bob = Math.round(Math.sin(view.time * 5) * 1.5);
      ctx.drawImage(m, Math.round(c.x - m.width / 2), Math.round(c.y - tall - m.height + bob));
    }
  }

  // Held up overhead: the find.
  const held = fx.heldSprite();
  if (held) {
    const rise = Math.min(1, held.progress * 5);
    const sprite = itemSprite(held.sprite);
    const hx = Math.round(ground.x - 8);
    const hy = Math.round(ckY - 13 - rise * 3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,230,150,0.22)';
    ellipse(ctx, hx + 8, hy + 8, 11, 11, true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sprite, hx, hy);
  }

  // Snoozing.
  if (view.idle >= NAP_AFTER && !held) {
    const asleep = view.idle - NAP_AFTER;
    for (let i = 0; i < 3; i++) {
      const age = asleep * 0.45 - i / 3;
      if (age < 0) continue;
      const k = age % 1;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.9;
      text(ctx, 'z', ckX + 13 + k * 6, ckY + 2 - k * 14, '#f4ead2', 'rgba(20,14,8,0.8)');
    }
    ctx.globalAlpha = 1;
  }

  // CK's thought bubble.
  const b = fx.bubbleInfo();
  if (b && b.progress * 8 >= 1) {
    const fade = b.progress > 0.8 ? 1 - (b.progress - 0.8) / 0.2 : 1;
    ctx.globalAlpha = fade;
    ctx.drawImage(bubble(b.char), ckX + 10, ckY - 10);
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx, t, true);
  ctx.restore();

  // The grade: old stone under late, warm light.
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255,170,90,0.32)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.globalCompositeOperation = 'source-over';

  drawVignette(ctx, view.width, view.height);
  drawOverlays(ctx, view.width, view.height);
  drawBanner(ctx, view.width, view.height);
  drawIris(ctx, view.width, view.height, { x: ground.x - camX, y: ground.y - 8 - camY });
}

function overlaps(a: Drawable['box'], b: Drawable['box']): boolean {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

/** Forget the camera so the next frame snaps to CK (a room change). */
export function snapIsoCamera(): void {
  cam.mapId = '';
}

