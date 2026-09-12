/**
 * The precision extraction: an artifact held in a mechanism that objects to
 * being disturbed. Careful, ordered work under a rising tension meter.
 *
 * Pure logic — the screen renders it and feeds it input.
 */
import type { MechanismConfig } from '@/content/adventure/types';
import { clamp, clamp01 } from '@/core/rng';

export interface ClampState {
  id: string;
  angle: number;
  order: number;
  released: boolean;
  /** 0..1 progress of the current steady hold. */
  hold: number;
}

export type MechanismEvent =
  | { kind: 'click'; clampId: string }
  | { kind: 'thunk' }
  | { kind: 'release'; clampId: string }
  | { kind: 'free' }
  | { kind: 'collapse' };

export interface MechanismState {
  clamps: ClampState[];
  /** 0..100. At 100 the chamber starts coming down. */
  tension: number;
  /** Artifact condition, 0..100. */
  condition: number;
  /** Dust covering the inscription, 0..1. Brushing reveals the order. */
  dust: number;
  /** True once the order is legible. */
  orderKnown: boolean;
  released: number;
  free: boolean;
  collapsing: boolean;
  mistakes: number;
  events: MechanismEvent[];
  config: MechanismConfig;
}

export function createMechanism(config: MechanismConfig): MechanismState {
  return {
    clamps: config.clamps.map((c) => ({ ...c, released: false, hold: 0 })),
    tension: 0,
    condition: 100,
    dust: 1,
    orderKnown: false,
    released: 0,
    free: false,
    collapsing: false,
    mistakes: 0,
    events: [],
    config,
  };
}

/** Brushing the plate. `amount` is drag distance in normalised units. */
export function brushPlate(state: MechanismState, amount: number): void {
  if (state.dust <= 0) return;
  state.dust = clamp01(state.dust - amount * 0.85);
  if (state.dust <= 0.25 && !state.orderKnown) {
    state.orderKnown = true;
  }
}

/** Time passing. Tension creeps once the mechanism has been disturbed. */
export function stepMechanism(state: MechanismState, dt: number): void {
  if (state.free || state.collapsing) return;
  if (state.released > 0) {
    state.tension = clamp(state.tension + state.config.creepPerSecond * dt * state.released, 0, 100);
  }
  if (state.tension >= 100) {
    state.collapsing = true;
    state.events.push({ kind: 'collapse' });
  }
}

/**
 * Continue a steady hold on a clamp. Returns true when the clamp releases.
 * Lifting off simply abandons the hold — no penalty for caution.
 */
export function holdClamp(state: MechanismState, clampId: string, dt: number): boolean {
  const clamp_ = state.clamps.find((c) => c.id === clampId);
  if (!clamp_ || clamp_.released || state.free || state.collapsing) return false;
  clamp_.hold = clamp01(clamp_.hold + dt / state.config.holdSeconds);
  if (clamp_.hold < 1) return false;

  const expected = nextExpectedOrder(state);
  if (clamp_.order !== expected) {
    // Wrong one. The mechanism moves, and it lets you know.
    clamp_.hold = 0;
    state.mistakes++;
    state.tension = clamp(state.tension + state.config.wrongOrderTension, 0, 100);
    state.condition = clamp(state.condition - state.config.wrongOrderDamage, 5, 100);
    state.events.push({ kind: 'click', clampId });
    if (state.tension >= 100) {
      state.collapsing = true;
      state.events.push({ kind: 'collapse' });
    }
    return false;
  }

  clamp_.released = true;
  clamp_.hold = 1;
  state.released++;
  state.events.push({ kind: 'release', clampId });
  if (state.released === state.clamps.length) {
    state.free = true;
    state.events.push({ kind: 'free' });
  }
  return true;
}

export function releaseHold(state: MechanismState, clampId: string): void {
  const clamp_ = state.clamps.find((c) => c.id === clampId);
  if (clamp_ && !clamp_.released) clamp_.hold = 0;
}

/** Touching the pressure rim: never fatal, always costly. */
export function touchRim(state: MechanismState): void {
  if (state.free || state.collapsing) return;
  state.mistakes++;
  state.tension = clamp(state.tension + state.config.rimTension, 0, 100);
  state.events.push({ kind: 'thunk' });
  if (state.tension >= 100) {
    state.collapsing = true;
    state.events.push({ kind: 'collapse' });
  }
}

export function nextExpectedOrder(state: MechanismState): number {
  return state.released + 1;
}

export function drainMechanismEvents(state: MechanismState): MechanismEvent[] {
  const out = state.events;
  state.events = [];
  return out;
}

/** Final condition after lifting the artifact out under pressure. */
export function liftArtifact(state: MechanismState, forced: boolean): number {
  const penalty = forced ? 22 + state.tension * 0.1 : state.tension * 0.06;
  state.condition = clamp(state.condition - penalty, 5, 100);
  return Math.round(state.condition);
}
