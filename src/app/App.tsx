import { useEffect, useState } from 'react';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { DialogueBox } from './DialogueBox';
import { Toast } from './Toast';
import { Journal } from './Journal';
import { TitleScreen } from './TitleScreen';
import { useGameEvents } from './useGameEvents';
import { useGameState } from './useGameState';

export function App() {
  const [started, setStarted] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
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

  if (!started) return <TitleScreen onBegin={() => setStarted(true)} />;

  return (
    <div className="game-root">
      <div className="game-viewport">
        <GameCanvas />
      </div>
      <Hud onOpenJournal={() => setJournalOpen(true)} />
      {!state.dialogue && <Toast text={toast} />}
      <DialogueBox />
      <TouchControls />
      {journalOpen && <Journal onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
