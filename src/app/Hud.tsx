import { useGameState } from './useGameState';
import { MAPS } from '@/content/maps';
import { computeDetectorReading } from '@/game/detector';
import { getItem } from '@/content/items';

export function Hud({ onOpenJournal }: { onOpenJournal: () => void }) {
  const state = useGameState();
  const map = MAPS[state.mapId]!;
  const reading = state.tool === 'detector' && state.detectorOn ? computeDetectorReading(map, state) : null;
  const artifactCount = state.inventory.filter((id) => getItem(id)?.kind !== 'shiny').length;

  return (
    <div className="hud">
      <div className="hud__top">
        <div className="hud__hearts" aria-label={`${state.hearts} of ${state.maxHearts} hearts`}>
          {Array.from({ length: state.maxHearts }, (_, i) => (
            <span key={i} className={`heart ${i < state.hearts ? 'heart--full' : 'heart--empty'}`} />
          ))}
        </div>
        <div className="hud__map-name">{map.name}</div>
        <button className="hud__journal" onClick={onOpenJournal} aria-label="Open journal">
          📖
        </button>
      </div>

      <div className="hud__bottom-left">
        <div className={`hud__tool hud__tool--${state.tool}`}>{state.tool === 'detector' ? '📡 Collar' : '🐾 Paws'}</div>
        {state.tool === 'detector' && (
          <div className="meter meter--detector" role="presentation">
            <div
              className="meter__fill"
              style={{
                width: `${(reading?.strength ?? 0) * 100}%`,
                background: reading?.kind === 'mechanism' ? 'var(--danger)' : 'var(--gold)',
              }}
            />
          </div>
        )}
        <div className="hud__inventory">🏺 {artifactCount}</div>
      </div>
    </div>
  );
}
