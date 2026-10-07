import { audio } from '@/engine/audio';
import { game, hasProgress, resetSave } from '@/core/game';
import { resetPlaytime } from '@/core/playtime';
import { MAPS } from '@/content/maps';
import { progressOf } from '@/content/progress';
import { ConfirmButton } from './ConfirmButton';
import { TitleScene } from './TitleScene';

/** The three things a player does, in the words the buttons use. */
const VERBS: { verb: string; what: string }[] = [
  { verb: 'Paw', what: 'poke, sniff and knock things off shelves' },
  { verb: 'Dig', what: 'where the collar hums, something is buried' },
  { verb: 'Hop', what: 'over gaps, rubble, and anything that clicks' },
];

export function TitleScreen({ onBegin }: { onBegin: () => void }) {
  const started = hasProgress();
  const state = game.get();
  const progress = progressOf(state);
  const where = MAPS[state.mapId]?.name;
  return (
    <div className="title-screen">
      <div className="title-screen__stars" aria-hidden="true" />
      <TitleScene />
      <h1 className="title-screen__logo">UNEARTH</h1>
      <div className="title-screen__rule" />
      <p className="title-screen__tag">
        Dad has gone out. CK, the Curious Kitten, is on the case — and the whole world is full of things to dig up.
      </p>
      {started ? (
        <p className="title-screen__progress" data-testid="title-progress">
          {where ? <span>CK is in {where}</span> : null}
          <span>
            ✦ {progress.shinies}/{progress.shiniesTotal} shinies · ✎ {progress.pages}/{progress.pagesTotal} pages
          </span>
        </p>
      ) : (
        <ul className="title-screen__verbs" aria-label="How to play">
          {VERBS.map((v) => (
            <li key={v.verb}>
              <span className="title-screen__verb">{v.verb}</span>
              <span>{v.what}</span>
            </li>
          ))}
        </ul>
      )}
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
        <ConfirmButton
          className="title-screen__reset"
          label="New Game"
          armedLabel="Tap again to erase progress"
          onConfirm={() => {
            resetSave();
            resetPlaytime();
            audio.unlock();
            onBegin();
          }}
        />
      ) : null}
      <p className="title-screen__foot">Best with sound on. Tap CK to say hello.</p>
    </div>
  );
}
