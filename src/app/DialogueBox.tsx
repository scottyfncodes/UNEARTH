import { useGameState } from './useGameState';
import { dispatch } from '@/core/game';
import { MAPS } from '@/content/maps';
import { Portrait } from './Sprite';

export function DialogueBox() {
  const state = useGameState();
  if (!state.dialogue) return null;
  const line = state.dialogue.lines[state.dialogue.index] ?? '';
  const isLast = state.dialogue.index >= state.dialogue.lines.length - 1;
  const npc = MAPS[state.mapId]!.entities.find((e) => e.kind === 'npc' && e.id === state.dialogue!.npcId);
  const speaker = npc?.kind === 'npc' ? npc : null;

  return (
    <button className="dialogue" onClick={() => dispatch({ type: 'interact' })} aria-label="Continue" data-testid="dialogue">
      {speaker ? (
        <div className="dialogue__portrait">
          <Portrait sprite={speaker.sprite} size={56} />
        </div>
      ) : null}
      <div className="dialogue__body">
        {speaker ? <div className="dialogue__name">{speaker.name}</div> : null}
        <p className="dialogue__line" key={`${state.dialogue.npcId}-${state.dialogue.index}`}>
          {line}
        </p>
        <span className="dialogue__hint">{isLast ? 'tap to close ✕' : 'tap to continue ▸'}</span>
      </div>
    </button>
  );
}
