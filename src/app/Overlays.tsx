/**
 * The modal and semi-modal overlays: the find card ("Ooh, shiny!"), the note
 * card (reading a clue), the chapter title, and the story interlude.
 */
import { useSyncExternalStore } from 'react';
import { dismissCard, ui } from '@/core/ui';
import { getItem } from '@/content/items';
import { getClue } from '@/content/clues';
import { audio } from '@/engine/audio';
import { ItemIcon } from './Sprite';

function useUi() {
  return useSyncExternalStore(
    (l) => ui.subscribe(l),
    () => ui.get(),
  );
}

const KIND_LABEL: Record<string, string> = {
  shiny: 'Shiny',
  fragment: 'Fragment',
  artifact: 'Artifact',
  relic: 'Relic',
  treat: 'Treat',
};

export function CardOverlay() {
  const state = useUi();
  const card = state.cards[0];
  if (!card) return null;

  const close = () => {
    audio.ui();
    dismissCard();
  };

  if (card.kind === 'find') {
    const item = getItem(card.itemId);
    return (
      <button className="card-overlay" onClick={close} aria-label="Continue" data-testid="find-card">
        <div className={`find-card find-card--${item?.kind ?? 'shiny'}`}>
          <div className="find-card__rays" aria-hidden="true" />
          <div className="find-card__headline">{card.headline}</div>
          <div className="find-card__icon">
            <ItemIcon itemId={card.itemId} size={96} />
          </div>
          <div className="find-card__kind">{KIND_LABEL[item?.kind ?? ''] ?? ''}</div>
          <h2 className="find-card__name">{item?.name}</h2>
          <p className="find-card__desc">{item?.description}</p>
          {card.detail ? <p className="find-card__detail">{card.detail}</p> : null}
          <span className="card-hint">tap to continue</span>
        </div>
      </button>
    );
  }

  const clue = getClue(card.clueId);
  return (
    <button className="card-overlay" onClick={close} aria-label="Continue" data-testid="note-card">
      <div className={`note-card ${clue?.page ? 'note-card--page' : ''}`}>
        <div className="note-card__title">{clue?.title}</div>
        <p className="note-card__text">{clue?.text}</p>
        <span className="card-hint">{clue?.page ? 'added to the journal' : 'noted in the journal'} · tap to continue</span>
      </div>
    </button>
  );
}

export function ChapterCard() {
  const state = useUi();
  if (!state.chapter) return null;
  return (
    <div className="chapter-card" key={state.chapter.key} aria-live="polite">
      <div className="chapter-card__number">{state.chapter.number}</div>
      <div className="chapter-card__rule" />
      <div className="chapter-card__title">{state.chapter.title}</div>
    </div>
  );
}

export function Interlude() {
  const state = useUi();
  if (!state.interlude) return null;
  return (
    <div className="interlude">
      <p>{state.interlude}</p>
    </div>
  );
}
