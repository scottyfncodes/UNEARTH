/**
 * Clue chains. Entirely data-driven: a chain is a set of clue ids plus what
 * completing it opens up. Nothing here knows what a "three-pointed sun" is.
 */
import { CHAINS, getChain, getClue } from '@/content/clues';
import type { ClueDef, MysteryChain } from '@/core/types';

export interface ChainProgress {
  chain: MysteryChain;
  held: ClueDef[];
  missing: number;
  complete: boolean;
}

export function chainProgress(heldClues: readonly string[]): ChainProgress[] {
  return CHAINS.map((chain) => {
    const held = chain.clueIds
      .filter((id) => heldClues.includes(id))
      .map((id) => getClue(id))
      .filter((c): c is ClueDef => !!c);
    return {
      chain,
      held,
      missing: chain.clueIds.length - held.length,
      complete: held.length === chain.clueIds.length,
    };
  });
}

/** Chains that just became complete and have not yet been acknowledged. */
export function newlyCompleted(
  heldClues: readonly string[],
  alreadyCompleted: readonly string[],
): MysteryChain[] {
  return chainProgress(heldClues)
    .filter((p) => p.complete && !alreadyCompleted.includes(p.chain.id))
    .map((p) => p.chain);
}

/** Chains a clue belongs to, for journal cross-references. */
export function chainForClue(clueId: string): MysteryChain | undefined {
  const clue = getClue(clueId);
  return clue ? getChain(clue.chainId) : undefined;
}
