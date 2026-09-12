/**
 * Turning an extracted object into a permanent record: journal entry, clue,
 * chain completion, unlocks and funds. Pure function of (save, extraction) so
 * the whole progression step is testable.
 */
import { getClue } from '@/content/clues';
import { getLocation } from '@/content/locations';
import type {
  ClueDef,
  DiscoveryRecord,
  LocationDef,
  MysteryChain,
  SaveData,
  TargetDef,
} from '@/core/types';
import { newlyCompleted } from './mystery';
import { uid } from '@/core/rng';

export interface ExtractionInput {
  def: TargetDef;
  condition: number;
  depthCm: number;
  locationId: string;
  tutorial?: boolean;
}

export interface DiscoveryOutcome {
  record: DiscoveryRecord;
  def: TargetDef;
  clue: ClueDef | null;
  /** Chains completed by this find. */
  chains: MysteryChain[];
  unlockedLocations: LocationDef[];
  unlockedAdventures: string[];
  /** First time this kind of object has ever been found. */
  firstOfKind: boolean;
  fundsGained: number;
}

export function resolveDiscovery(
  save: SaveData,
  input: ExtractionInput,
): { save: SaveData; outcome: DiscoveryOutcome } {
  const { def, locationId } = input;
  const condition = Math.round(Math.max(0, Math.min(100, input.condition)));

  const record: DiscoveryRecord = {
    uid: uid('find'),
    targetId: def.id,
    condition,
    depthCm: Math.round(input.depthCm * 10) / 10,
    locationId,
    foundAt: Date.now(),
    // Condition drives value: a damaged artifact is worth less, always.
    value: Math.round(def.value * (0.35 + 0.65 * (condition / 100))),
    ...(input.tutorial ? { tutorial: true as const } : {}),
  };

  const firstOfKind = !save.discoveries.some((d) => d.targetId === def.id);

  const clue = def.clueId ? getClue(def.clueId) ?? null : null;
  const clues = clue && !save.clues.includes(clue.id) ? [...save.clues, clue.id] : save.clues;

  const chains = newlyCompleted(clues, save.chainsComplete);
  const unlockedLocations: LocationDef[] = [];
  const unlockedAdventures: string[] = [];
  const unlocked = [...save.unlockedLocations];
  const adventures = { ...save.adventures };

  for (const chain of chains) {
    if (chain.unlocksLocation && !unlocked.includes(chain.unlocksLocation)) {
      unlocked.push(chain.unlocksLocation);
      const loc = getLocation(chain.unlocksLocation);
      if (loc) unlockedLocations.push(loc);
    }
    if (chain.unlocksAdventure) {
      adventures[chain.unlocksAdventure] = adventures[chain.unlocksAdventure] ?? 'available';
      unlockedAdventures.push(chain.unlocksAdventure);
    }
  }

  const nextSave: SaveData = {
    ...save,
    discoveries: [record, ...save.discoveries].slice(0, 500),
    clues,
    chainsComplete: chains.length ? [...save.chainsComplete, ...chains.map((c) => c.id)] : save.chainsComplete,
    unlockedLocations: unlocked,
    adventures,
    money: save.money + record.value,
    stats: {
      ...save.stats,
      finds: save.stats.finds + 1,
      bestCondition: Math.max(save.stats.bestCondition, condition),
    },
    flags: {
      ...save.flags,
      tutorialFound: save.flags.tutorialFound || !!input.tutorial,
    },
  };

  return {
    save: nextSave,
    outcome: {
      record,
      def,
      clue: clue && !save.clues.includes(clue.id) ? clue : null,
      chains,
      unlockedLocations,
      unlockedAdventures,
      firstOfKind,
      fundsGained: record.value,
    },
  };
}

export function conditionLabel(condition: number): string {
  if (condition >= 92) return 'Exceptional';
  if (condition >= 78) return 'Good';
  if (condition >= 60) return 'Fair';
  if (condition >= 40) return 'Worn';
  if (condition >= 20) return 'Poor';
  return 'Damaged';
}
