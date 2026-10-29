import { useEffect, useState } from 'react';
import { audio } from '@/engine/audio';

/** The ♪ button's panel: sound on or off, and how loud the score and the effects are, each on its own. */
export function SoundPanel({ onClose }: { onClose: () => void }) {
  const [on, setOn] = useState(audio.isEnabled());
  const [vol, setVol] = useState(audio.getVolumes());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slide = (key: 'music' | 'sfx') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...vol, [key]: Number(e.target.value) / 100 };
    setVol(next);
    audio.setVolumes(next);
  };

  return (
    <>
      <button className="sound-panel__scrim" onClick={onClose} aria-label="Close sound settings" />
      <div className="sound-panel" role="dialog" aria-label="Sound">
        <button
          className={`sound-panel__toggle ${on ? 'sound-panel__toggle--on' : ''}`}
          role="switch"
          aria-checked={on}
          onClick={() => {
            audio.unlock();
            audio.setEnabled(!on);
            setOn(!on);
            if (!on) audio.ui();
          }}
        >
          <span>Sound</span>
          <span className="sound-panel__state">{on ? 'On' : 'Off'}</span>
        </button>
        <label className={`sound-panel__row ${on ? '' : 'sound-panel__row--off'}`}>
          <span>Music</span>
          <input type="range" min={0} max={100} step={5} value={Math.round(vol.music * 100)} onChange={slide('music')} disabled={!on} />
        </label>
        <label className={`sound-panel__row ${on ? '' : 'sound-panel__row--off'}`}>
          <span>Effects</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(vol.sfx * 100)}
            onChange={slide('sfx')}
            onPointerUp={() => audio.pickup()}
            onKeyUp={() => audio.pickup()}
            disabled={!on}
          />
        </label>
      </div>
    </>
  );
}
