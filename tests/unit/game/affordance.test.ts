import { describe, expect, it } from 'vitest';
import { canHop, digAffordance, pawAffordance } from '@/game/affordance';
import { attemptInteract } from '@/game/interact';
import { attemptJump } from '@/game/movement';
import { MAPS } from '@/content/maps';
import { createInitialState } from '@/content/initialState';
import type { GameState, MapRegistry } from '@/game/types';
import { emptyMapState } from '@/game/types';
import { CTX, baseState } from './fixtures';

describe('pawAffordance', () => {
  it('says Talk when facing an NPC, and the conversation is fresh until finished', () => {
    const state = baseState({ player: { pos: { x: 2, y: 1 }, facing: 'left' } });
    expect(pawAffordance(CTX.maps, state)).toEqual({ verb: 'Talk', at: { x: 1, y: 1 }, fresh: true });
  });

  it('says Open in front of a door, Pull at a lever, Read at a note', () => {
    expect(pawAffordance(CTX.maps, baseState({ player: { pos: { x: 6, y: 2 }, facing: 'up' } }))?.verb).toBe('Open');
    expect(pawAffordance(CTX.maps, baseState({ player: { pos: { x: 1, y: 4 }, facing: 'right' } }))?.verb).toBe('Pull');
    const atNote = baseState({ player: { pos: { x: 4, y: 4 }, facing: 'left' } });
    expect(pawAffordance(CTX.maps, atNote)).toMatchObject({ verb: 'Read', fresh: true });
    const read = attemptInteract(CTX.maps, atNote).state;
    expect(pawAffordance(CTX.maps, read)).toMatchObject({ verb: 'Read', fresh: false });
  });

  it('returns null exactly when Paw would do nothing', () => {
    const empty = baseState({ player: { pos: { x: 2, y: 3 }, facing: 'up' } });
    expect(pawAffordance(CTX.maps, empty)).toBeNull();
    expect(attemptInteract(CTX.maps, empty).events).toEqual([]);
  });

  it('agrees with attemptInteract on every tile and facing of every real map', () => {
    const fresh = createInitialState();
    const dirs = ['up', 'down', 'left', 'right'] as const;
    for (const map of Object.values(MAPS)) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          for (const facing of dirs) {
            const state: GameState = { ...fresh, mapId: map.id, player: { pos: { x, y }, facing }, flags: { dadLeft: true } };
            const aff = pawAffordance(MAPS as MapRegistry, state);
            const { events } = attemptInteract(MAPS as MapRegistry, state);
            expect(aff === null, `${map.id} ${x},${y} ${facing}`).toBe(events.length === 0);
          }
        }
      }
    }
  });
});

describe('canHop', () => {
  it('agrees with attemptJump everywhere on every real map', () => {
    const fresh = createInitialState();
    const dirs = ['up', 'down', 'left', 'right'] as const;
    for (const map of Object.values(MAPS)) {
      for (let y = 1; y < map.height - 1; y++) {
        for (let x = 1; x < map.width - 1; x++) {
          for (const facing of dirs) {
            const state: GameState = { ...fresh, mapId: map.id, player: { pos: { x, y }, facing }, flags: { dadLeft: true } };
            const jumped = attemptJump(MAPS as MapRegistry, state).events[0]?.type === 'jump';
            expect(canHop(MAPS as MapRegistry, state), `${map.id} ${x},${y} ${facing}`).toBe(jumped);
          }
        }
      }
    }
  });
});

describe('digAffordance', () => {
  it('is none on stone or an already-dug hole, soft on plain earth', () => {
    expect(digAffordance(CTX.maps, baseState({ player: { pos: { x: 1, y: 4 }, facing: 'down' } }))).toBe('none');
    const fresh = createInitialState();
    const meadow: GameState = { ...fresh, mapId: 'meadow', player: { pos: { x: 7, y: 6 }, facing: 'left' }, flags: { dadLeft: true } };
    expect(digAffordance(MAPS as MapRegistry, meadow)).not.toBe('none');
    const dugKey = '6,6';
    const dug: GameState = { ...meadow, mapStates: { meadow: { ...emptyMapState(), dug: { [dugKey]: true } } } };
    expect(digAffordance(MAPS as MapRegistry, dug)).toBe('none');
  });

  it('runs hot facing a real buried find from an open neighbouring tile', () => {
    const fresh = createInitialState();
    const dirs = [
      ['up', 0, 1],
      ['down', 0, -1],
      ['left', 1, 0],
      ['right', -1, 0],
    ] as const;
    let checked = 0;
    for (const map of Object.values(MAPS)) {
      for (const [k, b] of Object.entries(map.buried)) {
        if (!b.itemId) continue;
        const [bx, by] = k.split(',').map(Number) as [number, number];
        for (const [facing, dx, dy] of dirs) {
          const pos = { x: bx + dx, y: by + dy };
          const t = map.tiles[pos.y]?.[pos.x];
          if (!t || t === 'wall' || t === 'water' || t === 'hazard') continue;
          const state: GameState = { ...fresh, mapId: map.id, player: { pos, facing }, flags: { dadLeft: true }, inventory: ['idol_sunstone'] };
          if (digAffordance(MAPS as MapRegistry, state) === 'hot') checked++;
          break;
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
