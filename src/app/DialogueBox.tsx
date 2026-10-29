import { useEffect, useRef, useState } from 'react';
import { useGameState } from './useGameState';
import { MAPS } from '@/content/maps';
import { audio } from '@/engine/audio';
import { pauseAfter, speaks, voiceFor } from '@/engine/voices';
import { Portrait } from './Sprite';
import { continueDialogue, onFinishLine } from './typewriter';

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DialogueBox() {
  const state = useGameState();
  const dialogue = state.dialogue;
  const line = dialogue ? (dialogue.lines[dialogue.index] ?? '') : '';
  const isLast = dialogue ? dialogue.index >= dialogue.lines.length - 1 : true;
  const npc = dialogue ? MAPS[state.mapId]!.entities.find((e) => e.kind === 'npc' && e.id === dialogue.npcId) : undefined;
  const speaker = npc?.kind === 'npc' ? npc : null;
  const lineKey = dialogue ? `${dialogue.npcId}-${dialogue.index}` : '';

  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    if (!dialogue) return;
    const voice = voiceFor(speaker?.sprite);
    const question = line.trim().endsWith('?');
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = (n: number) => {
      shownRef.current = n;
      setShown(n);
    };
    if (reducedMotion()) {
      show(line.length);
      audio.murmur(voice, line);
    } else {
      show(0);
      let letters = 0;
      const next = () => {
        const i = shownRef.current;
        if (i >= line.length) return;
        const ch = line[i]!;
        if (speaks(ch, letters)) audio.syllable(voice, ch, i / line.length, question);
        if (/[a-z0-9]/i.test(ch)) letters++;
        show(i + 1);
        timer = setTimeout(next, 1000 / voice.cps + pauseAfter(ch));
      };
      timer = setTimeout(next, 90);
    }
    onFinishLine(() => {
      if (shownRef.current >= line.length) return false;
      if (timer) clearTimeout(timer);
      show(line.length);
      return true;
    });
    return () => {
      if (timer) clearTimeout(timer);
      onFinishLine(null);
    };
    // A new line (or a new speaker) restarts the typing; nothing else should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey]);

  if (!dialogue) return null;
  const typing = shown < line.length;

  return (
    <button className="dialogue" onClick={continueDialogue} aria-label="Continue" data-testid="dialogue">
      {speaker ? (
        <div className="dialogue__portrait">
          <Portrait sprite={speaker.sprite} size={56} talking={typing} />
        </div>
      ) : null}
      <div className="dialogue__body">
        {speaker ? <div className="dialogue__name">{speaker.name}</div> : null}
        <p className="dialogue__line" key={lineKey}>
          {/* The whole line is laid out from the start, so the box never jumps as it types. */}
          <span>{line.slice(0, shown)}</span>
          <span className="dialogue__unsaid">{line.slice(shown)}</span>
        </p>
        <span className={`dialogue__hint ${typing ? 'dialogue__hint--typing' : ''}`}>{isLast ? 'tap to close ✕' : 'tap to continue ▸'}</span>
      </div>
    </button>
  );
}
