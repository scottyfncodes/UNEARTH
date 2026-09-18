import { audio } from '@/engine/audio';
import { resetSave } from '@/core/game';

export function TitleScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="title-screen">
      <div className="title-screen__cat" aria-hidden="true">
        🐾
      </div>
      <h1 className="title-screen__logo">UNEARTH</h1>
      <div className="title-screen__rule" />
      <p className="title-screen__tag">CK, the Curious Kitten, follows a trail into the ruins.</p>
      <button
        className="title-screen__begin"
        onClick={() => {
          audio.unlock();
          onBegin();
        }}
      >
        Begin
      </button>
      <button
        className="title-screen__reset"
        onClick={() => {
          if (confirm('Start a brand new game? This clears your current progress.')) {
            resetSave();
          }
        }}
      >
        New Game
      </button>
    </div>
  );
}
