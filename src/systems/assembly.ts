/**
 * Artifact assembly: turning a held set of fragment pieces into the composite
 * they belong to.
 *
 * A composite is just a TargetDef with `assemblyOf` set to its piece ids, and
 * `authored: true` so it is never rolled onto a loot table — the only way to
 * obtain one is to already hold every piece and assemble it here. Producing
 * the composite's DiscoveryRecord goes through the exact same
 * applyDiscoveryRecord path a dug-up find does, so assembly gets clues, chain
 * completions, unlocks and the discovery ceremony for free.
 */
import { getTarget, TARGETS } from '@/content/targets';
import type { DiscoveryRecord, SaveData, TargetDef } from '@/core/types';
import { applyDiscoveryRecord, type DiscoveryOutcome } from './discovery';
import { uid } from '@/core/rng';

/** Every composite artifact defined in content, regardless of progress. */
export function allComposites(): TargetDef[] {
  return TARGETS.filter((t) => !!t.assemblyOf && t.assemblyOf.length > 0);
}

export interface AssemblyProgress {
  composite: TargetDef;
  pieces: { def: TargetDef; held: boolean; record: DiscoveryRecord | null }[];
  heldCount: number;
  totalCount: number;
  /** Every piece has been found and the composite has not yet been made. */
  ready: boolean;
  /** The composite has already been assembled. */
  done: boolean;
}

/** Progress on a single composite, or null if the id is not a composite. */
export function assemblyProgress(save: SaveData, compositeId: string): AssemblyProgress | null {
  const composite = getTarget(compositeId);
  if (!composite?.assemblyOf) return null;

  const pieces = composite.assemblyOf.map((pieceId) => {
    const def = getTarget(pieceId);
    const record = save.discoveries.find((d) => d.targetId === pieceId) ?? null;
    return { def: def!, held: !!record, record };
  });

  const heldCount = pieces.filter((p) => p.held).length;
  const done = save.assembled.includes(compositeId);

  return {
    composite,
    pieces,
    heldCount,
    totalCount: pieces.length,
    ready: !done && heldCount === pieces.length,
    done,
  };
}

/**
 * Progress on every composite the player has made ANY headway on — at least
 * one piece found, or already assembled. Composites with zero pieces found
 * stay invisible; there is nothing to show yet.
 */
export function activeAssemblies(save: SaveData): AssemblyProgress[] {
  return allComposites()
    .map((c) => assemblyProgress(save, c.id)!)
    .filter((p) => p.heldCount > 0 || p.done);
}

/**
 * Performs the assembly: builds the composite's DiscoveryRecord and runs it
 * through the normal discovery pipeline. Returns null if the composite is not
 * actually ready (every piece held, not already assembled) — callers should
 * only offer this action when `assemblyProgress(...).ready` is true, but this
 * guards against a stale UI calling it anyway.
 */
export function resolveAssembly(
  save: SaveData,
  compositeId: string,
): { save: SaveData; outcome: DiscoveryOutcome } | null {
  const progress = assemblyProgress(save, compositeId);
  if (!progress || !progress.ready) return null;

  const { composite, pieces } = progress;
  // Condition reflects how carefully the pieces themselves were handled —
  // assembly itself is safe (no new risk), it just inherits their wear.
  const avgCondition =
    pieces.reduce((sum, p) => sum + (p.record?.condition ?? 100), 0) / pieces.length;
  const mostRecentLocation = pieces
    .map((p) => p.record)
    .filter((r): r is DiscoveryRecord => !!r)
    .sort((a, b) => b.foundAt - a.foundAt)[0]?.locationId;

  const record: DiscoveryRecord = {
    uid: uid('assembled'),
    targetId: composite.id,
    condition: Math.round(avgCondition),
    depthCm: 0,
    locationId: mostRecentLocation ?? 'loc_old_park',
    foundAt: Date.now(),
    value: Math.round(composite.value * (0.5 + 0.5 * (avgCondition / 100))),
  };

  const { save: nextSave, outcome } = applyDiscoveryRecord(save, record, composite);
  return {
    save: { ...nextSave, assembled: [...nextSave.assembled, composite.id] },
    outcome,
  };
}
