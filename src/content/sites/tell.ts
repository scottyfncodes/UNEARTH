/**
 * The Tell — where the Undercroft's bronze marker leads. Unlocked once
 * chain_undercroft_trail completes.
 *
 * Not a ruin with walls: a wind-cut mound, its layers exposed, with three
 * standing stones and a broken sighting cairn set into the open ground. Two
 * of the stones — the coiled serpent and the three-pointed sun, both marks
 * the player has already met, on the Silent Court's walls and on a railway
 * badge miles from any railway — sit due west and due east of the cairn, a
 * dead-straight line either side of it. The third stone, carrying the woven
 * knot from the tablet and the courtyard, sits well off that line. A
 * half-buried field note records the archaeologist's own doubt about it: he
 * tested moving it, found it hadn't been disturbed, and crossed out his own
 * first guess rather than force an answer he wasn't sure of.
 *
 * The alignment itself is only obvious from above: a tumbled heap of stone
 * beside the cairn is climbable — for a cat, not a person — and only from up
 * there does the straight line the serpent and the sun make across the
 * ground actually resolve. Walking that same line further out turns up a
 * fourth stone, carrying a mark that matches nothing else in the game yet.
 *
 * No hazard here — nothing in this ground earns one — and no detector dig;
 * this site is entirely about looking, walking, and noticing what recurs.
 */
import type { SiteDef } from './types';

export const TELL: SiteDef = {
  id: 'site_tell',
  name: 'The Tell',
  subtitle: 'Wind-cut mound, layers exposed',
  radius: 13,
  skyTop: '#7a8a6e',
  skyBottom: '#c7b98f',
  fogColor: '#9a9377',
  fogNear: 10,
  fogFar: 34,
  groundColor: '#4a4530',
  groundDetail: '#5f5940',
  ambience: 'ruins',
  spawn: { x: 0, y: 0, z: 10 },
  spawnYaw: 0,

  intro: [
    'THE TELL',
    'Wind-cut ground, layered like something nobody meant to slice open. Three marks here are worn but deliberate.',
    'See if they actually agree with each other.',
  ],

  props: [
    // Decorative scatter, kept south of the puzzle so it never competes with it.
    { id: 'rock_note', kind: 'rock', position: { x: -3, y: 0, z: 6 } },
    { id: 'rubble_a', kind: 'rubble', position: { x: -9, y: 0, z: 2 } },
    { id: 'rock_b', kind: 'rock', position: { x: 9, y: 0, z: 3 } },
    // The excavated north face the mound is named for — decorative.
    { id: 'cliff_edge', kind: 'cliff', position: { x: 0, y: 0, z: -12 }, scale: [1.6, 1, 1] },

    // The cairn and the three stones around it.
    { id: 'cairn', kind: 'columnBroken', position: { x: 0, y: 0, z: -4 } },
    { id: 'stone_serpent', kind: 'columnBroken', position: { x: -6, y: 0, z: -4 } },
    { id: 'stone_sun', kind: 'columnBroken', position: { x: 6, y: 0, z: -4 } },
    { id: 'stone_knot', kind: 'columnBroken', position: { x: 3, y: 0, z: -9 } },
    { id: 'stone_unknown', kind: 'columnBroken', position: { x: 10, y: 0, z: -4 } },

    // Tumbled stone beside the cairn — CK's own vantage point.
    { id: 'tumbled_stone', kind: 'rubble', position: { x: 2, y: 0, z: -3 }, scale: [1.4, 1, 1.4] },
  ],

  interactables: [
    {
      id: 'notice_field_note',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: -3, y: 0, z: 6 },
      range: 2,
      visual: 'rock',
      flavor:
        "A page, torn from a bound notebook and weighted down against the wind: 'Three marks on this hillside, and only two of them make sense together — the serpent and the sun sit on a dead-straight line either side of the cairn. The knot doesn't. Tried moving it myself, in case it had been kicked out of place. It hadn't. Either it was set off the line on purpose, or it was never part of this line at all. I don't know which.' The next line is crossed out hard enough to tear the page. Underneath, in the same hand: 'Starting again from the cairn.'",
      setsFlagOnUse: 'tell_seen_note',
      hideOnFlag: 'tell_seen_note',
    },
    {
      id: 'notice_cairn',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 0, y: 0, z: -4 },
      range: 2.2,
      visual: 'columnBroken',
      flavor:
        'A squat stump of fitted stone, broken off at chest height — built to hold something upright that is long gone. Whatever stood here would have cast a line across this ground, not just a shadow. Worth seeing what it once pointed at, from both sides.',
      setsFlagOnUse: 'tell_seen_cairn',
      hideOnFlag: 'tell_seen_cairn',
    },
    {
      id: 'stone_serpent_mark',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: -6, y: 0, z: -4 },
      range: 2.2,
      visual: 'carving',
      rotationY: Math.PI / 2,
      targetId: 'tgt_tell_serpent_mark',
    },
    {
      id: 'stone_sun_mark',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: 6, y: 0, z: -4 },
      range: 2.2,
      visual: 'columnBroken',
      targetId: 'tgt_tell_sun_mark',
    },
    {
      id: 'stone_knot_mark',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: 3, y: 0, z: -9 },
      range: 2.2,
      visual: 'columnBroken',
      targetId: 'tgt_tell_knot_mark',
    },
    {
      id: 'stone_unknown_mark',
      kind: 'observe',
      prompt: 'Look closer',
      position: { x: 10, y: 0, z: -4 },
      range: 2.2,
      visual: 'columnBroken',
      targetId: 'tgt_tell_unknown_mark',
    },
    {
      id: 'notice_vantage',
      kind: 'notice',
      prompt: 'Look out from here',
      position: { x: 2, y: 0, z: -3 },
      range: 1.8,
      visual: 'rubble',
      requiresFlag: 'tell_used_ledge',
      flavor:
        "From up here, the ground itself makes the point the stones only gesture at from below: due west and due east of the cairn, the serpent and the sun sit on a single straight cut across the hillside. The knot-stone, off to the south, isn't on that line at all — never was, whatever he decided.",
      setsFlagOnUse: 'tell_seen_vantage',
      hideOnFlag: 'tell_seen_vantage',
    },
  ],

  hazards: [],

  detectorDigs: [],

  catRoutes: [
    {
      id: 'ledge_climb',
      kind: 'ledge',
      position: { x: 2, y: 0, z: -3 },
      radius: 1.3,
      clearWidthM: 1.0,
      grantsFlag: 'tell_used_ledge',
      note: 'You spring up onto the tumbled stone — easy footing for four light paws, no way at all for boots.',
    },
  ],
};
