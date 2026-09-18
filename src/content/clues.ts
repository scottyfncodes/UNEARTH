/**
 * The archaeologist left a trail, not a map. Clues are read in the journal
 * overlay — CK collects them, the player reconstructs what happened.
 */
export interface ClueDef {
  id: string;
  title: string;
  text: string;
}

export const CLUES: Record<string, ClueDef> = {
  clue_worn_stone: {
    id: 'clue_worn_stone',
    title: 'A Worn Stone',
    text: 'Smoothed flat on one side, like a boot heel rested here again and again. Someone stood here a long time, looking south.',
  },
  clue_field_notes_1: {
    id: 'clue_field_notes_1',
    title: "Field Notes — Page 1",
    text:
      '"...the old keepers sealed the vault with twin bronze halves, split for safekeeping. Split, I now think, from a cat\'s reach — not a person\'s. I wonder if that was ever the point."',
  },
  clue_statue_crack: {
    id: 'clue_statue_crack',
    title: 'A Cracked Wall',
    text: 'A hairline fracture splits the stone behind the statue — just wide enough for something small and determined.',
  },
  clue_departure_note: {
    id: 'clue_departure_note',
    title: 'A Note on the Table',
    text: '"Back soon — followed a lead out past the old ruins. Mind the house. — Dad" It smells like it was written in a hurry.',
  },
  clue_field_notes_2: {
    id: 'clue_field_notes_2',
    title: 'Field Notes — Page 2',
    text:
      '"If this key is where I think it is, the vault opens onto something I\'ve chased for years. Funny — for something this old, my legs feel every step of it today."',
  },
  clue_inscription: {
    id: 'clue_inscription',
    title: 'A Worn Inscription',
    text: 'Faded script circles the idol\'s base. Most of it has worn away — what remains just says "and so it waited."',
  },
};

export function getClue(id: string): ClueDef | undefined {
  return CLUES[id];
}
