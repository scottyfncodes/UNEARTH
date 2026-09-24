import { useEffect, useState } from 'react';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { game, resetSave } from '@/core/game';
import { showChapter } from '@/core/ui';
import { resetPlaytime, startPlaytime } from '@/core/playtime';
import { MAPS } from '@/content/maps';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { DialogueBox } from './DialogueBox';
import { Toast } from './Toast';
import { Journal } from './Journal';
import { TitleScreen } from './TitleScreen';
import { Ending } from './Ending';
import { CardOverlay, ChapterCard, Interlude } from './Overlays';
import { useGameEvents } from './useGameEvents';
import { useGameState } from './useGameState';

const ENDING_SEEN = 'unearth.endingSeen.v2';

function endingSeen(): boolean {
  try {
    return localStorage.getItem(ENDING_SEEN) === '1';
  } catch {
    return false;
  }
}

export function App() {
  const [started, setStarted] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(endingSeen());
  const toast = useGameEvents();
  const state = useGameState();

  useEffect(() => {
    haptics.setEnabled(true);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) audio.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const begin = () => {
    setStarted(true);
    startPlaytime();
    const s = game.get();
    const map = MAPS[s.mapId]!;
    audio.music(map.region);
    // A brand-new game opens on the prologue's title card.
    if (!s.flags.dadLeft && map.chapter) setTimeout(() => showChapter(map.chapter!), 250);
  };

  if (!started) return <TitleScreen onBegin={begin} />;

  const showEnding = !!state.flags.gameComplete && !state.dialogue && !endingDismissed;

  return (
    <div className="game-root">
      <div className="game-viewport">
        <GameCanvas />
      </div>
      <Hud
        onOpenJournal={() => setJournalOpen(true)}
        onHome={() => {
          // Progress is already saved after every action; just step out.
          audio.ui();
          audio.music(null);
          setJournalOpen(false);
          setStarted(false);
        }}
      />
      {!state.dialogue && <Toast text={toast} />}
      <DialogueBox />
      <TouchControls />
      <ChapterCard />
      <CardOverlay />
      <Interlude />
      {journalOpen && <Journal onClose={() => setJournalOpen(false)} />}
      {showEnding ? (
        <Ending
          onKeepExploring={() => {
            try {
              localStorage.setItem(ENDING_SEEN, '1');
            } catch {
              // ignore
            }
            setEndingDismissed(true);
          }}
          onNewGame={() => {
            try {
              localStorage.removeItem(ENDING_SEEN);
            } catch {
              // ignore
            }
            resetSave();
            resetPlaytime();
            setEndingDismissed(false);
            begin();
          }}
        />
      ) : null}
    </div>
  );
}
