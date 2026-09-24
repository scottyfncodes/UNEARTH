/**
 * Presentation-only overlay state: the find card, the note card, chapter
 * title cards and the one story interlude. Kept apart from GameState on
 * purpose — none of it is saved, and the engine never knows it exists.
 */
import { Store } from './store';

export type Card =
  | { kind: 'find'; itemId: string; headline: string; detail?: string }
  | { kind: 'note'; clueId: string };

export interface UiState {
  cards: Card[];
  chapter: { number: string; title: string; key: number } | null;
  interlude: string | null;
}

export const ui = new Store<UiState>({ cards: [], chapter: null, interlude: null });

export function pushCard(card: Card): void {
  ui.set({ ...ui.get(), cards: [...ui.get().cards, card] });
}

export function dismissCard(): void {
  ui.set({ ...ui.get(), cards: ui.get().cards.slice(1) });
}

/** Whether a modal overlay is up — movement input is ignored while it is. */
export function isBlocking(): boolean {
  const s = ui.get();
  return s.cards.length > 0 || s.interlude !== null;
}

let chapterTimer: ReturnType<typeof setTimeout> | null = null;
export function showChapter(chapter: { number: string; title: string }): void {
  ui.set({ ...ui.get(), chapter: { ...chapter, key: Date.now() } });
  if (chapterTimer) clearTimeout(chapterTimer);
  chapterTimer = setTimeout(() => ui.set({ ...ui.get(), chapter: null }), 3600);
}

export function showInterlude(text: string, ms = 2600): Promise<void> {
  ui.set({ ...ui.get(), interlude: text });
  return new Promise((resolve) =>
    setTimeout(() => {
      ui.set({ ...ui.get(), interlude: null });
      resolve();
    }, ms),
  );
}
