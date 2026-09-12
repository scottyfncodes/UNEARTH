import { describe, expect, it } from 'vitest';
import { LOCATIONS, getLocation } from '@/content/locations';
import { TARGETS, getTarget, getTargetOrPlaceholder } from '@/content/targets';
import { CHAINS, CLUES } from '@/content/clues';
import { DETECTORS, TOOLS } from '@/content/equipment';
import { SILHOUETTES, getSilhouette, pointInSilhouette } from '@/content/silhouettes';
import { RARITY_ORDER } from '@/core/types';

describe('target definitions', () => {
  it('have unique ids', () => {
    const ids = TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reference a silhouette that exists', () => {
    for (const target of TARGETS) {
      expect(SILHOUETTES[target.silhouette], `${target.id} -> ${target.silhouette}`).toBeDefined();
    }
  });

  it('have sane numeric ranges', () => {
    for (const target of TARGETS) {
      expect(target.depth[0]).toBeLessThanOrEqual(target.depth[1]);
      expect(target.size).toBeGreaterThan(0);
      expect(target.size).toBeLessThanOrEqual(1);
      expect(target.fragility).toBeGreaterThanOrEqual(0);
      expect(target.fragility).toBeLessThanOrEqual(1);
      expect(target.excavationDifficulty).toBeGreaterThanOrEqual(0);
      expect(target.excavationDifficulty).toBeLessThanOrEqual(1);
      expect(target.value).toBeGreaterThanOrEqual(0);
      expect(RARITY_ORDER).toContain(target.rarity);
    }
  });

  it('have written copy for the player to read', () => {
    for (const target of TARGETS) {
      expect(target.name.length).toBeGreaterThan(2);
      expect(target.description.length).toBeGreaterThan(10);
      expect(target.discoveryText.length).toBeGreaterThan(10);
      expect(target.materialName.length).toBeGreaterThan(2);
    }
  });

  it('only grant clues that exist', () => {
    const clueIds = new Set(CLUES.map((c) => c.id));
    for (const target of TARGETS) {
      if (target.clueId) expect(clueIds.has(target.clueId), target.clueId).toBe(true);
    }
  });

  it('restrict location-specific targets to real locations', () => {
    for (const target of TARGETS) {
      for (const id of target.locations ?? []) {
        expect(getLocation(id), `${target.id} -> ${id}`).toBeDefined();
      }
    }
  });

  it('rarer things are generally worth more than junk', () => {
    const junk = TARGETS.filter((t) => t.rarity === 'common').map((t) => t.value);
    const rare = TARGETS.filter((t) => t.rarity === 'rare' || t.rarity === 'veryRare').map((t) => t.value);
    expect(Math.max(...junk)).toBeLessThan(Math.min(...rare));
  });

  it('degrade gracefully for an unknown id from an old save', () => {
    expect(getTarget('nope')).toBeUndefined();
    const placeholder = getTargetOrPlaceholder('nope');
    expect(placeholder.name.length).toBeGreaterThan(0);
    expect(SILHOUETTES[placeholder.silhouette]).toBeDefined();
  });
});

