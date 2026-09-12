import { useEffect } from 'react';
import { game, persistNow } from '@/core/gameState';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { useGameState } from './useGame';
import { TitleScreen } from './screens/TitleScreen';
import { MapScreen } from './screens/MapScreen';
import { DetectScreen } from './screens/DetectScreen';
import { ExcavateScreen } from './screens/ExcavateScreen';
import { DiscoveryScreen } from './screens/DiscoveryScreen';
import { JournalScreen } from './screens/JournalScreen';
import { EquipmentScreen } from './screens/EquipmentScreen';
import { AdventureScreen } from './screens/AdventureScreen';

export function App() {
  const { route, save, activeAdventure } = useGameState();

  // Settings drive the engines, not the other way around.
  useEffect(() => {
    audio.setEnabled(save.settings.sound);
    haptics.setEnabled(save.settings.haptics);
  }, [save.settings.sound, save.settings.haptics]);

  // Any first touch anywhere is a legitimate moment to start audio on iOS.
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      audio.setEnabled(game.get().save.settings.sound);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Never lose progress to a backgrounded tab.
  useEffect(() => {
    const flush = () => persistNow();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  switch (route) {
    case 'title':
      return <TitleScreen />;
    case 'map':
      return <MapScreen />;
    case 'detect':
      return <DetectScreen />;
    case 'excavate':
      return <ExcavateScreen />;
    case 'discovery':
      return <DiscoveryScreen />;
    case 'journal':
      return <JournalScreen />;
    case 'equipment':
      return <EquipmentScreen />;
    case 'adventure':
      // A fresh key per adventure forces a clean remount if the active
      // adventure ever changes without leaving the route in between.
      return <AdventureScreen key={activeAdventure ?? 'none'} />;
    default:
      return <MapScreen />;
  }
}
