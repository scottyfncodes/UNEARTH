/**
 * The excavation pit.
 *
 * Dirt is drawn by masking a real soil texture with the excavation grid, so
 * removing dirt removes *texture*, not a progress bar. Debris is a second
 * masked layer of stone. The object underneath is the same renderer the
 * journal uses.
 */
import type { ExcavationState } from '@/systems/excavation';
import { drawFind } from './object';
import { hexA, makeCanvas, soilTile, stoneTile } from './textures';

export interface PitParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'dirt' | 'dust' | 'spark';
}

export interface PitView {
  state: ExcavationState;
  /** Tool position in normalised pit space, or null when not touching. */
  toolX: number | null;
  toolY: number | null;
  toolRadius: number;
  toolKind: 'scoop' | 'brush' | 'pick' | 'pinpointer';
  particles: PitParticle[];
  time: number;
  /** 0..1 red flash after a strike. */
  damageFlash: number;
  /** Pinpointer heat reading 0..1, or null when not owned/off. */
  heat: number | null;
  shake: number;
}

export class PitRenderer {
  private soil = makeCanvas(1, 1);
  private stone = makeCanvas(1, 1);
  private soilReady = false;
  private mask: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private layer: HTMLCanvasElement | null = null;
  private layerSize = 0;

  private ensure(state: ExcavationState, size: number): void {
    if (!this.soilReady) {
      this.soil = soilTile(256, 21, '#4a3527');
      this.stone = stoneTile(192, 55);
      this.soilReady = true;
    }
    if (!this.mask || this.mask.width !== state.cols) {
      this.mask = makeCanvas(state.cols, state.rows);
      this.maskCtx = this.mask.getContext('2d');
    }
    const target = Math.max(64, Math.round(size));
    if (!this.layer || this.layerSize !== target) {
      this.layer = makeCanvas(target, target);
      this.layerSize = target;
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, view: PitView): void {
    const state = view.state;
    const size = Math.min(w - 24, h - 24);
    this.ensure(state, size * 2);

    const px = (w - size) / 2 + (view.shake ? (Math.random() - 0.5) * view.shake : 0);
    const py = (h - size) / 2 + (view.shake ? (Math.random() - 0.5) * view.shake : 0);

    ctx.clearRect(0, 0, w, h);

    // ── surrounding ground and pit wall ──────────────────────────────────
    ctx.fillStyle = '#15100c';
    ctx.fillRect(0, 0, w, h);

    const wallGrad = ctx.createRadialGradient(
      px + size / 2,
      py + size / 2,
      size * 0.3,
      px + size / 2,
      py + size / 2,
      size * 0.78,
    );
    wallGrad.addColorStop(0, '#3a281c');
    wallGrad.addColorStop(1, '#0d0906');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // ── pit floor ────────────────────────────────────────────────────────
    ctx.save();
    const clip = new Path2D();
    clip.roundRect(px, py, size, size, size * 0.06);
    ctx.clip(clip);

    // Bare floor beneath everything: darker, damper soil.
    ctx.fillStyle = '#241a12';
    ctx.fillRect(px, py, size, size);
    const floorPattern = ctx.createPattern(this.soil, 'repeat');
    if (floorPattern) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = floorPattern;
      ctx.fillRect(px, py, size, size);
      ctx.globalAlpha = 1;
    }
    // Damp shading towards the middle so the hole has depth.
    const depthShade = ctx.createRadialGradient(
      px + size / 2,
      py + size / 2,
      size * 0.05,
      px + size / 2,
      py + size / 2,
      size * 0.62,
    );
    depthShade.addColorStop(0, 'rgba(0,0,0,0.45)');
    depthShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = depthShade;
    ctx.fillRect(px, py, size, size);

    // ── the object ───────────────────────────────────────────────────────
    if (state.hasObject) {
      const cx = px + state.centerX * size;
      const cy = py + state.centerY * size;
      const radius = state.scale * size;
      // Still-buried objects are muddier; exposure cleans them up.
      const soiling = Math.max(0, 0.55 - state.exposed * 0.55);
      drawFind(ctx, state.silhouetteId, cx, cy, radius, {
        soiling,
        condition: state.condition,
        time: view.time,
      });

      // An edge catching the light is the game's "you're close" tell.
      if (state.exposed > 0.08 && state.exposed < 0.95) {
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(view.time * 2.2));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.5);
        g.addColorStop(0, hexA('#ffe3a8', 0.1 * pulse * state.exposed));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px, py, size, size);
        ctx.restore();
      }
    }

    // ── dirt layer ───────────────────────────────────────────────────────
    this.drawMaskedLayer(ctx, state.dirt, 1.3, this.soil, px, py, size, 0.98);
    // ── debris layer ─────────────────────────────────────────────────────
    this.drawMaskedLayer(ctx, state.debris, 1, this.stone, px, py, size, 0.95);

    // ── particles ────────────────────────────────────────────────────────
    for (const p of view.particles) {
      const t = 1 - p.life / p.maxLife;
      const x = px + p.x * size;
      const y = py + p.y * size;
      ctx.globalAlpha = Math.max(0, 1 - t) * (p.kind === 'dust' ? 0.4 : 0.85);
      ctx.fillStyle =
        p.kind === 'spark' ? '#ffe9b0' : p.kind === 'dust' ? '#a08a70' : '#4b3524';
      ctx.beginPath();
      ctx.arc(x, y, p.size * size * 0.01 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── tool cursor ──────────────────────────────────────────────────────
    if (view.toolX !== null && view.toolY !== null) {
      const tx = px + view.toolX * size;
      const ty = py + view.toolY * size;
      const r = (view.toolRadius / 320) * size;
      ctx.strokeStyle =
        view.toolKind === 'brush' ? 'rgba(233,226,208,0.55)' : 'rgba(255,190,140,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(tx, ty, r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── pinpointer heat ──────────────────────────────────────────────────
    if (view.heat !== null && view.toolX !== null && view.toolY !== null && view.heat > 0.02) {
      const tx = px + view.toolX * size;
      const ty = py + view.toolY * size;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 46);
      g.addColorStop(0, hexA('#ff9d4d', 0.28 * view.heat));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tx, ty, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // ── pit rim ──────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(px - 3, py - 3, size + 6, size + 6, size * 0.07);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,120,90,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, size, size, size * 0.06);
    ctx.stroke();

    // ── damage flash ─────────────────────────────────────────────────────
    if (view.damageFlash > 0.01) {
      ctx.fillStyle = hexA('#c0392b', view.damageFlash * 0.3);
      ctx.fillRect(0, 0, w, h);
    }

    // Vignette to keep attention in the hole.
    const vig = ctx.createRadialGradient(w / 2, h / 2, size * 0.42, w / 2, h / 2, size * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Paints `texture` through a mask built from a cell grid. The grid is drawn
   * at cell resolution and scaled up with smoothing, which gives soft organic
   * edges for free.
   */
  private drawMaskedLayer(
    ctx: CanvasRenderingContext2D,
    grid: Float32Array,
    fullValue: number,
    texture: HTMLCanvasElement,
    px: number,
    py: number,
    size: number,
    maxAlpha: number,
  ): void {
    if (!this.mask || !this.maskCtx || !this.layer) return;
    const cols = this.mask.width;
    const rows = this.mask.height;
    const img = this.maskCtx.createImageData(cols, rows);
    let any = false;
    for (let i = 0; i < grid.length; i++) {
      const v = Math.min(1, Math.max(0, grid[i]! / fullValue));
      const alpha = v <= 0.001 ? 0 : Math.min(255, Math.round(Math.pow(v, 0.7) * 255 * maxAlpha));
      if (alpha > 0) any = true;
      const o = i * 4;
      // Thicker dirt is lighter here; used as a shading hint below.
      const shade = Math.round(120 + v * 135);
      img.data[o] = shade;
      img.data[o + 1] = shade;
      img.data[o + 2] = shade;
      img.data[o + 3] = alpha;
    }
    if (!any) return;
    this.maskCtx.putImageData(img, 0, 0);

    const layerCtx = this.layer.getContext('2d');
    if (!layerCtx) return;
    const ls = this.layer.width;
    layerCtx.clearRect(0, 0, ls, ls);
    const pattern = layerCtx.createPattern(texture, 'repeat');
    if (pattern) {
      layerCtx.fillStyle = pattern;
      layerCtx.fillRect(0, 0, ls, ls);
    }
    // Shade the texture by mask brightness so mounded dirt reads as thicker.
    layerCtx.globalCompositeOperation = 'multiply';
    layerCtx.imageSmoothingEnabled = true;
    layerCtx.drawImage(this.mask, 0, 0, ls, ls);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.drawImage(this.mask, 0, 0, ls, ls);
    layerCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(this.layer, px, py, size, size);
  }
}

export function spawnParticles(
  list: PitParticle[],
  x: number,
  y: number,
  count: number,
  kind: PitParticle['kind'],
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = kind === 'spark' ? 0.28 + Math.random() * 0.4 : 0.08 + Math.random() * 0.3;
    list.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 0.06,
      life: 0,
      maxLife: kind === 'dust' ? 0.7 : 0.45,
      size: kind === 'dust' ? 2 + Math.random() * 3 : 1 + Math.random() * 2.2,
      kind,
    });
  }
  if (list.length > 200) list.splice(0, list.length - 200);
}

export function stepParticles(list: PitParticle[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life += dt;
    if (p.life >= p.maxLife) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += dt * 0.55;
    p.vx *= 0.92;
  }
}
