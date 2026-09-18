/**
 * Turns semantic game events into the things a player actually notices: a
 * sound, a buzz, a toast. Keeps the pure engine free of any of that.
 */
import { useEffect, useRef, useState } from 'react';
import { onGameEvent } from '@/core/game';
import type { GameEvent } from '@/game/types';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { getItem } from '@/content/items';
import { getClue } from '@/content/clues';

export function useGameEvents(): string | null {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = (text: string, ms = 2600) => {
      setToast(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), ms);
    };

    const handle = (event: GameEvent) => {
      switch (event.type) {
        case 'bump':
          audio.bump();
          break;
        case 'push':
          audio.push();
          haptics.tap();
          break;
        case 'transition':
          audio.ui();
          break;
        case 'dig-empty':
          audio.dig();
          show('Just dirt.', 1400);
          break;
        case 'reveal':
        case 'pickup': {
          const item = getItem(event.itemId);
          audio.pickup();
          haptics.reveal();
          show(`Found: ${item?.name ?? 'something'}`);
          break;
        }
        case 'assemble': {
          const item = getItem(event.artifactId);
          audio.assemble();
          haptics.reveal();
          show(`Assembled: ${item?.name ?? 'an artifact'}!`, 3200);
          break;
        }
        case 'clue': {
          const clue = getClue(event.clueId);
          audio.clue();
          haptics.tap();
          show(`Journal updated: ${clue?.title ?? 'a clue'}`);
          break;
        }
        case 'switch-on':
          audio.doorOpen();
          haptics.tap();
          show('Something clicks into place.');
          break;
        case 'already-done':
          audio.ui();
          break;
        case 'door-locked':
          audio.doorLocked();
          show(event.message);
          break;
        case 'exit-locked':
          audio.doorLocked();
          show(event.message);
          break;
        case 'door-open':
          audio.doorOpen();
          haptics.contact();
          show('The door swings open.');
          break;
        case 'trap-hit':
          audio.trapHit();
          haptics.danger();
          show("A dart clips CK's tail!");
          break;
        case 'knockout':
          show('CK scampers back to safety.');
          break;
        case 'talk-start':
          audio.talk();
          break;
        case 'flavor':
          audio.ui();
          show(event.line, 3200);
          break;
        default:
          break;
      }
    };

    return onGameEvent(handle);
  }, []);

  return toast;
}
