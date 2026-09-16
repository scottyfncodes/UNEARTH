/**
 * The Silent Court — the first first-person site.
 *
 * A small, walled ruin. Two matching carvings on opposite walls are the
 * game's first "wait, I've seen this" moment that happens entirely on foot:
 * no digging required, just looking. A buried stone hand (found the ordinary
 * way, with the detector) fits an empty socket on the court's broken statue,
 * which opens onto the payoff — a relic that was sitting twelve metres away
 * the whole time. One hazard, unmarked, discovered by getting too close to it
 * rather than by any UI telling you it is there.
 *
 * The south-east corner adds a small, contained side-vault: a collapsed gap
 * in an old partition wall, easily missed and nowhere near wide enough for
 * the archaeologist who built this place — but CK fits. Inside: a dart trap
 * readable before it fires, a buried tin that finally resolves the "someone
 * else was here" thread the main court only gestures at (the footprints, the
 * dropped crate), and a plate that wants weight CK doesn't have, solved the
 * same way as anywhere else in this game — find something to push onto it.
 */
import type { SiteDef } from './types';

export const SILENT_COURT: SiteDef = {
  id: 'site_silent_court',
  name: 'The Silent Court',
  subtitle: 'Roofless colonnade, no record of use',
  radius: 17,
  skyTop: '#6b7a52',
  skyBottom: '#c9b98a',
  fogColor: '#8a8a6a',
  fogNear: 9,
  fogFar: 32,
  groundColor: '#3a3f2c',
  groundDetail: '#565c3e',
  ambience: 'ruins',
  spawn: { x: 0, y: 0, z: 15.5 },
  spawnYaw: 0,

  intro: [
    'THE SILENT COURT',
    'Four low walls, roofless, holding a square of ground nobody has touched in a long time.',
    'Walk. Look. Some of what matters here only matters once you stop and actually look at it.',
  ],

  props: [
    // Perimeter walls, with a gap on the south side for the entrance.
    { id: 'wall_north', kind: 'wall', position: { x: 0, y: 0, z: -15 }, scale: [3.3, 1, 1] },
    { id: 'wall_west', kind: 'wall', position: { x: -15, y: 0, z: 0 }, rotationY: Math.PI / 2, scale: [3.3, 1, 1] },
    { id: 'wall_east', kind: 'wall', position: { x: 15, y: 0, z: 0 }, rotationY: Math.PI / 2, scale: [3.3, 1, 1] },
    { id: 'wall_south_a', kind: 'wall', position: { x: -8, y: 0, z: 15 }, scale: [1.3, 1, 1] },
    { id: 'wall_south_b', kind: 'wall', position: { x: 8, y: 0, z: 15 }, scale: [1.3, 1, 1] },
    { id: 'entrance_arch', kind: 'archway', position: { x: 0, y: 0, z: 15 } },

    // Corner columns, broken.
    { id: 'col_break_nw', kind: 'columnBroken', position: { x: -10, y: 0, z: -10 } },
    { id: 'col_break_ne', kind: 'columnBroken', position: { x: 10, y: 0, z: -10 } },
    { id: 'col_break_sw', kind: 'columnBroken', position: { x: -10, y: 0, z: 10 } },
    { id: 'col_break_se', kind: 'columnBroken', position: { x: 10, y: 0, z: 10 } },

    // Two columns still standing, flanking the approach to the dais.
    { id: 'col_a', kind: 'column', position: { x: -3, y: 0, z: -6 } },
    { id: 'col_b', kind: 'column', position: { x: 3, y: 0, z: -6 } },

    // Scatter and obstacles.
    { id: 'rubble_a', kind: 'rubble', position: { x: 6, y: 0, z: 4 } },
    { id: 'rubble_b', kind: 'rubble', position: { x: -6, y: 0, z: -3 } },
    { id: 'rubble_c', kind: 'rubble', position: { x: 2, y: 0, z: 9 } },
    { id: 'rock_a', kind: 'rock', position: { x: -12, y: 0, z: 6 } },
    { id: 'rock_b', kind: 'rock', position: { x: 11, y: 0, z: -3 } },

    // A modern supply crate, dropped and left — the "someone else was here" seed.
    { id: 'crate_a', kind: 'crate', position: { x: 4, y: 0, z: 12.5 } },

    // Steps up to the dais. Decorative only — not solid.
    { id: 'step_1', kind: 'stairStep', position: { x: 0, y: 0, z: -1.5 }, solid: false },
    { id: 'step_2', kind: 'stairStep', position: { x: 0, y: 0, z: -2.6 }, solid: false },
    { id: 'step_3', kind: 'stairStep', position: { x: 0, y: 0, z: -3.7 }, solid: false },

    // The statue itself — broken at the wrist, missing whatever it once held.
    { id: 'statue', kind: 'statueBody', position: { x: 0, y: 0, z: -9 } },

    // The inner vault, south-east corner: a small partition with one gap.
    { id: 'vault_rubble', kind: 'rubble', position: { x: 9.3, y: 0, z: 1.9 }, scale: [0.6, 0.6, 0.6] },
    { id: 'vault_entrance', kind: 'archway', position: { x: 10.3, y: 0, z: 6 }, rotationY: Math.PI / 2 },
    { id: 'vault_side_a', kind: 'wall', position: { x: 11.65, y: 0, z: 3 }, scale: [0.45, 1, 1] },
    { id: 'vault_side_b', kind: 'wall', position: { x: 11.65, y: 0, z: 8.5 }, scale: [0.45, 1, 1] },
    { id: 'vault_back', kind: 'wall', position: { x: 13, y: 0, z: 5.75 }, rotationY: Math.PI / 2, scale: [0.917, 1, 1] },
  ],

  interactables: [
    {
      id: 'notice_footprints',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 3, y: 0, z: 12 },
      range: 2.4,
      visual: 'footprints',
      flavor:
        'Boot prints in the dust, and they are not yours. Someone else has been walking this ground — recently.',
      setsFlagOnUse: 'court_seen_footprints',
      hideOnFlag: 'court_seen_footprints',
    },
    {
      id: 'carving_west',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: -13.6, y: 0, z: -2 },
      range: 2.6,
      visual: 'carving',
      rotationY: Math.PI / 2,
      targetId: 'tgt_court_carving_west',
    },
    {
      id: 'carving_east',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: 13.6, y: 0, z: 2 },
      range: 2.6,
      visual: 'carving',
      rotationY: -Math.PI / 2,
      targetId: 'tgt_court_carving_east',
    },
    {
      id: 'shard_pickup',
      kind: 'pickup',
      prompt: 'Take it',
      position: { x: -6, y: 0, z: 6 },
      range: 2,
      visual: 'potteryShard',
      targetId: 'tgt_court_shard',
    },
    {
      id: 'notice_statue',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 0, y: 0, z: -7.6 },
      range: 2.6,
      visual: 'statueBody',
      flavor:
        "The figure's right arm reaches out, ending at a broken wrist. Whatever fit into that hand is gone — but broken things get buried, not destroyed.",
      setsFlagOnUse: 'court_seen_statue',
      hideOnFlag: 'court_seen_statue',
    },
    {
      id: 'hand_socket',
      kind: 'fit',
      prompt: 'Fit the hand',
      position: { x: 0, y: 0, z: -8.6 },
      range: 2.4,
      visual: 'statueBody',
      requiresTargetId: 'tgt_court_hand',
      setsFlagOnUse: 'court_hand_fitted',
      hideOnFlag: 'court_hand_fitted',
      flavor: 'The stone hand settles into the socket. Somewhere ahead, stone grinds against stone.',
    },
    {
      id: 'relic_pedestal',
      kind: 'pickup',
      prompt: 'Take the idol',
      position: { x: 0, y: 0, z: -11.5 },
      range: 2.4,
      visual: 'relicPedestal',
      requiresFlag: 'court_hand_fitted',
      targetId: 'tgt_court_relic',
    },

    // ── The inner vault ─────────────────────────────────────────────────
    {
      id: 'notice_vault_gap',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 9.3, y: 0, z: 6 },
      range: 2.2,
      visual: 'footprints',
      flavor:
        "A gap where the old partition wall has come down, barely wider than you are lying flat. Whoever built this court could never have fit through it — which may be exactly why nobody ever has.",
      setsFlagOnUse: 'court_seen_vault_gap',
      hideOnFlag: 'court_seen_vault_gap',
    },
    {
      id: 'notice_trap_sign',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 10.7, y: 0, z: 4.3 },
      range: 1.1,
      visual: 'carving',
      flavor:
        'A row of small, evenly spaced holes along the base of the near wall, at about knee height. Nothing that even and that deliberate is decoration.',
      setsFlagOnUse: 'court_seen_trap_sign',
      hideOnFlag: 'court_seen_trap_sign',
    },
    {
      id: 'notice_plate',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 12.5, y: 0, z: 7.6 },
      range: 1.4,
      visual: 'carving',
      flavor:
        "A flat stone slab, flush with the floor, and a loose block beside it that clearly used to sit somewhere else. Standing on the plate does nothing. It wants weight you don't have.",
      setsFlagOnUse: 'court_seen_plate',
      hideOnFlag: 'court_seen_plate',
    },
    {
      id: 'plate_stone_push',
      kind: 'fit',
      prompt: 'Push the stone onto the plate',
      position: { x: 12.8, y: 0, z: 7.6 },
      range: 1.4,
      visual: 'potteryShard',
      setsFlagOnUse: 'vault_mechanism_shaken',
      hideOnFlag: 'vault_mechanism_shaken',
      flavor:
        'The stone grinds onto the plate. Somewhere near the entrance, the row of small holes clicks and goes still — and the recess behind the back wall is no longer sealed.',
    },
    {
      id: 'vault_reveal',
      kind: 'pickup',
      prompt: 'Take the cache',
      position: { x: 12.7, y: 0, z: 6.7 },
      range: 1.6,
      visual: 'relicPedestal',
      requiresFlag: 'vault_mechanism_shaken',
      targetId: 'tgt_court_hidden_cache',
    },
  ],

  hazards: [
    {
      id: 'cistern',
      // Sneaky by design: no notice warns you about this one, and none
      // should — the warning text below is the entire lesson, delivered at
      // the moment it's needed, and "watch your footing in overgrown
      // ground" is a rule the player carries into every site after this one.
      readability: 'sneaky',
      position: { x: -9, y: 0, z: 3 },
      radius: 2.1,
      warning: 'The ground gives here — a collapsed cistern, hidden under old growth. Stay back from the edge.',
    },
    {
      id: 'vault_dart_trap',
      kind: 'dart',
      // Discoverable: notice_trap_sign sits right beside it and describes
      // exactly this mechanism before it ever fires. Tucked into the corner
      // nearest the entrance, off the direct line to everything else in the
      // room — easy to avoid once you know it's there, easy to blunder into
      // if you skip the sign.
      readability: 'discoverable',
      position: { x: 11.6, y: 0, z: 3.6 },
      radius: 0.7,
      disarmedByFlag: 'vault_mechanism_shaken',
      setsFlagOnTrigger: 'vault_mechanism_shaken',
      warning: 'Something in the wall snaps forward — a jolt, and the row of holes at the base goes quiet.',
    },
  ],

  detectorDigs: [
    {
      id: 'dig_court_hand',
      position: { x: 4, y: 0, z: -5 },
      targetId: 'tgt_court_hand',
      depthCm: 24,
      baseCondition: 82,
    },
    {
      id: 'dig_court_intruder_tin',
      position: { x: 10.9, y: 0, z: 7 },
      targetId: 'tgt_court_intruder_tin',
      depthCm: 11,
      baseCondition: 88,
    },
  ],

  catRoutes: [
    {
      id: 'vault_gap',
      kind: 'squeeze',
      position: { x: 10.3, y: 0, z: 6 },
      radius: 1.4,
      clearWidthM: 0.85,
      grantsFlag: 'court_used_vault_gap',
      note: "You flatten low and slip through — nothing bigger than a cat is getting past this gap.",
    },
  ],
};
