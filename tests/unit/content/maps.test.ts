import { describe, expect, it } from 'vitest';
import { MAPS } from '@/content/maps';
import { RECIPES } from '@/content/recipes';
import { getItem, ITEMS } from '@/content/items';
import { getClue } from '@/content/clues';
import { inBounds, isSoftGround, terrainAt } from '@/game/world';
import { rolledFlag } from '@/game/hazards';

const allMaps = Object.values(MAPS);

describe('world content is internally consistent', () => {
  it('every exit points at a real map, with an in-bounds spawn', () => {
    for (const map of allMaps) {
      for (const exit of map.exits) {
        const target = MAPS[exit.toMap];
        expect(target, `${map.id} exits to unknown map "${exit.toMap}"`).toBeDefined();
        expect(inBounds(target!, exit.spawn), `${map.id} -> ${exit.toMap} spawns out of bounds`).toBe(true);
        expect(inBounds(map, exit.at), `${map.id} has an exit trigger out of bounds`).toBe(true);
      }
    }
  });

  it('every map is reachable from home via its exits', () => {
    const seen = new Set<string>(['home']);
    const queue = ['home'];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const exit of MAPS[id]!.exits) {
        if (!seen.has(exit.toMap)) {
          seen.add(exit.toMap);
          queue.push(exit.toMap);
        }
      }
    }
    expect(seen).toEqual(new Set(Object.keys(MAPS)));
  });

  it('every entity sits inside its map bounds', () => {
    for (const map of allMaps) {
      for (const entity of map.entities) {
        expect(inBounds(map, entity.pos), `${map.id}: ${entity.id} is out of bounds`).toBe(true);
      }
    }
  });

  it('every buried thing sits on in-bounds soft ground that nothing solid covers', () => {
    for (const map of allMaps) {
      for (const tileKey of Object.keys(map.buried)) {
        const [x, y] = tileKey.split(',').map(Number);
        const pos = { x: x!, y: y! };
        expect(inBounds(map, pos), `${map.id}: buried "${tileKey}" is out of bounds`).toBe(true);
        expect(isSoftGround(map, pos), `${map.id}: buried "${tileKey}" is not on soft ground`).toBe(true);
        expect(map.dressing.some((d) => d.solid && d.pos.x === x && d.pos.y === y), `${map.id}: buried "${tileKey}" is under solid dressing`).toBe(false);
        expect(map.oldHoles[tileKey], `${map.id}: buried "${tileKey}" is under an old (undiggable) hole`).toBeUndefined();
        expect(
          map.entities.some((e) => e.kind !== 'curio' && e.kind !== 'roller' && e.pos.x === x && e.pos.y === y && !(e.kind === 'decoration' && e.walkable)),
          `${map.id}: buried "${tileKey}" sits under an entity`,
        ).toBe(false);
      }
    }
  });

  it('every room has more soft ground than buried things — digging is a hunt, not a checklist', () => {
    for (const map of allMaps) {
      const buried = Object.keys(map.buried).length;
      if (buried === 0) continue;
      let soft = 0;
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isSoftGround(map, { x, y })) soft++;
      expect(soft, `${map.id} has ${soft} soft tiles for ${buried} buried things`).toBeGreaterThanOrEqual(buried * 4);
    }
  });

  it('every real find buried in a room shares it with at least one decoy or a lot of empty ground', () => {
    for (const map of allMaps) {
      const real = Object.values(map.buried).filter((b) => b.itemId).length;
      const junk = Object.values(map.buried).filter((b) => b.junk !== undefined).length;
      if (real === 0) continue;
      expect(junk, `${map.id} buries ${real} real finds with no junk to tell them from`).toBeGreaterThan(0);
    }
  });

  it('every trap is wired to something real', () => {
    for (const map of allMaps) {
      for (const e of map.entities) {
        if (e.kind !== 'trap') continue;
        if (e.trapType === 'spikes') {
          expect(e.lane?.length, `${map.id}: ${e.id} has no lane`).toBeGreaterThan(0);
          for (const t of e.lane!) expect(terrainAt(map, t), `${map.id}: ${e.id} lane off a spike floor`).toBe('spikes');
          expect(e.period).toBeGreaterThan(e.upMs ?? 0);
          continue;
        }
        expect(e.triggers?.length || e.triggerPlate, `${map.id}: ${e.id} can never go off`).toBeTruthy();
        for (const t of e.triggers ?? []) {
          expect(inBounds(map, t)).toBe(true);
          if (e.trapType === 'dart') expect(terrainAt(map, t), `${map.id}: ${e.id} trigger is not a trigger brick`).toBe('trigger');
        }
        if (e.trapType === 'dart') expect(terrainAt(map, e.pos), `${map.id}: ${e.id} darts should come out of a wall`).toBe('wall');
      }
    }
  });

  it('every trigger brick belongs to some trap', () => {
    for (const map of allMaps) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.tiles[y]![x] !== 'trigger') continue;
          const owned = map.entities.some((e) => e.kind === 'trap' && e.triggers?.some((t) => t.x === x && t.y === y));
          expect(owned, `${map.id}: stray trigger brick at ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it('every rolling boulder follows a connected path, starts on a flag something sets, and never rests on an exit', () => {
    const settable = new Set(
      allMaps.flatMap((m) => m.entities.flatMap((e) => (e.kind === 'item' && e.setsFlag ? [e.setsFlag] : e.kind === 'switch' ? [e.setsFlag] : []))),
    );
    for (const map of allMaps) {
      for (const e of map.entities) {
        if (e.kind !== 'roller') continue;
        expect(e.pos).toEqual(e.path[0]);
        expect(settable.has(e.startsOnFlag), `${map.id}: ${e.id} starts on a flag nothing sets`).toBe(true);
        for (let i = 1; i < e.path.length; i++) {
          const a = e.path[i - 1]!;
          const b = e.path[i]!;
          expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), `${map.id}: ${e.id} jumps between ${i - 1} and ${i}`).toBe(1);
          expect(inBounds(map, b)).toBe(true);
        }
        const end = e.path[e.path.length - 1]!;
        expect(map.exits.some((x) => x.at.x === end.x && x.at.y === end.y)).toBe(false);
      }
    }
  });

  it('every item id referenced by the world exists in the item registry', () => {
    for (const map of allMaps) {
      for (const entity of map.entities) {
        if (entity.kind === 'item') expect(getItem(entity.itemId), `${map.id}: unknown item "${entity.itemId}"`).toBeDefined();
      }
      for (const buried of Object.values(map.buried)) {
        if (buried.itemId) expect(getItem(buried.itemId), `${map.id}: unknown buried item "${buried.itemId}"`).toBeDefined();
        else expect(buried.junk?.length, `${map.id}: junk with nothing to say`).toBeGreaterThan(0);
      }
    }
  });

  it('every clue id referenced by the world exists in the clue registry', () => {
    for (const map of allMaps) {
      for (const entity of map.entities) {
        if (entity.kind === 'clueNote') expect(getClue(entity.clueId), `${map.id}: unknown clue "${entity.clueId}"`).toBeDefined();
        if ((entity.kind === 'decoration' || entity.kind === 'curio') && entity.clueId) {
          expect(getClue(entity.clueId), `${map.id}: unknown clue "${entity.clueId}"`).toBeDefined();
        }
      }
      for (const buried of Object.values(map.buried)) {
        if (buried.junk !== undefined && buried.clueId) expect(getClue(buried.clueId)).toBeDefined();
      }
    }
  });

  it('every door references a real artifact and/or a flag something actually sets', () => {
    const allSwitchFlags = new Set(
      allMaps.flatMap((m) =>
        m.entities.flatMap((e) => (e.kind === 'switch' ? [e.setsFlag] : e.kind === 'roller' ? [rolledFlag(e.id)] : [])),
      ),
    );
    for (const map of allMaps) {
      for (const entity of map.entities) {
        if (entity.kind !== 'door') continue;
        if (entity.requiresArtifact) expect(getItem(entity.requiresArtifact)).toBeDefined();
        if (entity.opensOnFlag) expect(allSwitchFlags.has(entity.opensOnFlag)).toBe(true);
        if (entity.opensWhenBlocksOn) {
          const blocks = map.entities.filter((e) => e.kind === 'block').length;
          expect(blocks, `${map.id}: ${entity.id} needs more blocks than the room has`).toBeGreaterThanOrEqual(
            entity.opensWhenBlocksOn.length,
          );
        }
        expect(
          entity.requiresArtifact || entity.opensOnFlag || entity.opensWhenBlocksOn,
          `${map.id}: ${entity.id} can never be opened`,
        ).toBeTruthy();
      }
    }
  });
});

describe('artifact recipes', () => {
  it('every recipe assembles from fragments that actually exist in the world', () => {
    const allItemIds = new Set(
      allMaps.flatMap((m) => [
        ...m.entities.filter((e) => e.kind === 'item').map((e) => e.itemId),
        ...Object.values(m.buried).flatMap((b) => (b.itemId ? [b.itemId] : [])),
      ]),
    );
    for (const recipe of RECIPES) {
      expect(ITEMS[recipe.id], `recipe "${recipe.id}" has no item definition`).toBeDefined();
      for (const fragmentId of recipe.requires) {
        expect(allItemIds.has(fragmentId), `recipe "${recipe.id}" requires "${fragmentId}", which is never placed in the world`).toBe(true);
      }
    }
  });
});
