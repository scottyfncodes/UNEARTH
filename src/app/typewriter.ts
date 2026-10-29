/**
 * The dialogue box types its line out in the speaker's voice. Paw, Space or a
 * tap on the box first finishes a line that's still typing, and only then
 * moves the conversation on, so nobody skips a line they haven't read.
 */
import { dispatch } from '@/core/game';

let finish: (() => boolean) | null = null;

/** The open dialogue box registers how to finish its line; returns false once it's fully shown. */
export function onFinishLine(f: (() => boolean) | null): void {
  finish = f;
}

export function continueDialogue(): void {
  if (finish?.()) return;
  dispatch({ type: 'interact' });
}
