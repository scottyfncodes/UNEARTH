/**
 * The mechanism plate: stone, clamps, dust, and the artifact in its jaws.
 * Rendering only — all state lives in systems/mechanism.ts.
 */
import type { MechanismState } from '@/systems/mechanism';
import { drawFind } from './object';
import { hexA, makeCanvas, soilTile, stoneTile } from './textures';

export interface MechanismView {
  state: MechanismState;
  time: number;
  shake: number;
  /** 0..1 flash after a mistake. */
  flash: number;
  /** Which clamp the finger is on, for the hold ring. */
  activeClamp: string | null;
  collapseProgress: number;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export class MechanismRenderer {
  private stone = makeCanvas(1, 1);
  private dustTile = makeCanvas(1, 1);
  private ready = false;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, view: MechanismView): void {
    if (!this.ready) {
      this.stone = stoneTile(192, 91);
      this.dustTile = soilTile(256, 33, '#5a4a3a');
      this.ready = true;
    }
    const state = view.state;
    const plate = Math.min(w - 20, h - 20);
    const cx = w / 2 + (view.shake ? (Math.random() - 0.5) * view.shake : 0);
    const cy = h / 2 + (view.shake ? (Math.random() - 0.5) * view.shake : 0);
    const R = plate * 0.44;

    ctx.clearRect(0, 0, w, h);

    // Chamber floor
    ctx.fillStyle = '#0a0808';
    ctx.fillRect(0, 0, w, h);
    const pattern = ctx.createPattern(this.stone, 'repeat');
    if (pattern) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    const floorShade = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, Math.max(w, h) * 0.7);
    floorShade.addColorStop(0, 'rgba(0,0,0,0)');
    floorShade.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = floorShade;
    ctx.fillRect(0, 0, w, h);

    // Pressure rim
    ctx.save();
    ctx.lineWidth = R * 0.16;
    ctx.strokeStyle = '#2b2420';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = R * 0.03;
    ctx.strokeStyle = hexA('#c0392b', 0.18 + (state.tension / 100) * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Plate
    const plateGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    plateGrad.addColorStop(0, '#4a4038');
    plateGrad.addColorStop(1, '#1c1816');
    ctx.fillStyle = plateGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
    ctx.fill();

    // Inscription ring — legible only once brushed
    const legibility = 1 - state.dust;
    if (legibility > 0.02) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(R * 0.2)}px 'Iowan Old Style', Georgia, serif`;
      for (const clamp of state.clamps) {
        const a = (clamp.angle * Math.PI) / 180;
        // Inside the clamp hotspots so a thumb never covers the order.
        const tx = cx + Math.cos(a) * R * 0.56;
        const ty = cy + Math.sin(a) * R * 0.56;
        ctx.fillStyle = hexA('#000000', legibility * 0.5);
        ctx.fillText(ROMAN[clamp.order] ?? '?', tx + R * 0.012, ty + R * 0.012);
        ctx.fillStyle = hexA('#f2e2b4', legibility);
        ctx.fillText(ROMAN[clamp.order] ?? '?', tx, ty);
      }
      ctx.restore();
    }

    // Clamp arms
    for (const clamp of state.clamps) {
      const a = (clamp.angle * Math.PI) / 180;
      const retract = clamp.released ? 1 : 0;
      const inner = R * (0.36 + retract * 0.3);
      const outer = R * (0.86 + retract * 0.06);
      const x1 = cx + Math.cos(a) * inner;
      const y1 = cy + Math.sin(a) * inner;
      const x2 = cx + Math.cos(a) * outer;
      const y2 = cy + Math.sin(a) * outer;

      ctx.lineCap = 'round';
      ctx.strokeStyle = clamp.released ? '#4f5a57' : '#8d9a95';
      ctx.lineWidth = R * 0.11;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = R * 0.03;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Jaw at the artifact end
      ctx.fillStyle = clamp.released ? '#3c4643' : '#b6c4be';
      ctx.beginPath();
      ctx.arc(x1, y1, R * 0.075, 0, Math.PI * 2);
      ctx.fill();

      // Hold progress ring
      if (!clamp.released && clamp.hold > 0.01) {
        ctx.strokeStyle = hexA('#d9a441', 0.9);
        ctx.lineWidth = R * 0.035;
        ctx.beginPath();
        ctx.arc(x2, y2, R * 0.14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp.hold);
        ctx.stroke();
      }
      if (view.activeClamp === clamp.id && !clamp.released) {
        ctx.strokeStyle = 'rgba(233,226,208,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x2, y2, R * 0.17, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // The artifact
    const lift = state.free ? Math.min(1, view.time * 0) : 0;
    drawFind(ctx, 'sundisc', cx, cy - lift * R * 0.2, R * 0.38, {
      condition: state.condition,
      soiling: state.dust * 0.5,
      time: view.time,
    });

    if (state.free) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
      const pulse = 0.35 + 0.35 * Math.sin(view.time * 3);
      glow.addColorStop(0, hexA('#ffd98a', 0.3 * pulse));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dust over the whole plate
    if (state.dust > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
      ctx.clip();
      const dustPattern = ctx.createPattern(this.dustTile, 'repeat');
      if (dustPattern) {
        ctx.globalAlpha = Math.min(0.95, state.dust);
        ctx.fillStyle = dustPattern;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Tension: the room reddens and grit falls
    if (state.tension > 5) {
      const t = state.tension / 100;
      ctx.fillStyle = hexA('#8c2b20', t * 0.18 * (0.6 + 0.4 * Math.sin(view.time * 4)));
      ctx.fillRect(0, 0, w, h);
      const motes = Math.round(t * 40);
      ctx.fillStyle = 'rgba(180,160,130,0.35)';
      for (let i = 0; i < motes; i++) {
        const x = ((i * 97 + view.time * 60) % w + w) % w;
        const y = ((i * 53 + view.time * 150) % h + h) % h;
        ctx.fillRect(x, y, 1.5, 4);
      }
    }

    if (view.flash > 0.01) {
      ctx.fillStyle = hexA('#c0392b', view.flash * 0.34);
      ctx.fillRect(0, 0, w, h);
    }

    if (view.collapseProgress > 0) {
      ctx.fillStyle = hexA('#000000', Math.min(0.75, view.collapseProgress * 0.75));
      ctx.fillRect(0, 0, w, h);
    }

    // Lamp vignette — you only ever see what the lamp sees.
    const vig = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(w, h) * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** Where a clamp's grip sits on screen, in fractions of the element. */
  static clampPosition(
    angleDeg: number,
    released: boolean,
    w: number,
    h: number,
  ): { left: string; top: string } {
    const plate = Math.min(w - 20, h - 20);
    const R = plate * 0.44;
    const a = (angleDeg * Math.PI) / 180;
    const radius = R * (0.86 + (released ? 0.06 : 0));
    return {
      left: `${((w / 2 + Math.cos(a) * radius) / w) * 100}%`,
      top: `${((h / 2 + Math.sin(a) * radius) / h) * 100}%`,
    };
  }
}
