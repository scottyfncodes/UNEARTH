import { describe, expect, it } from 'vitest';
import { getLocation } from '@/content/locations';
import { getTarget } from '@/content/targets';
import { generateField, remainingTargets } from '@/systems/placement';

const park = getLocation('loc_old_park')!;
const mine = getLocation('loc_abandoned_mine')!;

describe('generateField', () => {
  it('is deterministic for a given seed', () => {
    const a = generateField(park, 12345, { heldClues: [], includeTutorial: false });
    const b = generateField(park, 12345, { heldClues: [], includeTutorial: false });
    expect(a.targets).toEqual(b.targets);
  });

  it('produces different ground for different seeds', () => {
    const a = generateField(park, 1, { heldClues: [], includeTutorial: false });
    const b = generateField(park, 2, { heldClues: [], includeTutorial: false });
    expect(a.targets.map((t) => `${t.targetId}${t.x}`).join()).not.toBe(
      b.targets.map((t) => `${t.targetId}${t.x}`).join(),
    );
  });

  it('respects the configured target count', () => {
    for (let seed = 1; seed < 25; seed++) {
      const field = generateField(park, seed, { heldClues: [], includeTutorial: false });
      expect(field.targets.length).toBeGreaterThanOrEqual(park.targetCount[0]);
      expect(field.targets.length).toBeLessThanOrEqual(park.targetCount[1]);
    }
  });

  it('keeps targets inside the plot and apart from each other', () => {
    for (let seed = 1; seed < 15; seed++) {
      const field = generateField(park, seed, { heldClues: [], includeTutorial: false });
      for (const target of field.targets) {
        expect(target.x).toBeGreaterThan(0);
        expect(target.x).toBeLessThan(park.bounds.w);
        expect(target.y).toBeGreaterThan(0);
        expect(target.y).toBeLessThan(park.bounds.h);
        // Nothing directly under the player's starting position.
        expect(Math.hypot(target.x - park.bounds.w / 2, target.y - park.bounds.h / 2)).toBeGreaterThan(100);
      }
      for (let i = 0; i < field.targets.length; i++) {
        for (let j = i + 1; j < field.targets.length; j++) {
          const a = field.targets[i]!;
          const b = field.targets[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(120);
        }
      }
    }
  });

  it('only places targets that the location allows', () => {
    for (let seed = 1; seed < 40; seed++) {
      const field = generateField(park, seed, { heldClues: [], includeTutorial: false });
      for (const target of field.targets) {
        const def = getTarget(target.targetId)!;
        expect(def.authored).not.toBe(true);
        if (def.locations) expect(def.locations).toContain(park.id);
      }
    }
  });

  it('weights the ground heavily towards junk', () => {
    let common = 0;
    let total = 0;
    for (let seed = 1; seed < 60; seed++) {
      for (const target of generateField(park, seed, { heldClues: [], includeTutorial: false }).targets) {
        total++;
        if (getTarget(target.targetId)!.rarity === 'common') common++;
      }
    }
    expect(common / total).toBeGreaterThan(0.6);
  });

  it('always leaves at least one thing worth finding', () => {
    for (let seed = 1; seed < 50; seed++) {
      const field = generateField(park, seed, { heldClues: [], includeTutorial: false });
      const keepers = field.targets.filter((t) => getTarget(t.targetId)!.rarity !== 'common');
      expect(keepers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('inserts the teaching target shallow and close, and only when asked', () => {
    const withTutorial = generateField(park, 99, { heldClues: [], includeTutorial: true });
    const tutorial = withTutorial.targets.find((t) => t.tutorial);
    expect(tutorial).toBeDefined();
    expect(tutorial!.targetId).toBe('tgt_tut_penny');
    expect(tutorial!.depth).toBeLessThan(12);
    const distance = Math.hypot(
      tutorial!.x - withTutorial.playerX,
      tutorial!.y - withTutorial.playerY,
    );
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(260);

    const without = generateField(park, 99, { heldClues: [], includeTutorial: false });
    expect(without.targets.some((t) => t.tutorial)).toBe(false);
  });

  it('suppresses clue targets the player already holds', () => {
    let withHeld = 0;
    let withoutHeld = 0;
    for (let seed = 1; seed < 80; seed++) {
      const held = generateField(mine, seed, { heldClues: ['clue_token'], includeTutorial: false });
      const fresh = generateField(mine, seed, { heldClues: [], includeTutorial: false });
      withHeld += held.targets.filter((t) => t.targetId === 'tgt_bronze_token').length;
      withoutHeld += fresh.targets.filter((t) => t.targetId === 'tgt_bronze_token').length;
    }
    expect(withHeld).toBeLessThan(withoutHeld);
  });

  it('buries things deeper in older ground', () => {
    const parkDepth = average(
      generateField(park, 7, { heldClues: [], includeTutorial: false }).targets.map((t) => t.depth),
    );
    const mineDepth = average(
      generateField(mine, 7, { heldClues: [], includeTutorial: false }).targets.map((t) => t.depth),
    );
    expect(mineDepth).toBeGreaterThan(parkDepth);
  });

  it('gives every target a sane depth and condition', () => {
    const field = generateField(mine, 5, { heldClues: [], includeTutorial: false });
    for (const target of field.targets) {
      expect(target.depth).toBeGreaterThan(0);
      expect(target.depth).toBeLessThanOrEqual(55);
      expect(target.baseCondition).toBeGreaterThanOrEqual(35);
      expect(target.baseCondition).toBeLessThanOrEqual(100);
    }
  });

  it('counts undug targets', () => {
    const field = generateField(park, 3, { heldClues: [], includeTutorial: false });
    const before = remainingTargets(field);
    field.targets[0]!.dug = true;
    expect(remainingTargets(field)).toBe(before - 1);
  });
});

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
