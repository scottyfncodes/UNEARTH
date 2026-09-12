/**
 * The detecting view: a close, slightly cinematic top-down of the ground with
 * the player and the sweeping coil. Everything the player needs to read the
 * signal is drawn here rather than in UI chrome — the ring around the coil is
 * the meter.
 */
import { mulberry32 } from '@/core/rng';
import type { GroundPalette, LocationDef } from '@/core/types';
import type { ToneClass } from '@/systems/detection';
import { groundTile, hexA, makeCanvas } from './textures';

export interface Pulse {
  x: number;
  y: number;
  /** Seconds since spawn. */
  age: number;
  strength: number;
}

export interface WorldView {
  location: LocationDef;
  playerX: number;
  playerY: number;
  facing: number;
  coilX: number;
  coilY: number;
  /** Recent coil positions, oldest first, for the sweep trail. */
  trail: { x: number; y: number }[];
  signal: number;
  tone: ToneClass;
  pinpointing: boolean;
  pulses: Pulse[];
  holes: { x: number; y: number; found: boolean }[];
  elapsed: number;
  /** Screen shake amplitude in cm. */
  shake: number;
  /** The spot the player pinpointed, which is where DIG will dig. */
  mark: { x: number; y: number; age: number; life: number } | null;
}

const TONE_COLOR: Record<ToneClass, string> = {
  iron: '#b4683c',
  mid: '#d9a441',
  high: '#8fd3d8',
  odd: '#b98cd9',
};

interface ScatterItem {
  x: number;
  y: number;
  r: number;
  rot: number;
  kind: number;
}

/** Large, soft ground patches drawn in world space. */
interface PatchItem {
  x: number;
  y: number;
  r: number;
  tone: number;
}

export class WorldRenderer {
  private tile: HTMLCanvasElement | null = null;
  private tilePattern: CanvasPattern | null = null;
  private tileKey = '';
  private scatter: ScatterItem[] = [];
  private patches: PatchItem[] = [];
  private scatterKey = '';
  private grain: HTMLCanvasElement | null = null;

  private ensureAssets(ctx: CanvasRenderingContext2D, location: LocationDef): void {
    if (this.tileKey !== location.id || !this.tilePattern) {
      this.tile = groundTile(location.ground, 256, hash(location.id));
      this.tilePattern = ctx.createPattern(this.tile, 'repeat');
      this.tileKey = location.id;
    }
    if (this.scatterKey !== location.id) {
      this.scatter = buildScatter(location);
      this.patches = buildPatches(location);
      this.scatterKey = location.id;
    }
    if (!this.grain) this.grain = grainTile();
  }

