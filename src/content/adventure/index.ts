/**
 * Registry of every authored adventure. Adding a third adventure means a new
 * file of this module's shape plus one line here — no gameplay code changes.
 */
import { SEALED_CHAMBER } from './sealedChamber';
import { COURTYARD } from './courtyard';
import type { AdventureDef } from './types';

export const ADVENTURES: Record<string, AdventureDef> = {
  [SEALED_CHAMBER.id]: SEALED_CHAMBER,
  [COURTYARD.id]: COURTYARD,
};

export function getAdventure(id: string): AdventureDef | undefined {
  return ADVENTURES[id];
}

export type { AdventureDef, AdventureBeat, DialPuzzle, MechanismConfig, EscapeBeat } from './types';
