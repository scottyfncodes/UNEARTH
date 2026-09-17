import { enterLocation, game, go, markIntroSeen, notice } from '@/core/gameState';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { Btn } from '../components/ui';

export function TitleScreen() {
  const save = game.get().save;
  const returning = save.discoveries.length > 0;

  const begin = () => {
    // Audio has to be created inside the gesture that starts the game.
    audio.unlock();
    audio.setEnabled(save.settings.sound);
    haptics.setEnabled(save.settings.haptics);
    markIntroSeen();
    if (returning) {
      go('map');
    } else {
      enterLocation('loc_old_park');
      notice('Your collar is picking something up.');
    }
  };

  return (
    <div className="title-screen">
      <h1 className="title-screen__logo">UNEARTH</h1>
      <div className="title-screen__rule" />
      <p className="title-screen__tag">
        He went out one morning and didn't come back.
        <br />
        You are a cat. You are going to go find him.
      </p>
      <Btn variant="primary" onClick={begin} sound="open">
        {returning ? 'Continue' : 'Begin'}
      </Btn>
      {returning ? (
        <p className="tiny" style={{ marginTop: 18 }}>
          {save.discoveries.length} find{save.discoveries.length === 1 ? '' : 's'} in your journal
        </p>
      ) : (
        <p className="tiny" style={{ marginTop: 18 }}>
          Headphones recommended. The collar talks through sound.
        </p>
      )}
    </div>
  );
}
