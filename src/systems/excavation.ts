/**
 * Excavation: dirt, debris, contact and damage.
 *
 * Deliberately canvas-free. The renderer reads this state; it never owns it.
 * That means the whole dig — including damage and the reveal threshold — is
 * unit-testable without a browser.
 */
import { getSilhouette, pointInSilhouette } from '@/content/silhouettes';
import type { LocationDef, TargetDef, ToolDef } from '@/core/types';
import { clamp, clamp01, mulberry32, type Rng } from '@/core/rng';
import { hashString } from './detection';

export const GRID = 46;
/** Tool radii are authored against a 320px pit; convert to grid cells. */
const TOOL_PIT_REFERENCE = 320;

export type ExcavationEventKind = 'dig' | 'debris' | 'contact' | 'strike' | 'expose';

export interface ExcavationEvent {
  kind: ExcavationEventKind;
  /** Normalised pit position 0..1. */
  x: number;
  y: number;
  intensity: number;
}

export interface ExcavationState {
  cols: number;
  rows: number;
  /** Remaining soil per cell, 0..~1.3. */
  dirt: Float32Array;
  /** Hard material (stones, roots). Brushes barely touch it. */
  debris: Float32Array;
  /** 1 where the buried object occupies the cell. */
  mask: Uint8Array;
  maskCount: number;
  /** False when the player dug in the wrong place — an honest empty hole. */
  hasObject: boolean;
  /** Object centre in normalised pit coordinates. */
  centerX: number;
  centerY: number;
  /** Object size as a fraction of pit width. */
  scale: number;
  hardness: number;
  fragility: number;
  condition: number;
  exposed: number;
  strikes: number;
  totalRemoved: number;
  extracted: boolean;
  events: ExcavationEvent[];
  lastDamageAt: number;
  silhouetteId: string;
}

export interface CreateExcavationOpts {
  def: TargetDef;
  location: LocationDef;
  /** 0..1 — how well the dig was placed. 0 means the object is not in the pit. */
  accuracy: number;
  /** Direction from dig point to the real target, radians. */
  offsetAngle: number;
  /** Instance condition before digging begins. */
  baseCondition: number;
  seed: string;
}

export function createExcavation(opts: CreateExcavationOpts): ExcavationState {
  const { def, location, accuracy, offsetAngle, baseCondition, seed } = opts;
  const rng = mulberry32(hashString(seed));
  const cols = GRID;
  const rows = GRID;
  const dirt = new Float32Array(cols * rows);
  const debris = new Float32Array(cols * rows);
  const mask = new Uint8Array(cols * rows);

  const hardness = clamp01(location.hardness * 0.55 + def.excavationDifficulty * 0.6);
  const scale = 0.15 + 0.19 * def.size;

  // A sloppy dig still finds the object, just off to one side of the pit.
  const hasObject = accuracy > 0;
  const off = (1 - clamp01(accuracy)) * 0.26;
  const centerX = clamp(0.5 + Math.cos(offsetAngle) * off, 0.2, 0.8);
  const centerY = clamp(0.5 + Math.sin(offsetAngle) * off, 0.2, 0.8);

  let maskCount = 0;
  const sil = getSilhouette(def.silhouette);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      const nx = (i + 0.5) / cols;
      const ny = (j + 0.5) / rows;

      // Soil is deeper towards the middle of the pit and lumpy everywhere.
      const rFromCentre = Math.hypot(nx - 0.5, ny - 0.5) * 2;
      const lump = (rng() - 0.5) * 0.16;
      dirt[idx] = clamp(0.78 + hardness * 0.34 + (1 - rFromCentre) * 0.16 + lump, 0.15, 1.35);

      if (hasObject) {
        const ux = (nx - centerX) / scale;
        const uy = (ny - centerY) / scale;
        if (Math.abs(ux) <= 1.2 && Math.abs(uy) <= 1.2 && pointInSilhouette(sil, ux, uy)) {
          mask[idx] = 1;
          maskCount++;
        }
      }
    }
  }

  seedDebris(rng, debris, cols, rows, hardness, def.excavationDifficulty);

  return {
    cols,
    rows,
    dirt,
    debris,
    mask,
    maskCount,
    hasObject: hasObject && maskCount > 0,
    centerX,
    centerY,
    scale,
    hardness,
    fragility: def.fragility,
    condition: clamp(baseCondition, 1, 100),
    exposed: 0,
    strikes: 0,
    totalRemoved: 0,
    extracted: false,
    events: [],
    lastDamageAt: 0,
    silhouetteId: def.silhouette,
  };
}

