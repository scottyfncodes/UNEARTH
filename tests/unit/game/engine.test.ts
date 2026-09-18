import { describe, expect, it } from 'vitest';
import { reduce } from '@/game/engine';
import { CTX, baseState } from './fixtures';

describe('reduce', () => {
  it('toggles between the detector and paws tools', () => {
    const state = baseState({ tool: 'detector' });
    const { state: next } = reduce(CTX, state, { type: 'toggleTool' });
    expect(next.tool).toBe('paws');
    const { state: back } = reduce(CTX, next, { type: 'toggleTool' });
    expect(back.tool).toBe('detector');
  });

  it('auto-assembles the key the instant both fragments are collected, from a dig and a pickup', () => {
    const digged = reduce(CTX, baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } }), { type: 'dig' });
    expect(digged.state.inventory).toEqual(['fragB']);
    expect(digged.events).toEqual([{ type: 'reveal', itemId: 'fragB' }]);

    const walked = reduce(CTX, { ...digged.state, player: { pos: { x: 5, y: 2 }, facing: 'right' } }, { type: 'move', direction: 'right' });
    expect(walked.state.inventory).toEqual(['key1']);
    expect(walked.events).toEqual([{ type: 'pickup', itemId: 'fragA' }, { type: 'assemble', artifactId: 'key1' }]);
  });

  it('does not assemble when only one fragment is present', () => {
    const { state } = reduce(CTX, baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } }), { type: 'dig' });
    expect(state.inventory).toEqual(['fragB']);
  });

  it('routes interact through to the door/switch/npc logic', () => {
    const state = baseState({ player: { pos: { x: 6, y: 2 }, facing: 'up' }, inventory: ['key1'] });
    const { state: next, events } = reduce(CTX, state, { type: 'interact' });
    expect(next.mapStates.room1?.openedDoors.door1).toBe(true);
    expect(events).toEqual([{ type: 'door-open', doorId: 'door1' }]);
  });

  it('routes move through to movement logic', () => {
    const state = baseState({ player: { pos: { x: 3, y: 4 }, facing: 'down' } });
    const { state: next } = reduce(CTX, state, { type: 'move', direction: 'right' });
    expect(next.player.pos).toEqual({ x: 4, y: 4 });
  });
});
