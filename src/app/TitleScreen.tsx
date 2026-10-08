import { audio } from '@/engine/audio';
import { game, hasProgress, resetSave } from '@/core/game';
import { resetPlaytime } from '@/core/playtime';
import { MAPS } from '@/content/maps';
import { progressOf } from '@/content/progress';
import { ConfirmButton } from './ConfirmButton';
import { PixelText } from './PixelText';
import { TitleScene } from './TitleScene';

/**
 * The opening frame is the game itself: CK's front room, the note, the door
 * standing open on the trail. Under it, the name in CK's own pixels, one
 * line of premise, and one big button that does the first thing the game
 * is about — following the trail (or, coming back, getting on with it).
 */
export function TitleScreen({ onBegin }: { onBegin: () => void }) {
  const started = hasProgress();
  const state = game.get();
  const progress = progressOf(state);
  const where = MAPS[state.mapId]?.name;
  const verb = started ? 'Keep digging' : 'Follow the trail';
  return (
    <div className="title-screen">
      <TitleScene />
      <div className="title-screen__body">
        <h1 className="title-screen__logo">
          <PixelText text="UNEARTH" size={42} maxWidth={320} title color="#f6e7a8" lower="#d9a441" />
        </h1>
        <p className="title-screen__tag">
          <PixelText text={"DAD'S GONE OUT.\nCK'S ON THE CASE."} label="Dad's gone out. CK's on the case." size={13} />
        </p>
        {started ? (
          <p className="title-screen__progress" data-testid="title-progress">
            <PixelText
              text={`${where ? `CK IS IN ${where}\n` : ''}${progress.shinies}/${progress.shiniesTotal} SHINIES · ${progress.pages}/${progress.pagesTotal} PAGES`}
              label={`${where ? `CK is in ${where}. ` : ''}${progress.shinies}/${progress.shiniesTotal} shinies, ${progress.pages}/${progress.pagesTotal} pages`}
              size={10}
              color="#d9a441"
            />
          </p>
        ) : null}
        <div className="title-screen__push" />
        <p className="title-screen__sound">
          <span className="title-screen__collar" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <i key={i} style={{ height: 4 + i * 4, animationDelay: `${i * 0.18}s` }} />
            ))}
          </span>
          <PixelText
            text={"SOUND ON. THE COLLAR SINGS\nWHEN SOMETHING'S BURIED."}
            label="Sound on. The collar sings when something's buried."
            size={11}
            color="#9aa093"
          />
        </p>
        <button
          className="title-screen__go"
          onClick={() => {
            audio.unlock();
            onBegin();
          }}
        >
          <PixelText text={verb.toUpperCase()} label={verb} size={18} maxWidth={290} color="#2a1a10" shadow={false} />
        </button>
        {started ? (
          <ConfirmButton
            className="title-screen__reset"
            label="New game"
            armedLabel="Tap again to erase progress"
            onConfirm={() => {
              resetSave();
              resetPlaytime();
              audio.unlock();
              onBegin();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
