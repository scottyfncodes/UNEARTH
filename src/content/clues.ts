/**
 * The trail. Dad's field notes are numbered pages; everything else is what
 * CK noticed along the way. Read in order, they tell one story. Read again
 * after the ending, they tell a slightly different one — every line here is
 * true, and every line was there the whole time.
 */
export interface ClueDef {
  id: string;
  title: string;
  text: string;
  /** Set on Dad's field-note pages, which the journal lists in order with gaps. */
  page?: number;
}

const list: ClueDef[] = [
  // ── Dad's field notes ────────────────────────────────────────────────
  {
    id: 'clue_field_notes_1',
    page: 1,
    title: 'Field Notes — Page 1',
    text: '"The keepers split their bronze key and hid the halves. One half they buried. The other sits behind a statue, through a crack no person could fit through. Odd. It\'s almost as if they didn\'t want a person to open it at all."',
  },
  {
    id: 'clue_field_notes_2',
    page: 2,
    title: 'Field Notes — Page 2',
    text: '"The Sunstone. Warm as a windowsill in June. The inscriptions say it \'lights the way below the well.\' I think the crypt is under the old well east of the meadow. Tomorrow."',
  },
  {
    id: 'clue_field_notes_3',
    page: 3,
    title: 'Field Notes — Page 3',
    text: '"The well stairs go down into the crypt. My lamp keeps guttering out down there, like the dark is hungry. Ordinary light won\'t do. The keepers must have had something better."',
  },
  {
    id: 'clue_field_notes_4',
    page: 4,
    title: 'Field Notes — Page 4',
    text: '"A seal in three pieces — crescent, face and rim — scattered through the crypt. Moon-marked. Put it back together and the round door opens. I have found exactly none of them. My knees hate this place."',
  },
  {
    id: 'clue_field_notes_5',
    page: 5,
    title: 'Field Notes — Last Page',
    text: '"I\'ve come as far as a person can. The last passage is a crack no wider than my hand. Whatever the keepers hid, they hid it from people. I\'m going home. Maybe I\'ll find a way back someday. — A."',
  },

  // ── what CK noticed ──────────────────────────────────────────────────
  {
    id: 'clue_old_note',
    title: 'A Note in a Book',
    text: '"Back soon — followed a lead out past the old ruins. Mind the house. — A." The paper is yellow and crackly at the edges. Dad must have left in a real hurry.',
  },
  {
    id: 'clue_worn_stone',
    title: 'A Worn Stone',
    text: 'A flat stone rubbed smooth where someone sat and sketched. Scratched into it: an arrow pointing south, and a small symbol — a circle with two pointed ears.',
  },
  {
    id: 'clue_statue_crack',
    title: 'A Cracked Wall',
    text: 'Behind the statue, a hairline crack splits the stone — just wide enough for something small and determined.',
  },
  {
    id: 'clue_mural_cats',
    title: 'A Faded Mural',
    text: 'Tall painted figures bow low before a much smaller figure with pointed ears and a very upright tail. Nobody in the mural seems surprised by this.',
  },
  {
    id: 'clue_inscription',
    title: 'The Inscription',
    text: 'Faded script circles the pedestal. Most of it has worn away. What remains says: "…and so it waited, for one small enough, and curious enough."',
  },
  {
    id: 'clue_dusty_hat',
    title: "Dad's Hat",
    text: 'A battered field hat, left on a ledge. It is thick with dust. How long has Dad been down here?',
  },
  {
    id: 'clue_echo',
    title: 'The Hall of Echoes',
    text: 'The eared circle, carved again and again across every wall. Beneath it, the same three words in three old scripts: SMALL. CURIOUS. PATIENT.',
  },
  {
    id: 'clue_keepers_1',
    title: 'The Keepers',
    text: 'The vault murals are clear at last. The keepers were cats. Every single one of them.',
  },
  {
    id: 'clue_keepers_2',
    title: 'The Last Panel',
    text: 'A small cat, alone, following a trail of shiny things — all the way home.',
  },

  // ── the hunt: what the sites themselves give away ────────────────────
  {
    id: 'clue_dig_log',
    title: "Dad's Dig Log",
    text: 'Pinned to a board, curling at the edges: "Trench A — nothing. Trench B — nothing. Test pit by the tent — a tent peg (mine). Collar pinged LOUD by the leaning stone, on its sunrise side. Ran out of daylight. Back tomorrow for it!" Nobody came back tomorrow. A sapling has grown through the camp table.',
  },
  {
    id: 'clue_guardian_gaze',
    title: 'Floor Inscription',
    text: 'Letters worn into the flagstones: "HALF WE GAVE TO THE EARTH, WHERE THE GUARDIAN KEEPS ITS EYES." The guardian statue stares, unblinking, straight down the hall.',
  },
  {
    id: 'clue_leap_mural',
    title: 'The Bricks Frieze',
    text: 'Tall carved figures stride across a row of bricks while darts fly out of the wall at them. Behind them, a small eared figure sails over the very same bricks in a single bound, tail high. Nobody is firing at the small one.',
  },
  {
    id: 'clue_boulder_mural',
    title: 'A Warning, Probably',
    text: 'A carved figure lifts a sun-disc off a pedestal. Behind it, a great round stone. In the next panel, everybody is running. In the last panel, the stone has gone straight through a wall.',
  },
  {
    id: 'clue_moon_eye',
    title: 'The Watching Moon',
    text: 'A crescent moon carved high on the wall, with one open eye staring straight down at the floor beneath it. The keepers did not carve eyes for decoration.',
  },
  {
    id: 'clue_bridge_scratch',
    title: 'Scratched Into the Ledge',
    text: 'In Dad\'s handwriting, gouged with a pocket knife: "DON\'T STOP ON THE BRIDGE. Also don\'t look down. (Looked down.) — A."',
  },
  {
    id: 'clue_decoy_moons',
    title: 'Decoy Moons',
    text: 'Little carved stone crescents, buried all over the Hall of Echoes. Worthless — made to be dug up by the wrong people. The real piece rings clear. These only clunk.',
  },
];

export const CLUES: Record<string, ClueDef> = Object.fromEntries(list.map((clue) => [clue.id, clue]));

export const FIELD_NOTE_PAGES: ClueDef[] = list.filter((c) => c.page !== undefined).sort((a, b) => a.page! - b.page!);

export function getClue(id: string): ClueDef | undefined {
  return CLUES[id];
}
