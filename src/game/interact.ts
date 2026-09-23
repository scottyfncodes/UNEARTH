/**
 * The single context-sensitive action button: talk, unlock, pull, read, or
 * inspect, depending on what CK is facing. One button reads as "paws" —
 * exactly the vocabulary a cat has for the world.
 */
import type { DecorationEntity, DoorEntity, Entity, GameEvent, GameMap, GameState, MapRegistry, NpcEntity, SwitchEntity } from './types';
import { emptyMapState, step } from './types';
import { addClue, addItem, setFlag } from './inventory';
import { entitiesAt, isDoorOpen, mapStateOf } from './world';
import { enterMap } from './movement';

function pickLines(npc: NpcEntity, state: GameState): string[] {
  for (const conditional of npc.flagLines ?? []) {
    if (state.flags[conditional.flag]) return conditional.lines;
  }
  return npc.lines;
}

function startDialogue(state: GameState, npc: NpcEntity): { state: GameState; events: GameEvent[] } {
  const lines = pickLines(npc, state);
  return {
    state: { ...state, dialogue: { npcId: npc.id, lines, index: 0 } },
    events: [{ type: 'talk-start' }],
  };
}

export function advanceDialogue(maps: MapRegistry, state: GameState): { state: GameState; events: GameEvent[] } {
  const dialogue = state.dialogue;
  if (!dialogue) return { state, events: [] };

  if (dialogue.index + 1 < dialogue.lines.length) {
    return { state: { ...state, dialogue: { ...dialogue, index: dialogue.index + 1 } }, events: [] };
  }

  let next: GameState = { ...state, dialogue: null };
  const map = maps[state.mapId]!;
  const npc = map.entities.find((e): e is NpcEntity => e.kind === 'npc' && e.id === dialogue.npcId);
  if (npc?.onCompleteFlag) next = setFlag(next, npc.onCompleteFlag);
  return { state: next, events: [{ type: 'talk-end' }] };
}

function tryOpenDoor(state: GameState, map: GameMap, door: DoorEntity): { state: GameState; events: GameEvent[] } {
  const mapState = state.mapStates[map.id];
  if (isDoorOpen(door, state, map)) {
    return { state, events: [{ type: 'already-done' }] };
  }
  if (door.requiresArtifact && state.inventory.includes(door.requiresArtifact)) {
    const nextMapState = { ...(mapState ?? emptyMapState()), openedDoors: { ...(mapState?.openedDoors ?? {}), [door.id]: true as const } };
    return {
      state: { ...state, mapStates: { ...state.mapStates, [map.id]: nextMapState } },
      events: [{ type: 'door-open', doorId: door.id }],
    };
  }
  return { state, events: [{ type: 'door-locked', message: door.lockedMessage ?? "It won't budge. Something's missing." }] };
}

function pullSwitch(state: GameState, sw: SwitchEntity): { state: GameState; events: GameEvent[] } {
  if (state.flags[sw.setsFlag]) return { state, events: [{ type: 'already-done' }] };
  return { state: setFlag(state, sw.setsFlag), events: [{ type: 'switch-on', switchId: sw.id }] };
}

function inspectDecoration(state: GameState, map: GameMap, deco: DecorationEntity): { state: GameState; events: GameEvent[] } {
  const mapState = mapStateOf(state, map.id);
  const used = !!mapState.usedDecorations[deco.id];
  const oneShot = !!(deco.givesItem || deco.setsFlag || deco.warpTo);

  if (oneShot && used) {
    return { state, events: [{ type: 'flavor', line: deco.afterLine ?? deco.line ?? '...' }] };
  }

  let next = state;
  const events: GameEvent[] = [];
  if (oneShot) {
    next = {
      ...next,
      mapStates: { ...next.mapStates, [map.id]: { ...mapState, usedDecorations: { ...mapState.usedDecorations, [deco.id]: true } } },
    };
  }
  if (deco.line && oneShot) events.push({ type: 'flavor', line: deco.line });
  if (deco.givesItem) {
    next = addItem(next, deco.givesItem);
    events.push({ type: 'knock', itemId: deco.givesItem });
  }
  if (deco.setsFlag) next = setFlag(next, deco.setsFlag);
  if (deco.clueId) {
    next = addClue(next, deco.clueId);
    events.push({ type: 'clue', clueId: deco.clueId });
  }
  if (deco.warpTo) {
    next = enterMap(next, deco.warpTo.mapId, deco.warpTo.pos, deco.warpTo.facing ?? 'down');
    events.push({ type: 'warp', toMap: deco.warpTo.mapId });
  }
  if (events.length === 0) events.push({ type: 'flavor', line: deco.line ?? '...' });
  return { state: next, events };
}

export function attemptInteract(maps: MapRegistry, state: GameState): { state: GameState; events: GameEvent[] } {
  if (state.dialogue) return advanceDialogue(maps, state);

  const map = maps[state.mapId]!;
  const ahead = step(state.player.pos, state.player.facing);
  let candidates: Entity[] = entitiesAt(map, state, ahead);
  if (candidates.length === 0) candidates = entitiesAt(map, state, state.player.pos);

  const npc = candidates.find((e): e is NpcEntity => e.kind === 'npc');
  if (npc) return startDialogue(state, npc);

  const door = candidates.find((e): e is DoorEntity => e.kind === 'door');
  if (door) return tryOpenDoor(state, map, door);

  const sw = candidates.find((e): e is SwitchEntity => e.kind === 'switch');
  if (sw) return pullSwitch(state, sw);

  const clue = candidates.find((e): e is Extract<Entity, { kind: 'clueNote' }> => e.kind === 'clueNote');
  if (clue) return { state: addClue(state, clue.clueId), events: [{ type: 'clue', clueId: clue.clueId }] };

  const deco = candidates.find((e): e is DecorationEntity => e.kind === 'decoration');
  if (deco) return inspectDecoration(state, map, deco);

  return { state, events: [] };
}
