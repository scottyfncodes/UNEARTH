import { describe, expect, it } from 'vitest';
import { MAPS } from '@/content/maps';
import { RECIPES } from '@/content/recipes';
import { getItem, ITEMS } from '@/content/items';
import { getClue } from '@/content/clues';
import { inBounds } from '@/game/world';

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

  it('every buried item sits on an in-bounds diggable tile', () => {
    for (const map of allMaps) {
      for (const tileKey of Object.keys(map.buried)) {
        const [x, y] = tileKey.split(',').map(Number);
        expect(inBounds(map, { x: x!, y: y! }), `${map.id}: buried "${tileKey}" is out of bounds`).toBe(true);
        expect(map.tiles[y!]![x!], `${map.id}: buried "${tileKey}" is not on a diggable tile`).toBe('diggable');
      }
    }
  });

  it('every item id referenced by the world exists in the item registry', () => {
    for (const map of allMaps) {
      for (const entity of map.entities) {
        if (entity.kind === 'item') expect(getItem(entity.itemId), `${map.id}: unknown item "${entity.itemId}"`).toBeDefined();
      }
      for (const buried of Object.values(map.buried)) {
        expect(getItem(buried.itemId), `${map.id}: unknown buried item "${buried.itemId}"`).toBeDefined();
      }
    }
  });

  it('every clue id referenced by the world exists in the clue registry', () => {
    for (const map of allMaps) {
      for (const entity of map.entities) {
        if (entity.kind === 'clueNote') expect(getClue(entity.clueId), `${map.id}: unknown clue "${entity.clueId}"`).toBeDefined();
        if (entity.kind === 'decoration' && entity.clueId) {
          expect(getClue(entity.clueId), `${map.id}: unknown clue "${entity.clueId}"`).toBeDefined();
        }
      }
    }
  });

  it('every door references a real artifact and/or a flag some switch actually sets', () => {
    const allSwitchFlags = new Set(
      allMaps.flatMap((m) => m.entities.filter((e) => e.kind === 'switch').map((e) => e.setsFlag)),
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
        ...Object.values(m.buried).map((b) => b.itemId),
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