  /**
   * @param w  CSS width
   * @param h  CSS height
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, view: WorldView): void {
    this.ensureAssets(ctx, view.location);
    const palette = view.location.ground;

    // Zoom: ~310cm of ground across the short edge. Close enough that the
    // figure, the coil and the sweep all read clearly on a phone screen.
    const scale = w / 310;
    const shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    const shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    // The player sits below centre so there is more ground ahead than behind.
    const camX = view.playerX + shakeX;
    const camY = view.playerY - 40 / scale + shakeY;
    const originX = w / 2 - camX * scale;
    const originY = h * 0.5 - camY * scale;

    const toScreen = (x: number, y: number): [number, number] => [
      originX + x * scale,
      originY + y * scale,
    ];

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // ── ground ───────────────────────────────────────────────────────────
    ctx.fillStyle = palette.haze;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    if (this.tilePattern) {
      ctx.fillStyle = this.tilePattern;
      ctx.save();
      // Pattern space is in tile pixels; map it onto world centimetres.
      const tileCm = 210;
      ctx.scale(tileCm / 256, tileCm / 256);
      ctx.fillRect(
        ((camX - w / scale) * 256) / tileCm,
        ((camY - h / scale) * 256) / tileCm,
        ((w * 2) / scale) * (256 / tileCm),
        ((h * 2) / scale) * (256 / tileCm),
      );
      ctx.restore();
    }
    ctx.restore();

    // ── beyond the plot: haze ────────────────────────────────────────────
    const [bx, by] = toScreen(0, 0);
    const bw = view.location.bounds.w * scale;
    const bh = view.location.bounds.h * scale;
    ctx.save();
    ctx.fillStyle = hexA(palette.haze, 0.88);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(bx, by, bw, bh);
    ctx.fill('evenodd');
    // A soft lip where the workable ground ends.
    const edge = ctx.createLinearGradient(bx, by, bx, by + 90);
    edge.addColorStop(0, hexA(palette.haze, 0.55));
    edge.addColorStop(1, hexA(palette.haze, 0));
    ctx.fillStyle = edge;
    ctx.fillRect(bx, by, bw, 90);
    ctx.restore();

    // ── scatter detail ───────────────────────────────────────────────────
    const viewPadCm = 60;
    const minX = camX - w / 2 / scale - viewPadCm;
    const maxX = camX + w / 2 / scale + viewPadCm;
    const minY = camY - h / 2 / scale - viewPadCm;
    const maxY = camY + h / 2 / scale + viewPadCm;

    for (const patch of this.patches) {
      if (
        patch.x + patch.r < minX ||
        patch.x - patch.r > maxX ||
        patch.y + patch.r < minY ||
        patch.y - patch.r > maxY
      ) {
        continue;
      }
      const [sx, sy] = toScreen(patch.x, patch.y);
      const r = patch.r * scale;
      const tone = patch.tone < 0.34 ? palette.base : patch.tone < 0.67 ? palette.mid : palette.light;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, hexA(tone, 0.3));
      g.addColorStop(1, hexA(tone, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const item of this.scatter) {
      if (item.x < minX || item.x > maxX || item.y < minY || item.y > maxY) continue;
      const [sx, sy] = toScreen(item.x, item.y);
      drawScatter(ctx, sx, sy, item, scale, palette);
    }

    // ── holes already dug ────────────────────────────────────────────────
    for (const hole of view.holes) {
      if (hole.x < minX || hole.x > maxX || hole.y < minY || hole.y > maxY) continue;
      const [sx, sy] = toScreen(hole.x, hole.y);
      drawHole(ctx, sx, sy, 17 * scale, hole.found);
    }

    // ── signal pulses ────────────────────────────────────────────────────
    const toneColor = TONE_COLOR[view.tone];
    for (const pulse of view.pulses) {
      const [sx, sy] = toScreen(pulse.x, pulse.y);
      const life = Math.min(1, pulse.age / 0.85);
      const radius = (12 + life * 78) * scale * (0.6 + pulse.strength * 0.8);
      ctx.strokeStyle = hexA(toneColor, (1 - life) * 0.34 * (0.4 + pulse.strength));
      ctx.lineWidth = Math.max(1, (2.6 - life * 2) * scale * 1.4);
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── coil hotspot ─────────────────────────────────────────────────────
    const [coilSx, coilSy] = toScreen(view.coilX, view.coilY);
    if (view.signal > 0.03) {
      const glow = ctx.createRadialGradient(coilSx, coilSy, 0, coilSx, coilSy, 70 * scale);
      glow.addColorStop(0, hexA(toneColor, 0.05 + view.signal * 0.4));
      glow.addColorStop(0.55, hexA(toneColor, view.signal * 0.1));
      glow.addColorStop(1, hexA(toneColor, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(coilSx, coilSy, 70 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── sweep trail ──────────────────────────────────────────────────────
    if (view.trail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < view.trail.length; i++) {
        const a = view.trail[i - 1]!;
        const b = view.trail[i]!;
        const t = i / view.trail.length;
        const [ax, ay] = toScreen(a.x, a.y);
        const [bx2, by2] = toScreen(b.x, b.y);
        ctx.strokeStyle = hexA('#e9e2d0', 0.028 * t);
        ctx.lineWidth = 9 * scale * t;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx2, by2);
        ctx.stroke();
      }
    }

    // ── pinpoint mark ────────────────────────────────────────────────────
    if (view.mark) {
      const [mx, my] = toScreen(view.mark.x, view.mark.y);
      const fade = 1 - Math.min(1, view.mark.age / view.mark.life);
      const r = 15 * scale;
      ctx.save();
      ctx.globalAlpha = 0.35 + fade * 0.55;
      ctx.strokeStyle = '#e9e2d0';
      ctx.lineWidth = 1.6 * scale;
      ctx.setLineDash([4 * scale, 4 * scale]);
      ctx.beginPath();
      ctx.ellipse(mx, my, r, r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA(toneColor, 0.9);
      ctx.lineWidth = 2 * scale;
      const tick = 6 * scale;
      ctx.beginPath();
      ctx.moveTo(mx - tick, my);
      ctx.lineTo(mx + tick, my);
      ctx.moveTo(mx, my - tick);
      ctx.lineTo(mx, my + tick);
      ctx.stroke();
      ctx.restore();
    }

    // ── player + detector ────────────────────────────────────────────────
    const [px, py] = toScreen(view.playerX, view.playerY);
    drawPlayer(ctx, px, py, coilSx, coilSy, view, scale, toneColor);

    // ── framing ──────────────────────────────────────────────────────────
    const vig = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.22, w / 2, h * 0.52, h * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, hexA(palette.haze, 0.7));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    if (this.grain) {
      ctx.globalAlpha = 0.05;
      const pattern = ctx.createPattern(this.grain, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
    }

    // Scrims so the thin UI at top and bottom stays readable over any ground.
    const topScrim = ctx.createLinearGradient(0, 0, 0, 120);
    topScrim.addColorStop(0, 'rgba(8,10,9,0.72)');
    topScrim.addColorStop(1, 'rgba(8,10,9,0)');
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, w, 120);

    const bottomScrim = ctx.createLinearGradient(0, h - 170, 0, h);
    bottomScrim.addColorStop(0, 'rgba(8,10,9,0)');
    bottomScrim.addColorStop(1, 'rgba(8,10,9,0.8)');
    ctx.fillStyle = bottomScrim;
    ctx.fillRect(0, h - 170, w, 170);

    ctx.restore();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  coilX: number,
  coilY: number,
  view: WorldView,
  scale: number,
  toneColor: string,
): void {
  const bodyR = 26 * scale;

  // Shadow, offset away from the light and soft at the edge.
  const shadow = ctx.createRadialGradient(
    px + 4 * scale,
    py + 6 * scale,
    bodyR * 0.2,
    px + 4 * scale,
    py + 6 * scale,
    bodyR * 1.15,
  );
  shadow.addColorStop(0, 'rgba(0,0,0,0.4)');
  shadow.addColorStop(0.65, 'rgba(0,0,0,0.22)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(px + 4 * scale, py + 6 * scale, bodyR * 1.15, bodyR * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Detector shaft, from the hands out to the coil.
  const gripX = px + Math.cos(view.facing) * bodyR * 0.75;
  const gripY = py + Math.sin(view.facing) * bodyR * 0.75;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 6.5 * scale;
  ctx.beginPath();
  ctx.moveTo(gripX, gripY + 2.5 * scale);
  ctx.lineTo(coilX, coilY + 2.5 * scale);
  ctx.stroke();
  const shaft = ctx.createLinearGradient(gripX, gripY, coilX, coilY);
  shaft.addColorStop(0, '#d8d0be');
  shaft.addColorStop(1, '#9a9282');
  ctx.strokeStyle = shaft;
  ctx.lineWidth = 4.6 * scale;
  ctx.beginPath();
  ctx.moveTo(gripX, gripY);
  ctx.lineTo(coilX, coilY);
  ctx.stroke();

  // Coil: an open ring seen at a shallow angle.
  const coilR = 19 * scale;
  ctx.save();
  ctx.translate(coilX, coilY);
  ctx.rotate(view.facing + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(2.5 * scale, 4 * scale, coilR * 1.04, coilR * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body of the coil housing.
  const housing = ctx.createLinearGradient(-coilR, -coilR * 0.5, coilR, coilR * 0.5);
  housing.addColorStop(0, '#20241f');
  housing.addColorStop(0.45, '#5d6459');
  housing.addColorStop(1, '#171a16');
  ctx.strokeStyle = housing;
  ctx.lineWidth = coilR * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, coilR * 0.86, coilR * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Search-plate face inside the ring.
  ctx.fillStyle = 'rgba(24,28,23,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, coilR * 0.74, coilR * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(233,226,208,0.18)';
  ctx.lineWidth = 1.1 * scale;
  ctx.beginPath();
  ctx.ellipse(0, -coilR * 0.06, coilR * 0.74, coilR * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Strength ring — this is the signal meter. Below a whisper it is not drawn
  // at all, so a stray tick of colour never sits on the coil.
  if (view.signal > 0.06) {
    ctx.strokeStyle = hexA(toneColor, 0.9);
    ctx.lineWidth = 3.4 * scale;
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      coilR * 1.22,
      coilR * 0.74,
      0,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * view.signal,
    );
    ctx.stroke();
    if (view.signal > 0.55) {
      ctx.strokeStyle = hexA(toneColor, (view.signal - 0.55) * 0.8);
      ctx.lineWidth = 8 * scale;
      ctx.beginPath();
      ctx.ellipse(0, 0, coilR * 1.22, coilR * 0.74, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Figure, seen from above: shoulders, one arm on the shaft, head and hat.
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(view.facing);

  // Shoulders / jacket
  const jacket = ctx.createLinearGradient(-bodyR * 0.6, -bodyR, bodyR * 0.6, bodyR);
  jacket.addColorStop(0, '#4a5540');
  jacket.addColorStop(0.55, '#38442f');
  jacket.addColorStop(1, '#212a1d');
  ctx.fillStyle = jacket;
  ctx.beginPath();
  // Shoulders are wider across than front-to-back, seen from above.
  ctx.ellipse(0, 0, bodyR * 0.62, bodyR * 0.98, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2 * scale;
  ctx.stroke();

  // Pack on the back
  ctx.fillStyle = '#6b5539';
  ctx.beginPath();
  ctx.roundRect(-bodyR * 0.62, -bodyR * 0.42, bodyR * 0.55, bodyR * 0.84, 4 * scale);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(-bodyR * 0.62, -bodyR * 0.06, bodyR * 0.55, bodyR * 0.1, 2 * scale);
  ctx.fill();

  // Forward arm reaching to the grip
  ctx.strokeStyle = '#42502f';
  ctx.lineWidth = bodyR * 0.3;
  ctx.beginPath();
  ctx.moveTo(bodyR * 0.1, bodyR * 0.3);
  ctx.lineTo(bodyR * 0.72, bodyR * 0.12);
  ctx.stroke();

  // Hat: brim, then crown, so the figure reads as a person from above.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(bodyR * 0.14, bodyR * 0.04, bodyR * 0.46, bodyR * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  const brim = ctx.createRadialGradient(bodyR * 0.04, -bodyR * 0.16, bodyR * 0.04, bodyR * 0.12, 0, bodyR * 0.44);
  brim.addColorStop(0, '#9c8a66');
  brim.addColorStop(1, '#5f5238');
  ctx.fillStyle = brim;
  ctx.beginPath();
  ctx.ellipse(bodyR * 0.12, 0, bodyR * 0.42, bodyR * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,24,16,0.55)';
  ctx.lineWidth = 1.1 * scale;
  ctx.stroke();
  const crown = ctx.createRadialGradient(bodyR * 0.04, -bodyR * 0.1, bodyR * 0.02, bodyR * 0.12, 0, bodyR * 0.26);
  crown.addColorStop(0, '#8b7a58');
  crown.addColorStop(1, '#4c4230');
  ctx.fillStyle = crown;
  ctx.beginPath();
  ctx.ellipse(bodyR * 0.12, 0, bodyR * 0.24, bodyR * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (view.pinpointing) {
    ctx.strokeStyle = hexA('#e9e2d0', 0.5);
    ctx.lineWidth = 1.3;
    const cross = 20 * scale;
    ctx.beginPath();
    ctx.moveTo(coilX - cross, coilY);
    ctx.lineTo(coilX + cross, coilY);
    ctx.moveTo(coilX, coilY - cross);
    ctx.lineTo(coilX, coilY + cross);
    ctx.stroke();
  }
}

function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, found: boolean): void {
  ctx.save();
  // Loose spoil beside the hole
  ctx.fillStyle = 'rgba(70, 52, 36, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.7, y + r * 0.45, r * 0.85, r * 0.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(12,9,7,0.95)');
  g.addColorStop(0.7, 'rgba(34,25,18,0.9)');
  g.addColorStop(1, 'rgba(48,36,26,0.5)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  if (found) {
    ctx.strokeStyle = 'rgba(217,164,65,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.1, r * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  item: ScatterItem,
  scale: number,
  palette: GroundPalette,
): void {
  const r = item.r * scale;
  if (palette.scatter === 'grass') {
    if (item.kind === 0) {
      // A tuft: several fine blades of slightly different length and lean.
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.9 * scale;
      for (let i = -2; i <= 2; i++) {
        const lean = Math.cos(item.rot + i) * 0.45;
        const height = r * (0.65 + Math.abs(Math.sin(item.rot * 2 + i)) * 0.7);
        ctx.strokeStyle = hexA(i % 2 === 0 ? palette.detail : palette.light, 0.3);
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.22, y);
        ctx.quadraticCurveTo(
          x + i * r * 0.26 + lean * r * 0.3,
          y - height * 0.6,
          x + i * r * 0.3 + lean * r * 0.8,
          y - height,
        );
        ctx.stroke();
      }
    } else if (item.kind === 1) {
      ctx.fillStyle = hexA(palette.base, 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r * 0.85, item.rot, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = hexA('#c9b48d', 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.5, r * 0.34, item.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (palette.scatter === 'gravel') {
    if (item.kind === 0) {
      ctx.fillStyle = hexA(palette.detail, 0.5);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.7, r * 0.5, item.rot, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 1) {
      // Rotted sleeper
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(item.rot * 0.2);
      ctx.fillStyle = 'rgba(44,33,24,0.6)';
      ctx.fillRect(-r * 3.4, -r * 0.7, r * 6.8, r * 1.4);
      ctx.fillStyle = 'rgba(90,72,54,0.32)';
      ctx.fillRect(-r * 3.4, -r * 0.7, r * 6.8, r * 0.35);
      ctx.restore();
    } else {
      ctx.fillStyle = hexA('#1d1815', 0.35);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.9, item.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // rubble
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(item.rot);
  ctx.fillStyle = item.kind === 0 ? hexA(palette.detail, 0.5) : hexA('#15110f', 0.45);
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.5);
  ctx.lineTo(r * 0.3, -r);
  ctx.lineTo(r, r * 0.3);
  ctx.lineTo(-r * 0.4, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function buildScatter(location: LocationDef): ScatterItem[] {
  const rng = mulberry32(hash(location.id) ^ 0x9e37);
  const density = location.ground.scatter === 'grass' ? 1100 : 800;
  const items: ScatterItem[] = [];
  for (let i = 0; i < density; i++) {
    items.push({
      x: rng() * location.bounds.w,
      y: rng() * location.bounds.h,
      r: 3 + rng() * 7,
      rot: rng() * Math.PI * 2,
      kind: Math.floor(rng() * 3),
    });
  }
  return items;
}

function buildPatches(location: LocationDef): PatchItem[] {
  const rng = mulberry32(hash(location.id) ^ 0x51ee7);
  const items: PatchItem[] = [];
  for (let i = 0; i < 90; i++) {
    items.push({
      x: rng() * location.bounds.w,
      y: rng() * location.bounds.h,
      r: 90 + rng() * 190,
      tone: rng(),
    });
  }
  return items;
}

function grainTile(): HTMLCanvasElement {
  const size = 96;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 40;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
