/**
 * Elevation, authored per room as a second text layer over the room's own
 * rows, in steps of STEP pixels. It is purely visual: the grid, collision,
 * hops and traps are exactly what they were. The one rule (tested) is that
 * two walkable tiles side by side never differ by more than one step, so
 * every change in level reads as a stair CK could take in one trot.
 */
import type { GameMap } from '@/game/types';

const HEIGHTS: Record<string, string[]> = {
  // The entry hall: a terrace at the door, the hall a step below it, the
  // guardian on a plinth, a raised hidden alcove behind the cat gap, and the
  // corridor stepping down to the lower chamber.
  temple1: [
    '2222222222222222',
    '2222222222222222',
    '2222222222222222',
    '1111111111222222',
    '1111111111221222',
    '1111111111111222',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
};

export function heightRows(mapId: string): string[] | undefined {
  return HEIGHTS[mapId];
}

/** Elevation of a tile, in steps. Out of bounds reads as ground level. */
export function heightSteps(map: GameMap, x: number, y: number): number {
  const row = HEIGHTS[map.id]?.[y];
  const ch = row?.[x];
  return ch ? Number(ch) : 0;
}

/**
 * Purely visual architecture layered over a room: walls drawn taller than
 * the cutaway rule would allow (gate pillars), and lintels spanning open
 * tiles high enough for CK to pass under. None of it collides; it is there
 * to frame the space and to give the foreground something to hide CK behind.
 */
export interface RoomArchitecture {
  /** Wall tiles ("x,y") forced to this height above their base, in px. */
  pillars: Record<string, number>;
  /** Spans over walkable tiles, from `lo` to `hi` px above ground. */
  lintels: { x: number; y: number; lo: number; hi: number }[];
}

const ARCHITECTURE: Record<string, RoomArchitecture> = {
  // A gateway where the hall narrows into the trap corridor.
  temple1: {
    pillars: { '5,10': 34, '9,10': 34 },
    lintels: [6, 7, 8].map((x) => ({ x, y: 10, lo: 27, hi: 34 })),
  },
};

export function architecture(mapId: string): RoomArchitecture {
  return ARCHITECTURE[mapId] ?? { pillars: {}, lintels: [] };
}
