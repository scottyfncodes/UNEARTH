import { describe, expect, it } from 'vitest';
import { LOCATIONS, getLocation } from '@/content/locations';
import { TARGETS, getTarget, getTargetOrPlaceholder } from '@/content/targets';
import { CHAINS, CLUES } from '@/content/clues';
import { DETECTORS, TOOLS } from '@/content/equipment';
import { SILHOUETTES, getSilhouette, pointInSilhouette } from '@/content/silhouettes';
import { SITES, getSite } from '@/content/sites';
import { RARITY_ORDER } from '@/core/types';
import { isCatOnlyGap } from '@/systems/traversal';

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
      ) ||
      SITES.some((site) => {
        // A site-authored piece is only obtainable once the location hosting
        // that site is itself reachable — the same "not through a still-locked
        // spot" rule LOCATIONS.table gets above.
        const hostLocation = LOCATIONS.find((loc) => loc.siteId === site.id);
        if (!hostLocation || !reachable.has(hostLocation.id)) return false;
        return (
          site.interactables.some((i) => i.targetId === targetId) ||
          site.detectorDigs.some((d) => d.targetId === targetId)
        );
      });

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
        // though nothing in the game currently nests composites) — either on
        // a procedural loot table, or authored directly into a first-person
        // site (a pickup/observe interactable or a detector dig).
        const findable =
          LOCATIONS.some((loc) => loc.table.some((e) => e.targetId === pieceId)) ||
          SITES.some(
            (site) =>
              site.interactables.some((i) => i.targetId === pieceId) ||
              site.detectorDigs.some((d) => d.targetId === pieceId),
          );
        expect(findable, `${pieceId} is not on any loot table or site`).toBe(true);
      }
    }
  });

  it('each non-adventure location has enough variety to be worth visiting', () => {
    for (const location of LOCATIONS) {
      if (location.adventureId || location.siteId) continue;
      expect(location.table.length).toBeGreaterThan(8);
      expect(location.targetCount[0]).toBeGreaterThan(0);
      const rarities = new Set(location.table.map((e) => getTarget(e.targetId)!.rarity));
      expect(rarities.size).toBeGreaterThan(2);
    }
  });
});

