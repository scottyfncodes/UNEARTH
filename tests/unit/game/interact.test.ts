import { describe, expect, it } from 'vitest';
import { attemptInteract } from '@/game/interact';
import { CTX, baseState } from './fixtures';

describe('attemptInteract', () => {
  it('starts a conversation when facing an NPC', () => {
    const state = baseState({ player: { pos: { x: 2, y: 1 }, facing: 'left' } });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next.dialogue).toEqual({ npcId: 'npc1', lines: ['Hi there.', 'See you around.'], index: 0 });
    expect(events).toEqual([{ type: 'talk-start' }]);
  });

  it('advances through dialogue lines and sets the completion flag at the end', () => {
    const started = attemptInteract(CTX.maps, baseState({ player: { pos: { x: 2, y: 1 }, facing: 'left' } }));
    const advanced = attemptInteract(CTX.maps, started.state);
    expect(advanced.state.dialogue?.index).toBe(1);
    expect(advanced.events).toEqual([]);

    const closed = attemptInteract(CTX.maps, advanced.state);
    expect(closed.state.dialogue).toBeNull();
    expect(closed.state.flags.metGuide).toBe(true);
    expect(closed.events).toEqual([{ type: 'talk-end' }]);
  });

  it('the NPC vanishes once its completion flag is set', () => {
    const state = baseState({ flags: { metGuide: true } });
    const map = CTX.maps.room1!;
    const npcStillThere = map.entities.some((e) => e.kind === 'npc' && e.id === 'npc1');
    expect(npcStillThere).toBe(true); // the map definition is unchanged...
    const facing = attemptInteract(CTX.maps, { ...state, player: { pos: { x: 2, y: 1 }, facing: 'left' } });
    expect(facing.state.dialogue).toBeNull(); // ...but interacting finds nobody there anymore.
  });

  it('refuses to open a door without the required artifact or flag', () => {
    const state = baseState({ player: { pos: { x: 6, y: 2 }, facing: 'up' } });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next.mapStates.room1?.openedDoors.door1).toBeUndefined();
    expect(events).toEqual([{ type: 'door-locked', message: 'Locked tight.' }]);
  });

  it('opens a door once CK is carrying the required artifact', () => {
    const state = baseState({ player: { pos: { x: 6, y: 2 }, facing: 'up' }, inventory: ['key1'] });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next.mapStates.room1?.openedDoors.door1).toBe(true);
    expect(events).toEqual([{ type: 'door-open', doorId: 'door1' }]);
  });

  it('a switch opens its linked door via flag, no artifact needed', () => {
    const pulled = attemptInteract(CTX.maps, baseState({ player: { pos: { x: 3, y: 4 }, facing: 'left' } }));
    expect(pulled.state.flags.leverPulled).toBe(true);
    expect(pulled.events).toEqual([{ type: 'switch-on', switchId: 'switch1' }]);

    const doorAttempt = attemptInteract(CTX.maps, { ...pulled.state, player: { pos: { x: 6, y: 2 }, facing: 'up' } });
    expect(doorAttempt.events).toEqual([{ type: 'already-done' }]);
  });

  it('pulling the same switch twice reports already-done', () => {
    const once = attemptInteract(CTX.maps, baseState({ player: { pos: { x: 3, y: 4 }, facing: 'left' } }));
    const twice = attemptInteract(CTX.maps, once.state);
    expect(twice.events).toEqual([{ type: 'already-done' }]);
  });

  it('reads a clue note and adds it to the journal', () => {
    const state = baseState({ player: { pos: { x: 3, y: 3 }, facing: 'down' } });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next.clues).toEqual(['clueA']);
    expect(events).toEqual([{ type: 'clue', clueId: 'clueA' }]);
  });

  it('inspects a decoration for a clue', () => {
    const state = baseState({ player: { pos: { x: 5, y: 3 }, facing: 'down' } });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next.clues).toEqual(['clueB']);
    expect(events).toEqual([{ type: 'clue', clueId: 'clueB' }]);
  });

  it('does nothing when facing empty floor', () => {
    const state = baseState({ player: { pos: { x: 4, y: 4 }, facing: 'down' } });
    const { state: next, events } = attemptInteract(CTX.maps, state);
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });
});
