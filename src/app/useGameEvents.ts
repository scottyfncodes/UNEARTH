/**
 * Turns semantic game events into everything a player actually notices: a
 * sound, a buzz, particles, the held-up find, a card, a toast, a chapter
 * title. Keeps the pure engine free of all of it.
 */
import { useEffect, useRef, useState } from 'react';
import { game, onGameEvent } from '@/core/game';
import { pushCard, showChapter, showInterlude } from '@/core/ui';
import type { GameEvent } from '@/game/types';
import { step } from '@/game/types';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { getItem, SHINY_IDS } from '@/content/items';
import { MAPS } from '@/content/maps';
import { fx } from '@/render/fx';
import { PALETTES } from '@/render/palette';

function findHeadline(itemId: string): { headline: string; detail?: string } {
  const item = getItem(itemId);
  const inv = game.get().inventory;
  switch (item?.kind) {
    case 'shiny': {
      const n = SHINY_IDS.filter((id) => inv.includes(id)).length;
      return { headline: 'Ooh, shiny!', detail: `${n} of ${SHINY_IDS.length} shinies` };
    }
    case 'fragment':
      return { headline: 'A fragment!', detail: 'Part of something bigger.' };
    case 'relic':
      return { headline: 'A relic!' };
    case 'artifact':
      return { headline: 'It fits together!' };
    default:
      return { headline: 'Found something!' };
  }
}

export function useGameEvents(): string | null {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = (text: string, ms = 2800) => {
      setToast(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), ms);
    };

    const ahead = () => {
      const s = game.get();
      return step(s.player.pos, s.player.facing);
    };
    const soil = () => PALETTES[MAPS[game.get().mapId]!.region].diggable;

    const found = (itemId: string, big = false) => {
      const item = getItem(itemId);
      fx.hold(item?.sprite ?? 'coin', 1.3);
      fx.sparkle(game.get().player.pos, big);
      if (item?.kind === 'shiny') audio.shiny();
      else audio.fanfare(big || item?.kind === 'relic');
      haptics.reveal();
      pushCard({ kind: 'find', itemId, ...findHeadline(itemId) });
    };

    const handle = (event: GameEvent) => {
      switch (event.type) {
        case 'bump':
          audio.bump();
          break;
        case 'push':
          audio.push();
          fx.dust(ahead());
          haptics.tap();
          break;
        case 'transition': {
          fx.fade();
          audio.ui();
          const map = MAPS[event.toMap]!;
          audio.music(map.region);
          if (event.firstVisit && map.chapter) showChapter(map.chapter);
          break;
        }
        case 'warp': {
          fx.fade();
          audio.music(MAPS[event.toMap]!.region);
          void showInterlude('Some time later…', 3400);
          break;
        }
        case 'dig-empty':
          audio.dig();
          fx.dig(ahead(), soil());
          show('Just dirt.', 1400);
          break;
        case 'dig-hard':
          audio.digHard();
          show('Too hard to dig here. Try the soft dirt.', 1800);
          break;
        case 'reveal':
          audio.dig();
          fx.dig(ahead(), soil());
          found(event.itemId);
          break;
        case 'pickup':
          found(event.itemId);
          break;
        case 'knock':
          if (event.itemId) found(event.itemId);
          break;
        case 'heal':
          audio.heal();
          fx.hearts(game.get().player.pos);
          haptics.tap();
          show('Crunch! A fish treat. ♥', 1800);
          break;
        case 'assemble':
          fx.goldFlash();
          fx.sparkle(game.get().player.pos, true);
          setTimeout(() => audio.fanfare(true), 300);
          haptics.reveal();
          pushCard({ kind: 'find', itemId: event.artifactId, ...findHeadline(event.artifactId) });
          break;
        case 'clue':
          audio.clue();
          haptics.tap();
          pushCard({ kind: 'note', clueId: event.clueId });
          break;
        case 'secret':
          audio.secret();
          fx.secret(game.get().player.pos);
          haptics.reveal();
          show('✦ A secret nook! ✦', 2200);
          break;
        case 'switch-on':
          audio.doorOpen();
          haptics.tap();
          show('Something heavy clicks into place, somewhere nearby…');
          break;
        case 'already-done':
          audio.ui();
          break;
        case 'door-locked':
        case 'exit-locked':
          audio.doorLocked();
          show(event.message, 3600);
          break;
        case 'door-open':
          audio.doorOpen();
          fx.dust(ahead());
          haptics.contact();
          show('The door grinds open.');
          break;
        case 'trap-hit':
          if (event.trapType === 'dart') {
            audio.dart();
            fx.dart(event.from, event.at);
          } else {
            audio.rock();
            fx.rock(event.at);
          }
          setTimeout(() => {
            audio.hurt();
            fx.hurt();
          }, 90);
          haptics.danger();
          show(event.trapType === 'dart' ? "Thwip! A dart clips CK's tail!" : 'Bonk! A stone drops from the ceiling!');
          break;
        case 'knockout':
          show('CK scampers back to safety, a little dizzy.');
          break;
        case 'talk-start':
          audio.talk();
          break;
        case 'flavor':
          audio.ui();
          show(event.line, Math.min(6000, 1800 + event.line.length * 35));
          break;
        default:
          break;
      }
    };

    return onGameEvent(handle);
  }, []);

  return toast;
}
