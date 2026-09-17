/**
 * CK's Home — where the whole thing starts, and where it ends.
 *
 * Visited early, this is chapter one: the archaeologist is gone, his bowl is
 * untouched, and a torn page from his own notebook is the first real clue.
 * Nothing here needs digging — some things are never buried, they are just
 * sitting there once you actually stop and look.
 *
 * Visited again after both authored adventures are complete, the same yard
 * delivers the ending: he was at the shop. The whole odyssey, reframed in one
 * line, played completely straight — see `dad_returned` below.
 */
import type { SiteDef } from './types';

export const HOME: SiteDef = {
  id: 'site_home',
  name: "CK's Home",
  subtitle: 'Fieldstone cottage, edge of town',
  radius: 11,
  skyTop: '#8fb0c9',
  skyBottom: '#e7d9b6',
  fogColor: '#cdd7c0',
  fogNear: 10,
  fogFar: 30,
  groundColor: '#3f5c34',
  groundDetail: '#5c7d46',
  ambience: 'park',
  spawn: { x: 0, y: 0, z: 8.5 },
  spawnYaw: 0,

  intro: [
    'HOME',
    "He didn't come back last night. He always comes back.",
    'The gate is open. His boots are gone. So, evidently, are you — whether you meant to follow or not.',
  ],

  props: [
    // The cottage wall, with a gap for the door on the north side.
    { id: 'house_wall_n_a', kind: 'wall', position: { x: -4.2, y: 0, z: -8 }, scale: [1.5, 1.1, 1] },
    { id: 'house_wall_n_b', kind: 'wall', position: { x: 4.2, y: 0, z: -8 }, scale: [1.5, 1.1, 1] },
    { id: 'house_wall_w', kind: 'wall', position: { x: -8, y: 0, z: -3 }, rotationY: Math.PI / 2, scale: [1.6, 1.1, 1] },
    { id: 'house_wall_e', kind: 'wall', position: { x: 8, y: 0, z: -3 }, rotationY: Math.PI / 2, scale: [1.6, 1.1, 1] },
    { id: 'door_arch', kind: 'archway', position: { x: 0, y: 0, z: -8 }, scale: [0.9, 1, 1] },
    { id: 'porch_step_1', kind: 'stairStep', position: { x: 0, y: 0, z: -6.6 }, solid: false },
    { id: 'porch_step_2', kind: 'stairStep', position: { x: 0, y: 0, z: -7.3 }, solid: false },

    // The garden gate CK spawns beside — the way in and out of the yard.
    { id: 'garden_gate', kind: 'archway', position: { x: 0, y: 0, z: 9.5 }, scale: [0.7, 0.9, 1] },

    // Expedition gear, dumped by the door rather than put away properly.
    { id: 'crate_gear_a', kind: 'crate', position: { x: 3.4, y: 0, z: -6.4 } },
    { id: 'crate_gear_b', kind: 'crate', position: { x: 4.1, y: 0, z: -5.6 }, rotationY: 0.4 },

    // A modest rockery — and somewhere for a stray cat to sit and watch a gate.
    { id: 'rock_a', kind: 'rock', position: { x: -5.5, y: 0, z: 3 } },
    { id: 'rock_b', kind: 'rock', position: { x: -6.2, y: 0, z: 4.4 }, scale: [0.7, 0.7, 0.7] },
    { id: 'rubble_a', kind: 'rubble', position: { x: 5.5, y: 0, z: 2 }, scale: [0.6, 0.6, 0.6] },
  ],

  interactables: [
    {
      id: 'bowl_notice',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 2.1, y: 0, z: -6.1 },
      range: 2,
      visual: 'potteryShard',
      flavor:
        'His food bowl. Empty, and licked clean around the rim from yesterday morning — nothing since. He always tops it up before he leaves. Always.',
      setsFlagOnUse: 'home_seen_bowl',
      hideOnFlag: 'home_seen_bowl',
    },
    {
      id: 'note_observe',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: 3.7, y: 0, z: -5.9 },
      range: 2.2,
      visual: 'carving',
      targetId: 'tgt_home_note',
    },
    {
      id: 'dad_returned',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 0.6, y: 0, z: 8.3 },
      range: 2.6,
      visual: 'footprints',
      requiresAdventuresComplete: ['adv_sealed_chamber', 'adv_courtyard'],
      flavor:
        '"CK? I\'ve only been gone twenty minutes." He sets the grocery bags down on the step. He went to the shop. That is the entire explanation. That is the whole thing.',
      setsFlagOnUse: 'home_dad_returned',
      hideOnFlag: 'home_dad_returned',
    },
    {
      id: 'mystery_artifact_pickup',
      kind: 'pickup',
      prompt: 'Take the strange object',
      position: { x: -0.6, y: 0, z: 8.1 },
      range: 2,
      visual: 'potteryShard',
      requiresFlag: 'home_dad_returned',
      targetId: 'tgt_home_mystery_artifact',
    },
  ],

  hazards: [],
  detectorDigs: [],
};
