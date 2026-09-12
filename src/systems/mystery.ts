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

export interface SymbolConnection {
  symbol: string;
  clues: ClueDef[];
}

/**
 * Groups every held clue by its recurring symbol. A group of one is just a
 * clue; a group of two or more is a connection — proof that finds made in
 * different places, possibly a long session apart, are the same mystery.
 * This is symbol-based rather than chain-based on purpose: two clues can
 * share a mark without belonging to the same formal chain, and that overlap
 * is exactly the "wait, that matters" moment worth surfacing.
 */
export function symbolConnections(heldClues: readonly string[]): SymbolConnection[] {
  const bySymbol = new Map<string, ClueDef[]>();
  for (const id of heldClues) {
    const clue = getClue(id);
    if (!clue) continue;
    const list = bySymbol.get(clue.symbol);
    if (list) list.push(clue);
    else bySymbol.set(clue.symbol, [clue]);
  }
  return [...bySymbol.entries()]
    .map(([symbol, clues]) => ({ symbol, clues }))
    .filter((g) => g.clues.length >= 2)
    .sort((a, b) => b.clues.length - a.clues.length);
}