function seedDebris(
  rng: Rng,
  debris: Float32Array,
  cols: number,
  rows: number,
  hardness: number,
  difficulty: number,
): void {
  const blobs = Math.round(2 + hardness * 5 + difficulty * 3);
  for (let b = 0; b < blobs; b++) {
    const cx = rng() * cols;
    const cy = rng() * rows;
    const r = 2 + rng() * (2.5 + hardness * 3.5);
    for (let j = Math.max(0, Math.floor(cy - r)); j < Math.min(rows, Math.ceil(cy + r)); j++) {
      for (let i = Math.max(0, Math.floor(cx - r)); i < Math.min(cols, Math.ceil(cx + r)); i++) {
        const d = Math.hypot(i - cx, j - cy);
        if (d > r) continue;
        const idx = j * cols + i;
        debris[idx] = Math.max(debris[idx]!, clamp01((1 - d / r) * (0.55 + rng() * 0.5)));
      }
    }
  }
}

export interface ToolResult {
  /** Dirt volume removed this call. */
  removed: number;
  debrisRemoved: number;
  damage: number;
  /** The tool touched exposed artifact surface. */
  contact: boolean;
  /** A real mistake — damage above the "you felt that" threshold. */
  strike: boolean;
  exposedDelta: number;
}

const CONTACT_DIRT = 0.24;
const EXPOSED_DIRT = 0.3;
const DAMAGE_COOLDOWN_MS = 120;

/**
 * Apply a tool at normalised pit position (nx, ny) for dt seconds.
 * This is the only way the pit ever changes.
 */
export function applyTool(
  state: ExcavationState,
  tool: ToolDef,
  nx: number,
  ny: number,
  dt: number,
  now: number,
): ToolResult {
  const result: ToolResult = {
    removed: 0,
    debrisRemoved: 0,
    damage: 0,
    contact: false,
    strike: false,
    exposedDelta: 0,
  };
  if (state.extracted) return result;

  const rCells = (tool.radius / TOOL_PIT_REFERENCE) * state.cols;
  const ci = nx * state.cols;
  const cj = ny * state.rows;
  const step = clamp(dt, 0, 0.05);
  const isBrush = tool.kind === 'brush';
  const dirtRate = tool.power * step * 12 * (1 - state.hardness * 0.35);
  const debrisRate = tool.power * step * (isBrush ? 0.9 : 8);

  let contactCells = 0;
  const before = state.exposed;

  for (let j = Math.max(0, Math.floor(cj - rCells)); j < Math.min(state.rows, Math.ceil(cj + rCells)); j++) {
    for (let i = Math.max(0, Math.floor(ci - rCells)); i < Math.min(state.cols, Math.ceil(ci + rCells)); i++) {
      const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj);
      if (d > rCells) continue;
      const falloff = 1 - (d / rCells) * 0.75;
      const idx = j * state.cols + i;

      // Debris shields the soil beneath it: clear the stone before the dirt.
      if (state.debris[idx]! > 0.02) {
        const take = Math.min(state.debris[idx]!, debrisRate * falloff);
        state.debris[idx]! -= take;
        result.debrisRemoved += take;
        if (state.debris[idx]! > 0.02) continue;
      }

      const dirtHere = state.dirt[idx]!;
      if (dirtHere > 0.001) {
        const take = Math.min(dirtHere, dirtRate * falloff);
        state.dirt[idx] = dirtHere - take;
        result.removed += take;
      }

      if (state.mask[idx] === 1 && state.dirt[idx]! <= CONTACT_DIRT) {
        contactCells++;
      }
    }
  }

  state.totalRemoved += result.removed;

  if (contactCells > 0) {
    result.contact = true;
    // Brushes are near-harmless; anything with an edge is not. Damage scales
    // with how much surface the tool is pressing on, not with how long the
    // player has been working — patience must never be punished.
    if (tool.risk > 0.005 && now - state.lastDamageAt >= DAMAGE_COOLDOWN_MS) {
      state.lastDamageAt = now;
      // Scaled so one careless stroke with an edged tool costs a few points on
      // a sturdy find and a lot on a delicate one, while sustained carelessness
      // ruins anything. Time spent working carefully costs nothing.
      const pressure = 0.5 + Math.min(1, contactCells / 6) * 1.2;
      // The fragility term dominates: a nail shrugs off a scoop, a locket does
      // not. Common finds stay forgiving even under sustained carelessness.
      const raw = tool.risk * (0.3 + state.fragility * 4.2) * pressure;
      const damage = Math.min(8, raw);
      if (damage > 0.05) {
        state.condition = clamp(state.condition - damage, 4, 100);
        result.damage = damage;
        if (damage >= 1.1) {
          state.strikes++;
          result.strike = true;
          pushEvent(state, { kind: 'strike', x: nx, y: ny, intensity: clamp01(damage / 8) });
        }
      }
    }
    if (!result.strike) {
      pushEvent(state, { kind: 'contact', x: nx, y: ny, intensity: clamp01(contactCells / 8) });
    }
  }

  if (result.debrisRemoved > 0.02) {
    pushEvent(state, { kind: 'debris', x: nx, y: ny, intensity: clamp01(result.debrisRemoved) });
  } else if (result.removed > 0.02) {
    pushEvent(state, { kind: 'dig', x: nx, y: ny, intensity: clamp01(result.removed * 1.4) });
  }

  state.exposed = computeExposure(state);
  result.exposedDelta = state.exposed - before;
  if (result.exposedDelta > 0.06) {
    pushEvent(state, { kind: 'expose', x: nx, y: ny, intensity: clamp01(result.exposedDelta * 4) });
  }

  return result;
}

