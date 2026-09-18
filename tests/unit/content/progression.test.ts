import { describe, expect, it } from 'vitest';
import { reduce } from '@/game/engine';
import { createEngineContext, createInitialState } from '@/content/initialState';
import type { GameState } from '@/game/types';

/**
 * Walks the real vertical-slice content through its intended progression
 * loop: home → the archaeologist leaves → the outskirts → the Forgotten
 * Temple → dig up one fragment, find the other → auto-assemble the key →
 * unlock the sanctum → the reward. Exercises the actual authored maps and
 * recipes, not a synthetic fixture, so a broken coordinate or id here would
 * be a real content bug.
 */
const ctx = createEngineContext();

function at(state: GameState, x: number, y: number, facing: GameState['player']['facing']): GameState {
  return { ...state, player: { pos: { x, y }, facing } };
}

describe('the vertical slice progression loop', () => {
  it('takes CK from home to the sanctum reward, assembling the key along the way', () => {
    let state = createInitialState();

    // Talk to the archaeologist through his whole departure — he leaves, and
    // his note appears in the same spot.
    state = at(state, 6, 6, 'right');
    let result = reduce(ctx, state, { type: 'interact' }); // shows line 1 of 3
    expect(result.events).toEqual([{ type: 'talk-start' }]);
    result = reduce(ctx, result.state, { type: 'interact' }); // line 2
    result = reduce(ctx, result.state, { type: 'interact' }); // line 3
    result = reduce(ctx, result.state, { type: 'interact' }); // closes, sets the flag
    expect(result.state.flags.archaeologistLeft).toBe(true);
    expect(result.state.dialogue).toBeNull();
    state = result.state;

    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'clue', clueId: 'clue_departure_note' }]);
    expect(result.state.clues).toContain('clue_departure_note');
    state = result.state;

    // Leave home for the outskirts.
    state = at(state, 8, 9, 'down');
    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    expect(result.events).toEqual([{ type: 'transition', toMap: 'outskirts' }]);
    state = result.state;
    expect(state.mapId).toBe('outskirts');

    // Straight through to the temple entry hall.
    state = at(state, 8, 9, 'down');
    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    state = result.state;
    expect(state.mapId).toBe('temple1');

    // Dig up the buried fragment.
    state = at(state, 4, 4, 'up');
    result = reduce(ctx, state, { type: 'dig' });
    expect(result.events).toEqual([{ type: 'reveal', itemId: 'fragment_bronze_handle' }]);
    state = result.state;
    expect(state.inventory).toContain('fragment_bronze_handle');

    // Read the note left beside the dig, and inspect the cracked statue.
    state = at(state, 6, 3, 'left');
    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'clue', clueId: 'clue_field_notes_1' }]);
    state = result.state;

    state = at(state, 10, 5, 'right');
    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'clue', clueId: 'clue_statue_crack' }]);
    state = result.state;

    // Squeeze through the cat-only gap and grab the second fragment — the
    // instant it's collected, the two halves auto-assemble into the key.
    state = at(state, 11, 5, 'right');
    result = reduce(ctx, state, { type: 'move', direction: 'right' });
    state = result.state;
    expect(state.player.pos).toEqual({ x: 12, y: 5 });

    result = reduce(ctx, state, { type: 'move', direction: 'right' });
    expect(result.events).toEqual([
      { type: 'pickup', itemId: 'fragment_bronze_blade' },
      { type: 'assemble', artifactId: 'key_bronze' },
    ]);
    state = result.state;
    expect(state.inventory).toEqual(['key_bronze']);

    // On to the puzzle chamber, then unlock the sanctum door with the key.
    state = at(state, 8, 9, 'down');
    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    state = result.state;
    expect(state.mapId).toBe('temple2');

    state = at(state, 8, 9, 'down');
    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'door-open', doorId: 'door_sanctum' }]);
    state = result.state;

    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    expect(result.events).toEqual([{ type: 'transition', toMap: 'temple3' }]);
    state = result.state;
    expect(state.mapId).toBe('temple3');

    // The reward: the idol, and the final page of field notes.
    state = at(state, 8, 4, 'down');
    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    expect(result.events).toEqual([{ type: 'pickup', itemId: 'idol_sunstone' }]);
    state = result.state;

    state = at(state, 6, 5, 'left');
    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'clue', clueId: 'clue_field_notes_2' }]);

    expect(result.state.inventory).toContain('idol_sunstone');
    expect(result.state.clues).toEqual(
      expect.arrayContaining(['clue_departure_note', 'clue_field_notes_1', 'clue_statue_crack', 'clue_field_notes_2']),
    );
  });

  it('the hidden lever offers a shortcut into the sanctum, bypassing the key entirely', () => {
    let state = createInitialState();
    state = { ...state, mapId: 'temple2', player: { pos: { x: 8, y: 1 }, facing: 'down' } };

    // Push the block west of the corridor into the pit to reach the lever room.
    state = at(state, 7, 5, 'left');
    let result = reduce(ctx, state, { type: 'move', direction: 'left' });
    expect(result.events).toEqual([{ type: 'push' }]);
    state = result.state;
    expect(state.mapStates.temple2?.movedBlocks.block_1).toEqual({ x: 5, y: 5 });

    // Cross the bridge and walk onto the lever itself, tucked past the pit.
    state = { ...state, player: { pos: { x: 2, y: 5 }, facing: 'down' } };
    result = reduce(ctx, state, { type: 'interact' });
    expect(result.events).toEqual([{ type: 'switch-on', switchId: 'switch_shortcut' }]);
    expect(result.state.flags.sanctumUnlockedByShortcut).toBe(true);

    // The sanctum door is now open on the flag alone — no key required.
    state = at(result.state, 8, 9, 'down');
    result = reduce(ctx, state, { type: 'move', direction: 'down' });
    expect(result.events).toEqual([{ type: 'transition', toMap: 'temple3' }]);
    expect(result.state.inventory).not.toContain('key_bronze');
  });
});
