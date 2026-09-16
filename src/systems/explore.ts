/**
 * First-person site movement, collision, hazards and interaction targeting.
 *
 * Pure math over plain numbers — no THREE.js, no DOM — so the feel of moving
 * through a site (walls that actually stop you, a hazard that pushes you
 * back, which single thing the crosshair is "on") is unit-testable without a
 * browser. engine/scene3d only turns this into pixels.
 */
import type { HazardZone, PropKind, SiteInteractable, SiteProp } from '@/content/sites/types';

export interface Collider {
  x: number;
  z: number;
  radius: number;
}

export const PLAYER_RADIUS = 0.34;

/** Footprint (width, depth) in metres for each prop kind, before `scale`. */
export const PROP_FOOTPRINT: Record<PropKind, { w: number; d: number }> = {
  wall: { w: 6, d: 0.6 },
  column: { w: 0.6, d: 0.6 },
  columnBroken: { w: 0.7, d: 0.7 },
  rubble: { w: 1.6, d: 1.6 },
  rock: { w: 1, d: 1 },
  archway: { w: 3, d: 0.6 },
  cliff: { w: 8, d: 1.2 },
  crate: { w: 0.7, d: 0.7 },
  stairStep: { w: 2.4, d: 0.7 },
  statueBody: { w: 1, d: 1 },
};

/**
 * Long, thin props (walls, cliffs) collide as a chain of circles along their
 * width so the player can't just clip through the middle of one; everything
 * else is a single circle. `stairStep` defaults to non-solid — you can walk
 * over it — matching the schema comment on SiteProp.solid.
 */
export function buildColliders(props: readonly SiteProp[]): Collider[] {
  const colliders: Collider[] = [];
  for (const prop of props) {
    const solid = prop.solid ?? prop.kind !== 'stairStep';
    if (!solid) continue;

    const scale = prop.scale ?? [1, 1, 1];
    const footprint = PROP_FOOTPRINT[prop.kind];
    const w = footprint.w * scale[0];
    const d = footprint.d * scale[2];
    const rot = prop.rotationY ?? 0;
    const axisX = Math.cos(rot);
    const axisZ = Math.sin(rot);

    if (prop.kind === 'wall' || prop.kind === 'cliff') {
      const segRadius = Math.max(d, 0.3) / 2 + 0.12;
      const count = Math.max(1, Math.round(w / (segRadius * 1.4)));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count - 0.5;
        const lx = t * w;
        colliders.push({ x: prop.position.x + lx * axisX, z: prop.position.z + lx * axisZ, radius: segRadius });
      }
    } else if (prop.kind === 'archway') {
      const spacing = 1.6 * scale[0];
      for (const s of [-1, 1]) {
        const lx = (s * spacing) / 2;
        colliders.push({ x: prop.position.x + lx * axisX, z: prop.position.z + lx * axisZ, radius: 0.28 });
      }
    } else {
      colliders.push({ x: prop.position.x, z: prop.position.z, radius: (Math.max(w, d) / 2) * 0.85 });
    }
  }
  return colliders;
}

/** Pushes (x, z) out of every overlapping collider. Two passes is enough for a handful of colliders. */
export function resolveCollisions(x: number, z: number, colliders: readonly Collider[]): { x: number; z: number } {
  let rx = x;
  let rz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const dx = rx - c.x;
      const dz = rz - c.z;
      const dist = Math.hypot(dx, dz);
      const minDist = c.radius + PLAYER_RADIUS;
      if (dist >= minDist) continue;
      if (dist < 1e-4) {
        rx += minDist;
        continue;
      }
      const push = minDist - dist;
      rx += (dx / dist) * push;
      rz += (dz / dist) * push;
    }
  }
  return { x: rx, z: rz };
}

/** Keeps the player inside the site's square walkable bound. */
export function clampToBounds(x: number, z: number, halfExtent: number): { x: number; z: number } {
  const m = Math.max(0, halfExtent - PLAYER_RADIUS);
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}

