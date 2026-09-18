import { useGameState } from './useGameState';
import { getClue } from '@/content/clues';
import { getItem } from '@/content/items';

export function Journal({ onClose }: { onClose: () => void }) {
  const state = useGameState();

  return (
    <div className="journal-overlay">
      <div className="journal">
        <div className="journal__header">
          <h2>CK&apos;s Journal</h2>
          <button className="journal__close" onClick={onClose} aria-label="Close journal">
            ✕
          </button>
        </div>

        <section>
          <h3>Satchel</h3>
          {state.inventory.length === 0 ? (
            <p className="journal__empty">Nothing yet. Follow the signal.</p>
          ) : (
            <ul className="journal__list">
              {state.inventory.map((id) => {
                const item = getItem(id);
                if (!item) return null;
                return (
                  <li key={id}>
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3>The Trail</h3>
          {state.clues.length === 0 ? (
            <p className="journal__empty">No clues collected yet.</p>
          ) : (
            <ul className="journal__list">
              {state.clues.map((id) => {
                const clue = getClue(id);
                if (!clue) return null;
                return (
                  <li key={id}>
                    <strong>{clue.title}</strong>
                    <span>{clue.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