function pushEvent(state: ExcavationState, event: ExcavationEvent): void {
  state.events.push(event);
  if (state.events.length > 24) state.events.splice(0, state.events.length - 24);
}

export function drainEvents(state: ExcavationState): ExcavationEvent[] {
  const out = state.events;
  state.events = [];
  return out;
}

export function computeExposure(state: ExcavationState): number {
  if (!state.hasObject || state.maskCount === 0) return 0;
  let exposedCells = 0;
  for (let idx = 0; idx < state.mask.length; idx++) {
    if (state.mask[idx] !== 1) continue;
    if (state.dirt[idx]! <= EXPOSED_DIRT && state.debris[idx]! <= 0.05) exposedCells++;
  }
  return exposedCells / state.maskCount;
}

/** Fraction of the pit cleared — used for "nothing here" messaging. */
export function pitCleared(state: ExcavationState): number {
  let clear = 0;
  for (let idx = 0; idx < state.dirt.length; idx++) {
    if (state.dirt[idx]! <= EXPOSED_DIRT && state.debris[idx]! <= 0.05) clear++;
  }
  return clear / state.dirt.length;
}

export const EXTRACT_THRESHOLD = 0.7;

export function canExtract(state: ExcavationState): boolean {
  return state.hasObject && !state.extracted && state.exposed >= EXTRACT_THRESHOLD;
}

export function extract(state: ExcavationState): number {
  state.extracted = true;
  // Lifting it out is itself a small risk, scaled by how buried it still is.
  const stillBuried = 1 - state.exposed;
  const liftDamage = stillBuried * state.fragility * 12;
  state.condition = clamp(state.condition - liftDamage, 4, 100);
  return Math.round(state.condition);
}

/** Pinpointer heat: 1 directly over the object, 0 at the pit edge. */
export function heatAt(state: ExcavationState, nx: number, ny: number): number {
  if (!state.hasObject) return 0;
  const d = Math.hypot(nx - state.centerX, ny - state.centerY);
  return clamp01(1 - d / (state.scale * 1.9));
}
