import { useEffect, useRef, useState } from 'react';
import { useGameState } from './useGameState';
import { MAPS } from '@/content/maps';
import { computeCollarReading } from '@/game/collar';
import { progressOf } from '@/content/progress';
import { audio } from '@/engine/audio';

export function Hud({ onOpenJournal }: { onOpenJournal: () => void }) {
  const state = useGameState();
  const [sound, setSound] = useState(audio.isEnabled());
  const map = MAPS[state.mapId]!;
  const reading = computeCollarReading(map, state);
  const progress = progressOf(state);
  const bars = reading.kind ? Math.max(1, Math.round(reading.strength * 5)) : 0;

  // Hearts react: a jolt when one is lost, a pop when one comes back.
  const prevHearts = useRef(state.hearts);
  const [heartFx, setHeartFx] = useState<{ kind: 'hurt' | 'heal'; key: number } | null>(null);
  useEffect(() => {
    if (state.hearts !== prevHearts.current) {
      setHeartFx({ kind: state.hearts < prevHearts.current ? 'hurt' : 'heal', key: Date.now() });
      prevHearts.current = state.hearts;
    }
  }, [state.hearts]);

  return (
    <div className="hud">
      <div className="hud__top">
        <div
          className={`hud__hearts ${heartFx ? `hud__hearts--${heartFx.kind}` : ''}`}
          key={heartFx?.key ?? 0}
          aria-label={`${state.hearts} of ${state.maxHearts} hearts`}
        >
          {Array.from({ length: state.maxHearts }, (_, i) => (
            <span key={i} className={`heart ${i < state.hearts ? 'heart--full' : 'heart--empty'} ${heartFx?.kind === 'heal' && i === state.hearts - 1 ? 'heart--pop' : ''}`} />
          ))}
        </div>
        <div className="hud__map-name">{map.name}</div>
        <button
          className="hud__icon-btn"
          onClick={() => {
            audio.unlock();
            audio.setEnabled(!sound);
            setSound(!sound);
          }}
          aria-label={sound ? 'Mute sound' : 'Unmute sound'}
        >
          {sound ? '♪' : '✕'}
        </button>
        <button className="hud__icon-btn hud__journal" onClick={onOpenJournal} aria-label="Open journal">
          📖
        </button>
      </div>

      <div className="hud__status">
        <div className={`collar collar--${reading.kind ?? 'quiet'} ${reading.locked ? 'collar--locked' : ''}`} aria-label="Collar signal">
          <span className="collar__label">
            {reading.kind === 'mechanism' ? 'Careful' : reading.locked ? 'Here!' : reading.kind ? (reading.aim > 0.6 ? 'Clear' : 'Faint') : 'Quiet'}
          </span>
          <span className="collar__bars">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < bars ? 'on' : ''} style={{ height: 4 + i * 3 }} />
            ))}
          </span>
        </div>
        <div className="hud__counts">
          <span title="Shinies">✦ {progress.shinies}/{progress.shiniesTotal}</span>
          <span title="Dad's field notes">✎ {progress.pages}/{progress.pagesTotal}</span>
        </div>
      </div>
    </div>
  );
}
