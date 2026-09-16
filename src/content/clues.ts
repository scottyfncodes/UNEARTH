import type { ClueDef, MysteryChain } from '@/core/types';

/**
 * Two independent mystery threads run through the game, each announced by its
 * own recurring symbol:
 *
 *  - "Three-pointed sun" (chain_survey, chain_sun) — paperwork for a railway
 *    spur that was never built, leading down into the mine and the sealed
 *    chamber beneath it.
 *  - "Woven Knot" (chain_tablet, chain_knot) — three broken shards of the
 *    same tablet, found early and separately, that turn out to be one object
 *    and point somewhere the player has not been yet.
 *
 * The two threads cross at the end: the courtyard's knot points back down at
 * the mine, tying both mysteries to the same ground.
 */
export const CLUES: ClueDef[] = [
  {
    id: 'clue_badge',
    chainId: 'chain_survey',
    symbol: 'Three-pointed sun',
    title: 'A line that does not exist',
    text:
      'Crew badge, line 14. No railway register lists a line 14 anywhere in this county. Stamped below the number, small enough to miss: a sun with three rays.',
  },
  {
    id: 'clue_survey',
    chainId: 'chain_survey',
    symbol: 'Bearing 312°',
    title: 'A spur that was never built',
    text:
      'Survey tag, 1888. Bearing 312 degrees, depth 40 fathoms. The spur runs north-west into the old mine ground — and nothing was ever laid there.',
  },
  {
    id: 'clue_token',
    chainId: 'chain_sun',
    symbol: 'Three-pointed sun',
    title: 'Not currency',
    text:
      'The token is cast, not struck, and far too heavy for its size. The three-pointed sun again — the same proportions as the badge, down to the angle of the rays.',
  },
  {
    id: 'clue_fragment',
    chainId: 'chain_sun',
    symbol: 'Three-pointed sun',
    title: 'Cut, not weathered',
    text:
      'The same sun, this time carved into basalt with edges that never saw rain. Whatever this was broken from stood inside something.',
  },
  {
    id: 'clue_mechanism',
    chainId: 'chain_sun',
    symbol: 'Machined teeth',
    title: 'Made to turn',
    text:
      'A gear segment with no corrosion and a tooth profile cut for a mechanism, not a mine cart. Three teeth are worn flat — this thing moved, repeatedly, for a long time.',
  },

  // ── The Bound Tablet: three ordinary-looking shards that turn out to be one
  // object, split apart. This is the game's first "wait, these fit" moment,
  // and it happens in the two mundane starting locations.
  {
    id: 'clue_shard_a',
    chainId: 'chain_tablet',
    symbol: 'Woven Knot',
    title: 'Not a natural break',
    text:
      'A fired-clay shard, one edge sheared clean rather than snapped. Where the surface survives, part of a carved pattern: two loops, woven through each other.',
  },
  {
    id: 'clue_shard_b',
    chainId: 'chain_tablet',
    symbol: 'Woven Knot',
    title: 'The same hand',
    text:
      'Another shard, same clay, same depth of carving. The woven pattern continues across the broken edge — this was one piece before something split it in three.',
  },
  {
    id: 'clue_shard_c',
    chainId: 'chain_tablet',
    symbol: 'Woven Knot',
    title: 'The third piece',
    text:
      'The last shard completes the outline. Fit the three edges together and the woven knot closes into a single unbroken loop — assuming the pieces actually fit.',
  },
  {
    id: 'clue_tablet_assembled',
    chainId: 'chain_knot',
    symbol: 'Woven Knot',
    title: 'The tablet reads a direction',
    text:
      'Whole, the tablet is a small carved map: the woven knot sits at a crossing of two lines, and one line runs on past the edge of the fired clay — toward higher ground, walled and overgrown.',
  },
  {
    id: 'clue_courtyard',
    chainId: 'chain_knot',
    symbol: 'Woven Knot',
    title: 'The knot again, and a bearing',
    text:
      'Cut into the courtyard flagstones, worn almost flat: the same woven knot, and beside it, a line pointing down — toward the spoil heaps above the old mine.',
  },

  // ── The Silent Court's inner vault: a buried tin left by whoever left the
  // footprints and the crate up front — the loose thread the main court
  // never resolves, picked back up here, reachable only through a gap CK's
  // own body is small enough to use.
  {
    id: 'clue_court_intruder',
    chainId: 'chain_court_intruder',
    symbol: 'Recent Boot Prints',
    title: 'Not part of the ruin',
    text:
      'Survey notes, damp but legible, in a hand that is not the archaeologist\'s and not old. Someone else has been quietly working this court — and hiding what they found the same way anyone would.',
  },

  // ── The Silent Court (content/sites/silentCourt.ts): two matching carvings,
  // found by looking rather than digging — the game's first "wait, I've seen
  // this" moment that happens entirely on foot, with no detector involved.
  {
    id: 'clue_court_coil_west',
    chainId: 'chain_court_coil',
    symbol: 'Twin Serpent Coil',
    title: 'A serpent, coiled',
    text:
      'Cut into the base of the west wall: a serpent coiled tight around itself. Deliberate work, and old — but the stone around it is not worn the way the rest of the wall is.',
  },
  {
    id: 'clue_court_coil_east',
    chainId: 'chain_court_coil',
    symbol: 'Twin Serpent Coil',
    title: 'The same serpent, the other wall',
    text:
      'The east wall carries an identical coil — same proportions, same depth of cut, same hand. Two matching marks, on opposite walls of the same small court, do not happen by accident.',
  },
  {
    id: 'clue_court_vessel',
    chainId: 'chain_court_vessel',
    symbol: 'Twin Serpent Coil',
    title: 'The same coil, in the clay',
    text:
      'The reassembled vessel carries the same coiled serpent as both walls — pressed into the clay before it was ever fired, not scratched in after. Whatever this court was built around, it wasn\'t the statue at the centre. It was this.',
  },
];

