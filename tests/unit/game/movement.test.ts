import { describe, expect, it } from 'vitest';
import { attemptMove } from '@/game/movement';
import { CTX, baseState } from './fixtures';

describe('attemptMove', () => {
  it('moves CK one tile and updates facing', () => {
    const state = baseState({ player: { pos: { x: 3, y: 4 }, facing: 'down' } });
    const { state: next, events } = attemptMove(CTX.maps, state, 'right');
    expect(next.player.pos).toEqual({ x: 4, y: 4 });
    expect(next.player.facing).toBe('right');
    expect(events).toEqual([]);
  });

  it('bumps into a wall without moving, but still turns to face it', () => {
    const state = baseState({ player: { pos: { x: 1, y: 1 }, facing: 'down' } });
    const { state: next, events } = attemptMove(CTX.maps, state, 'up');
    expect(next.player.pos).toEqual({ x: 1, y: 1 });
    expect(next.player.facing).toBe('up');
    expect(events).toEqual([{ type: 'bump' }]);
  });

  it('lets CK squeeze through a cat-only gap', () => {
    const state = baseState({ player: { pos: { x: 3, y: 3 }, facing: 'up' } });
    const { state: next, events } = attemptMove(CTX.maps, state, 'up');
    expect(next.player.pos).toEqual({ x: 3, y: 2 });
    expect(events).toEqual([]);
  });

  it('cannot walk through a diggable wall until it has been dug', () => {
    const state = baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } });
    const { state: next, events } = attemptMove(CTX.maps, state, 'right');
    expect(next.player.pos).toEqual({ x: 3, y: 1 });
    expect(events).toEqual([{ type: 'bump' }]);
  });

  it('picks up a free-standing item by walking onto its tile', () => {
    const state = baseState({ player: { pos: { x: 5, y: 2 }, facing: 'right' } });
    const { state: next, events } = attemptMove(CTX.maps, state, 'right');
    expect(next.inventory).toContain('fragA');
    expect(events).toContainEqual({ type: 'pickup', itemId: 'fragA' });
  });

  it('does not pick the same item up twice', () => {
    const first = attemptMove(CTX.maps, baseState({ player: { pos: { x: 5, y: 2 }, facing: 'right' } }), 'right');
    const second = attemptMove(CTX.maps, { ...first.state, player: { pos: { x: 6, y: 3 }, facing: 'up' } }, 'up');
    expect(second.state.inventory.filter((id) => id === 'fragA')).toHaveLength(1);
    expect(second.events).not.toContainEqual({ type: 'pickup', itemId: 'fragA' });
  });

  const emptyMapState = { dug: {}, takenItems: {}, openedDoors: {}, toggledSwitches: {}, movedBlocks: {}, disarmedTraps: {}, foundSecrets: {}, usedDecorations: {} };

  describe('movable blocks and pits', () => {
    it('pushes a block one tile when the space beyond is open', () => {
      const state = baseState({ player: { pos: { x: 1, y: 4 }, facing: 'up' } });
      const { state: next, events } = attemptMove(CTX.maps, state, 'up');
      expect(next.mapStates.room1?.movedBlocks.block1).toEqual({ x: 1, y: 2 });
      expect(next.player.pos).toEqual({ x: 1, y: 3 });
      expect(events).toEqual([{ type: 'push' }]);
    });

    it('refuses to push a block into a wall', () => {
      const state = baseState({
        player: { pos: { x: 5, y: 4 }, facing: 'right' },
        mapStates: { room1: { ...emptyMapState, movedBlocks: { block1: { x: 6, y: 4 } } } },
      });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.player.pos).toEqual({ x: 5, y: 4 });
      expect(next.mapStates.room1?.movedBlocks.block1).toEqual({ x: 6, y: 4 });
      expect(events).toEqual([{ type: 'bump' }]);
    });

    it('blocks CK from walking into an un-bridged pit', () => {
      const state = baseState({
        player: { pos: { x: 1, y: 3 }, facing: 'up' },
        mapStates: { room1: { ...emptyMapState, movedBlocks: { block1: { x: 6, y: 4 } } } },
      });
      const { state: next, events } = attemptMove(CTX.maps, state, 'up');
      expect(next.player.pos).toEqual({ x: 1, y: 3 });
      expect(events).toEqual([{ type: 'bump' }]);
    });

    it('lets CK cross a pit once a block bridges it', () => {
      const state = baseState({
        player: { pos: { x: 1, y: 3 }, facing: 'up' },
        mapStates: { room1: { ...emptyMapState, movedBlocks: { block1: { x: 1, y: 2 } } } },
      });
      const { state: next, events } = attemptMove(CTX.maps, state, 'up');
      expect(next.player.pos).toEqual({ x: 1, y: 2 });
      expect(events).toEqual([]);
    });
  });

  describe('pressure plates and traps', () => {
    it('fires a trap and knocks CK back when stepping on its plate', () => {
      const state = baseState({ player: { pos: { x: 4, y: 3 }, facing: 'right' }, hearts: 3 });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.player.pos).toEqual({ x: 4, y: 3 });
      expect(next.hearts).toBe(2);
      expect(events).toContainEqual({ type: 'trap-hit', trapId: 'trap1', trapType: 'dart', from: { x: 5, y: 3 }, at: { x: 5, y: 3 } });
    });

    it('resets hearts and respawns CK at the map default spawn on the last heart', () => {
      const state = baseState({ player: { pos: { x: 4, y: 3 }, facing: 'right' }, hearts: 1 });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.hearts).toBe(3);
      expect(next.player.pos).toEqual(CTX.maps.room1!.defaultSpawn);
      expect(events).toContainEqual({ type: 'knockout' });
    });

    it('does not re-fire a disarmed trap', () => {
      const state = baseState({
        player: { pos: { x: 4, y: 3 }, facing: 'right' },
        mapStates: { room1: { ...emptyMapState, disarmedTraps: { trap1: true } } },
      });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.player.pos).toEqual({ x: 5, y: 3 });
      expect(events).toEqual([]);
    });
  });

  describe('exits', () => {
    it('refuses to cross a flag-gated exit', () => {
      const state = baseState({ player: { pos: { x: 5, y: 4 }, facing: 'right' } });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.mapId).toBe('room1');
      expect(next.player.pos).toEqual({ x: 5, y: 4 });
      expect(events).toEqual([{ type: 'exit-locked', message: 'Not yet.' }]);
    });

    it('transitions to the target map once the flag is set', () => {
      const state = baseState({ player: { pos: { x: 5, y: 4 }, facing: 'right' }, flags: { canLeave: true } });
      const { state: next, events } = attemptMove(CTX.maps, state, 'right');
      expect(next.mapId).toBe('room2');
      expect(next.player.pos).toEqual({ x: 1, y: 1 });
      expect(next.player.facing).toBe('down');
      expect(events).toEqual([{ type: 'transition', toMap: 'room2', firstVisit: true }]);
    });
  });
});
