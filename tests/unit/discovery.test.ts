import { describe, expect, it } from 'vitest';
import { getTarget } from '@/content/targets';
import { CHAINS } from '@/content/clues';
import { freshSave } from '@/core/save';
import { conditionLabel, resolveDiscovery } from '@/systems/discovery';
import { chainForClue, chainProgress, newlyCompleted } from '@/systems/mystery';
import type { SaveData } from '@/core/types';

const coin = getTarget('tgt_silver_coin')!;
const badge = getTarget('tgt_brakeman_badge')!;
const tag = getTarget('tgt_survey_tag')!;
const token = getTarget('tgt_bronze_token')!;
const fragment = getTarget('tgt_stone_fragment')!;
const mechanism = getTarget('tgt_mechanism_part')!;

function find(save: SaveData, def = coin, condition = 80) {
  return resolveDiscovery(save, {
    def,
    condition,
    depthCm: 14,
    locationId: 'loc_old_railway',
  });
}

describe('resolveDiscovery', () => {
  it('adds a journal record with the right details', () => {
    const { save, outcome } = find(freshSave());
    expect(save.discoveries).toHaveLength(1);
    const record = save.discoveries[0]!;
    expect(record.targetId).toBe(coin.id);
    expect(record.condition).toBe(80);
    expect(record.depthCm).toBe(14);
    expect(record.locationId).toBe('loc_old_railway');
    expect(outcome.record).toEqual(record);
    expect(outcome.firstOfKind).toBe(true);
  });

  it('does not mutate the save it was given', () => {
    const before = freshSave();
    const snapshot = JSON.stringify(before);
    find(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('values a find by condition, and pays nothing for junk', () => {
    const good = find(freshSave(), coin, 100).outcome.record.value;
    const wrecked = find(freshSave(), coin, 10).outcome.record.value;
    expect(good).toBeGreaterThan(wrecked);
    expect(good).toBeLessThanOrEqual(coin.value);
    const junk = find(freshSave(), getTarget('tgt_bottle_cap')!, 100).outcome.record.value;
    expect(junk).toBe(0);
  });

  it('credits funds and tracks stats', () => {
    const { save, outcome } = find(freshSave(), coin, 90);
    expect(save.money).toBe(outcome.record.value);
    expect(save.stats.finds).toBe(1);
    expect(save.stats.bestCondition).toBe(90);
  });

  it('marks repeat finds as not first of kind', () => {
    const first = find(freshSave()).save;
    const second = find(first).outcome;
    expect(second.firstOfKind).toBe(false);
  });

  it('grants a clue only once', () => {
    const first = find(freshSave(), badge);
    expect(first.outcome.clue?.id).toBe('clue_badge');
    expect(first.save.clues).toEqual(['clue_badge']);
    const second = find(first.save, badge);
    expect(second.outcome.clue).toBeNull();
    expect(second.save.clues).toEqual(['clue_badge']);
  });

  it('records the teaching find as tutorial content, kept distinguishable', () => {
    const { save, outcome } = resolveDiscovery(freshSave(), {
      def: getTarget('tgt_tut_penny')!,
      condition: 90,
      depthCm: 8,
      locationId: 'loc_old_park',
      tutorial: true,
    });
    expect(outcome.record.tutorial).toBe(true);
    expect(save.flags.tutorialFound).toBe(true);
    expect(save.discoveries.filter((d) => !d.tutorial)).toHaveLength(0);
  });
});

describe('clue chains', () => {
  it('completes a chain and unlocks its location exactly once', () => {
    let save = freshSave();
    expect(save.unlockedLocations).not.toContain('loc_abandoned_mine');

    const step1 = find(save, badge);
    expect(step1.outcome.chains).toHaveLength(0);
    save = step1.save;

    const step2 = find(save, tag);
    expect(step2.outcome.chains.map((c) => c.id)).toEqual(['chain_survey']);
    expect(step2.outcome.unlockedLocations.map((l) => l.id)).toEqual(['loc_abandoned_mine']);
    save = step2.save;
    expect(save.unlockedLocations).toContain('loc_abandoned_mine');
    expect(save.chainsComplete).toEqual(['chain_survey']);

    // Finding the same clue-bearing objects again must not re-complete it.
    const again = find(save, tag);
    expect(again.outcome.chains).toHaveLength(0);
    expect(again.outcome.unlockedLocations).toHaveLength(0);
  });

  it('completes the three-clue chain and opens the adventure', () => {
    let save = freshSave();
    save = find(save, token).save;
    save = find(save, fragment).save;
    const last = find(save, mechanism);
    expect(last.outcome.chains.map((c) => c.id)).toEqual(['chain_sun']);
    expect(last.outcome.unlockedAdventures).toEqual(['adv_sealed_chamber']);
    expect(last.save.adventures.adv_sealed_chamber).toBe('available');
    expect(last.save.unlockedLocations).toContain('loc_sealed_chamber');
  });

  it('reports partial progress without completing', () => {
    const save = find(freshSave(), token).save;
    const sun = chainProgress(save.clues).find((p) => p.chain.id === 'chain_sun')!;
    expect(sun.held.map((c) => c.id)).toEqual(['clue_token']);
    expect(sun.missing).toBe(2);
    expect(sun.complete).toBe(false);
    expect(newlyCompleted(save.clues, save.chainsComplete)).toHaveLength(0);
  });

  it('links a clue back to its chain', () => {
    expect(chainForClue('clue_mechanism')?.id).toBe('chain_sun');
    expect(chainForClue('nonsense')).toBeUndefined();
  });

  it('every chain clue exists and every unlock target is real', () => {
    for (const chain of CHAINS) {
      expect(chain.clueIds.length).toBeGreaterThan(0);
      for (const clueId of chain.clueIds) {
        // Some target in the game must be able to grant this clue.
        const granter = ['tgt_brakeman_badge', 'tgt_survey_tag', 'tgt_bronze_token', 'tgt_stone_fragment', 'tgt_mechanism_part']
          .map((id) => getTarget(id)!)
          .some((def) => def.clueId === clueId);
        expect(granter, `no target grants ${clueId}`).toBe(true);
      }
    }
  });
});

describe('conditionLabel', () => {
  it('describes condition in words', () => {
    expect(conditionLabel(100)).toBe('Exceptional');
    expect(conditionLabel(80)).toBe('Good');
    expect(conditionLabel(65)).toBe('Fair');
    expect(conditionLabel(45)).toBe('Worn');
    expect(conditionLabel(25)).toBe('Poor');
    expect(conditionLabel(5)).toBe('Damaged');
  });
});
