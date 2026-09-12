/**
 * THE SEALED CHAMBER — Act 4: the major discovery.
 *
 * Everything here is data: rooms, the dial puzzle, the mechanism holding the
 * artifact, and the escape beats.
 */
import type { AdventureDef } from './types';

export const SEALED_CHAMBER: AdventureDef = {
  id: 'adv_sealed_chamber',
  locationId: 'loc_sealed_chamber',
  title: 'The Sealed Chamber',
  introSubtitle: 'Beneath the north-west spur',
  artifactTargetId: 'tgt_sun_disc',
  ambience: 'chamber',
  cleanCondition: 96,
  intro: [
    'The collapsed adit takes two hours to clear by hand. Behind it, the tunnel stops being a mine.',
    'The walls are cut square. The floor is level. Nobody dug this for coal.',
  ],
  startBeat: 'beat_passage',
  beats: [
    {
      id: 'beat_passage',
      heading: 'The Cut Passage',
      lines: [
        'Your lamp reaches about twelve feet before the dark takes it back. The air is dry and very still, and it tastes of nothing at all.',
        'Thirty paces in, the passage forks. To the left, the cut continues clean and deliberate. To the right, the wall has been broken through from the other side.',
      ],
      choices: [
        { label: 'Follow the cut passage', to: 'beat_door', note: 'The way it was meant to be walked' },
        { label: 'Take the broken opening', to: 'beat_shaft', note: 'Someone left in a hurry' },
      ],
    },
    {
      id: 'beat_shaft',
      heading: 'The Broken Wall',
      lines: [
        'Beyond the break, a shaft drops away into nothing. Timber staging clings to one wall, rotted to sponge.',
        'On a ledge at the top: a lamp, a mining pick, and a boot. All three arranged carefully, as though their owner intended to come back for them.',
        'They never did.',
      ],
      choices: [{ label: 'Back to the fork', to: 'beat_door' }],
    },
    {
      id: 'beat_door',
      heading: 'The Door',
      lines: [
        'The passage ends in a slab of dressed stone, and the slab has a face.',
        'Three rings are set into it, each carved with a single tapered ray. Around them, the same characters you could not read on the token.',
        'The rings turn. Of course they turn.',
      ],
      choices: [{ label: 'Work the rings', to: 'puzzle' }],
    },
  ],
  puzzle: {
    positions: 6,
    // Three rays, evenly spaced — the symbol you have been staring at all game.
    solution: [0, 2, 4],
    start: [3, 5, 1],
    prompt: 'Turn each ring until the three rays stand as they do on the token.',
    solvedText:
      'The last ring seats with a sound like a held breath being let go, and the slab swings inward on its own weight.',
    screenTitle: 'The Door',
    screenSubtitle: 'Three rings, one symbol',
    unsolvedHint: 'The token shows three rays, evenly spaced. Nothing else fits.',
    continueLabel: 'Step inside',
    unitLabel: 'Rays',
  },
  mechanism: {
    clamps: [
      { id: 'clamp_a', angle: -90, order: 1 },
      { id: 'clamp_b', angle: 30, order: 2 },
      { id: 'clamp_c', angle: 150, order: 3 },
    ],
    holdSeconds: 1.5,
    wrongOrderTension: 26,
    rimTension: 14,
    wrongOrderDamage: 9,
    creepPerSecond: 2.2,
  },
  escape: [
    {
      prompt: 'The lintel drops — DUCK',
      window: 1.5,
      success: 'Stone passes close enough to take dust off your shoulder.',
      failure: 'It catches you across the back and puts you on the floor.',
    },
    {
      prompt: 'Floor gives way — JUMP',
      window: 1.3,
      success: 'You clear it. Behind you the slabs go down like teeth.',
      failure: 'Your leg goes through to the knee before you tear it free.',
    },
    {
      prompt: 'The shaft is filling — CLIMB',
      window: 1.5,
      success: 'Rotten staging, one handhold at a time, and it holds.',
      failure: 'A timber snaps and you slide back six feet through the dark.',
    },
    {
      prompt: 'Daylight — RUN',
      window: 1.8,
      success: 'You come out of the adit into flat grey afternoon light.',
      failure: 'The mouth of the adit shuts a heartbeat after you clear it.',
    },
  ],
  outro: [
    'The spoil heap settles behind you and goes quiet, as though nothing happened at all.',
    'The disc is heavier than it has any right to be, and the characters around its rim are the same ones on the token, the fragment, and the door.',
    'They are also, you notice, on the back.',
  ],
};
