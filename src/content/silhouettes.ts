/**
 * Object silhouettes, described as primitives in a -1..1 unit box.
 *
 * The same description drives two things: the excavation hit mask (pure maths,
 * testable without a canvas) and the on-screen drawing. One source of truth
 * means what you brush is exactly what you see.
 */
export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'ring'; x: number; y: number; r: number; t: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rot?: number }
  | { kind: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number }
  | { kind: 'poly'; pts: [number, number][] };

export interface Silhouette {
  shapes: Shape[];
  /** Surface family — drives colour and how it catches the light. */
  finish: 'iron' | 'brass' | 'copper' | 'silver' | 'gold' | 'bronze' | 'stone' | 'alloy' | 'painted';
  /** Relief detail drawn on top once exposed (engraving, teeth, lettering). */
  detail?: 'coinface' | 'engraved' | 'teeth' | 'sunmark' | 'thread' | 'glass';
}

const cap = (x1: number, y1: number, x2: number, y2: number, r: number): Shape => ({
  kind: 'capsule',
  x1,
  y1,
  x2,
  y2,
  r,
});

export const SILHOUETTES: Record<string, Silhouette> = {
  coin: { shapes: [{ kind: 'circle', x: 0, y: 0, r: 0.82 }], finish: 'copper', detail: 'coinface' },
  bottlecap: {
    shapes: [{ kind: 'circle', x: 0, y: 0, r: 0.78 }],
    finish: 'painted',
    detail: 'thread',
  },
  pulltab: {
    shapes: [
      { kind: 'ring', x: 0, y: 0.1, r: 0.55, t: 0.2 },
      cap(0, 0.55, 0, -0.85, 0.16),
    ],
    finish: 'alloy',
  },
  nail: {
    shapes: [
      cap(0, -0.9, 0.05, 0.7, 0.12),
      { kind: 'rect', x: 0, y: -0.88, w: 0.5, h: 0.22, rot: 0.05 },
    ],
    finish: 'iron',
  },
  scrap: {
    shapes: [
      { kind: 'poly', pts: [[-0.9, -0.3], [-0.2, -0.85], [0.7, -0.5], [0.9, 0.3], [0.1, 0.85], [-0.7, 0.5]] },
    ],
    finish: 'iron',
  },
  washer: { shapes: [{ kind: 'ring', x: 0, y: 0, r: 0.78, t: 0.34 }], finish: 'iron' },
  screw: {
    shapes: [cap(0, -0.85, 0, 0.8, 0.16), { kind: 'circle', x: 0, y: -0.85, r: 0.34 }],
    finish: 'iron',
    detail: 'thread',
  },
  wire: {
    shapes: [cap(-0.85, 0.4, -0.1, -0.6, 0.1), cap(-0.1, -0.6, 0.5, 0.5, 0.1), cap(0.5, 0.5, 0.9, -0.2, 0.1)],
    finish: 'copper',
  },
  tin: {
    shapes: [{ kind: 'poly', pts: [[-0.85, -0.6], [0.6, -0.8], [0.9, 0.5], [-0.5, 0.85]] }],
    finish: 'iron',
  },
  key: {
    shapes: [
      { kind: 'ring', x: 0, y: -0.6, r: 0.38, t: 0.18 },
      cap(0, -0.25, 0, 0.8, 0.11),
      { kind: 'rect', x: 0.18, y: 0.62, w: 0.36, h: 0.14 },
      { kind: 'rect', x: 0.15, y: 0.34, w: 0.3, h: 0.12 },
    ],
    finish: 'iron',
  },
  knife: {
    shapes: [
      { kind: 'rect', x: 0, y: 0.2, w: 0.42, h: 1.2, rot: 0.15 },
      { kind: 'poly', pts: [[-0.2, -0.4], [0.22, -0.45], [0.3, -0.95], [-0.05, -0.7]] },
    ],
    finish: 'bronze',
    detail: 'engraved',
  },
  button: {
    shapes: [
      { kind: 'circle', x: 0, y: 0, r: 0.66 },
      { kind: 'circle', x: 0, y: 0, r: 0.2 },
    ],
    finish: 'brass',
    detail: 'engraved',
  },
  buckle: {
    shapes: [
      { kind: 'rect', x: 0, y: 0, w: 1.6, h: 1.1 },
      { kind: 'rect', x: 0, y: 0, w: 1.05, h: 0.6 },
      cap(0, -0.55, 0, 0.1, 0.1),
    ],
    finish: 'brass',
  },
  thimble: {
    shapes: [
      { kind: 'poly', pts: [[-0.45, 0.8], [0.45, 0.8], [0.34, -0.5], [-0.34, -0.5]] },
      { kind: 'circle', x: 0, y: -0.5, r: 0.34 },
    ],
    finish: 'silver',
    detail: 'thread',
  },
  spanner: {
    shapes: [
      cap(-0.1, -0.7, 0.1, 0.7, 0.18),
      { kind: 'poly', pts: [[-0.45, -0.95], [0.25, -0.95], [0.3, -0.55], [-0.4, -0.55]] },
      { kind: 'poly', pts: [[-0.4, 0.55], [0.3, 0.55], [0.25, 0.95], [-0.45, 0.95]] },
    ],
    finish: 'iron',
  },
  horseshoe: {
    shapes: [
      { kind: 'ring', x: 0, y: 0, r: 0.85, t: 0.3 },
      { kind: 'rect', x: 0, y: 0.78, w: 1.2, h: 0.5 },
    ],
    finish: 'iron',
  },
  medal: {
    shapes: [
      { kind: 'circle', x: 0, y: 0.2, r: 0.68 },
      { kind: 'rect', x: 0, y: -0.72, w: 0.8, h: 0.3 },
    ],
    finish: 'bronze',
    detail: 'engraved',
  },
  ring: { shapes: [{ kind: 'ring', x: 0, y: 0.1, r: 0.7, t: 0.22 }, { kind: 'circle', x: 0, y: -0.55, r: 0.4 }], finish: 'gold', detail: 'engraved' },
  locket: {
    shapes: [
      { kind: 'circle', x: 0, y: 0.15, r: 0.7 },
      { kind: 'ring', x: 0, y: -0.62, r: 0.24, t: 0.12 },
    ],
    finish: 'silver',
    detail: 'glass',
  },
  badge: {
    shapes: [{ kind: 'poly', pts: [[-0.8, -0.55], [0.8, -0.55], [0.9, 0.2], [0, 0.85], [-0.9, 0.2]] }],
    finish: 'brass',
    detail: 'sunmark',
  },
  tag: {
    shapes: [
      { kind: 'rect', x: 0, y: 0.05, w: 1.2, h: 0.85 },
      { kind: 'circle', x: 0, y: -0.62, r: 0.22 },
    ],
    finish: 'alloy',
    detail: 'engraved',
  },
  token: {
    shapes: [{ kind: 'circle', x: 0, y: 0, r: 0.82 }],
    finish: 'bronze',
    detail: 'sunmark',
  },
  fragment: {
    shapes: [{ kind: 'poly', pts: [[-0.9, -0.5], [0.3, -0.9], [0.9, 0.1], [0.4, 0.9], [-0.6, 0.7]] }],
    finish: 'stone',
    detail: 'sunmark',
  },
  gear: {
    shapes: [
      { kind: 'ring', x: 0, y: 0, r: 0.8, t: 0.34 },
      { kind: 'circle', x: 0, y: 0, r: 0.22 },
    ],
    finish: 'alloy',
    detail: 'teeth',
  },
  oddity: {
    shapes: [
      { kind: 'poly', pts: [[-0.7, -0.7], [0.5, -0.85], [0.85, 0.2], [0.2, 0.8], [-0.8, 0.35]] },
      { kind: 'circle', x: 0.05, y: 0, r: 0.28 },
    ],
    finish: 'alloy',
    detail: 'sunmark',
  },
  sundisc: {
    shapes: [
      { kind: 'circle', x: 0, y: 0, r: 0.78 },
      { kind: 'poly', pts: [[0, -1], [0.22, -0.6], [-0.22, -0.6]] },
      { kind: 'poly', pts: [[0.87, 0.5], [0.5, 0.4], [0.66, 0.72]] },
      { kind: 'poly', pts: [[-0.87, 0.5], [-0.5, 0.4], [-0.66, 0.72]] },
    ],
    finish: 'gold',
    detail: 'sunmark',
  },
};

