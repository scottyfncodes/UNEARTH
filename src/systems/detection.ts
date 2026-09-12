/**
 * The signal model.
 *
 * The detector never says "there is treasure here". It reports a strength that
 * falls off with lateral distance AND depth, is coloured by material, is
 * masked by neighbouring junk, and is never perfectly clean. Everything the
 * player knows before digging comes out of this file.
 */
import { getTarget } from '@/content/targets';
import type { DetectorDef, FieldState, MaterialClass, PlacedTarget, TargetDef } from '@/core/types';
import { clamp01, valueNoise1D } from '@/core/rng';

/** How strongly each material couples to the coil. Stone barely does. */
const MATERIAL_COUPLING: Record<MaterialClass, number> = {
  ferrous: 1,
  nonFerrous: 1.05,
  silver: 1.1,
  gold: 0.9,
  bronze: 1,
  stone: 0.55,
  organic: 0.4,
  unknown: 0.95,
};

/** Tone families. The player learns these by ear before they learn the UI. */
export type ToneClass = 'iron' | 'mid' | 'high' | 'odd';

const MATERIAL_TONE: Record<MaterialClass, ToneClass> = {
  ferrous: 'iron',
  nonFerrous: 'mid',
  silver: 'high',
  gold: 'mid',
  bronze: 'mid',
  stone: 'iron',
  organic: 'iron',
  unknown: 'odd',
};

export function toneOf(material: MaterialClass): ToneClass {
  return MATERIAL_TONE[material];
}

export interface Contribution {
  target: PlacedTarget;
  def: TargetDef;
  /** Lateral distance from coil to target, centimetres. */
  distance: number;
  strength: number;
}

/**
 * Signal contribution of a single buried target for a coil at (cx, cy).
 * Returns 0..1.
 */
export function targetSignal(
  cx: number,
  cy: number,
  target: PlacedTarget,
  def: TargetDef,
  det: DetectorDef,
): number {
  const dx = target.x - cx;
  const dy = target.y - cy;
  const lateral = Math.hypot(dx, dy);
  const z = target.depth;

  // Bigger objects read from further out; the coil itself sets the base scale.
  const reach = det.reach * (0.5 + 0.85 * def.size);
  // Depth costs more than lateral distance — you can walk past a deep target.
  const r = Math.hypot(lateral, z * 1.3);
  let raw = 1 / (1 + Math.pow(r / reach, 3));

  // Beyond the detector's depth capability the signal collapses rather than fades.
  if (z > det.depthCapacity) {
    const over = (z - det.depthCapacity) / Math.max(6, det.depthCapacity * 0.55);
    raw *= 1 / (1 + over * over * 3.2);
  }

  raw *= MATERIAL_COUPLING[def.material];
  return clamp01(raw);
}

export interface FieldSample {
  /** Clean combined signal, 0..1. */
  strength: number;
  /** What the player actually hears/sees, with instability noise applied. */
  noisy: number;
  /** Strongest single contributor, if anything is in range at all. */
  dominant: Contribution | null;
  /** Everything with a non-trivial contribution, strongest first. */
  contributions: Contribution[];
  /** True when more than one target is muddying the reading. */
  masked: boolean;
}

const signalNoise = valueNoise1D(0x5eed01);
const driftNoise = valueNoise1D(0x5eed02);

/**
 * Sample the whole field at a coil position.
 * `time` is seconds — noise is smooth over time so the signal breathes.
 */
