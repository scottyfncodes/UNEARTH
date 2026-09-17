/**
 * The Undercroft — reached only after assembling the Silent Court's vessel
 * (chain_court_vessel unlocks loc_undercroft). Where the vessel raised a
 * question — he split it and hid the halves; what was he protecting it
 * from? — this site is the archaeologist's own attempt at an answer, left
 * mid-step for whoever came after him.
 *
 * A low chamber built around a waystone: a raised stone platform ringed by
 * four squat posts, each carved with a different mark. Only one — the
 * coiled serpent, the same mark from the Silent Court's own walls and the
 * vessel itself — turns true; the other three are rough with disuse. That
 * physical tell (backed by a half-legible note the archaeologist left
 * behind) is the entire puzzle: notice which post has actually been used,
 * not which one you'd guess first.
 *
 * Getting the waystone to turn is only half of it. Behind it, a gap too
 * tight for a person leads to the mechanism's final catch — the part the
 * archaeologist clearly reached for and never managed to trip. He solved
 * the intellectual half of this and got physically stuck on the last inch.
 * CK doesn't solve anything new; he just fits where a hand never could.
 */
import type { SiteDef } from './types';

export const UNDERCROFT: SiteDef = {
  id: 'site_undercroft',
  name: 'The Undercroft',
  subtitle: 'Beneath the Silent Court, no recorded entrance',
  radius: 9,
  skyTop: '#1c2224',
  skyBottom: '#302c28',
  fogColor: '#16191a',
  fogNear: 6,
  fogFar: 20,
  groundColor: '#232624',
  groundDetail: '#343730',
  ambience: 'chamber',
  spawn: { x: 0, y: 0, z: 7.5 },
  spawnYaw: 0,

  intro: [
    'THE UNDERCROFT',
    "Whatever he was hiding the vessel from, this is where he came looking for it.",
    'Something here still turns. Look before you push anything.',
  ],

  props: [
    { id: 'wall_north', kind: 'wall', position: { x: 0, y: 0, z: -8.5 }, scale: [3, 1, 1] },
    { id: 'wall_west', kind: 'wall', position: { x: -8.5, y: 0, z: 0 }, rotationY: Math.PI / 2, scale: [3, 1, 1] },
    { id: 'wall_east', kind: 'wall', position: { x: 8.5, y: 0, z: 0 }, rotationY: Math.PI / 2, scale: [3, 1, 1] },
    { id: 'wall_south_a', kind: 'wall', position: { x: -4.5, y: 0, z: 8.5 }, scale: [1.1, 1, 1] },
    { id: 'wall_south_b', kind: 'wall', position: { x: 4.5, y: 0, z: 8.5 }, scale: [1.1, 1, 1] },
    { id: 'entrance_arch', kind: 'archway', position: { x: 0, y: 0, z: 8.5 } },

    // Scatter, kept well clear of the mechanism so it isn't mistaken for it.
    { id: 'rubble_a', kind: 'rubble', position: { x: -5.5, y: 0, z: 4.5 } },
    { id: 'rock_a', kind: 'rock', position: { x: 5.5, y: 0, z: 5 } },
    // Where the archaeologist's note is tucked.
    { id: 'note_rock', kind: 'rock', position: { x: -3, y: 0, z: 3 }, scale: [0.7, 0.6, 0.7] },
    // Debris around the bent tool, short of the crawl gap.
    { id: 'nook_rubble', kind: 'rubble', position: { x: 0.6, y: 0, z: -6.9 }, scale: [0.6, 0.5, 0.6] },

    // The waystone itself: a raised platform CK cannot walk onto, forcing
    // an approach from one of the four posts ringing it.
    { id: 'dial_platform', kind: 'stairStep', position: { x: 0, y: 0, z: -3 }, scale: [0.8, 1, 2.2], solid: true },

    // The four posts. Visually identical structures — columnBroken — except
    // the correct one also carries its own carved-serpent interactable
    // below, giving it a real, look-and-see visual tell.
    { id: 'post_north', kind: 'columnBroken', position: { x: 0, y: 0, z: -5.2 } },
    { id: 'post_south', kind: 'columnBroken', position: { x: 0, y: 0, z: -0.8 } },
    { id: 'post_east', kind: 'columnBroken', position: { x: 2.2, y: 0, z: -3 } },
    { id: 'post_west', kind: 'columnBroken', position: { x: -2.2, y: 0, z: -3 } },

    // A partition beyond the waystone, with one gap — the same technique as
    // the Silent Court's vault entrance: an archway flanked by solid wall,
    // narrow enough in the fiction to be CK's alone (see catRoutes below).
    { id: 'crawl_side_a', kind: 'wall', position: { x: -4.8, y: 0, z: -6.5 }, scale: [1.24, 1, 1] },
    { id: 'crawl_side_b', kind: 'wall', position: { x: 4.8, y: 0, z: -6.5 }, scale: [1.24, 1, 1] },
    { id: 'crawl_archway', kind: 'archway', position: { x: 0, y: 0, z: -6.5 } },
  ],

  interactables: [
    {
      id: 'notice_field_note',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: -3, y: 0, z: 3 },
      range: 1.8,
      visual: 'rock',
      flavor:
        "A scrap of paper, damp and half-illegible, wedged into a crack at knee height. Most of it has gone to mildew, but one line still reads: '...the mark that's watched over every important thing in this court will watch over this too. Trust it again.'",
      setsFlagOnUse: 'undercroft_seen_note',
      hideOnFlag: 'undercroft_seen_note',
    },
    {
      id: 'notice_wear',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 0, y: 0, z: -4.1 },
      range: 2.2,
      visual: 'rock',
      flavor:
        "Low against the stone — a cat's eye level, not a person's — three of the four posts are rough with rust and disuse. The fourth is worn pale and smooth at its base, the grain pressed flat by the same grip, turned the same way, more times than you could count.",
      setsFlagOnUse: 'undercroft_seen_wear',
      hideOnFlag: 'undercroft_seen_wear',
    },

    // ── the four posts ────────────────────────────────────────────────────
    {
      id: 'post_serpent',
      kind: 'fit',
      prompt: 'Turn the coiled-serpent post',
      position: { x: 0, y: 0, z: -5.2 },
      range: 1.3,
      visual: 'carving',
      setsFlagOnUse: 'undercroft_dial_aligned',
      hideOnFlag: 'undercroft_dial_aligned',
      flavor:
        'The serpent post turns without protest — smooth, practiced, worn to fit exactly this motion. Somewhere beneath the platform, something heavy shifts, then stops, waiting.',
    },
    {
      id: 'post_spiral',
      kind: 'fit',
      prompt: 'Turn the spiral post',
      position: { x: 0, y: 0, z: -0.8 },
      range: 1.3,
      visual: 'columnBroken',
      setsFlagOnUse: 'undercroft_wrong_turned',
      hideOnFlag: 'undercroft_dial_aligned',
      flavor:
        "The spiral post grinds a stiff quarter turn and locks hard — wrong, and rough with disuse, like it's never once turned true.",
    },
    {
      id: 'post_sunburst',
      kind: 'fit',
      prompt: 'Turn the sunburst post',
      position: { x: 2.2, y: 0, z: -3 },
      range: 1.3,
      visual: 'columnBroken',
      setsFlagOnUse: 'undercroft_wrong_turned',
      hideOnFlag: 'undercroft_dial_aligned',
      flavor:
        "The sunburst post grinds a stiff quarter turn and locks hard — wrong, and rough with disuse, like it's never once turned true.",
    },
    {
      id: 'post_fish',
      kind: 'fit',
      prompt: 'Turn the fish post',
      position: { x: -2.2, y: 0, z: -3 },
      range: 1.3,
      visual: 'columnBroken',
      setsFlagOnUse: 'undercroft_wrong_turned',
      hideOnFlag: 'undercroft_dial_aligned',
      flavor:
        "The fish post grinds a stiff quarter turn and locks hard — wrong, and rough with disuse, like it's never once turned true.",
    },

    // ── behind the waystone ──────────────────────────────────────────────
    {
      id: 'notice_bent_tool',
      kind: 'notice',
      prompt: 'Look closer',
      position: { x: 0.6, y: 0, z: -6.9 },
      range: 1.3,
      visual: 'rubble',
      flavor:
        'A thin iron rod, bent double, wedged into the gap beneath the platform. Something — or someone — tried to reach whatever is back here by hand, or by tool, and neither one fit.',
      setsFlagOnUse: 'undercroft_seen_tool',
      hideOnFlag: 'undercroft_seen_tool',
    },
    {
      id: 'pin_release',
      kind: 'fit',
      prompt: 'Nudge the catch',
      position: { x: 0, y: 0, z: -7.8 },
      range: 1.2,
      visual: 'rock',
      requiresFlag: 'undercroft_dial_aligned',
      setsFlagOnUse: 'undercroft_opened',
      hideOnFlag: 'undercroft_opened',
      flavor:
        'The catch gives way under almost no weight at all — the lightest push finishing what no hand could ever reach far enough to attempt.',
    },
    {
      id: 'alcove_relic',
      kind: 'pickup',
      prompt: 'Take it',
      position: { x: 0.6, y: 0, z: -7.9 },
      range: 1.2,
      visual: 'relicPedestal',
      requiresFlag: 'undercroft_opened',
      targetId: 'tgt_undercroft_relic',
    },
  ],

  hazards: [],

  detectorDigs: [],

  catRoutes: [
    {
      id: 'crawl_gap',
      kind: 'crawl',
      position: { x: 0, y: 0, z: -6.5 },
      radius: 1.2,
      clearWidthM: 0.6,
      grantsFlag: 'undercroft_used_crawl',
      note: 'You flatten down and slide beneath the gap — no person is getting through here, crawl or otherwise.',
    },
  ],
};
