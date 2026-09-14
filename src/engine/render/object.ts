/**
 * Draws a find from its silhouette description. Used by the excavation pit and
 * by the discovery card, so the thing you brushed clean is literally the thing
 * you see in your journal.
 */
import { getSilhouette, type Shape, type Silhouette } from '@/content/silhouettes';
import { hexA } from './textures';

interface Finish {
  dark: string;
  base: string;
  light: string;
  spec: string;
}

const FINISHES: Record<Silhouette['finish'], Finish> = {
  iron: { dark: '#2d241e', base: '#6b5b4e', light: '#9c8b7b', spec: '#d8cec2' },
  brass: { dark: '#5a4415', base: '#a9862f', light: '#dcb85c', spec: '#fff0bf' },
  copper: { dark: '#4a2a18', base: '#8c5a3b', light: '#c1835a', spec: '#ffd9b5' },
  silver: { dark: '#4c5257', base: '#9aa2a8', light: '#d6dde1', spec: '#ffffff' },
  gold: { dark: '#6b4c08', base: '#c19527', light: '#f0cf6a', spec: '#fff6d0' },
  bronze: { dark: '#4a3418', base: '#8a6a3c', light: '#c19f63', spec: '#ffe9b8' },
  stone: { dark: '#332e2a', base: '#6b6560', light: '#98918a', spec: '#c9c3ba' },
  alloy: { dark: '#33403f', base: '#78878b', light: '#b6c9ce', spec: '#eaf7fb' },
  painted: { dark: '#3a1d18', base: '#8a4a3a', light: '#bd7a63', spec: '#ffd7c4' },
};

export interface DrawObjectOpts {
  /** 0..1 — dirt still clinging to it. 1 = filthy, 0 = cleaned. */
  soiling?: number;
  /** 0..1 condition; low condition adds cracks and pitting. */
  condition?: number;
  /** Animated glint phase in seconds. */
  time?: number;
  /** Light direction in radians. */
  lightAngle?: number;
  rotation?: number;
}

export function drawFind(
  ctx: CanvasRenderingContext2D,
  silhouetteId: string,
  cx: number,
  cy: number,
  radius: number,
  opts: DrawObjectOpts = {},
): void {
  const sil = getSilhouette(silhouetteId);
  const finish = FINISHES[sil.finish];
  const soiling = opts.soiling ?? 0;
  const condition = opts.condition ?? 100;
  const time = opts.time ?? 0;
  const light = opts.lightAngle ?? -2.2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.rotation ?? 0);
  ctx.scale(radius, radius);
  ctx.lineJoin = 'round';

  // Contact shadow so the object sits in the hole rather than floating on it.
  ctx.save();
  ctx.translate(0.06, 0.09);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (const shape of sil.shapes) {
    tracePath(ctx, shape);
    ctx.fill();
  }
  ctx.restore();

  // Body
  const grad = ctx.createLinearGradient(Math.cos(light), Math.sin(light), -Math.cos(light), -Math.sin(light));
  grad.addColorStop(0, finish.light);
  grad.addColorStop(0.45, finish.base);
  grad.addColorStop(1, finish.dark);
  ctx.fillStyle = grad;
  // A light stroke: a heavy one turns the seams between a silhouette's shapes
  // into hard lines and the object stops reading as one piece.
  ctx.strokeStyle = hexA(finish.dark, 0.45);
  ctx.lineWidth = 0.03;
  for (const shape of sil.shapes) {
    tracePath(ctx, shape);
    ctx.fill();
    ctx.stroke();
  }

  // Rim light along the lit edge
  ctx.save();
  ctx.clip(clipAll(ctx, sil));
  const rim = ctx.createLinearGradient(Math.cos(light) * 1.1, Math.sin(light) * 1.1, 0, 0);
  rim.addColorStop(0, hexA(finish.spec, 0.55));
  rim.addColorStop(0.4, hexA(finish.spec, 0.05));
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);

  // Relief detail
  drawDetail(ctx, sil, finish);

  // Age: pitting and cracks scale with damage
  const wear = 1 - condition / 100;
  if (wear > 0.05) {
    ctx.strokeStyle = hexA('#1a120c', Math.min(0.7, 0.15 + wear * 0.6));
    ctx.lineWidth = 0.02 + wear * 0.03;
    let seed = silhouetteId.length * 13 + Math.round(condition);
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const cracks = Math.round(wear * 7);
    for (let i = 0; i < cracks; i++) {
      const x = rand() * 1.6 - 0.8;
      const y = rand() * 1.6 - 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand() * 0.5 - 0.25, y + rand() * 0.5 - 0.25);
      ctx.stroke();
    }
  }

  // A travelling specular glint — this is what makes metal read as metal.
  const glintPos = ((time * 0.28) % 2) - 1;
  const glint = ctx.createLinearGradient(glintPos - 0.5, -1, glintPos + 0.5, 1);
  glint.addColorStop(0, 'rgba(255,255,255,0)');
  glint.addColorStop(0.5, hexA(finish.spec, 0.22 * (1 - soiling)));
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);

  // Clinging soil
  if (soiling > 0.01) {
    ctx.fillStyle = hexA('#3b2a1c', soiling * 0.75);
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  }
  ctx.restore();
  ctx.restore();
}

