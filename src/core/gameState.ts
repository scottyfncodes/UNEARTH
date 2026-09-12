/**
 * The single source of truth for persistent + navigational game state.
 *
 * Per-frame things (player position while walking, the pit itself) live in the
 * engine and are flushed in here at sensible moments — the store is not a
 * render loop.
 */
import { getLocation } from '@/content/locations';
import { getDetector, getTool } from '@/content/equipment';
import { getTarget } from '@/content/targets';
import { generateField } from '@/systems/placement';
import { resolveDiscovery, type DiscoveryOutcome, type ExtractionInput } from '@/systems/discovery';
import { Store } from './store';
import { defaultStorage, freshSave, loadSave, writeSave, clearSave, type StorageLike } from './save';
import type { DetectorDef, FieldState, SaveData, ToolDef } from './types';
import { randomSeed } from './rng';

export type Route =
  | 'title'
  | 'map'
  | 'detect'
  | 'excavate'
  | 'discovery'
  | 'journal'
  | 'equipment'
  | 'adventure';

/** Everything the excavation scene needs to know about the hole being dug. */
export interface DigContext {
  locationId: string;
  targetUid: string | null;
  targetId: string | null;
  /** 0 = the object is not in this hole at all. */
  accuracy: number;
  offsetAngle: number;
  baseCondition: number;
  depthCm: number;
  digX: number;
  digY: number;
  seed: string;
  tutorial?: boolean;
}

export interface GameState {
  save: SaveData;
  route: Route;
  dig: DigContext | null;
  pending: DiscoveryOutcome | null;
  /** Transient one-line message shown over the world. */
  notice: string | null;
  journalFocus: string | null;
  loadOutcome: 'new' | 'loaded' | 'migrated' | 'recovered';
}

let storage: StorageLike = defaultStorage();
const loaded = loadSave(storage);

export const game = new Store<GameState>({
  save: loaded.save,
  route: loaded.save.discoveries.length > 0 || loaded.save.flags.seenIntro ? 'map' : 'title',
  dig: null,
  pending: null,
  notice: null,
  journalFocus: null,
  loadOutcome: loaded.outcome,
});

// ── persistence ─────────────────────────────────────────────────────────────
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function persistNow(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  writeSave(game.get().save, storage);
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeSave(game.get().save, storage);
  }, 350);
}

/** Test hook: point the store at a different storage implementation. */
export function useStorage(next: StorageLike): void {
  storage = next;
}

function setSave(mutate: (save: SaveData) => SaveData): void {
  game.update((state) => ({ ...state, save: mutate(state.save) }));
  schedulePersist();
}

/**
 * Mutates the save without notifying React. Used for high-frequency writes
 * (player position, holes) that no component needs to re-render for.
 */
export function patchSaveSilently(mutate: (save: SaveData) => void): void {
  mutate(game.get().save);
  schedulePersist();
}

// ── navigation ──────────────────────────────────────────────────────────────
export function go(route: Route): void {
  game.update((s) => ({ ...s, route, notice: null }));
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

/** A one-line message over the world. Clears itself so it never becomes UI. */
export function notice(message: string | null, holdMs = 5000): void {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  game.update((s) => ({ ...s, notice: message }));
  if (message) {
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      game.update((s) => (s.notice === message ? { ...s, notice: null } : s));
    }, holdMs);
  }
}

export function focusJournal(targetId: string | null): void {
  game.update((s) => ({ ...s, journalFocus: targetId, route: 'journal' }));
}

export function markIntroSeen(): void {
  setSave((save) => ({ ...save, flags: { ...save.flags, seenIntro: true } }));
}

// ── equipment ───────────────────────────────────────────────────────────────
export function currentDetector(): DetectorDef {
  return getDetector(game.get().save.detectorId);
}

export function ownedTools(): ToolDef[] {
  return game
    .get()
    .save.ownedEquipment.map((id) => getTool(id))
    .filter((t): t is ToolDef => !!t);
}

export function hasEquipment(id: string): boolean {
  return game.get().save.ownedEquipment.includes(id);
}

export function buyEquipment(id: string, price: number): boolean {
  const save = game.get().save;
  if (save.ownedEquipment.includes(id)) return false;
  if (save.money < price) return false;
  setSave((s) => ({
    ...s,
    money: s.money - price,
    ownedEquipment: [...s.ownedEquipment, id],
  }));
  return true;
}

