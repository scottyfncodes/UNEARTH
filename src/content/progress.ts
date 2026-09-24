/**
 * How much of the world CK has turned over: shinies, Dad's pages, other
 * observations, secret nooks and relics — rolled up into one "curiosity"
 * percentage for the journal and the ending.
 */
import type { GameState } from '@/game/types';
import { SHINY_IDS } from './items';
import { CLUES, FIELD_NOTE_PAGES } from './clues';
import { MAPS } from './maps';

const RELICS = ['idol_sunstone', 'keepers_bell', 'key_bronze', 'moon_seal'];

export interface Progress {
  shinies: number;
  shiniesTotal: number;
  pages: number;
  pagesTotal: number;
  clues: number;
  cluesTotal: number;
  secrets: number;
  secretsTotal: number;
  relics: number;
  relicsTotal: number;
  percent: number;
}

export function progressOf(state: GameState): Progress {
  const shinies = SHINY_IDS.filter((id) => state.inventory.includes(id)).length;
  const pages = FIELD_NOTE_PAGES.filter((p) => state.clues.includes(p.id)).length;
  const cluesTotal = Object.keys(CLUES).length;
  const clues = state.clues.filter((id) => CLUES[id]).length;
  let secrets = 0;
  let secretsTotal = 0;
  for (const map of Object.values(MAPS)) {
    const keys = Object.keys(map.secrets);
    secretsTotal += keys.length;
    const found = state.mapStates[map.id]?.foundSecrets ?? {};
    secrets += keys.filter((k) => found[k]).length;
  }
  const relics = RELICS.filter((id) => state.inventory.includes(id)).length;
  const got = shinies + clues + secrets + relics;
  const total = SHINY_IDS.length + cluesTotal + secretsTotal + RELICS.length;
  return {
    shinies,
    shiniesTotal: SHINY_IDS.length,
    pages,
    pagesTotal: FIELD_NOTE_PAGES.length,
    clues,
    cluesTotal,
    secrets,
    secretsTotal,
    relics,
    relicsTotal: RELICS.length,
    percent: Math.round((got / total) * 100),
  };
}

/** A rank for the ending screen, earned by curiosity alone. */
export function curiosityRank(percent: number): string {
  if (percent >= 100) return 'Keeper of the Hollow';
  if (percent >= 85) return 'Certified Nosy';
  if (percent >= 65) return 'Professional Snoop';
  if (percent >= 40) return 'Curious Kitten';
  return 'Mildly Interested';
}
