import { useGameState } from './useGameState';
import { progressOf, curiosityRank } from '@/content/progress';
import { formatDuration, playSeconds } from '@/core/playtime';
import { audio } from '@/engine/audio';
import { Portrait } from './Sprite';

/**
 * The credits card: the punchline, the numbers, and one last loose thread.
 */
export function Ending({ onKeepExploring, onNewGame }: { onKeepExploring: () => void; onNewGame: () => void }) {
  const state = useGameState();
  const p = progressOf(state);

  return (
    <div className="ending" data-testid="ending">
      <div className="ending__inner">
        <div className="ending__portraits">
          <Portrait sprite="dadGroceries" size={72} />
          <Portrait sprite="ck" size={64} />
        </div>
        <h1 className="ending__title">The End</h1>
        <p className="ending__line">…probably.</p>

        <div className="ending__times">
          <div>
            <span>Dad was gone</span>
            <strong>20 minutes</strong>
          </div>
          <div>
            <span>CK was gone</span>
            <strong>{formatDuration(playSeconds())}</strong>
          </div>
        </div>

        <div className="ending__stats">
          <div>
            ✦ Shinies <strong>{p.shinies}/{p.shiniesTotal}</strong>
          </div>
          <div>
            ✎ Dad&apos;s notes <strong>{p.pages}/{p.pagesTotal}</strong>
          </div>
          <div>
            ◆ Secret nooks <strong>{p.secrets}/{p.secretsTotal}</strong>
          </div>
          <div>
            ☾ Relics <strong>{p.relics}/{p.relicsTotal}</strong>
          </div>
        </div>
        <div className="ending__rank">
          Curiosity {p.percent}% — <em>{curiosityRank(p.percent)}</em>
        </div>

        <p className="ending__sting">
          That night, in the grocery bag under the fancy fish, something small and bronze begins, very quietly, to hum.
        </p>

        <div className="ending__buttons">
          <button
            className="title-screen__begin"
            onClick={() => {
              audio.ui();
              onKeepExploring();
            }}
          >
            {p.percent < 100 ? 'Keep exploring' : 'Wander a while'}
          </button>
          <button
            className="title-screen__reset"
            onClick={() => {
              if (confirm('Start a brand new game? This clears your current progress.')) onNewGame();
            }}
          >
            New game
          </button>
        </div>
      </div>
    </div>
  );
}