function clipAll(ctx: CanvasRenderingContext2D, sil: Silhouette): Path2D {
  const path = new Path2D();
  for (const shape of sil.shapes) addToPath(path, shape);
  void ctx;
  return path;
}

function drawDetail(ctx: CanvasRenderingContext2D, sil: Silhouette, finish: Finish): void {
  const stroke = hexA(finish.dark, 0.75);
  const highlight = hexA(finish.light, 0.6);
  ctx.lineWidth = 0.045;
  switch (sil.detail) {
    case 'coinface':
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(0, 0, 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 0.03;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.68, Math.sin(a) * 0.68);
        ctx.lineTo(Math.cos(a) * 0.76, Math.sin(a) * 0.76);
        ctx.stroke();
      }
      // Worn profile: a suggestion of a head, nothing more.
      ctx.fillStyle = hexA(finish.dark, 0.35);
      ctx.beginPath();
      ctx.ellipse(-0.04, 0.02, 0.26, 0.34, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'engraved':
      ctx.strokeStyle = stroke;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.5, i * 0.2);
        ctx.lineTo(0.5, i * 0.2 + 0.06);
        ctx.stroke();
      }
      break;
    case 'teeth':
      ctx.fillStyle = hexA(finish.light, 0.5);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(-0.06, -0.98, 0.12, 0.2);
        ctx.restore();
      }
      break;
    case 'sunmark': {
      // The mystery's signature: three rays from a small disc.
      ctx.fillStyle = hexA(finish.dark, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA(finish.dark, 0.85);
      ctx.lineWidth = 0.09;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.24, Math.sin(a) * 0.24);
        ctx.lineTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62);
        ctx.stroke();
      }
      break;
    }
    case 'thread':
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.035;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.5, i * 0.17);
        ctx.lineTo(0.5, i * 0.17 + 0.12);
        ctx.stroke();
      }
      break;
    case 'glass':
      ctx.fillStyle = 'rgba(210,235,240,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0.15, 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(-0.14, 0.02, 0.16, 0.1, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'knotmark': {
      // The second mystery's signature: two interlocked loops, woven through
      // each other — carved rather than cast, so it never reads perfectly round.
      ctx.strokeStyle = hexA(finish.dark, 0.85);
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.ellipse(-0.16, 0, 0.32, 0.22, 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0.16, 0, 0.32, 0.22, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      // A short break in the near loop where the far loop weaves over it.
      ctx.strokeStyle = hexA(finish.light, 0.5);
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.arc(0, 0.02, 0.1, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'coilmark': {
      // The third mystery's signature: a serpent coiled tight, drawn as a
      // single spiral that winds inward — distinct from the knot's two
      // separate loops and the sun's straight rays.
      ctx.strokeStyle = hexA(finish.dark, 0.85);
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      const turns = 2.25;
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * turns * Math.PI * 2;
        const r = 0.46 * (1 - t) + 0.04;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // A small diamond head at the outer end, where the coil "looks out".
      ctx.fillStyle = hexA(finish.light, 0.6);
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.42, 0.07);
      ctx.lineTo(0.34, 0);
      ctx.lineTo(0.42, -0.07);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

function tracePath(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.beginPath();
  switch (shape.kind) {
    case 'circle':
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      break;
    case 'ring':
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      ctx.arc(shape.x, shape.y, Math.max(0.001, shape.r - shape.t), 0, Math.PI * 2, true);
      break;
    case 'rect': {
      ctx.save();
      ctx.translate(shape.x, shape.y);
      ctx.rotate(shape.rot ?? 0);
      ctx.rect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
      ctx.restore();
      break;
    }
    case 'capsule': {
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      ctx.arc(shape.x1, shape.y1, shape.r, angle + Math.PI / 2, angle - Math.PI / 2);
      ctx.arc(shape.x2, shape.y2, shape.r, angle - Math.PI / 2, angle + Math.PI / 2);
      ctx.closePath();
      break;
    }
    case 'poly':
      shape.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      break;
  }
}

function addToPath(path: Path2D, shape: Shape): void {
  switch (shape.kind) {
    case 'circle':
      path.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      break;
    case 'ring':
      path.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      break;
    case 'rect': {
      const rot = shape.rot ?? 0;
      if (!rot) {
        path.rect(shape.x - shape.w / 2, shape.y - shape.h / 2, shape.w, shape.h);
      } else {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const pts: [number, number][] = [
          [-shape.w / 2, -shape.h / 2],
          [shape.w / 2, -shape.h / 2],
          [shape.w / 2, shape.h / 2],
          [-shape.w / 2, shape.h / 2],
        ];
        pts.forEach(([lx, ly], i) => {
          const x = shape.x + lx * c - ly * s;
          const y = shape.y + lx * s + ly * c;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
      }
      break;
    }
    case 'capsule': {
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      path.arc(shape.x1, shape.y1, shape.r, angle + Math.PI / 2, angle - Math.PI / 2);
      path.arc(shape.x2, shape.y2, shape.r, angle - Math.PI / 2, angle + Math.PI / 2);
      path.closePath();
      break;
    }
    case 'poly':
      shape.pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
      path.closePath();
      break;
  }
}