describe('locations', () => {
  it('have unique ids and real loot tables', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const location of LOCATIONS) {
      for (const entry of location.table) {
        const def = getTarget(entry.targetId);
        expect(def, `${location.id} -> ${entry.targetId}`).toBeDefined();
        expect(entry.weight).toBeGreaterThan(0);
        // A table must not list a target that is banned from this location.
        if (def!.locations) expect(def!.locations).toContain(location.id);
      }
    }
  });

  it('only lock behind chains that exist, and unlock is reachable', () => {
    const chainIds = new Set(CHAINS.map((c) => c.id));
    for (const location of LOCATIONS) {
      if (!location.lockedBy) continue;
      expect(chainIds.has(location.lockedBy), location.lockedBy).toBe(true);
      const chain = CHAINS.find((c) => c.id === location.lockedBy)!;
      expect(chain.unlocksLocation).toBe(location.id);
    }
  });

  it('every locked location can actually be reached from an unlocked one', () => {
    // Each locking chain's clues must be obtainable somewhere already open —
    // either dug up directly, or (for a composite) assembled from pieces that
    // are all themselves obtainable, all without visiting a still-locked spot.
    const open = LOCATIONS.filter((l) => !l.lockedBy).map((l) => l.id);
    const reachable = new Set(open);

    const placedAt = (targetId: string) =>
      LOCATIONS.some(
        (loc) => reachable.has(loc.id) && loc.table.some((entry) => entry.targetId === targetId),
      );

    const obtainable = (targetId: string): boolean => {
      const def = TARGETS.find((t) => t.id === targetId);
      if (!def) return false;
      if (placedAt(targetId)) return true;
      // A composite is obtainable once every one of its pieces is.
      if (def.assemblyOf) return def.assemblyOf.every((pieceId) => obtainable(pieceId));
      return false;
    };

    let changed = true;
    while (changed) {
      changed = false;
      for (const chain of CHAINS) {
        const clueSources = chain.clueIds.map((clueId) => {
          const granters = TARGETS.filter((t) => t.clueId === clueId);
          return granters.some((granter) => obtainable(granter.id));
        });
        if (clueSources.every(Boolean) && chain.unlocksLocation && !reachable.has(chain.unlocksLocation)) {
          reachable.add(chain.unlocksLocation);
          changed = true;
        }
      }
    }
    for (const location of LOCATIONS) {
      expect(reachable.has(location.id), `${location.id} is unreachable`).toBe(true);
    }
  });

  it('every composite artifact can actually be assembled from obtainable pieces', () => {
    for (const composite of TARGETS.filter((t) => t.assemblyOf)) {
      for (const pieceId of composite.assemblyOf!) {
        const piece = getTarget(pieceId);
        expect(piece, `${composite.id} references missing piece ${pieceId}`).toBeDefined();
        expect(piece!.pieceOf, `${pieceId} should point back at ${composite.id}`).toBe(composite.id);
        // A piece must actually be findable somewhere (or itself a composite,
        // though nothing in the game currently nests composites).
        const findable = LOCATIONS.some((loc) => loc.table.some((e) => e.targetId === pieceId));
        expect(findable, `${pieceId} is not on any loot table`).toBe(true);
      }
    }
  });

  it('each non-adventure location has enough variety to be worth visiting', () => {
    for (const location of LOCATIONS) {
      if (location.adventureId) continue;
      expect(location.table.length).toBeGreaterThan(8);
      expect(location.targetCount[0]).toBeGreaterThan(0);
      const rarities = new Set(location.table.map((e) => getTarget(e.targetId)!.rarity));
      expect(rarities.size).toBeGreaterThan(2);
    }
  });
});

describe('equipment', () => {
  it('has a free starting detector and free starting tools', () => {
    expect(DETECTORS[0]!.price).toBe(0);
    expect(TOOLS.filter((t) => t.price === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('upgrades cost more and are not strictly worse', () => {
    for (let i = 1; i < DETECTORS.length; i++) {
      expect(DETECTORS[i]!.price).toBeGreaterThan(DETECTORS[i - 1]!.price);
      const better = DETECTORS[i]!;
      const previous = DETECTORS[i - 1]!;
      const improvements = [
        better.depthCapacity > previous.depthCapacity,
        better.discrimination > previous.discrimination,
        better.stability > previous.stability,
        better.reach > previous.reach,
        better.coilWidth < previous.coilWidth,
      ];
      expect(improvements.some(Boolean), `${better.id} improves nothing`).toBe(true);
    }
  });

  it('gives the safe tool a lower risk than every digging tool', () => {
    const brushes = TOOLS.filter((t) => t.kind === 'brush');
    const diggers = TOOLS.filter((t) => t.kind === 'scoop' || t.kind === 'pick');
    for (const brush of brushes) {
      for (const digger of diggers) {
        expect(brush.risk).toBeLessThan(digger.risk);
      }
    }
  });
});

describe('silhouettes', () => {
  it('every silhouette has drawable shapes and covers its own centre area', () => {
    for (const [id, sil] of Object.entries(SILHOUETTES)) {
      expect(sil.shapes.length, id).toBeGreaterThan(0);
      // Sample the unit box: a silhouette must occupy a reasonable share of it,
      // otherwise the excavation mask would be too small to find.
      let inside = 0;
      const samples = 40;
      for (let j = 0; j < samples; j++) {
        for (let i = 0; i < samples; i++) {
          const x = (i / (samples - 1)) * 2 - 1;
          const y = (j / (samples - 1)) * 2 - 1;
          if (pointInSilhouette(sil, x, y)) inside++;
        }
      }
      const coverage = inside / (samples * samples);
      expect(coverage, `${id} coverage`).toBeGreaterThan(0.03);
      expect(coverage, `${id} coverage`).toBeLessThan(0.95);
    }
  });

  it('falls back to a shape rather than crashing on an unknown id', () => {
    expect(getSilhouette('does-not-exist').shapes.length).toBeGreaterThan(0);
  });
});
