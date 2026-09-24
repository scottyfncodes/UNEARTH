import { describe, expect, it } from 'vitest';
import { attemptDig } from '@/game/dig';
import { CTX, baseState } from './fixtures';

describe('attemptDig', () => {
  it('digs a diggable tile and reveals a buried fragment', () => {
    const state = baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } });
    const { state: next, events } = attemptDig(CTX.maps, state);
    expect(next.mapStates.room1?.dug['4,1']).toBe(true);
    expect(next.inventory).toContain('fragB');
    expect(events).toEqual([{ type: 'reveal', itemId: 'fragB' }]);
  });

  it('does nothing on a non-diggable tile', () => {
    const state = baseState({ player: { pos: { x: 1, y: 4 }, facing: 'up' } });
    const { state: next, events } = attemptDig(CTX.maps, state);
    expect(next).toBe(state);
    expect(events).toEqual([{ type: 'dig-hard' }]);
  });

  it('digging an already-dug tile does not re-reveal the fragment', () => {
    const first = attemptDig(CTX.maps, baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } }));
    const { state: next, events } = attemptDig(CTX.maps, first.state);
    expect(next.inventory.filter((id) => id === 'fragB')).toHaveLength(1);
    expect(events).toEqual([{ type: 'dig-empty' }]);
  });

  it('digging an empty patch of diggable ground turns up nothing but still clears it', () => {
    // (5,1) has no buried entry in the fixture map — a "just dirt" dig.
    const state = baseState({ player: { pos: { x: 6, y: 1 }, facing: 'left' } });
    const { state: next, events } = attemptDig(CTX.maps, state);
    expect(next.mapStates.room1?.dug['5,1']).toBe(true);
    expect(next.inventory).toEqual([]);
    expect(events).toEqual([{ type: 'dig-empty' }]);
  });
});
