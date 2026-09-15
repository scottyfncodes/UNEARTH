import { describe, expect, it } from 'vitest';
import {
  buildColliders,
  clampToBounds,
  clampToRectBounds,
  facingVectors,
  isInteractableAvailable,
  nearestInteractable,
  resolveCollisions,
  stepPlayer,
  sweepCoilPosition,
  thirdPersonCameraPose,
  type PlayerState,
} from '@/systems/explore';
import type { HazardZone, SiteInteractable, SiteProp } from '@/content/sites/types';

describe('buildColliders', () => {
  it('produces a chain of circles for a wide wall, not one giant one', () => {
    const props: SiteProp[] = [{ id: 'w', kind: 'wall', position: { x: 0, y: 0, z: 0 }, scale: [3, 1, 1] }];
    const colliders = buildColliders(props);
    expect(colliders.length).toBeGreaterThan(1);
    for (const c of colliders) expect(c.radius).toBeLessThan(1.5);
  });

  it('skips a stairStep by default (non-solid) but respects an explicit solid: true', () => {
    const step: SiteProp = { id: 's', kind: 'stairStep', position: { x: 0, y: 0, z: 0 } };
    expect(buildColliders([step])).toHaveLength(0);
    expect(buildColliders([{ ...step, solid: true }]).length).toBeGreaterThan(0);
  });

  it('skips any prop explicitly marked solid: false', () => {
    const rock: SiteProp = { id: 'r', kind: 'rock', position: { x: 0, y: 0, z: 0 }, solid: false };
    expect(buildColliders([rock])).toHaveLength(0);
  });

  it('gives an archway two post colliders, not a solid block across the gap', () => {
    const arch: SiteProp = { id: 'a', kind: 'archway', position: { x: 0, y: 0, z: 0 } };
    const colliders = buildColliders([arch]);
    expect(colliders).toHaveLength(2);
    // Walking straight through the middle (x=0) must not hit either post.
    for (const c of colliders) expect(Math.abs(c.x)).toBeGreaterThan(0.3);
  });
});

describe('resolveCollisions', () => {
  it('pushes the player out of a single overlapping collider', () => {
    const { x, z } = resolveCollisions(0, 0, [{ x: 0, z: 0, radius: 1 }]);
    expect(Math.hypot(x, z)).toBeGreaterThan(1);
  });

  it('leaves a position with no overlap untouched', () => {
    const result = resolveCollisions(10, 10, [{ x: 0, z: 0, radius: 1 }]);
    expect(result).toEqual({ x: 10, z: 10 });
  });
});

describe('clampToBounds', () => {
  it('keeps a position inside the square walkable area', () => {
    const { x, z } = clampToBounds(100, -100, 10);
    expect(x).toBeLessThanOrEqual(10);
    expect(z).toBeGreaterThanOrEqual(-10);
  });
});

describe('clampToRectBounds', () => {
  it('clamps each axis independently to its own half-extent', () => {
    const { x, z } = clampToRectBounds(100, -100, 5, 20);
    expect(x).toBeLessThanOrEqual(5);
    expect(z).toBeGreaterThanOrEqual(-20);
  });

  it('leaves an interior point untouched', () => {
    expect(clampToRectBounds(1, -2, 10, 10)).toEqual({ x: 1, z: -2 });
  });
});

describe('sweepCoilPosition', () => {
  it('rests straight ahead at sweep phase 0', () => {
    const { x, z } = sweepCoilPosition(0, 0, 0, 0, { forward: 0.6, width: 0.4, amp: 1 });
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(-0.6, 5);
  });

  it('swings laterally as the sweep phase advances', () => {
    const a = sweepCoilPosition(0, 0, 0, Math.PI / 2, { forward: 0.6, width: 0.4, amp: 1 });
    expect(a.x).toBeCloseTo(0.4, 5);
    const b = sweepCoilPosition(0, 0, 0, -Math.PI / 2, { forward: 0.6, width: 0.4, amp: 1 });
    expect(b.x).toBeCloseTo(-0.4, 5);
  });

  it('narrows toward dead-centre as amplitude drops (pinpointing)', () => {
    const wide = sweepCoilPosition(0, 0, 0, Math.PI / 2, { forward: 0.6, width: 0.4, amp: 1 });
    const narrow = sweepCoilPosition(0, 0, 0, Math.PI / 2, { forward: 0.6, width: 0.4, amp: 0.1 });
    expect(Math.abs(narrow.x)).toBeLessThan(Math.abs(wide.x));
  });

  it('follows the player position and yaw, not just the local offset', () => {
    const { x, z } = sweepCoilPosition(10, 10, Math.PI, 0, { forward: 1, width: 0, amp: 1 });
    // Facing +Z (yaw = PI) puts the coil one metre further along +Z.
    expect(x).toBeCloseTo(10, 5);
    expect(z).toBeCloseTo(11, 5);
  });
});