export function getSilhouette(id: string): Silhouette {
  return SILHOUETTES[id] ?? SILHOUETTES.oddity!;
}

/** Point-in-shape test in unit (-1..1) space. */
export function pointInShape(shape: Shape, px: number, py: number): boolean {
  switch (shape.kind) {
    case 'circle':
      return (px - shape.x) ** 2 + (py - shape.y) ** 2 <= shape.r * shape.r;
    case 'ring': {
      const d = Math.hypot(px - shape.x, py - shape.y);
      return d <= shape.r && d >= shape.r - shape.t;
    }
    case 'rect': {
      const rot = shape.rot ?? 0;
      const dx = px - shape.x;
      const dy = py - shape.y;
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      return Math.abs(lx) <= shape.w / 2 && Math.abs(ly) <= shape.h / 2;
    }
    case 'capsule': {
      const vx = shape.x2 - shape.x1;
      const vy = shape.y2 - shape.y1;
      const len2 = vx * vx + vy * vy || 1e-6;
      let t = ((px - shape.x1) * vx + (py - shape.y1) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = shape.x1 + vx * t;
      const cy = shape.y1 + vy * t;
      return (px - cx) ** 2 + (py - cy) ** 2 <= shape.r * shape.r;
    }
    case 'poly': {
      let inside = false;
      const pts = shape.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
  }
}

export function pointInSilhouette(sil: Silhouette, px: number, py: number): boolean {
  for (const shape of sil.shapes) if (pointInShape(shape, px, py)) return true;
  return false;
}
