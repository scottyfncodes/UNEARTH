import { useState } from 'react';
import { useGameState } from './useGameState';
import { CLUES, FIELD_NOTE_PAGES } from '@/content/clues';
import { getItem, SHINY_IDS } from '@/content/items';
import { progressOf, curiosityRank } from '@/content/progress';
import { audio } from '@/engine/audio';
import { ItemIcon } from './Sprite';

type Tab = 'satchel' | 'notes' | 'trail';

export function Journal({ onClose }: { onClose: () => void }) {
  const state = useGameState();
  const [tab, setTab] = useState<Tab>('satchel');
  const [selected, setSelected] = useState<string | null>(null);
  const progress = progressOf(state);
  const keyItems = state.inventory.filter((id) => {
    const kind = getItem(id)?.kind;
    return kind === 'fragment' || kind === 'artifact' || kind === 'relic';
  });
  const observations = state.clues.filter((id) => CLUES[id] && CLUES[id]!.page === undefined);
  const selectedItem = selected ? getItem(selected) : undefined;

  return (
    <div className="journal-overlay">
      <div className="journal">
        <div className="journal__header">
          <div>
            <h2>CK&apos;s Journal</h2>
            <div className="journal__rank">
              Curiosity {progress.percent}% · {curiosityRank(progress.percent)}
            </div>
          </div>
          <button className="journal__close" onClick={onClose} aria-label="Close journal">
            ✕
          </button>
        </div>

        <div className="journal__tabs" role="tablist">
          {(
            [
              ['satchel', 'Satchel'],
              ['notes', `Dad's Notes ${progress.pages}/${progress.pagesTotal}`],
              ['trail', 'The Trail'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`journal__tab ${tab === id ? 'journal__tab--on' : ''}`}
              onClick={() => {
                audio.ui();
                setTab(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="journal__body">
          {tab === 'satchel' ? (
            <>
              <h3>Treasures</h3>
              {keyItems.length === 0 ? (
                <p className="journal__empty">Nothing important yet. Follow the collar.</p>
              ) : (
                <div className="satchel-grid">
                  {keyItems.map((id) => (
                    <button key={id} className="satchel-slot" onClick={() => setSelected(id)} aria-label={getItem(id)?.name}>
                      <ItemIcon itemId={id} size={40} />
                    </button>
                  ))}
                </div>
              )}

              <h3>
                Shinies <span className="journal__count">{progress.shinies}/{progress.shiniesTotal}</span>
              </h3>
              <div className="satchel-grid">
                {SHINY_IDS.map((id) => {
                  const have = state.inventory.includes(id);
                  return (
                    <button
                      key={id}
                      className={`satchel-slot ${have ? '' : 'satchel-slot--missing'}`}
                      onClick={() => have && setSelected(id)}
                      aria-label={have ? getItem(id)?.name : 'Not found yet'}
                    >
                      <ItemIcon itemId={id} size={40} dim={!have} />
                    </button>
                  );
                })}
              </div>

              {selectedItem ? (
                <div className="journal__detail">
                  <strong>{selectedItem.name}</strong>
                  <span>{selectedItem.description}</span>
                </div>
              ) : (
                <p className="journal__empty">Tap a find to look at it. Secret nooks found: {progress.secrets}/{progress.secretsTotal}</p>
              )}
            </>
          ) : null}

          {tab === 'notes' ? (
            <ul className="journal__list">
              {FIELD_NOTE_PAGES.map((page) =>
                state.clues.includes(page.id) ? (
                  <li key={page.id} className="journal__page">
                    <strong>{page.title}</strong>
                    <span>{page.text}</span>
                  </li>
                ) : (
                  <li key={page.id} className="journal__page journal__page--missing">
                    <strong>Page {page.page === FIELD_NOTE_PAGES.length ? 'the last' : page.page} — missing</strong>
                    <span>Somewhere out there, a page of Dad&apos;s notes is waiting.</span>
                  </li>
                ),
              )}
            </ul>
          ) : null}

          {tab === 'trail' ? (
            observations.length === 0 ? (
              <p className="journal__empty">No observations yet. Paw at things. Everything.</p>
            ) : (
              <ul className="journal__list">
                {observations.map((id) => (
                  <li key={id}>
                    <strong>{CLUES[id]!.title}</strong>
                    <span>{CLUES[id]!.text}</span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
