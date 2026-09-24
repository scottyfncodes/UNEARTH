import { audio } from '@/engine/audio';
import { resetSave, game } from '@/core/game';
import { resetPlaytime } from '@/core/playtime';
import { Portrait } from './Sprite';

export function TitleScreen({ onBegin }: { onBegin: () => void }) {
  const started = Object.keys(game.get().flags).length > 0;
  return (
    <div className="title-screen">
      <div className="title-screen__stars" aria-hidden="true" />
      <div className="title-screen__cat">
        <Portrait sprite="ck" size={112} />
      </div>
      <h1 className="title-screen__logo">UNEARTH</h1>
      <div className="title-screen__rule" />
      <p className="title-screen__tag">
        Dad has gone out.
        <br />
        CK, the Curious Kitten, is on the case.
      </p>
      <button
        className="title-screen__begin"
        onClick={() => {
          audio.unlock();
          onBegin();
        }}
      >
        {started ? 'Continue' : 'Begin'}
      </button>
      {started ? (
        <button
          className="title-screen__reset"
          onClick={() => {
            if (confirm('Start a brand new game? This clears your current progress.')) {
              resetSave();
              resetPlaytime();
              audio.unlock();
              onBegin();
            }
          }}
        >
          New Game
        </button>
      ) : null}
      <p className="title-screen__foot">Best with sound on — the collar sings when something is buried.</p>
    </div>
  );
}
