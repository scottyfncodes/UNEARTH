/**
 * Display info for everything that can sit in CK's inventory: dig-up
 * fragments, the artifacts they assemble into, and story trinkets.
 */
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  /** How this item reads in the inventory strip: a fragment, a completed artifact, or flavor. */
  kind: 'fragment' | 'artifact' | 'trinket';
}

export const ITEMS: Record<string, ItemDef> = {
  fragment_bronze_handle: {
    id: 'fragment_bronze_handle',
    name: 'Bronze Fragment (Handle)',
    description: 'Half of something. The break is old, deliberate — cut, not snapped.',
    kind: 'fragment',
  },
  fragment_bronze_blade: {
    id: 'fragment_bronze_blade',
    name: 'Bronze Fragment (Blade)',
    description: 'The other half. It wants to be somewhere else, joined to something.',
    kind: 'fragment',
  },
  key_bronze: {
    id: 'key_bronze',
    name: 'Ancient Bronze Key',
    description: 'The two halves click together like they never wanted to be apart.',
    kind: 'artifact',
  },
  idol_sunstone: {
    id: 'idol_sunstone',
    name: 'Sunstone Idol',
    description: 'Warm to the touch, for a stone that has never seen the sun.',
    kind: 'trinket',
  },
  trinket_button: {
    id: 'trinket_button',
    name: 'Shiny Button',
    description: "Not archaeology. Just shiny. CK doesn't care about the difference.",
    kind: 'trinket',
  },
};

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}
