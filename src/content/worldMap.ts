/**
 * The journal's map of the journey: where each room sits on a small grid,
 * which rooms CK has been to, and how much of each is still out there —
 * shinies and secret nooks, found versus total. Revisiting a room should
 * be a decision, and this is what makes it one.
 */
import type { GameMap, GameState } from '@/game/types';
import { visitedFlag } from '@/game/movement';
import { MAPS } from './maps';
import { SHINY_IDS } from './items';

/** Grid cell (column, row) per room. Rows read top-down as the journey goes deeper. */
export const ROOM_LAYOUT: Record<string, { col: number; row: number }> = {
  home: { col: 2, row: 0 },
  meadow: { col: 2, row: 1 },
  digsite: { col: 1, row: 1 },
  trench: { col: 1, row: 2 },
  well: { col: 3, row: 1 },
  temple1: { col: 2, row: 2 },
  temple2: { col: 2, row: 3 },
  temple3: { col: 2, row: 4 },
  crypt1: { col: 3, row: 2 },
  chasm: { col: 3, row: 3 },
  crypt2: { col: 3, row: 4 },
  crypt3: { col: 3, row: 5 },
  passage: { col: 3, row: 6 },
  vault: { col: 3, row: 7 },
};

/** Every shiny a room holds, wherever it hides: lying out, knocked off something, or buried. */
export function shiniesIn(map: GameMap): string[] {
  const out: string[] = [];
  for (const e of map.entities) {
    if (e.kind === 'item' && !e.heals && SHINY_IDS.includes(e.itemId)) out.push(e.itemId);
    if (e.kind === 'decoration' && e.givesItem && SHINY_IDS.includes(e.givesItem)) out.push(e.givesItem);
  }
  for (const b of Object.values(map.buried)) if (b.itemId && SHINY_IDS.includes(b.itemId)) out.push(b.itemId);
  return out;
}

export interface RoomProgress {
  id: string;
  name: string;
  visited: boolean;
  current: boolean;
  shinies: number;
  shiniesTotal: number;
  secrets: number;
  secretsTotal: number;
  /** Everything countable here has been found. */
  complete: boolean;
}

export function isVisited(state: GameState, mapId: string): boolean {
  return mapId === state.mapId || mapId === 'home' || !!state.flags[visitedFlag(mapId)];
}

export function roomProgress(state: GameState): RoomProgress[] {
  return Object.values(MAPS).map((map) => {
    const shinyIds = shiniesIn(map);
    const shinies = shinyIds.filter((id) => state.inventory.includes(id)).length;
    const secretKeys = Object.keys(map.secrets);
    const found = state.mapStates[map.id]?.foundSecrets ?? {};
    const secrets = secretKeys.filter((k) => found[k]).length;
    return {
      id: map.id,
      name: map.name,
      visited: isVisited(state, map.id),
      current: map.id === state.mapId,
      shinies,
      shiniesTotal: shinyIds.length,
      secrets,
      secretsTotal: secretKeys.length,
      complete: shinies === shinyIds.length && secrets === secretKeys.length,
    };
  });
}

/** Undirected room-to-room links, one per pair, from the maps' exits. */
export function roomLinks(): [string, string][] {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const map of Object.values(MAPS)) {
    for (const exit of map.exits) {
      const pair = [map.id, exit.toMap].sort() as [string, string];
      const k = pair.join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(pair);
    }
  }
  return out;
}
