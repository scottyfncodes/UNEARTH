/**
 * Shared shape for every authored adventure — a small, contained mystery
 * hosted at one location. A second adventure is another file of this shape
 * registered in index.ts, not new gameplay code.
 */
import type { AmbienceKind } from '@/engine/audio';

export interface AdventureBeat {
  id: string;
  /** Short scene heading. */
  heading: string;
  /** Body text, one paragraph per entry. */
  lines: string[];
  /** Choices move to another beat; one may be marked as the way on. */
  choices: { label: string; to: string; note?: string }[];
}

export interface DialPuzzle {
  /** Number of positions each dial can take. */
  positions: number;
  /** Correct position per dial. */
  solution: number[];
  /** Starting position per dial. */
  start: number[];
  prompt: string;
  solvedText: string;
  /** Screen heading while the puzzle is active. */
  screenTitle: string;
  screenSubtitle: string;
  /** Hint shown under the dials while unsolved. */
  unsolvedHint: string;
  /** Label for the button that appears once solved. */
  continueLabel: string;
  /** What each dial position represents, for the progress readout (e.g. "Rays", "Marks"). */
  unitLabel: string;
}

export interface MechanismConfig {
  /** Clamp angles in degrees around the disc. */
  clamps: { id: string; angle: number; order: number }[];
  /** Seconds of steady pressure needed to release a clamp. */
  holdSeconds: number;
  /** Tension added by releasing out of order. */
  wrongOrderTension: number;
  /** Tension added by touching the pressure rim. */
  rimTension: number;
  /** Condition lost per mistake. */
  wrongOrderDamage: number;
  /** Tension added per second once the first clamp is off. */
  creepPerSecond: number;
}

export interface EscapeBeat {
  prompt: string;
  /** Seconds the player has to react. */
  window: number;
  /** Flavour shown after a success. */
  success: string;
  /** Flavour shown after a miss. */
  failure: string;
}

export interface AdventureDef {
  id: string;
  locationId: string;
  title: string;
  artifactTargetId: string;
  intro: string[];
  introSubtitle: string;
  beats: AdventureBeat[];
  startBeat: string;
  ambience: AmbienceKind;
  /** A short environmental puzzle. Every adventure has exactly one. */
  puzzle: DialPuzzle;
  /**
   * A precision extraction under rising tension. Optional — a puzzle-only
   * adventure (no physical artifact fighting back) skips straight from the
   * puzzle to the outro once solved.
   */
  mechanism?: MechanismConfig;
  /** A reactive escape sequence. Only meaningful when `mechanism` is set. */
  escape?: EscapeBeat[];
  outro: string[];
  /**
   * Condition given to the artifact when there is no mechanism/escape to
   * derive one from — a clean, unhurried recovery.
   */
  cleanCondition: number;
}
