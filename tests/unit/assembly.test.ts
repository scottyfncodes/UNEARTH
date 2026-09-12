import { describe, expect, it } from 'vitest';
import { getTarget } from '@/content/targets';
import { freshSave } from '@/core/save';
import { resolveDiscovery } from '@/systems/discovery';
import {
  activeAssemblies,
  allComposites,
  assemblyProgress,
  resolveAssembly,
} from '@/systems/assembly';
import type { SaveData } from '@/core/types';

const shardA = getTarget('tgt_shard_a')!;
const shardB = getTarget('tgt_shard_b')!;
const shardC = getTarget('tgt_shard_c')!;
const tablet = getTarget('tgt_bound_tablet')!;

function dig(save: SaveData, def = shardA, condition = 90): SaveData {
  return resolveDiscovery(save, {
    def,
    condition,
    depthCm: 10,
    locationId: 'loc_old_park',
  }).save;
}

describe('content integrity for composites', () => {
  it('every composite is authored and never appears on a loot table', () => {
    for (const composite of allComposites()) {
      expect(composite.authored).toBe(true);
      expect(composite.locations).toBeUndefined();
    }
  });

  it('the bound tablet is made of exactly its three shards', () => {
    expect(tablet.assemblyOf).toEqual(['tgt_shard_a', 'tgt_shard_b', 'tgt_shard_c']);
    for (const pieceId of tablet.assemblyOf!) {
      expect(getTarget(pieceId)?.pieceOf).toBe(tablet.id);
    }
  });
});

describe('assemblyProgress', () => {
  it('is null for a target that is not a composite', () => {
    expect(assemblyProgress(freshSave(), 'tgt_shard_a')).toBeNull();
    expect(assemblyProgress(freshSave(), 'nonsense')).toBeNull();
  });

  it('starts at zero held, not ready, not done', () => {
    const progress = assemblyProgress(freshSave(), tablet.id)!;
    expect(progress.heldCount).toBe(0);
    expect(progress.totalCount).toBe(3);
    expect(progress.ready).toBe(false);
    expect(progress.done).toBe(false);
    expect(progress.pieces.every((p) => !p.held)).toBe(true);
  });

  it('tracks partial progress as pieces are found', () => {
    let save = freshSave();
    save = dig(save, shardA);
    const progress = assemblyProgress(save, tablet.id)!;
    expect(progress.heldCount).toBe(1);
    expect(progress.ready).toBe(false);
    expect(progress.pieces.find((p) => p.def.id === shardA.id)?.held).toBe(true);
    expect(progress.pieces.find((p) => p.def.id === shardB.id)?.held).toBe(false);
  });

  it('is ready once every piece is held, and not before', () => {
    let save = freshSave();
    save = dig(save, shardA);
    save = dig(save, shardB);
    expect(assemblyProgress(save, tablet.id)!.ready).toBe(false);
    save = dig(save, shardC);
    expect(assemblyProgress(save, tablet.id)!.ready).toBe(true);
  });
});

describe('activeAssemblies', () => {
  it('hides composites with zero progress', () => {
    expect(activeAssemblies(freshSave())).toHaveLength(0);
  });

  it('surfaces a composite the moment the first piece is found', () => {
    const save = dig(freshSave(), shardA);
    const active = activeAssemblies(save);
    expect(active).toHaveLength(1);
    expect(active[0]!.composite.id).toBe(tablet.id);
  });
});

describe('resolveAssembly', () => {
  it('refuses to assemble without every piece', () => {
    const save = dig(freshSave(), shardA);
    expect(resolveAssembly(save, tablet.id)).toBeNull();
  });

  it('refuses an unknown or non-composite id', () => {
    expect(resolveAssembly(freshSave(), 'tgt_shard_a')).toBeNull();
    expect(resolveAssembly(freshSave(), 'nonsense')).toBeNull();
  });

  it('produces a discovery record for the composite once every piece is held', () => {
    let save = freshSave();
    save = dig(save, shardA, 90);
    save = dig(save, shardB, 80);
    save = dig(save, shardC, 100);

    const result = resolveAssembly(save, tablet.id)!;
    expect(result).not.toBeNull();
    expect(result.outcome.def.id).toBe(tablet.id);
    expect(result.outcome.record.targetId).toBe(tablet.id);
    // Condition is the average of the three pieces: (90+80+100)/3 = 90.
    expect(result.outcome.record.condition).toBe(90);
    expect(result.save.assembled).toContain(tablet.id);
    // The composite is now itself a real journal entry, on top of the pieces.
    expect(result.save.discoveries.some((d) => d.targetId === tablet.id)).toBe(true);
    expect(result.save.discoveries.filter((d) => d.targetId !== tablet.id)).toHaveLength(3);
  });

  it('grants the assembly clue and reports it as new', () => {
    let save = freshSave();
    save = dig(save, shardA);
    save = dig(save, shardB);
    save = dig(save, shardC);
    const result = resolveAssembly(save, tablet.id)!;
    expect(result.outcome.clue?.id).toBe('clue_tablet_assembled');
    expect(result.save.clues).toContain('clue_tablet_assembled');
  });

  it('completing the shard chain first, then assembling, unlocks the courtyard', () => {
    let save = freshSave();
    expect(save.unlockedLocations).not.toContain('loc_courtyard');

    save = dig(save, shardA);
    save = dig(save, shardB);
    const beforeAssembly = dig(save, shardC);
    // The 3-shard chain should have completed on the third find already.
    expect(beforeAssembly.chainsComplete).toContain('chain_tablet');
    expect(beforeAssembly.unlockedLocations).not.toContain('loc_courtyard');

    const result = resolveAssembly(beforeAssembly, tablet.id)!;
    expect(result.outcome.unlockedLocations.map((l) => l.id)).toEqual(['loc_courtyard']);
    expect(result.save.unlockedLocations).toContain('loc_courtyard');
    expect(result.save.chainsComplete).toContain('chain_tablet_bound');
  });

  it('is idempotent-safe: assembling twice is refused the second time', () => {
    let save = freshSave();
    save = dig(save, shardA);
    save = dig(save, shardB);
    save = dig(save, shardC);
    const first = resolveAssembly(save, tablet.id)!;
    expect(resolveAssembly(first.save, tablet.id)).toBeNull();
  });

  it('does not duplicate a chain completion across repeat piece discoveries', () => {
    // Re-digging a shard the player already has (a second Carved Shard from a
    // fresh field) must not re-fire the 3-shard chain event.
    let save = freshSave();
    save = dig(save, shardA);
    save = dig(save, shardB);
    save = dig(save, shardC);
    expect(save.chainsComplete.filter((id) => id === 'chain_tablet')).toHaveLength(1);
    const again = dig(save, shardA);
    expect(again.chainsComplete.filter((id) => id === 'chain_tablet')).toHaveLength(1);
  });
});
