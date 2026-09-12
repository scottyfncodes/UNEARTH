/**
 * THE OVERGROWN COURTYARD — Act 3: the environmental puzzle.
 *
 * Unlocked by assembling The Bound Tablet, not by fighting anything. This
 * adventure has no mechanism or escape — a puzzle-only vertical slice that
 * proves the format works without the chamber's precision-extraction stakes.
 */
import type { AdventureDef } from './types';

export const COURTYARD: AdventureDef = {
  id: 'adv_courtyard',
  locationId: 'loc_courtyard',
  title: 'The Overgrown Courtyard',
  introSubtitle: 'Walled ground, no record of use',
  artifactTargetId: 'tgt_courtyard_idol',
  ambience: 'ruins',
  cleanCondition: 96,
  intro: [
    'The tablet’s second line ends here: four low walls, mostly fallen, enclosing a square of ground that ivy took over long before anyone alive was born.',
    'Nothing about it looks built for defence. It looks built for looking at something.',
  ],
  startBeat: 'beat_walls',
  beats: [
    {
      id: 'beat_walls',
      heading: 'The Walls',
      lines: [
        'What is left of the walls is dry stone, no mortar, fitted so tightly that a knife blade would not find the seams. Whoever raised them took their time.',
        'At the centre, a raised flagstone platform, swept nearly clean of soil by two hundred years of rain. Something is cut into it.',
      ],
      choices: [{ label: 'Look at the flagstones', to: 'beat_stones' }],
    },
    {
      id: 'beat_stones',
      heading: 'The Flagstones',
      lines: [
        'Four stones, each carved with a loop, laid in a ring around a fifth, blank stone at the centre.',
        'Individually the loops mean nothing. But you have seen this pattern before, in your hand, on a tablet you put back together yourself. Each stone can be turned.',
      ],
      choices: [{ label: 'Turn the stones', to: 'puzzle' }],
    },
  ],
  puzzle: {
    positions: 8,
    // The tablet's woven knot, unrolled around four stones instead of two
    // shards: alternating orientations, not all pointing the same way.
    solution: [0, 4, 2, 6],
    start: [3, 1, 7, 5],
    prompt: 'Turn each stone to match the loop from the tablet — the pattern is not symmetrical.',
    solvedText:
      'The fourth stone clicks into place and the centre flagstone drops half an inch, then stops, as if something under it has simply run out of room to fall.',
    screenTitle: 'The Flagstones',
    screenSubtitle: 'Four stones, one pattern',
    unsolvedHint: 'The tablet showed the knot woven, not repeated. Match the orientation, not just the shape.',
    continueLabel: 'Lift the centre stone',
    unitLabel: 'Marks',
  },
  outro: [
    'Under the centre stone: a shallow niche, dry, lined with the same fitted stone as the walls.',
    'Standing in it, facing out toward where the walls once had a gate, a small bronze figure — and cut into the flagstone beneath its feet, a bearing, pointing down toward the mine workings on the far side of the valley.',
    'The tablet led here. This leads back down, toward everything you have already been digging around the edges of.',
  ],
};
