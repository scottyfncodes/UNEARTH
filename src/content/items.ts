/**
 * Display info for everything CK can pick up: fragments, the artifacts they
 * assemble into, relics, treats, and shinies — the twelve small glittering
 * things hidden across the world that no archaeologist would ever catalogue
 * and no cat could ever ignore.
 */
export type ItemKind = 'fragment' | 'artifact' | 'relic' | 'shiny' | 'treat';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  /** Which pixel sprite draws it — in the world, in the satchel, on the find card. */
  sprite: string;
}

const list: ItemDef[] = [
  // ── the bronze key ───────────────────────────────────────────────────
  {
    id: 'fragment_bronze_handle',
    name: 'Bronze Key — Handle',
    description: 'Half of something. The break is old and deliberate: cut, not snapped.',
    kind: 'fragment',
    sprite: 'keyHandle',
  },
  {
    id: 'fragment_bronze_blade',
    name: 'Bronze Key — Blade',
    description: 'The other half, hidden where no person could reach it. Almost like that was the point.',
    kind: 'fragment',
    sprite: 'keyBlade',
  },
  {
    id: 'key_bronze',
    name: 'Ancient Bronze Key',
    description: 'The two halves click together like they never wanted to be apart.',
    kind: 'artifact',
    sprite: 'key',
  },

  // ── the moon seal ────────────────────────────────────────────────────
  {
    id: 'moon_crescent',
    name: 'Moon Seal — Crescent',
    description: 'A pale sliver of stone, cool to the touch. One of three, the notes said.',
    kind: 'fragment',
    sprite: 'moonCrescent',
  },
  {
    id: 'moon_face',
    name: 'Moon Seal — Face',
    description: 'The middle of the moon. There is a tiny eared circle carved in its center.',
    kind: 'fragment',
    sprite: 'moonFace',
  },
  {
    id: 'moon_rim',
    name: 'Moon Seal — Rim',
    description: 'The last curve. It hums very quietly when it is near the others.',
    kind: 'fragment',
    sprite: 'moonRim',
  },
  {
    id: 'moon_seal',
    name: 'The Moon Seal',
    description: 'Whole again, it glows like a night-light. Something below is waiting for it.',
    kind: 'artifact',
    sprite: 'moonSeal',
  },

  // ── relics ───────────────────────────────────────────────────────────
  {
    id: 'idol_sunstone',
    name: 'The Sunstone',
    description: 'Warm as a sunbeam on a windowsill, for a stone that has never seen the sun. It glows.',
    kind: 'relic',
    sprite: 'sunstone',
  },
  {
    id: 'keepers_bell',
    name: "Keeper's Bell",
    description: "A tiny golden bell on a worn ribbon, sized for a cat's collar. It doesn't ring. It purrs.",
    kind: 'relic',
    sprite: 'bell',
  },

  // ── treats ───────────────────────────────────────────────────────────
  {
    id: 'fish_treat',
    name: 'Fish Treat',
    description: 'Crunchy. Restorative. Gone.',
    kind: 'treat',
    sprite: 'fish',
  },

  // ── shinies ──────────────────────────────────────────────────────────
  {
    id: 'shiny_button',
    name: 'Shiny Button',
    description: "Not archaeology. Just shiny. CK doesn't care about the difference.",
    kind: 'shiny',
    sprite: 'button',
  },
  {
    id: 'shiny_thimble',
    name: 'Silver Thimble',
    description: 'A tiny metal hat. CK tried it on. It did not fit. It is still perfect.',
    kind: 'shiny',
    sprite: 'thimble',
  },
  {
    id: 'shiny_bottlecap',
    name: 'Bottle Cap',
    description: 'Crinkly edges. Makes a great sound when batted across a floor.',
    kind: 'shiny',
    sprite: 'bottlecap',
  },
  {
    id: 'shiny_marble',
    name: 'Blue Marble',
    description: 'A whole tiny sky, rolled up small.',
    kind: 'shiny',
    sprite: 'marble',
  },
  {
    id: 'shiny_jingle',
    name: 'Jingle Bell',
    description: 'From a very old cat toy. Somebody loved it once.',
    kind: 'shiny',
    sprite: 'jingle',
  },
  {
    id: 'shiny_spoon',
    name: 'Tarnished Spoon',
    description: 'For eating something. Probably soup. Possibly treasure.',
    kind: 'shiny',
    sprite: 'spoon',
  },
  {
    id: 'shiny_ring',
    name: 'Copper Ring',
    description: 'Too big for a paw, just right for a tail. CK is considering it.',
    kind: 'shiny',
    sprite: 'ring',
  },
  {
    id: 'shiny_coin',
    name: 'Keeper Coin',
    description: 'A little bronze coin stamped with an eared circle. Cat money?',
    kind: 'shiny',
    sprite: 'coin',
  },
  {
    id: 'shiny_tooth',
    name: 'Gold Tooth',
    description: "Whose? Why? CK has questions and will be asking none of them.",
    kind: 'shiny',
    sprite: 'tooth',
  },
  {
    id: 'shiny_earring',
    name: 'Pearl Earring',
    description: 'It rolled all the way down the crypt stairs, like it was trying to get somewhere.',
    kind: 'shiny',
    sprite: 'earring',
  },
  {
    id: 'shiny_watch',
    name: 'Pocket Watch',
    description: "Engraved on the back: 'A.' The hands stopped a very long time ago.",
    kind: 'shiny',
    sprite: 'watch',
  },
  {
    id: 'shiny_glasseye',
    name: 'Glass Eye',
    description: 'It is still looking at something. CK has decided not to find out what.',
    kind: 'shiny',
    sprite: 'glassEye',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((item) => [item.id, item]));

export const SHINY_IDS: string[] = list.filter((item) => item.kind === 'shiny').map((item) => item.id);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}
