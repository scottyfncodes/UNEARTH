/**
 * The mew's echo. A ring of sound goes out from CK, and as it passes each
 * tile the room answers for a moment, drawn over the darkness on the same
 * pixel grid as everything else:
 *
 *   structure  pale blue: the edges of walls, the rims of pits
 *   crumble    pale blue, broken: loose stones, which rattle
 *   way        warm white: exits and cat-gaps, the ways through
 *   danger     red: a trap's mechanism, a strip, a loose ceiling
 *
 * Plain floor says nothing. Buried things say nothing either: that is the
 * collar's job, and the mew never does it for it.
 */
import type { GameMap, GameState, Vec2 } from '@/game/types';
import { key } from '@/game/types';
import { inBounds, isTrapDisarmed, mapStateOf, resolvedTerrainAt, trapLane } from '@/game/world';
import { TILE_SIZE as T } from './constants';

export type EchoKind = 'wall' | 'pit' | 'crumble' | 'way' | 'danger';

export interface EchoMark {
  x: number;
  y: number;
  kind: EchoKind;
  /** For walls and pit rims: which sides face open ground. */
  sides?: { up: boolean; down: boolean; left: boolean; right: boolean };
}

/** How far a mew carries, in tiles, and how fast its ring spreads. */
export const ECHO_REACH = 8;
const ECHO_SPEED = 10;
const ECHO_LINGER = 2.4;

const SIDES = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const;

/** Everything a mew from `origin` would hear back, within `reach` tiles. Pure. */
export function echoMarks(map: GameMap, state: GameState, origin: Vec2, reach = ECHO_REACH): EchoMark[] {
  const ms = mapStateOf(state, map.id);
  const terrain = (p: Vec2) => (inBounds(map, p) ? resolvedTerrainAt(map, ms, p) : null);
  const open = (p: Vec2) => {
    const t = terrain(p);
    return t !== null && t !== 'wall' && t !== 'hazard';
  };
  const marks: EchoMark[] = [];
  const near = (p: Vec2) => Math.hypot(p.x - origin.x, p.y - origin.y) <= reach;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const p = { x, y };
      if (!near(p)) continue;
      const t = terrain(p);
      if (t === 'wall' || t === 'hazard') {
        const facing = (d: Vec2) => open({ x: x + d.x, y: y + d.y });
        const sides = { up: facing(SIDES.up), down: facing(SIDES.down), left: facing(SIDES.left), right: facing(SIDES.right) };
        if (sides.up || sides.down || sides.left || sides.right) marks.push({ x, y, kind: t === 'wall' ? 'wall' : 'pit', sides });
      } else if (t === 'crumble') {
        marks.push({ x, y, kind: 'crumble' });
      } else if (t === 'exit' || t === 'catGap') {
        marks.push({ x, y, kind: 'way' });
      } else if (t === 'trigger') {
        marks.push({ x, y, kind: 'danger' });
      }
    }
  }

  // Trap mechanisms ring hollow: loose ceilings, spike floors.
  const seen = new Set(marks.filter((m) => m.kind === 'danger').map((m) => key(m)));
  for (const e of map.entities) {
    if (e.kind !== 'trap' || isTrapDisarmed(e, state)) continue;
    if (e.trapType !== 'fallingRock' && e.trapType !== 'spikes') continue;
    const tiles = e.trapType === 'spikes' ? trapLane(e) : (e.triggers ?? [e.pos]);
    for (const p of tiles) {
      if (!near(p) || seen.has(key(p))) continue;
      seen.add(key(p));
      marks.push({ x: p.x, y: p.y, kind: 'danger' });
    }
  }
  return marks;
}

// ── live echo ─────────────────────────────────────────────────────────────

interface LiveEcho {
  origin: Vec2;
  start: number;
  mapId: string;
  marks: (EchoMark & { dist: number })[];
}

let live: LiveEcho | null = null;

function now(): number {
  return performance.now() / 1000;
}

export function startEcho(map: GameMap, state: GameState): void {
  const origin = state.player.pos;
  live = {
    origin,
    start: now(),
    mapId: map.id,
    marks: echoMarks(map, state, origin).map((m) => ({ ...m, dist: Math.hypot(m.x - origin.x, m.y - origin.y) })),
  };
}

