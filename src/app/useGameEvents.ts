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
import { startHop } from '@/render/motion';
import { HOP_MS, lockFor } from './controls';

const JUST_DIRT = ['Just dirt.', 'Dirt. Very nice dirt. Still just dirt.', 'Nothing but earth and one surprised worm.', 'Just dirt. The collar was quiet here, to be fair.'];
const MISSES = [
  'THWIP-THWIP-THWIP! Darts hiss past behind CK. Too slow, temple.',
  'THWIP! A volley of darts — right where CK was half a second ago.',
  'Darts rattle off the far wall. CK does not look back. CK is too cool to look back.',
];

/** The boulder's rolling rumble, while it rolls. */
function rolling(): void {
  const beat = () => {
    const s = game.get();
    if (!s.timed?.rollers.length) return;
    audio.roll();
    fx.rumble();
    setTimeout(beat, 210);
  };
  setTimeout(beat, 1200);
}

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
          const map = MAPS[event.toMap]!;
          audio.music(map.region);
          if (event.fall) {
            audio.fall();
            fx.hurt();
            haptics.danger();
            show(event.fall, 4200);
          } else {
            audio.ui();
          }
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
          show(JUST_DIRT[Math.floor(Math.random() * JUST_DIRT.length)]!, 1500);
          break;
        case 'dig-junk':
          audio.dig();
          audio.clunk();
          fx.dig(ahead(), soil());
          fx.bubble('…', 1.4);
          show(event.line, Math.min(5200, 1800 + event.line.length * 30));
          break;
        case 'dig-old':
          audio.digHard();
          fx.bubble('?', 1.2);
          show('Somebody already dug here. A long, long time ago. Nothing left.', 2200);
          break;
        case 'dig-hard':
          audio.digHard();
          show('Too hard for paws here — CK needs soft ground.', 1800);
          break;
        case 'jump': {
          audio.hop();
          startHop(event.from, event.to, HOP_MS / 1000);
          lockFor(HOP_MS - 40);
          setTimeout(() => {
            audio.land();
            fx.dust(event.to);
          }, HOP_MS - 30);
          break;
        }
        case 'jump-blocked': {
          const p = game.get().player.pos;
          audio.hop();
          startHop(p, p, 0.2, 0.35);
          break;
        }
        case 'curio':
          audio.curio(event.bubble);
          fx.bubble(event.bubble, event.line ? 2.2 : 1.4);
          if (event.line) show(event.line, Math.min(5200, 1800 + event.line.length * 30));
          break;
        case 'sniff':
          audio.sniff();
          fx.bubble('…', 1);
          break;
        case 'kick':
          audio.push();
          if (event.to) fx.dust(event.to);
          if (!event.to) show('The pebble skitters away and drops into the dark. …plink.', 2200);
          break;
        case 'trap-armed': {
          audio.click();
          haptics.contact();
          fx.click(event.at);
          if (event.trapType === 'fallingRock') {
            audio.trickle();
            fx.bubble('!', 0.9);
          } else {
            fx.bubble('!', 0.7);
          }
          break;
        }
        case 'trap-fire':
          if (event.trapType === 'dart') {
            audio.dart();
            fx.volley(event.from, event.lane);
          } else if (event.trapType === 'fallingRock') {
            audio.rock();
            fx.rock(event.lane[0] ?? event.from);
          }
          break;
        case 'trap-miss':
          if (event.trapType === 'dart') {
            audio.whoosh();
            show(MISSES[Math.floor(Math.random() * MISSES.length)]!, 2200);
          } else {
            show('CRUNCH. A stone lands right where CK was standing. Nope. Not today.', 2400);
          }
          break;
        case 'crumble-start':
          audio.creak();
          break;
        case 'crumble':
          audio.crumble();
          fx.crumble(event.at);
          break;
        case 'fall':
          audio.fall();
          haptics.danger();
          setTimeout(() => {
            audio.hurt();
            fx.hurt();
          }, 250);
          show('The stone drops away — and CK with it! CK scrabbles back up, very dusty and quite annoyed.', 3200);
          break;
        case 'roller-start':
          audio.rumble();
          fx.rumble();
          haptics.danger();
          show('The floor shudders. Somewhere in the walls, something very large has just come loose…', 3000);
          rolling();
          break;
        case 'roller-hit':
          audio.splat();
          fx.hurt();
          haptics.danger();
          show('SPLAT. CK is flattened like a pancake — then pops back into shape, deeply offended.', 3000);
          break;
        case 'roller-stop':
          audio.crash();
          fx.crash(event.at);
          haptics.reveal();
          show('BOOM. The boulder goes straight through the cracked wall — and there\'s something behind it.', 3400);
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
            // A delayed volley is already drawn by trap-fire; an instant plate still needs its streak.
            fx.dart(event.from, event.at);
          } else if (event.trapType === 'spikes') {
            audio.spikes();
          }
          setTimeout(() => {
            audio.hurt();
            fx.hurt();
          }, 90);
          haptics.danger();
          show(
            event.trapType === 'dart'
              ? "Thwip! A dart clips CK's tail! CK stood still a moment too long."
              : event.trapType === 'spikes'
                ? 'SHNK! The floor bites. CK leaps back, fur on end.'
                : 'Bonk! A stone drops from the ceiling!',
          );
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