export const CHAINS: MysteryChain[] = [
  {
    id: 'chain_survey',
    name: 'The Unbuilt Spur',
    clueIds: ['clue_badge', 'clue_survey'],
    hint: 'Two pieces of paperwork for a railway that was never finished.',
    completeTitle: 'THE SPUR LEADS SOMEWHERE',
    completeText:
      'A crew badge for a line that was never registered, and a survey tag pointing north-west at forty fathoms. The heading ends at the spoil heaps above the old mine. Somebody was working down there, off the books.',
    unlocksLocation: 'loc_abandoned_mine',
  },
  {
    id: 'chain_sun',
    name: 'The Three-Pointed Sun',
    clueIds: ['clue_token', 'clue_fragment', 'clue_mechanism'],
    hint: 'The same symbol keeps turning up on things that should not share a symbol.',
    completeTitle: 'THE CHAMBER IS REAL',
    completeText:
      'Cast bronze, carved basalt, machined alloy — three materials, three centuries apart, one symbol. The mechanism piece is the proof: there is something built down there, and the collapsed adit behind the spoil heaps is the way in.',
    unlocksLocation: 'loc_sealed_chamber',
    unlocksAdventure: 'adv_sealed_chamber',
  },
  {
    id: 'chain_tablet',
    name: 'Three Pieces of Clay',
    clueIds: ['clue_shard_a', 'clue_shard_b', 'clue_shard_c'],
    hint: 'Three broken shards, all carved with the same pattern. They might fit together.',
    completeTitle: 'THESE BELONG TOGETHER',
    completeText:
      'Laid side by side, the shards are unmistakably one object, split three ways. The carved knot lines up across every break. Time to see what it looks like whole.',
  },
  {
    id: 'chain_tablet_bound',
    name: 'The Tablet, Whole',
    clueIds: ['clue_tablet_assembled'],
    hint: 'The shards are found. Whether they actually fit together is another matter.',
    completeTitle: 'THE MAP WAS INSIDE IT ALL ALONG',
    completeText:
      'Reassembled, the tablet is small enough to hold in one hand and it is unmistakably a map — this ground, drawn from above, with the woven knot marking one specific spot. Walled. Overgrown. Close.',
    unlocksLocation: 'loc_courtyard',
  },
  {
    id: 'chain_knot',
    name: 'The Woven Knot',
    clueIds: ['clue_tablet_assembled', 'clue_courtyard'],
    hint: 'The knot on the tablet and the knot in the courtyard are not a coincidence.',
    completeTitle: 'ONE SYMBOL, THREE SITES',
    completeText:
      'The tablet pointed to the courtyard. The courtyard points to the mine. The same woven knot marks every step — a different mark entirely from the three-pointed sun on the badge and the survey tag, which means two separate mysteries are converging on the same patch of ground.',
  },
  {
    id: 'chain_court_intruder',
    name: 'Someone Else Was Here',
    clueIds: ['clue_court_intruder'],
    hint: 'Boot prints and a dropped crate, up front. Whoever left them may have left more than that.',
    completeTitle: 'NOT ALONE OUT HERE',
    completeText:
      'Recent notes, hidden on purpose, in ground nobody but a cat could reach unannounced. Whoever this belongs to has been through this court more than once — and left before finishing.',
  },
  {
    id: 'chain_court_coil',
    name: 'The Twin Serpent Coil',
    clueIds: ['clue_court_coil_west', 'clue_court_coil_east'],
    hint: 'A coiled serpent is cut into one wall of the court. Is it only on the one wall?',
    completeTitle: 'BOTH WALLS AGREE',
    completeText:
      'The same coiled serpent, cut into stone on opposite sides of the court, by the same hand, at the same height. Whatever stood at the centre of this place was important enough to mark twice.',
  },
  {
    id: 'chain_court_vessel',
    name: 'He Split It On Purpose',
    clueIds: ['clue_court_vessel'],
    hint: 'The vessel is in two pieces, on opposite sides of the court. That is not how things usually break.',
    completeTitle: 'HE SPLIT IT ON PURPOSE',
    completeText:
      'The break across the vessel is a clean, modern cut — not decay, not an accident. He found this whole, understood what it was, and deliberately hid it in two places rather than leave it for whoever left that tin. Somewhere beyond this court, there is more of whatever he was protecting it from — and he went to see it anyway.',
  },
];

const CLUE_INDEX = new Map(CLUES.map((c) => [c.id, c]));
const CHAIN_INDEX = new Map(CHAINS.map((c) => [c.id, c]));

export function getClue(id: string): ClueDef | undefined {
  return CLUE_INDEX.get(id);
}

export function getChain(id: string): MysteryChain | undefined {
  return CHAIN_INDEX.get(id);
}