describe('facingVectors', () => {
  it('faces -Z at yaw 0, matching the SiteDef.spawnYaw convention', () => {
    const { forwardX, forwardZ } = facingVectors(0);
    expect(forwardX).toBeCloseTo(0, 5);
    expect(forwardZ).toBeCloseTo(-1, 5);
  });
});

describe('stepPlayer', () => {
  function player(): PlayerState {
    return { x: 0, z: 0, yaw: 0, pitch: 0 };
  }

  it('moves forward at yaw 0 toward -Z', () => {
    const p = player();
    stepPlayer(p, {
      dt: 1,
      moveX: 0,
      moveY: 1,
      yawDelta: 0,
      pitchDelta: 0,
      speed: 2,
      colliders: [],
      bounds: 50,
      hazards: [],
      siteProgress: [],
    });
    expect(p.z).toBeLessThan(0);
    expect(p.x).toBeCloseTo(0, 5);
  });

  it('a wall stops forward movement rather than letting the player pass through', () => {
    const p = player();
    const colliders = [{ x: 0, z: -1, radius: 0.8 }];
    for (let i = 0; i < 30; i++) {
      stepPlayer(p, {
        dt: 0.1,
        moveX: 0,
        moveY: 1,
        yawDelta: 0,
        pitchDelta: 0,
        speed: 2,
        colliders,
        bounds: 50,
        hazards: [],
        siteProgress: [],
      });
    }
    expect(p.z).toBeGreaterThan(-1);
  });

  it('clamps pitch so looking never flips past comfortable limits', () => {
    const p = player();
    stepPlayer(p, {
      dt: 1,
      moveX: 0,
      moveY: 0,
      yawDelta: 0,
      pitchDelta: 10,
      speed: 2,
      colliders: [],
      bounds: 50,
      hazards: [],
      siteProgress: [],
    });
    expect(p.pitch).toBeLessThan(Math.PI / 2);
  });

  it('an active hazard pushes the player back out and is reported', () => {
    const p: PlayerState = { x: 0, z: 0, yaw: 0, pitch: 0 };
    const hazard: HazardZone = { id: 'h', position: { x: 0, y: 0, z: 0 }, radius: 2, warning: 'careful' };
    const result = stepPlayer(p, {
      dt: 0,
      moveX: 0,
      moveY: 0,
      yawDelta: 0,
      pitchDelta: 0,
      speed: 0,
      colliders: [],
      bounds: 50,
      hazards: [hazard],
      siteProgress: [],
    });
    expect(result.hazard).toBe(hazard);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(2);
  });

  it('a disarmed hazard (flag held) no longer triggers', () => {
    const p: PlayerState = { x: 0, z: 0, yaw: 0, pitch: 0 };
    const hazard: HazardZone = {
      id: 'h',
      position: { x: 0, y: 0, z: 0 },
      radius: 2,
      warning: 'careful',
      disarmedByFlag: 'safe',
    };
    const result = stepPlayer(p, {
      dt: 0,
      moveX: 0,
      moveY: 0,
      yawDelta: 0,
      pitchDelta: 0,
      speed: 0,
      colliders: [],
      bounds: 50,
      hazards: [hazard],
      siteProgress: ['safe'],
    });
    expect(result.hazard).toBeNull();
  });
});

const OBSERVE: SiteInteractable = {
  id: 'obs',
  kind: 'observe',
  prompt: 'Look closer',
  position: { x: 0, y: 0, z: -2 },
  range: 2,
  visual: 'carving',
  targetId: 'tgt_x',
};