const COLORS: Record<EchoKind, string> = {
  wall: '170,205,255',
  pit: '170,205,255',
  crumble: '170,205,255',
  way: '255,236,200',
  danger: '231,76,60',
};

/** Drawn over the darkness, in world space. */
export function drawEcho(ctx: CanvasRenderingContext2D, map: GameMap): void {
  if (!live || live.mapId !== map.id) return;
  const t = now() - live.start;
  if (t > ECHO_REACH / ECHO_SPEED + ECHO_LINGER) {
    live = null;
    return;
  }
  const px = 2; // one sprite pixel
  const front = t * ECHO_SPEED;

  // The ring itself, faint, drawn as pixel dots so it sits on the grid.
  if (front < ECHO_REACH) {
    const cx = live.origin.x * T + T / 2;
    const cy = live.origin.y * T + T / 2;
    const r = front * T;
    const fade = 1 - front / ECHO_REACH;
    ctx.fillStyle = `rgba(170,205,255,${0.35 * fade})`;
    const dots = Math.max(24, Math.floor(r / 3));
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2;
      ctx.fillRect(Math.round((cx + Math.cos(a) * r) / px) * px, Math.round((cy + Math.sin(a) * r) / px) * px, px, px);
    }
  }

  for (const m of live.marks) {
    const since = t - m.dist / ECHO_SPEED;
    if (since < 0) continue;
    // A bright ping as the ring arrives, then a slow fade.
    const a = since < 0.12 ? 1 : Math.max(0, 1 - (since - 0.12) / ECHO_LINGER);
    if (a <= 0) continue;
    const x = m.x * T;
    const y = m.y * T;
    ctx.fillStyle = `rgba(${COLORS[m.kind]},${a * (m.kind === 'danger' ? 0.9 : 0.75)})`;
    switch (m.kind) {
      case 'wall':
      case 'pit': {
        const s = m.sides!;
        if (s.up) ctx.fillRect(x, y, T, px);
        if (s.down) ctx.fillRect(x, y + T - px, T, px);
        if (s.left) ctx.fillRect(x, y, px, T);
        if (s.right) ctx.fillRect(x + T - px, y, px, T);
        if (m.kind === 'pit') {
          // A pit's rim, then nothing: a short drop line just inside the edge.
          ctx.fillStyle = `rgba(${COLORS.pit},${a * 0.3})`;
          if (s.up) ctx.fillRect(x + px * 2, y + px * 3, T - px * 4, px);
          if (s.down) ctx.fillRect(x + px * 2, y + T - px * 4, T - px * 4, px);
          if (s.left) ctx.fillRect(x + px * 3, y + px * 2, px, T - px * 4);
          if (s.right) ctx.fillRect(x + T - px * 4, y + px * 2, px, T - px * 4);
        }
        break;
      }
      case 'crumble': {
        // A broken outline: the stone is there, just not for long.
        for (let i = 0; i < 4; i++) {
          const o = px * 2 + i * px * 3;
          ctx.fillRect(x + o, y + px * 2, px * 2, px);
          ctx.fillRect(x + o, y + T - px * 3, px * 2, px);
          ctx.fillRect(x + px * 2, y + o, px, px * 2);
          ctx.fillRect(x + T - px * 3, y + o, px, px * 2);
        }
        // and a crack across it
        ctx.fillRect(x + px * 6, y + px * 6, px, px);
        ctx.fillRect(x + px * 7, y + px * 7, px, px);
        ctx.fillRect(x + px * 8, y + px * 7, px, px);
        ctx.fillRect(x + px * 9, y + px * 8, px, px);
        break;
      }
      case 'way': {
        // An open arch.
        ctx.fillRect(x + px * 3, y + px * 4, px, T - px * 7);
        ctx.fillRect(x + T - px * 4, y + px * 4, px, T - px * 7);
        ctx.fillRect(x + px * 4, y + px * 3, T - px * 8, px);
        break;
      }
      case 'danger': {
        // A small X: whatever is here goes off.
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(x + px * (5 + i), y + px * (5 + i), px, px);
          ctx.fillRect(x + px * (10 - i), y + px * (5 + i), px, px);
        }
        break;
      }
    }
  }
}