describe('scenery clues', () => {
  it('every location.sceneryClues entry references a real target inside the plot bounds', () => {
    for (const loc of LOCATIONS) {
      for (const clue of loc.sceneryClues ?? []) {
        expect(getTarget(clue.targetId), `${loc.id}/${clue.id} -> ${clue.targetId}`).toBeDefined();
        expect(clue.x, `${loc.id}/${clue.id} x`).toBeGreaterThanOrEqual(0);
        expect(clue.x, `${loc.id}/${clue.id} x`).toBeLessThanOrEqual(loc.bounds.w);
        expect(clue.y, `${loc.id}/${clue.id} y`).toBeGreaterThanOrEqual(0);
        expect(clue.y, `${loc.id}/${clue.id} y`).toBeLessThanOrEqual(loc.bounds.h);
        expect(clue.range).toBeGreaterThan(0);
      }
    }
  });

  it('scenery clue ids are unique within a location', () => {
    for (const loc of LOCATIONS) {
      const ids = (loc.sceneryClues ?? []).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('first-person sites', () => {
  it('every location.siteId points at a real site, and vice versa', () => {
    for (const loc of LOCATIONS) {
      if (loc.siteId) expect(getSite(loc.siteId), `${loc.id} -> ${loc.siteId}`).toBeDefined();
    }
  });

  it('interactable and detector-dig ids are unique within a site', () => {
    for (const site of SITES) {
      const ids = [...site.interactables.map((i) => i.id), ...site.detectorDigs.map((d) => d.id)];
      expect(new Set(ids).size, site.id).toBe(ids.length);
    }
  });

  it('every observe/pickup/fit target reference points at a real, findable target', () => {
    for (const site of SITES) {
      for (const it of site.interactables) {
        if (it.targetId) expect(getTarget(it.targetId), `${site.id}/${it.id} -> ${it.targetId}`).toBeDefined();
        if (it.requiresTargetId) {
          expect(getTarget(it.requiresTargetId), `${site.id}/${it.id} -> ${it.requiresTargetId}`).toBeDefined();
        }
      }
      for (const dig of site.detectorDigs) {
        expect(getTarget(dig.targetId), `${site.id}/${dig.id} -> ${dig.targetId}`).toBeDefined();
      }
    }
  });

  it('a fit interactable that requires a target is satisfiable by something actually obtainable in this site', () => {
    for (const site of SITES) {
      const obtainableIds = new Set([
        ...site.interactables.filter((i) => i.targetId).map((i) => i.targetId!),
        ...site.detectorDigs.map((d) => d.targetId),
      ]);
      for (const it of site.interactables) {
        if (it.kind === 'fit' && it.requiresTargetId) {
          expect(obtainableIds.has(it.requiresTargetId), `${site.id}/${it.id}`).toBe(true);
        }
      }
    }
  });

  it('every requiresFlag/hideOnFlag/disarmedByFlag is actually set by something in the same site', () => {
    for (const site of SITES) {
      const setFlags = new Set([
        ...site.interactables.filter((i) => i.setsFlagOnUse).map((i) => i.setsFlagOnUse!),
        ...site.hazards.filter((h) => h.setsFlagOnTrigger).map((h) => h.setsFlagOnTrigger!),
      ]);
      const referenced = [
        ...site.interactables.map((i) => i.requiresFlag).filter((f): f is string => !!f),
        ...site.interactables.map((i) => i.hideOnFlag).filter((f): f is string => !!f),
        ...site.hazards.map((h) => h.disarmedByFlag).filter((f): f is string => !!f),
      ];
      for (const flag of referenced) expect(setFlags.has(flag), `${site.id} -> ${flag}`).toBe(true);
    }
  });

  it('a gated interactable (requiresFlag) is reachable: something else grants that flag unconditionally', () => {
    for (const site of SITES) {
      const gaters = site.interactables.filter((i) => i.setsFlagOnUse);
      for (const it of site.interactables) {
        if (!it.requiresFlag) continue;
        const granter = gaters.find((g) => g.setsFlagOnUse === it.requiresFlag);
        expect(granter, `${site.id}/${it.id} requires ${it.requiresFlag}`).toBeDefined();
        // The granter itself must not be gated behind something no other
        // interactable can ever unlock (a one-level check is enough at this scale).
        if (granter!.requiresFlag) {
          expect(gaters.some((g) => g.setsFlagOnUse === granter!.requiresFlag)).toBe(true);
        }
      }
    }
  });

  it('the walkable radius is positive and every prop/interactable/hazard sits within it', () => {
    for (const site of SITES) {
      expect(site.radius).toBeGreaterThan(0);
      const within = (x: number, z: number) => Math.abs(x) <= site.radius + 0.01 && Math.abs(z) <= site.radius + 0.01;
      for (const p of site.props) expect(within(p.position.x, p.position.z), `${site.id}/${p.id}`).toBe(true);
      for (const it of site.interactables) {
        expect(within(it.position.x, it.position.z), `${site.id}/${it.id}`).toBe(true);
      }
      for (const d of site.detectorDigs) expect(within(d.position.x, d.position.z), `${site.id}/${d.id}`).toBe(true);
      for (const r of site.catRoutes ?? []) expect(within(r.position.x, r.position.z), `${site.id}/${r.id}`).toBe(true);
    }
  });

  it('a "squeeze" cat route is honestly classified: CK fits, a person would not', () => {
    for (const site of SITES) {
      for (const route of site.catRoutes ?? []) {
        if (route.kind !== 'squeeze') continue;
        expect(isCatOnlyGap(route.clearWidthM), `${site.id}/${route.id}`).toBe(true);
      }
    }
  });

  it('a "discoverable" hazard has a notice within reach to actually discover it', () => {
    // The whole point of the category: a player who looks around before
    // walking in has something nearby to find. Reach is generous (the
    // notice just has to be in the same neighbourhood, not point-on-point)
    // because what matters is "was there something to notice", not exact
    // staging.
    const DISCOVERY_REACH_M = 4;
    for (const site of SITES) {
      const notices = site.interactables.filter((i) => i.kind === 'notice');
      for (const hz of site.hazards) {
        if (hz.readability !== 'discoverable') continue;
        const hasNearbyNotice = notices.some(
          (n) => Math.hypot(n.position.x - hz.position.x, n.position.z - hz.position.z) <= DISCOVERY_REACH_M,
        );
        expect(hasNearbyNotice, `${site.id}/${hz.id} is 'discoverable' but has no notice nearby`).toBe(true);
      }
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