describe('isInteractableAvailable', () => {
  it('is available with no gating and nothing discovered yet', () => {
    expect(isInteractableAvailable(OBSERVE, { siteProgress: [], discovered: [] })).toBe(true);
  });

  it('hides an observe/pickup once its target is already discovered', () => {
    expect(isInteractableAvailable(OBSERVE, { siteProgress: [], discovered: ['tgt_x'] })).toBe(false);
  });

  it('respects requiresFlag and hideOnFlag', () => {
    const gated: SiteInteractable = { ...OBSERVE, id: 'g', requiresFlag: 'need' };
    expect(isInteractableAvailable(gated, { siteProgress: [], discovered: [] })).toBe(false);
    expect(isInteractableAvailable(gated, { siteProgress: ['need'], discovered: [] })).toBe(true);

    const hidden: SiteInteractable = { ...OBSERVE, id: 'h', hideOnFlag: 'done' };
    expect(isInteractableAvailable(hidden, { siteProgress: ['done'], discovered: [] })).toBe(false);
  });

  it('respects requiresAdventuresComplete', () => {
    const gated: SiteInteractable = {
      ...OBSERVE,
      id: 'ending',
      requiresAdventuresComplete: ['adv_a', 'adv_b'],
    };
    expect(isInteractableAvailable(gated, { siteProgress: [], discovered: [] })).toBe(false);
    expect(isInteractableAvailable(gated, { siteProgress: [], discovered: [], adventuresComplete: ['adv_a'] })).toBe(
      false,
    );
    expect(
      isInteractableAvailable(gated, {
        siteProgress: [],
        discovered: [],
        adventuresComplete: ['adv_a', 'adv_b'],
      }),
    ).toBe(true);
  });
});

describe('thirdPersonCameraPose', () => {
  it('sits behind and above CK when facing -Z at zero pitch', () => {
    const pose = thirdPersonCameraPose(0, 0, 0, 0, {
      distance: 2,
      height: 1,
      lookHeight: 0.4,
      pitchMin: -0.5,
      pitchMax: 0.5,
    });
    // Facing -Z (yaw 0), "behind" is +Z.
    expect(pose.z).toBeCloseTo(2, 5);
    expect(pose.x).toBeCloseTo(0, 5);
    expect(pose.y).toBeCloseTo(1, 5);
    expect(pose.lookX).toBe(0);
    expect(pose.lookY).toBe(0.4);
    expect(pose.lookZ).toBe(0);
  });

  it('clamps pitch to the given orbit arc', () => {
    const overPitched = thirdPersonCameraPose(0, 0, 0, 5, {
      distance: 2,
      height: 1,
      lookHeight: 0.4,
      pitchMin: -0.5,
      pitchMax: 0.5,
    });
    const clampedAtMax = thirdPersonCameraPose(0, 0, 0, 0.5, {
      distance: 2,
      height: 1,
      lookHeight: 0.4,
      pitchMin: -0.5,
      pitchMax: 0.5,
    });
    expect(overPitched.y).toBeCloseTo(clampedAtMax.y, 5);
  });

  it('follows CK\'s position and yaw', () => {
    const pose = thirdPersonCameraPose(10, -4, Math.PI / 2, 0, {
      distance: 2,
      height: 1,
      lookHeight: 0.4,
      pitchMin: -0.5,
      pitchMax: 0.5,
    });
    expect(pose.lookX).toBe(10);
    expect(pose.lookZ).toBe(-4);
    // Facing +X (yaw PI/2), "behind" is -X.
    expect(pose.x).toBeCloseTo(8, 5);
    expect(pose.z).toBeCloseTo(-4, 5);
  });
});

describe('nearestInteractable', () => {
  it('finds a target directly ahead and within range', () => {
    const found = nearestInteractable(0, 0, 0, [OBSERVE], { siteProgress: [], discovered: [] });
    expect(found?.id).toBe('obs');
  });

  it('ignores a target outside its range', () => {
    const far: SiteInteractable = { ...OBSERVE, id: 'far', position: { x: 0, y: 0, z: -50 } };
    expect(nearestInteractable(0, 0, 0, [far], { siteProgress: [], discovered: [] })).toBeNull();
  });

  it('ignores a target far outside the facing cone when not close', () => {
    const behind: SiteInteractable = { ...OBSERVE, id: 'behind', position: { x: 0, y: 0, z: 5 } };
    expect(nearestInteractable(0, 0, 0, [behind], { siteProgress: [], discovered: [] })).toBeNull();
  });

  it('picks the closer of two available candidates', () => {
    const near: SiteInteractable = { ...OBSERVE, id: 'near', position: { x: 0, y: 0, z: -1 } };
    const found = nearestInteractable(0, 0, 0, [OBSERVE, near], { siteProgress: [], discovered: [] });
    expect(found?.id).toBe('near');
  });
});