export function sampleField(
  field: FieldState,
  cx: number,
  cy: number,
  det: DetectorDef,
  time: number,
  opts: { pinpointing?: boolean } = {},
): FieldSample {
  const contributions: Contribution[] = [];

  for (const target of field.targets) {
    if (target.dug) continue;
    const def = getTarget(target.targetId);
    if (!def) continue;
    const strength = targetSignal(cx, cy, target, def, det);
    if (strength < 0.012) continue;
    contributions.push({
      target,
      def,
      distance: Math.hypot(target.x - cx, target.y - cy),
      strength,
    });
  }

  contributions.sort((a, b) => b.strength - a.strength);
  const dominant = contributions[0] ?? null;

  let strength = 0;
  if (dominant) {
    // Neighbouring targets add to the noise floor without fully stacking:
    // two overlapping signals make a mess, which is true to life.
    let others = 0;
    for (let i = 1; i < contributions.length; i++) others += contributions[i]!.strength;
    strength = clamp01(dominant.strength + others * 0.32);
  }

  // Instability: matters most when the signal is weak, which is exactly when
  // the player is straining to interpret it.
  const stability = opts.pinpointing ? Math.min(1, det.stability + 0.25) : det.stability;
  const noiseAmp = (1 - stability) * 0.14 * (1 - strength * 0.65);
  const wobble =
    signalNoise(time * 3.1) * 0.65 + driftNoise(time * 0.9 + cx * 0.004 + cy * 0.004) * 0.35;
  const noisy = clamp01(strength + wobble * noiseAmp);

  return {
    strength,
    noisy,
    dominant,
    contributions,
    masked: contributions.length > 1 && (contributions[1]?.strength ?? 0) > dominant!.strength * 0.45,
  };
}

export const MATERIAL_LABEL: Record<MaterialClass, string> = {
  ferrous: 'Ferrous',
  nonFerrous: 'Non-ferrous',
  silver: 'Silver range',
  gold: 'Gold range',
  bronze: 'Bronze range',
  stone: 'Mineral / non-metal',
  organic: 'Organic',
  unknown: 'Unreadable',
};

/** Materials the detector confuses with each other at low discrimination. */
const CONFUSION: Record<MaterialClass, MaterialClass[]> = {
  ferrous: ['ferrous', 'bronze'],
  nonFerrous: ['nonFerrous', 'gold', 'silver'],
  silver: ['silver', 'nonFerrous'],
  gold: ['gold', 'nonFerrous'],
  bronze: ['bronze', 'ferrous', 'nonFerrous'],
  stone: ['stone', 'ferrous'],
  organic: ['organic', 'ferrous'],
  unknown: ['unknown', 'nonFerrous', 'bronze'],
};

export interface Readout {
  material: MaterialClass;
  label: string;
  tone: ToneClass;
  /** 0..1 — how much the player should trust the label. */
  confidence: number;
  sizeLabel: 'Small' | 'Medium' | 'Large';
  depthLabel: string;
}

/**
 * What the detector claims about a target. Deterministic per target+detector so
 * the readout doesn't flicker while the player stands there, but wrong often
 * enough at low discrimination to keep the player honest.
 */
export function readout(
  contribution: Contribution,
  det: DetectorDef,
  signalStrength: number,
): Readout {
  const { def, target } = contribution;
  // Deterministic pseudo-random draw from ids so the lie is stable.
  const h = hashString(`${target.uid}|${det.id}`);
  const roll = (h % 1000) / 1000;

  const clarity = clamp01(det.discrimination * (0.35 + 0.65 * clamp01(signalStrength * 1.5)));
  let material = def.material;
  if (roll > clarity) {
    const options = CONFUSION[def.material];
    material = options[(h >>> 10) % options.length]!;
  }
  if (def.material === 'unknown' && det.discrimination < 0.85) material = 'unknown';

  const depthError = (1 - clarity) * 9;
  const shown = target.depth + ((((h >>> 3) % 200) / 100) - 1) * depthError;
  const low = Math.max(1, Math.round((shown - 3) / 2) * 2);
  const high = Math.max(low + 2, Math.round((shown + 3) / 2) * 2);

  return {
    material,
    label: MATERIAL_LABEL[material],
    tone: MATERIAL_TONE[material],
    confidence: clarity,
    sizeLabel: def.size < 0.38 ? 'Small' : def.size < 0.68 ? 'Medium' : 'Large',
    depthLabel: `${low}–${high} cm`,
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Beep interval in milliseconds for a given signal strength. */
export function beepInterval(strength: number): number {
  if (strength < 0.05) return Infinity;
  const t = Math.pow(clamp01(strength), 0.75);
  return 820 - t * 740;
}

/**
 * How close to the true position a dig has to land. Small targets and
 * precise detectors tighten this; it is what makes triangulation matter.
 */
export function digTolerance(def: TargetDef, det: DetectorDef): number {
  const base = 26 + def.size * 20;
  const coilBonus = (30 - det.coilWidth) * 0.35;
  return Math.max(16, base + coilBonus);
}
