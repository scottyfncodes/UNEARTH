import { describe, expect, it } from 'vitest';
import { SEALED_CHAMBER } from '@/content/adventure/sealedChamber';
import { ADVENTURES, getAdventure } from '@/content/adventure';
import { getTarget } from '@/content/targets';
import { getLocation } from '@/content/locations';
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

// Sealed Chamber always defines a mechanism; the assertion documents that as a test precondition.
const config = SEALED_CHAMBER.mechanism!;
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
  const all = Object.values(ADVENTURES);

  it('the registry is keyed by each adventure\'s own id and finds both authored adventures', () => {
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const [key, adv] of Object.entries(ADVENTURES)) {
      expect(adv.id).toBe(key);
      expect(getAdventure(adv.id)).toBe(adv);
    }
    expect(getAdventure('nonsense')).toBeUndefined();
  });

  it('every adventure targets a real location and a real artifact target', () => {
    for (const adv of all) {
      const loc = getLocation(adv.locationId);
      expect(loc, `${adv.id} -> ${adv.locationId}`).toBeDefined();
      expect(loc!.adventureId).toBe(adv.id);
      const artifact = getTarget(adv.artifactTargetId);
      expect(artifact, `${adv.id} -> ${adv.artifactTargetId}`).toBeDefined();
    }
  });

  it('every beat choice points somewhere real, for every adventure', () => {
    for (const adv of all) {
      const ids = new Set(adv.beats.map((b) => b.id));
      ids.add('puzzle');
      for (const beat of adv.beats) {
        for (const choice of beat.choices) {
          expect(ids.has(choice.to), `${adv.id}: ${beat.id} -> ${choice.to}`).toBe(true);
        }
      }
      expect(ids.has(adv.startBeat), `${adv.id} startBeat`).toBe(true);
    }
  });

  it('every dial puzzle is solvable, does not start solved, and has its own copy', () => {
    for (const adv of all) {
      const { solution, start, positions } = adv.puzzle;
      expect(solution.length, adv.id).toBeGreaterThan(0);
      expect(solution).toHaveLength(start.length);
      expect(solution.every((v) => v >= 0 && v < positions)).toBe(true);
      expect(start.every((v) => v >= 0 && v < positions)).toBe(true);
      expect(start.join(), `${adv.id} starts pre-solved`).not.toBe(solution.join());
      expect(adv.puzzle.screenTitle.length).toBeGreaterThan(0);
      expect(adv.puzzle.continueLabel.length).toBeGreaterThan(0);
    }
  });

  it('an adventure with a mechanism also has an escape, and vice versa is not required', () => {
    for (const adv of all) {
      if (adv.mechanism) {
        expect(adv.mechanism.clamps.length).toBeGreaterThan(0);
      }
    }
  });

  it('has an escape sequence with reactable windows', () => {
    const escape = SEALED_CHAMBER.escape!;
    expect(escape.length).toBeGreaterThan(0);
    for (const beat of escape) {
      expect(beat.window).toBeGreaterThan(1);
      expect(beat.prompt.length).toBeGreaterThan(0);
      expect(beat.success.length).toBeGreaterThan(0);
      expect(beat.failure.length).toBeGreaterThan(0);
    }
  });

  it('the courtyard is a puzzle-only adventure: no mechanism, no escape', () => {
    const courtyard = getAdventure('adv_courtyard')!;
    expect(courtyard.mechanism).toBeUndefined();
    expect(courtyard.escape).toBeUndefined();
    expect(courtyard.cleanCondition).toBeGreaterThan(0);
    expect(courtyard.cleanCondition).toBeLessThanOrEqual(100);
  });

  it('every adventure has non-empty intro and outro text', () => {
    for (const adv of all) {
      expect(adv.intro.length, adv.id).toBeGreaterThan(0);
      expect(adv.outro.length, adv.id).toBeGreaterThan(0);
      expect(adv.introSubtitle.length).toBeGreaterThan(0);
    }
  });
});