/** Keeps the player inside a rectangular walkable bound — a detecting field's plot. */
export function clampToRectBounds(
  x: number,
  z: number,
  halfWidth: number,
  halfHeight: number,
): { x: number; z: number } {
  const mx = Math.max(0, halfWidth - PLAYER_RADIUS);
  const mz = Math.max(0, halfHeight - PLAYER_RADIUS);
  return { x: Math.max(-mx, Math.min(mx, x)), z: Math.max(-mz, Math.min(mz, z)) };
}

export interface RectBounds {
  halfWidth: number;
  halfHeight: number;
}

export interface PlayerState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface StepInput {
  dt: number;
  /** -1..1, strafe right positive. */
  moveX: number;
  /** -1..1, forward positive. */
  moveY: number;
  yawDelta: number;
  pitchDelta: number;
  /** Metres per second at full stick deflection. */
  speed: number;
  colliders: readonly Collider[];
  /** A number is a square half-extent (authored sites); RectBounds is a plot's width/height (fields). */
  bounds: number | RectBounds;
  hazards: readonly HazardZone[];
  siteProgress: readonly string[];
}

export interface StepResult {
  hazard: HazardZone | null;
}

const PITCH_MIN = -1.15;
const PITCH_MAX = 1.0;

/** Forward/right unit vectors for a yaw where 0 faces -Z (matches SiteDef.spawnYaw). */
export function facingVectors(yaw: number): { forwardX: number; forwardZ: number; rightX: number; rightZ: number } {
  return { forwardX: Math.sin(yaw), forwardZ: -Math.cos(yaw), rightX: Math.cos(yaw), rightZ: Math.sin(yaw) };
}

/** Advances the player one frame: look, move, collide, clamp, hazard-check. Mutates `state`. */
export function stepPlayer(state: PlayerState, input: StepInput): StepResult {
  state.yaw += input.yawDelta;
  state.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, state.pitch + input.pitchDelta));

  const { forwardX, forwardZ, rightX, rightZ } = facingVectors(state.yaw);
  const mx = input.moveY * forwardX + input.moveX * rightX;
  const mz = input.moveY * forwardZ + input.moveX * rightZ;
  const len = Math.hypot(mx, mz);

  let nx = state.x;
  let nz = state.z;
  if (len > 1e-3) {
    const clampedLen = Math.min(len, 1);
    nx += (mx / len) * clampedLen * input.speed * input.dt;
    nz += (mz / len) * clampedLen * input.speed * input.dt;
  }

  const resolved = resolveCollisions(nx, nz, input.colliders);
  const clamped =
    typeof input.bounds === 'number'
      ? clampToBounds(resolved.x, resolved.z, input.bounds)
      : clampToRectBounds(resolved.x, resolved.z, input.bounds.halfWidth, input.bounds.halfHeight);
  nx = clamped.x;
  nz = clamped.z;

  let hazard: HazardZone | null = null;
  for (const hz of input.hazards) {
    if (hz.disarmedByFlag && input.siteProgress.includes(hz.disarmedByFlag)) continue;
    const dx = nx - hz.position.x;
    const dz = nz - hz.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= hz.radius) continue;
    hazard = hz;
    const pushDist = hz.radius + 0.15;
    if (dist < 1e-4) {
      nx = hz.position.x + pushDist;
      nz = hz.position.z;
    } else {
      nx = hz.position.x + (dx / dist) * pushDist;
      nz = hz.position.z + (dz / dist) * pushDist;
    }
    break;
  }

  state.x = nx;
  state.z = nz;
  return { hazard };
}

export interface InteractionState {
  siteProgress: readonly string[];
  discovered: readonly string[];
  /**
   * Ids of authored adventures currently marked 'complete'. Optional because
   * most call sites (and every existing test) don't care about it — only an
   * interactable with `requiresAdventuresComplete` looks at this.
   */
  adventuresComplete?: readonly string[];
}

/** Whether an interactable currently offers anything — gating + "already used". */
export function isInteractableAvailable(it: SiteInteractable, state: InteractionState): boolean {
  if (it.requiresFlag && !state.siteProgress.includes(it.requiresFlag)) return false;
  if (it.hideOnFlag && state.siteProgress.includes(it.hideOnFlag)) return false;
  if (it.requiresAdventuresComplete) {
    const complete = state.adventuresComplete ?? [];
    if (!it.requiresAdventuresComplete.every((id) => complete.includes(id))) return false;
  }
  if ((it.kind === 'observe' || it.kind === 'pickup') && it.targetId && state.discovered.includes(it.targetId)) {
    return false;
  }
  return true;
}

