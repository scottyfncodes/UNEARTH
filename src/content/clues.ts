import type { ClueDef, MysteryChain } from '@/core/types';

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
];

const CLUE_INDEX = new Map(CLUES.map((c) => [c.id, c]));
const CHAIN_INDEX = new Map(CHAINS.map((c) => [c.id, c]));

export function getClue(id: string): ClueDef | undefined {
  return CLUE_INDEX.get(id);
}

export function getChain(id: string): MysteryChain | undefined {
  return CHAIN_INDEX.get(id);
}
