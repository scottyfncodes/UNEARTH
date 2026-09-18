import { useGameState } from './useGameState';
import { dispatch } from '@/core/game';

export function DialogueBox() {
  const state = useGameState();
  if (!state.dialogue) return null;
  const line = state.dialogue.lines[state.dialogue.index] ?? '';
  const isLast = state.dialogue.index >= state.dialogue.lines.length - 1;

  return (
    <button className="dialogue" onClick={() => dispatch({ type: 'interact' })} aria-label="Continue">
      <p className="dialogue__line">{line}</p>
      <span className="dialogue__hint">{isLast ? 'tap to close ✕' : 'tap to continue ▸'}</span>
    </button>
  );
}