export interface CoilSweepOptions {
  /** Metres ahead of the player the coil rests. */
  forward: number;
  /** Metres either side of centre at full amplitude. */
  width: number;
  /** 0..1 — how wide the current sweep is (narrows while pinpointing). */
  amp: number;
}

/**
 * World position of the detector coil: held out in front of the player and
 * swept side to side. Shared by every first-person detecting view (a
 * procedural field or an authored site's one buried find) so the physical
 * feel of sweeping is identical everywhere the detector comes out.
 */
export function sweepCoilPosition(
  x: number,
  z: number,
  yaw: number,
  sweepPhase: number,
  opts: CoilSweepOptions,
): { x: number; z: number } {
  const { forwardX, forwardZ, rightX, rightZ } = facingVectors(yaw);
  const lateral = Math.sin(sweepPhase) * opts.width * opts.amp;
  return {
    x: x + forwardX * opts.forward + rightX * lateral,
    z: z + forwardZ * opts.forward + rightZ * lateral,
  };
}

export interface ThirdPersonCameraOptions {
  /** Metres behind CK at zero arc. */
  distance: number;
  /** Base camera height above the ground, metres. */
  height: number;
  /** Look-at target height above the ground, roughly CK's head. */
  lookHeight: number;
  /** Clamped range for the vertical orbit arc, radians. */
  pitchMin: number;
  pitchMax: number;
}

export interface ThirdPersonCameraPose {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

/**
 * Where a third-person chase camera sits, given CK's position and the same
 * yaw/pitch a first-person eye camera would have used. Reusing yaw/pitch
 * (rather than a free orbit) means every interaction/collision system that
 * already reasons about "where the player is facing" keeps working unchanged
 * — the camera just trails behind that facing instead of sitting at it.
 */
export function thirdPersonCameraPose(
  x: number,
  z: number,
  yaw: number,
  pitch: number,
  opts: ThirdPersonCameraOptions,
): ThirdPersonCameraPose {
  const { forwardX, forwardZ } = facingVectors(yaw);
  const armPitch = Math.max(opts.pitchMin, Math.min(opts.pitchMax, pitch));
  const back = Math.cos(armPitch) * opts.distance;
  const up = Math.sin(armPitch) * opts.distance;
  return {
    x: x - forwardX * back,
    y: opts.height + up,
    z: z - forwardZ * back,
    lookX: x,
    lookY: opts.lookHeight,
    lookZ: z,
  };
}

/**
 * Clamped local yaw offset for CK's head to turn toward a world-space point
 * of interest, relative to his own facing — the pure math behind "curious
 * head movement near artifacts" and "brief hesitation near a known hazard".
 * Uses the same atan2(dx, -dz) convention as nearestInteractable's facing
 * check, so a target dead ahead always yields 0.
 */
export function headTurnToward(yaw: number, dx: number, dz: number, maxOffsetRad = 0.55): number {
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-3) return 0;
  const angleToTarget = Math.atan2(dx, -dz);
  let diff = angleToTarget - yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-maxOffsetRad, Math.min(maxOffsetRad, diff));
}

/**
 * The single interactable the crosshair is "on", if any: closest available
 * one within range and roughly in front of the player. Close range skips the
 * facing check so you don't have to be pixel-perfect on something right next
 * to you.
 */
export function nearestInteractable(
  x: number,
  z: number,
  yaw: number,
  interactables: readonly SiteInteractable[],
  state: InteractionState,
  maxAngle = 0.95,
): SiteInteractable | null {
  let best: SiteInteractable | null = null;
  let bestDist = Infinity;
  for (const it of interactables) {
    if (!isInteractableAvailable(it, state)) continue;
    const dx = it.position.x - x;
    const dz = it.position.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > it.range) continue;
    if (dist > 0.6) {
      const angleToTarget = Math.atan2(dx, -dz);
      let diff = Math.abs(angleToTarget - yaw);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > maxAngle) continue;
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = it;
    }
  }
  return best;
}
