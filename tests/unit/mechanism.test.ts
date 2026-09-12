import { describe, expect, it } from 'vitest';
import { SEALED_CHAMBER } from '@/content/adventure/sealedChamber';
import {
  brushPlate,
  createMechanism,
  drainMechanismEvents,
  holdClamp,
  liftArtifact,
  nextExpectedOrder,
  releaseHold,
  stepMechanism,
  touchRim,
} from '@/systems/mechanism';

const config = SEALED_CHAMBER.mechanism;
const HOLD = config.holdSeconds + 0.01;

function mech() {
  return createMechanism(config);
}

/** Clamp ids in their correct release order. */
const ORDER = [...config.clamps].sort((a, b) => a.order - b.order).map((c) => c.id);

describe('the plate', () => {
  it('starts dusted, with the order hidden', () => {
    const state = mech();
    expect(state.dust).toBe(1);
    expect(state.orderKnown).toBe(false);
  });

  it('reveals the order once enough dust is brushed away', () => {
    const state = mech();
    for (let i = 0; i < 10; i++) brushPlate(state, 0.12);
    expect(state.dust).toBeLessThan(0.26);
    expect(state.orderKnown).toBe(true);
  });
});

describe('clamps', () => {
  it('needs a sustained hold, not a tap', () => {
    const state = mech();
    expect(holdClamp(state, ORDER[0]!, 0.1)).toBe(false);
    expect(state.clamps[0]!.released).toBe(false);
    expect(holdClamp(state, ORDER[0]!, HOLD)).toBe(true);
    expect(state.released).toBe(1);
  });

  it('abandoning a hold costs nothing', () => {
    const state = mech();
    holdClamp(state, ORDER[0]!, 0.5);
    releaseHold(state, ORDER[0]!);
    expect(state.clamps.find((c) => c.id === ORDER[0])!.hold).toBe(0);
    expect(state.tension).toBe(0);
    expect(state.condition).toBe(100);
  });

  it('punishes the wrong order with tension and damage, but does not release', () => {
    const state = mech();
    const wrong = ORDER[2]!;
    expect(holdClamp(state, wrong, HOLD)).toBe(false);
    expect(state.clamps.find((c) => c.id === wrong)!.released).toBe(false);
    expect(state.tension).toBeCloseTo(config.wrongOrderTension, 5);
    expect(state.condition).toBeCloseTo(100 - config.wrongOrderDamage, 5);
    expect(state.mistakes).toBe(1);
    expect(drainMechanismEvents(state).some((e) => e.kind === 'click')).toBe(true);
  });

  it('frees the artifact when all three come off in order', () => {
    const state = mech();
    for (const id of ORDER) {
      expect(nextExpectedOrder(state)).toBe(ORDER.indexOf(id) + 1);
      expect(holdClamp(state, id, HOLD)).toBe(true);
    }
    expect(state.free).toBe(true);
    expect(state.released).toBe(3);
    expect(state.tension).toBe(0);
    expect(state.condition).toBe(100);
  });

  it('ignores further input once the artifact is free', () => {
    const state = mech();
    for (const id of ORDER) holdClamp(state, id, HOLD);
    const before = { ...state };
    touchRim(state);
    stepMechanism(state, 5);
    expect(state.tension).toBe(before.tension);
    expect(state.condition).toBe(before.condition);
  });
});

describe('tension', () => {
  it('only creeps once the mechanism has been disturbed', () => {
    const state = mech();
    stepMechanism(state, 3);
    expect(state.tension).toBe(0);
    holdClamp(state, ORDER[0]!, HOLD);
    stepMechanism(state, 3);
    expect(state.tension).toBeGreaterThan(0);
  });

  it('creeps faster the more clamps are off', () => {
    const one = mech();
    holdClamp(one, ORDER[0]!, HOLD);
    stepMechanism(one, 1);

    const two = mech();
    holdClamp(two, ORDER[0]!, HOLD);
    holdClamp(two, ORDER[1]!, HOLD);
    stepMechanism(two, 1);

    expect(two.tension).toBeGreaterThan(one.tension);
  });

  it('charges for touching the pressure rim', () => {
    const state = mech();
    touchRim(state);
    expect(state.tension).toBeCloseTo(config.rimTension, 5);
    expect(state.mistakes).toBe(1);
  });

  it('collapses the chamber at full tension', () => {
    const state = mech();
    for (let i = 0; i < 12; i++) touchRim(state);
    expect(state.tension).toBe(100);
    expect(state.collapsing).toBe(true);
    expect(drainMechanismEvents(state).some((e) => e.kind === 'collapse')).toBe(true);
    // A collapsing chamber stops accepting careful work.
    expect(holdClamp(state, ORDER[0]!, HOLD)).toBe(false);
  });
});

describe('lifting the artifact', () => {
  it('a clean extraction keeps the artifact nearly perfect', () => {
    const state = mech();
    for (const id of ORDER) holdClamp(state, id, HOLD);
    expect(liftArtifact(state, false)).toBeGreaterThanOrEqual(99);
  });

  it('a forced grab during a collapse costs a lot', () => {
    const clean = mech();
    for (const id of ORDER) holdClamp(clean, id, HOLD);
    const cleanCondition = liftArtifact(clean, false);

    const forced = mech();
    for (let i = 0; i < 12; i++) touchRim(forced);
    const forcedCondition = liftArtifact(forced, true);

    expect(forcedCondition).toBeLessThan(cleanCondition - 25);
    expect(forcedCondition).toBeGreaterThanOrEqual(5);
  });
});

describe('adventure content integrity', () => {
  it('every beat choice points somewhere real', () => {
    const ids = new Set(SEALED_CHAMBER.beats.map((b) => b.id));
    ids.add('puzzle');
    for (const beat of SEALED_CHAMBER.beats) {
      for (const choice of beat.choices) {
        expect(ids.has(choice.to), `${beat.id} -> ${choice.to}`).toBe(true);
      }
    }
    expect(ids.has(SEALED_CHAMBER.startBeat)).toBe(true);
  });

  it('the dial puzzle is solvable and does not start solved', () => {
    const { solution, start, positions } = SEALED_CHAMBER.puzzle;
    expect(solution).toHaveLength(start.length);
    expect(solution.every((v) => v >= 0 && v < positions)).toBe(true);
    expect(start.every((v) => v >= 0 && v < positions)).toBe(true);
    expect(start.join()).not.toBe(solution.join());
  });

  it('has an escape sequence with reactable windows', () => {
    expect(SEALED_CHAMBER.escape.length).toBeGreaterThan(0);
    for (const beat of SEALED_CHAMBER.escape) {
      expect(beat.window).toBeGreaterThan(1);
      expect(beat.prompt.length).toBeGreaterThan(0);
      expect(beat.success.length).toBeGreaterThan(0);
      expect(beat.failure.length).toBeGreaterThan(0);
    }
  });
});
