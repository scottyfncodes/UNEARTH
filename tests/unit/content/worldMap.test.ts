import { describe, expect, it } from 'vitest';
import { MAPS } from '@/content/maps';
import { SHINY_IDS } from '@/content/items';
import { ROOM_LAYOUT, roomLinks, roomProgress, shiniesIn } from '@/content/worldMap';
import { createInitialState } from '@/content/initialState';

describe('the journal world map', () => {
  it('places every room on its own grid cell', () => {
    const cells = new Set<string>();
    for (const id of Object.keys(MAPS)) {
      const at = ROOM_LAYOUT[id];
      expect(at, `${id} has no layout cell`).toBeDefined();
      const k = `${at!.col},${at!.row}`;
      expect(cells.has(k), `${id} overlaps another room at ${k}`).toBe(false);
      cells.add(k);
    }
  });

  it('accounts for every shiny exactly once across the rooms', () => {
    const all = Object.values(MAPS).flatMap((m) => shiniesIn(m));
    expect(all.length).toBe(SHINY_IDS.length);
    expect(new Set(all).size).toBe(SHINY_IDS.length);
  });

  it('links only real rooms, and only rooms that sit next to each other on the grid', () => {
    for (const [a, b] of roomLinks()) {
      expect(MAPS[a]).toBeDefined();
      expect(MAPS[b]).toBeDefined();
      const pa = ROOM_LAYOUT[a]!;
      const pb = ROOM_LAYOUT[b]!;
      expect(Math.abs(pa.col - pb.col) + Math.abs(pa.row - pb.row), `${a}–${b}`).toBe(1);
    }
  });

  it('starts with only home visited and nothing found', () => {
    const rooms = roomProgress(createInitialState());
    expect(rooms.filter((r) => r.visited).map((r) => r.id)).toEqual(['home']);
    expect(rooms.every((r) => r.shinies === 0 && r.secrets === 0)).toBe(true);
  });

  it('counts a room complete once its shinies and nooks are all found', () => {
    const fresh = createInitialState();
    const home = MAPS.home!;
    const state = {
      ...fresh,
      inventory: shiniesIn(home),
      mapStates: { home: { ...emptyFound(), foundSecrets: Object.fromEntries(Object.keys(home.secrets).map((k) => [k, true as const])) } },
    };
    expect(roomProgress(state).find((r) => r.id === 'home')!.complete).toBe(true);
  });
});

function emptyFound() {
  return { dug: {}, takenItems: {}, openedDoors: {}, toggledSwitches: {}, movedBlocks: {}, disarmedTraps: {}, foundSecrets: {}, usedDecorations: {}, movedDecorations: {}, collapsed: {} };
}
