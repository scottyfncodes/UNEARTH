/**
 * Affordances: what each button would do *right now*, without doing it.
 *
 * The game has three verbs and no tutorial. These pure queries let the UI
 * teach the verbs by showing them — the Paw button says "Talk" when CK is
 * facing someone and "Read" in front of a carving, Hop dims when there is
 * nothing to hop, Dig warms up when the collar is locked on soft ground —
 * and let the renderer float a small marker over whatever CK would touch.
 *
 * Every rule here mirrors the real action (attemptInteract, attemptJump,
 * checkDig) and the tests hold the two together, so the UI can never
 * promise something the engine then refuses.
 */
import type { Entity, GameState, MapRegistry, Vec2 } from './types';
import { step } from './types';
import { dressingAt, entitiesAt, isDoorOpen, mapStateOf } from './world';
import { checkDig } from './dig';
import { jumpLanding } from './movement';
import { computeCollarReading } from './collar';

export type PawVerb = 'Talk' | 'Open' | 'Pull' | 'Read' | 'Look' | 'Bat' | 'Knock' | 'Sniff';

export interface PawAffordance {
  verb: PawVerb;
  /** The tile being acted on — ahead of CK, or under CK's paws. */
  at: Vec2;
  /**
   * Something here CK hasn't had from it yet: an unheard conversation, an
   * unread note, an untouched shelf. Worth a brighter marker.
   */
  fresh: boolean;
}

function decorationVerb(deco: Extract<Entity, { kind: 'decoration' }>): PawVerb {
  if (deco.kick) return 'Bat';
  if (deco.givesItem || deco.warpTo) return 'Knock';
  if (deco.clueId) return 'Read';
  return 'Look';
}

/** What Paw would do, mirroring attemptInteract's priority exactly; null if it would do nothing. */
export function pawAffordance(maps: MapRegistry, state: GameState): PawAffordance | null {
  if (state.dialogue) return null;
  const map = maps[state.mapId]!;
  const ahead = step(state.player.pos, state.player.facing);
  let candidates = entitiesAt(map, state, ahead);
  let at = ahead;
  if (candidates.length === 0) {
    candidates = entitiesAt(map, state, state.player.pos);
    at = state.player.pos;
  }
  const mapState = mapStateOf(state, map.id);

  const npc = candidates.find((e) => e.kind === 'npc');
  if (npc && npc.kind === 'npc') {
    const heard = !!npc.onCompleteFlag && !!state.flags[npc.onCompleteFlag];
    return { verb: 'Talk', at, fresh: !heard };
  }
  const door = candidates.find((e) => e.kind === 'door');
  if (door && door.kind === 'door') {
    const open = isDoorOpen(door, state, map);
    return { verb: 'Open', at, fresh: !open && !!door.requiresArtifact && state.inventory.includes(door.requiresArtifact) };
  }
  const sw = candidates.find((e) => e.kind === 'switch');
  if (sw && sw.kind === 'switch') return { verb: 'Pull', at, fresh: !state.flags[sw.setsFlag] };
  const note = candidates.find((e) => e.kind === 'clueNote');
  if (note && note.kind === 'clueNote') return { verb: 'Read', at, fresh: !state.clues.includes(note.clueId) };
  const deco = candidates.find((e) => e.kind === 'decoration');
  if (deco && deco.kind === 'decoration') {
    const oneShot = !!(deco.givesItem || deco.setsFlag || deco.warpTo);
    const used = !!mapState.usedDecorations[deco.id];
    const fresh = deco.kick ? true : oneShot ? !used : !!deco.clueId && !state.clues.includes(deco.clueId);
    return { verb: decorationVerb(deco), at, fresh };
  }
  if (dressingAt(map, ahead)) return { verb: 'Sniff', at: ahead, fresh: false };
  if (dressingAt(map, state.player.pos)) return { verb: 'Sniff', at: state.player.pos, fresh: false };
  return null;
}

/** Whether Hop would actually go somewhere from here. */
export function canHop(maps: MapRegistry, state: GameState): boolean {
  if (state.dialogue) return false;
  return jumpLanding(maps, state) !== null;
}

export type DigAffordance = 'none' | 'soft' | 'hot';

/**
 * 'hot' — soft ground, and the collar is locked on the very tile ahead.
 * 'soft' — paws would go in; whether anything is there is the player's call.
 * 'none' — stone, already dug, or nothing to dig into.
 */
export function digAffordance(maps: MapRegistry, state: GameState): DigAffordance {
  if (state.dialogue) return 'none';
  const check = checkDig(maps, state);
  if (check === 'hard') return 'none';
  if (check === 'dug') return 'none';
  if (check === 'old') return 'soft';
  const reading = computeCollarReading(maps[state.mapId]!, state);
  return reading.locked && reading.kind === 'buried' ? 'hot' : 'soft';
}