export function equipDetector(id: string): void {
  if (!hasEquipment(id)) return;
  setSave((s) => ({ ...s, detectorId: id }));
}

// ── field sessions ──────────────────────────────────────────────────────────
export function isLocationUnlocked(locationId: string): boolean {
  const loc = getLocation(locationId);
  if (!loc) return false;
  if (!loc.lockedBy) return true;
  return game.get().save.unlockedLocations.includes(locationId);
}

/**
 * Enter a location. Reuses the saved field when it belongs to this location so
 * a refresh drops the player back into the same ground; otherwise seeds a new
 * one. `forceNew` is the "search fresh ground" action.
 */
export function enterLocation(locationId: string, forceNew = false): FieldState | null {
  const loc = getLocation(locationId);
  if (!loc || !isLocationUnlocked(locationId)) return null;

  const save = game.get().save;
  const existing = save.field;
  const reusable =
    !forceNew &&
    existing &&
    existing.locationId === locationId &&
    existing.targets.some((t) => !t.dug);

  const field = reusable
    ? existing!
    : generateField(loc, randomSeed(), {
        heldClues: save.clues,
        includeTutorial: !save.flags.tutorialFound && loc.table.length > 0,
      });

  setSave((s) => ({ ...s, field }));
  go('detect');
  return field;
}

export function currentField(): FieldState | null {
  return game.get().save.field;
}

export function bumpStat(key: keyof SaveData['stats'], amount = 1): void {
  patchSaveSilently((save) => {
    save.stats[key] = (save.stats[key] ?? 0) + amount;
  });
}

export function recordHole(x: number, y: number, found: boolean): void {
  patchSaveSilently((save) => {
    if (!save.field) return;
    save.field.holes.push({ x: Math.round(x), y: Math.round(y), found });
    if (save.field.holes.length > 64) save.field.holes.shift();
    save.stats.holesDug++;
    if (!found) save.stats.emptyHoles++;
  });
}

export function savePlayerPosition(x: number, y: number): void {
  patchSaveSilently((save) => {
    if (!save.field) return;
    save.field.playerX = x;
    save.field.playerY = y;
  });
}

// ── digging ─────────────────────────────────────────────────────────────────
export function beginDig(context: DigContext): void {
  game.update((s) => ({ ...s, dig: context, route: 'excavate', notice: null }));
}

/** Mark a target as dug so it stops broadcasting a signal. */
export function markTargetDug(uid: string): void {
  setSave((save) => {
    if (!save.field) return save;
    return {
      ...save,
      field: {
        ...save.field,
        targets: save.field.targets.map((t) => (t.uid === uid ? { ...t, dug: true } : t)),
      },
    };
  });
}

export function abandonDig(): void {
  game.update((s) => ({ ...s, dig: null, route: 'detect' }));
}

export function completeExtraction(input: ExtractionInput): DiscoveryOutcome {
  const { save, outcome } = resolveDiscovery(game.get().save, input);
  game.update((s) => ({ ...s, save, pending: outcome, dig: null, route: 'discovery' }));
  persistNow();
  return outcome;
}

export function dismissDiscovery(next: Route = 'detect'): void {
  game.update((s) => ({ ...s, pending: null, route: next }));
}

// ── adventures ──────────────────────────────────────────────────────────────
export function setAdventureStatus(id: string, status: 'locked' | 'available' | 'complete'): void {
  setSave((s) => ({ ...s, adventures: { ...s.adventures, [id]: status } }));
}

export function adventureStatus(id: string): 'locked' | 'available' | 'complete' {
  return game.get().save.adventures[id] ?? 'locked';
}

// ── settings / reset ────────────────────────────────────────────────────────
export function setSetting<K extends keyof SaveData['settings']>(
  key: K,
  value: SaveData['settings'][K],
): void {
  setSave((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
}

export function resetProgress(): void {
  clearSave(storage);
  game.set({
    save: freshSave(),
    route: 'title',
    dig: null,
    pending: null,
    notice: null,
    journalFocus: null,
    loadOutcome: 'new',
  });
  persistNow();
}

/** Convenience for tests and dev tooling. */
export function targetDefFor(uid: string) {
  const field = currentField();
  const placed = field?.targets.find((t) => t.uid === uid);
  return placed ? getTarget(placed.targetId) : undefined;
}
