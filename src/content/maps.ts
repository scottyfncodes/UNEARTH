/**
 * CK's whole journey, screen by screen.
 *
 *   Prologue — Home: Dad pops out. CK finds a note. CK draws conclusions.
 *   The Meadow — a tortoise who remembers everything a little wrong, a
 *     magpie with opinions, and two roads: south to the temple, east to a
 *     well that goes nowhere without a light.
 *   Chapter I — The Forgotten Temple: the bronze key, the Sunstone.
 *   The Old Well — the way down, once CK has something to see by.
 *   Chapter II — The Sunken Crypt: dark rooms, falling stones, a bat, the
 *     three pieces of the Moon Seal.
 *   Chapter III — The Hollow: where Dad stopped, and where CK doesn't.
 *
 * Legend: # wall · . floor · : path · ~ water · D soft dirt · g cat-only gap
 *         P pressure plate · ^ pit · > exit · s secret nook (floor)
 */
import { buildMap } from '@/game/mapBuilder';
import type { GameMap } from '@/game/types';

// ── Prologue: Home ─────────────────────────────────────────────────────────
const home = buildMap({
  id: 'home',
  name: "CK's Home",
  region: 'home',
  chapter: { number: 'Prologue', title: 'Twenty Minutes' },
  rows: [
    '################',
    '#..........#s..#',
    '#..........#...#',
    '#..........g...#',
    '#..........#####',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#######>########',
  ],
  entities: [
    {
      kind: 'npc',
      id: 'npc_dad',
      pos: { x: 7, y: 9 },
      name: 'Dad',
      sprite: 'dad',
      lines: [
        'Morning, CK! I\'m just popping out for a bit.',
        'Please do NOT knock anything off the shelves while I\'m gone. I mean it this time.',
        'Twenty minutes. Back before you know it!',
      ],
      onCompleteFlag: 'dadLeft',
      vanishesWhenFlag: 'dadLeft',
    },
    {
      kind: 'npc',
      id: 'npc_dad_home',
      pos: { x: 11, y: 8 },
      name: 'Dad',
      sprite: 'dadGroceries',
      requiresFlag: 'napTaken',
      lines: [
        "CK! I'm home! Sorry — the line at the store was out the door.",
        'Were you asleep this whole time? You\'re covered in… is that moss? And bat fur?',
        "Wait — why is my old note out? I wrote that twenty years ago, on my Hollow expedition. Before you were even born!",
        'Never did get into that vault. The last passage was too small for a person, would you believe it.',
        'Anyway! I got you the fancy fish. Twenty minutes, tops. Did you miss me?',
      ],
      onCompleteFlag: 'gameComplete',
    },
    {
      kind: 'decoration',
      id: 'deco_bookshelf_note',
      pos: { x: 2, y: 1 },
      spriteId: 'bookshelf',
      line: 'CK bats a book off the shelf. THUMP. A folded note flutters out of it…',
      clueId: 'clue_old_note',
      setsFlag: 'foundOldNote',
      afterLine: 'One book lighter. CK regrets nothing.',
    },
    {
      kind: 'decoration',
      id: 'deco_bookshelf',
      pos: { x: 3, y: 1 },
      spriteId: 'bookshelf',
      line: 'Books about ruins. Books about more ruins. One about cats — thoroughly chewed.',
    },
    {
      kind: 'decoration',
      id: 'deco_desk',
      pos: { x: 6, y: 1 },
      spriteId: 'desk',
      line: "Dad's desk. The hook where his prototype detector collar hangs is empty. …Oh. CK is wearing it.",
    },
    {
      kind: 'decoration',
      id: 'deco_table',
      pos: { x: 4, y: 6 },
      spriteId: 'table',
      line: "The kitchen table. Dad's coffee is still warm.",
    },
    {
      kind: 'decoration',
      id: 'deco_vase',
      pos: { x: 5, y: 6 },
      spriteId: 'vase',
      line: 'CK nudges the vase. Nudges it again. It topples — and something shiny rolls out!',
      givesItem: 'shiny_button',
      afterLine: 'The vase lies on its side. Dad will blame the wind.',
    },
    { kind: 'decoration', id: 'deco_rug', pos: { x: 7, y: 5 }, spriteId: 'rug', walkable: true, line: 'A good rug. Excellent for scratching. Strictly forbidden.' },
    { kind: 'decoration', id: 'deco_bowl', pos: { x: 12, y: 7 }, spriteId: 'bowl', line: "CK's food bowl. Empty. This is, frankly, a crime." },
    { kind: 'decoration', id: 'deco_bed', pos: { x: 13, y: 8 }, spriteId: 'catBed', line: "CK's bed. Warm. Tempting. But there is a mystery afoot." },
    { kind: 'decoration', id: 'deco_plant', pos: { x: 1, y: 9 }, spriteId: 'plant', line: 'A houseplant with several suspicious bite marks.' },
    { kind: 'item', id: 'item_thimble', pos: { x: 14, y: 1 }, itemId: 'shiny_thimble' },
  ],
  exits: [
    {
      at: { x: 7, y: 10 },
      toMap: 'meadow',
      spawn: { x: 7, y: 1 },
      spawnFacing: 'down',
      requiresFlag: 'foundOldNote',
      lockedMessage: 'CK sits by the door. Where did Dad actually go? There must be a clue around here…',
    },
  ],
  defaultSpawn: { x: 7, y: 2 },
});

// ── The Meadow ─────────────────────────────────────────────────────────────
const meadow = buildMap({
  id: 'meadow',
  name: 'The Meadow',
  region: 'meadow',
  rows: [
    '#######>########',
    '#~~~...:.......#',
    '#~s~...:.......#',
    '#~.~...:.......#',
    '#......:....D..#',
    '#......:.......#',
    '#......::::::::>',
    '#......:.......#',
    '#..D...:..##...#',
    '#......:..##...#',
    '#......:....D..#',
    '#......:.......#',
    '#######>########',
  ],
  entities: [
    {
      kind: 'npc',
      id: 'npc_tortoise',
      pos: { x: 10, y: 2 },
      name: 'Old Shellby',
      sprite: 'tortoise',
      lines: [
        'Hm? Oh. A kitten. Hello, kitten.',
        'The tall human with the hat? He went south, toward the old temple.',
        '…Or was that a different time? When you\'re two hundred years old, everything was a while ago.',
      ],
      flagLines: [
        {
          flag: 'visited:vault',
          lines: ['You found it, didn\'t you. The Hollow. I can tell.', 'You have the look of a cat who knows something the rest of us don\'t. Which is every cat. But more so.'],
        },
        {
          flag: 'visited:crypt1',
          lines: ['Back from the well? You smell like bats.', 'Three pieces make a moon, they used to say. Down there in the dark. Don\'t ask me who "they" were.'],
        },
        {
          flag: 'visited:temple3',
          lines: [
            'Your whiskers are singed. You went to the temple!',
            'That warm stone of yours… the old well, east of here, goes down into a dark nothing else can light.',
          ],
        },
      ],
    },
    {
      kind: 'npc',
      id: 'npc_magpie',
      pos: { x: 13, y: 9 },
      name: 'Magpie',
      sprite: 'magpie',
      lines: [
        'SHINY! You got shinies? Show! …No? Pff.',
        'Tip, cat: that collar sings near buried things. Louder, louder — then DIG.',
        'Soft dirt lies, though. Most of it is just dirt. Listen first!',
      ],
    },
    { kind: 'decoration', id: 'deco_stone', pos: { x: 5, y: 3 }, spriteId: 'stone', clueId: 'clue_worn_stone', line: 'A flat stone, worn smooth.' },
    {
      kind: 'decoration',
      id: 'deco_sign',
      pos: { x: 8, y: 7 },
      spriteId: 'sign',
      line: 'A weathered signpost. SOUTH: The Old Temple. EAST: The Old Well (CLOSED). Someone has crossed out "closed".',
    },
    { kind: 'decoration', id: 'deco_flowers', pos: { x: 4, y: 10 }, spriteId: 'flowers', walkable: true, line: 'Flowers. CK sneezes.' },
    { kind: 'item', id: 'item_marble', pos: { x: 2, y: 2 }, itemId: 'shiny_marble' },
    { kind: 'item', id: 'treat_meadow', pos: { x: 1, y: 11 }, itemId: 'fish_treat', heals: 1 },
  ],
  buried: { '12,4': { itemId: 'shiny_bottlecap' } },
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'home', spawn: { x: 7, y: 9 }, spawnFacing: 'up' },
    { at: { x: 7, y: 12 }, toMap: 'temple1', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
    { at: { x: 15, y: 6 }, toMap: 'well', spawn: { x: 1, y: 6 }, spawnFacing: 'right' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

// ── The Old Well ───────────────────────────────────────────────────────────
const well = buildMap({
  id: 'well',
  name: 'The Old Well',
  region: 'well',
  rows: [
    '################',
    '#..........#s..#',
    '#..D.......#...#',
    '#..........#g###',
    '#..............#',
    '#.......>......#',
    '>..............#',
    '#..............#',
    '#...##.........#',
    '#...#..D.......#',
    '#..............#',
    '################',
  ],
  entities: [
    { kind: 'clueNote', id: 'note_field3', pos: { x: 6, y: 4 }, clueId: 'clue_field_notes_3' },
    {
      kind: 'decoration',
      id: 'deco_well_statue',
      pos: { x: 12, y: 7 },
      spriteId: 'catStatue',
      line: 'A weathered statue of… a cat? A very dignified cat, gazing at the well.',
    },
    { kind: 'item', id: 'item_spoon', pos: { x: 14, y: 1 }, itemId: 'shiny_spoon' },
    { kind: 'item', id: 'treat_well', pos: { x: 14, y: 2 }, itemId: 'fish_treat', heals: 1 },
  ],
  buried: { '7,9': { itemId: 'shiny_jingle' } },
  exits: [
    { at: { x: 0, y: 6 }, toMap: 'meadow', spawn: { x: 14, y: 6 }, spawnFacing: 'left' },
    {
      at: { x: 8, y: 5 },
      toMap: 'crypt1',
      spawn: { x: 7, y: 1 },
      spawnFacing: 'down',
      requiresItem: 'idol_sunstone',
      lockedMessage: "The well's stairs spiral down into total darkness. CK's eyes are good — but not that good. A light, maybe?",
    },
  ],
  defaultSpawn: { x: 1, y: 6 },
});

// ── Chapter I: The Forgotten Temple ────────────────────────────────────────
const temple1 = buildMap({
  id: 'temple1',
  name: 'Forgotten Temple — Entry Hall',
  region: 'temple',
  chapter: { number: 'Chapter I', title: 'The Forgotten Temple' },
  rows: [
    '#######>########',
    '#..............#',
    '#..............#',
    '#...D.......####',
    '#...........#s.#',
    '#...........g..#',
    '#...........####',
    '#..D...........#',
    '#..............#',
    '#....P.........#',
    '#..............#',
    '#..............#',
    '#######>########',
  ],
  entities: [
    { kind: 'clueNote', id: 'note_field1', pos: { x: 6, y: 3 }, clueId: 'clue_field_notes_1' },
    { kind: 'decoration', id: 'deco_statue1', pos: { x: 11, y: 4 }, spriteId: 'statue', clueId: 'clue_statue_crack', line: 'A stern stone guardian.' },
    { kind: 'item', id: 'item_fragment_b', pos: { x: 14, y: 5 }, itemId: 'fragment_bronze_blade' },
    { kind: 'trap', id: 'trap_entry', pos: { x: 0, y: 9 }, trapType: 'dart', triggerPlate: { x: 5, y: 9 }, detectable: true },
    { kind: 'decoration', id: 'deco_scorch1', pos: { x: 6, y: 9 }, spriteId: 'scorch', walkable: true, line: 'Scorch marks and a scatter of tiny darts. Something in these walls still works.' },
    { kind: 'item', id: 'treat_temple1', pos: { x: 1, y: 11 }, itemId: 'fish_treat', heals: 1 },
  ],
  buried: {
    '4,3': { itemId: 'fragment_bronze_handle' },
    '3,7': { itemId: 'shiny_ring' },
  },
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'meadow', spawn: { x: 7, y: 11 }, spawnFacing: 'up' },
    { at: { x: 7, y: 12 }, toMap: 'temple2', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

const temple2 = buildMap({
  id: 'temple2',
  name: 'Forgotten Temple — Puzzle Chamber',
  region: 'temple',
  rows: [
    '#######>########',
    '#####..........#',
    '#####..........#',
    '#####..........#',
    '#....#.........#',
    '#....^..P......#',
    '#....#.........#',
    '#####..........#',
    '##s#...P.......#',
    '##.g...........#',
    '#####..........#',
    '#####..........#',
    '#######>########',
  ],
  entities: [
    { kind: 'block', id: 'block_1', pos: { x: 6, y: 5 } },
    { kind: 'trap', id: 'trap_dart1', pos: { x: 15, y: 5 }, trapType: 'dart', triggerPlate: { x: 8, y: 5 }, detectable: true },
    { kind: 'trap', id: 'trap_dart2', pos: { x: 15, y: 8 }, trapType: 'dart', triggerPlate: { x: 7, y: 8 }, detectable: true },
    { kind: 'decoration', id: 'deco_scorch2', pos: { x: 9, y: 8 }, spriteId: 'scorch', walkable: true, line: 'More scorch marks. The obvious way through is the dangerous one.' },
    { kind: 'switch', id: 'switch_shortcut', pos: { x: 2, y: 5 }, setsFlag: 'sanctumUnlockedByShortcut' },
    { kind: 'item', id: 'item_coin', pos: { x: 2, y: 8 }, itemId: 'shiny_coin' },
    {
      kind: 'door',
      id: 'door_sanctum',
      pos: { x: 7, y: 12 },
      requiresArtifact: 'key_bronze',
      opensOnFlag: 'sanctumUnlockedByShortcut',
      lockedMessage: 'The bronze fittings hum faintly. This door wants its key — or another way in.',
    },
  ],
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'temple1', spawn: { x: 7, y: 11 }, spawnFacing: 'up' },
    { at: { x: 7, y: 12 }, toMap: 'temple3', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

const temple3 = buildMap({
  id: 'temple3',
  name: 'Forgotten Temple — Inner Sanctum',
  region: 'temple',
  rows: [
    '#######>########',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#...D..........#',
    '#..............#',
    '################',
  ],
  entities: [
    { kind: 'decoration', id: 'deco_pedestal', pos: { x: 7, y: 6 }, spriteId: 'pedestal', clueId: 'clue_inscription', line: 'A worn stone pedestal.' },
    { kind: 'item', id: 'item_idol', pos: { x: 7, y: 5 }, itemId: 'idol_sunstone' },
    { kind: 'clueNote', id: 'note_field2', pos: { x: 4, y: 6 }, clueId: 'clue_field_notes_2' },
    { kind: 'decoration', id: 'deco_mural', pos: { x: 3, y: 2 }, spriteId: 'mural', clueId: 'clue_mural_cats', line: 'A faded mural.' },
    { kind: 'decoration', id: 'deco_brazier_l', pos: { x: 5, y: 3 }, spriteId: 'brazier', line: 'A cold brazier.' },
    { kind: 'decoration', id: 'deco_brazier_r', pos: { x: 9, y: 3 }, spriteId: 'brazier', line: 'A cold brazier.' },
  ],
  buried: { '4,9': { itemId: 'shiny_tooth' } },
  exits: [{ at: { x: 7, y: 0 }, toMap: 'temple2', spawn: { x: 7, y: 11 }, spawnFacing: 'up' }],
  defaultSpawn: { x: 7, y: 1 },
});

// ── Chapter II: The Sunken Crypt ───────────────────────────────────────────
const crypt1 = buildMap({
  id: 'crypt1',
  name: 'Sunken Crypt — The Stairs',
  region: 'crypt',
  dark: true,
  chapter: { number: 'Chapter II', title: 'The Sunken Crypt' },
  rows: [
    '#######>########',
    '#......:.......#',
    '#.####.:.####..#',
    '#.#....:....#..#',
    '#.#.P..:..P.#..#',
    '#.#....:....#.D#',
    '#......P.......#',
    '###.######.#####',
    '#......#.......#',
    '#.D....#.......#',
    '#..............#',
    '#..............#',
    '#######>########',
  ],
  entities: [
    {
      kind: 'npc',
      id: 'npc_bat',
      pos: { x: 12, y: 9 },
      name: 'Pip the Bat',
      sprite: 'bat',
      lines: [
        'Squeak! A CAT! …A cat with a LIGHT. Oh, that\'s actually lovely.',
        'The tall one with the hat? Oh, he came down here once. Years and years ago.',
        'His lamp kept going out. He bumped into EVERYTHING. Very funny. Squeak.',
        'Mind the loose floor stones. Rocks come down. Bonk.',
      ],
    },
    { kind: 'trap', id: 'rock_a', pos: { x: 4, y: 4 }, trapType: 'fallingRock', triggerPlate: { x: 4, y: 4 }, detectable: true },
    { kind: 'trap', id: 'rock_b', pos: { x: 10, y: 4 }, trapType: 'fallingRock', triggerPlate: { x: 10, y: 4 }, detectable: true },
    { kind: 'trap', id: 'rock_c', pos: { x: 7, y: 6 }, trapType: 'fallingRock', triggerPlate: { x: 7, y: 6 }, detectable: true },
    { kind: 'decoration', id: 'deco_bones', pos: { x: 13, y: 3 }, spriteId: 'bones', walkable: true, line: 'Old fish bones. Someone has been snacking down here. Pip, probably.' },
    { kind: 'item', id: 'treat_crypt1', pos: { x: 1, y: 11 }, itemId: 'fish_treat', heals: 1 },
  ],
  buried: {
    '14,5': { itemId: 'moon_crescent' },
    '2,9': { itemId: 'shiny_earring' },
  },
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'well', spawn: { x: 8, y: 6 }, spawnFacing: 'down' },
    { at: { x: 7, y: 12 }, toMap: 'crypt2', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

const crypt2 = buildMap({
  id: 'crypt2',
  name: 'Sunken Crypt — Flooded Gallery',
  region: 'crypt',
  dark: true,
  rows: [
    '#######>########',
    '#......:.......#',
    '#.~~~~~:~~~~~..#',
    '#.~~~~~:~~~~~..#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..P.......P...#',
    '#..............#',
    '#######.########',
    '#s.g...........#',
    '###............#',
    '#######>########',
  ],
  entities: [
    { kind: 'block', id: 'block_west', pos: { x: 3, y: 5 } },
    { kind: 'block', id: 'block_east', pos: { x: 11, y: 5 } },
    {
      kind: 'door',
      id: 'door_gallery',
      pos: { x: 7, y: 9 },
      opensWhenBlocksOn: [
        { x: 3, y: 7 },
        { x: 11, y: 7 },
      ],
      lockedMessage: 'A heavy stone door. Two worn plates flank the hall — and two heavy blocks sit nearby, doing nothing useful.',
    },
    { kind: 'item', id: 'item_moon_face', pos: { x: 2, y: 10 }, itemId: 'moon_face' },
    { kind: 'item', id: 'item_watch', pos: { x: 1, y: 10 }, itemId: 'shiny_watch' },
    { kind: 'clueNote', id: 'note_field4', pos: { x: 13, y: 11 }, clueId: 'clue_field_notes_4' },
  ],
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'crypt1', spawn: { x: 7, y: 11 }, spawnFacing: 'up' },
    { at: { x: 7, y: 12 }, toMap: 'crypt3', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

const crypt3 = buildMap({
  id: 'crypt3',
  name: 'Sunken Crypt — Hall of Echoes',
  region: 'crypt',
  dark: true,
  rows: [
    '#######>########',
    '#..............#',
    '#.D..D....D..D.#',
    '#..............#',
    '#...##....##...#',
    '#...##....##...#',
    '#.D..........D.#',
    '#.....P..P.....#',
    '#..D.......D...#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#######>########',
  ],
  entities: [
    { kind: 'decoration', id: 'deco_echo', pos: { x: 7, y: 4 }, spriteId: 'carving', clueId: 'clue_echo', line: 'Carvings, everywhere.' },
    { kind: 'trap', id: 'rock_d', pos: { x: 6, y: 7 }, trapType: 'fallingRock', triggerPlate: { x: 6, y: 7 }, detectable: true },
    { kind: 'trap', id: 'rock_e', pos: { x: 9, y: 7 }, trapType: 'fallingRock', triggerPlate: { x: 9, y: 7 }, detectable: true },
    { kind: 'item', id: 'treat_crypt3', pos: { x: 14, y: 11 }, itemId: 'fish_treat', heals: 1 },
    {
      kind: 'door',
      id: 'door_moon',
      pos: { x: 7, y: 12 },
      requiresArtifact: 'moon_seal',
      lockedMessage: 'A round stone door with a moon-shaped socket. It wants the whole moon, not a piece of one.',
    },
  ],
  buried: {
    '10,2': { itemId: 'moon_rim' },
    '3,8': { itemId: 'shiny_glasseye' },
  },
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'crypt2', spawn: { x: 7, y: 11 }, spawnFacing: 'up' },
    { at: { x: 7, y: 12 }, toMap: 'passage', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

const passage = buildMap({
  id: 'passage',
  name: 'The Last Passage',
  region: 'crypt',
  dark: true,
  rows: [
    '#######>########',
    '#..............#',
    '#..............#',
    '#..............#',
    '#######g########',
    '#######.########',
    '#######>########',
  ],
  entities: [
    { kind: 'clueNote', id: 'note_field5', pos: { x: 5, y: 3 }, clueId: 'clue_field_notes_5' },
    { kind: 'decoration', id: 'deco_hat', pos: { x: 10, y: 3 }, spriteId: 'hat', clueId: 'clue_dusty_hat', line: 'A battered hat.' },
    { kind: 'decoration', id: 'deco_lantern', pos: { x: 3, y: 1 }, spriteId: 'lantern', line: "A burnt-out lantern. Scratched into its base: 'A.'" },
  ],
  exits: [
    { at: { x: 7, y: 0 }, toMap: 'crypt3', spawn: { x: 7, y: 11 }, spawnFacing: 'up' },
    { at: { x: 7, y: 6 }, toMap: 'vault', spawn: { x: 7, y: 1 }, spawnFacing: 'down' },
  ],
  defaultSpawn: { x: 7, y: 1 },
});

// ── Chapter III: The Hollow ────────────────────────────────────────────────
const vault = buildMap({
  id: 'vault',
  name: 'The Hollow',
  region: 'vault',
  chapter: { number: 'Chapter III', title: 'The Hollow' },
  rows: [
    '#######>########',
    '#..............#',
    '#.#..........#.#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#.#..........#.#',
    '#..............#',
    '#..............#',
    '################',
  ],
  entities: [
    { kind: 'decoration', id: 'deco_mural_l', pos: { x: 1, y: 5 }, spriteId: 'catMural', clueId: 'clue_keepers_1', line: 'A mural of cats.' },
    { kind: 'decoration', id: 'deco_mural_r', pos: { x: 14, y: 5 }, spriteId: 'catMural', clueId: 'clue_keepers_2', line: 'The final mural.' },
    { kind: 'item', id: 'item_bell', pos: { x: 7, y: 3 }, itemId: 'keepers_bell' },
    {
      kind: 'decoration',
      id: 'deco_hollow',
      pos: { x: 7, y: 7 },
      spriteId: 'hollow',
      line: 'In a single warm beam of light sits a smooth hollow in the stone — exactly cat-shaped. CK has never been so sure of anything. CK curls up. Just for a minute…',
      setsFlag: 'napTaken',
      warpTo: { mapId: 'home', pos: { x: 12, y: 8 }, facing: 'left' },
      afterLine: 'The perfect nap spot.',
    },
  ],
  exits: [{ at: { x: 7, y: 0 }, toMap: 'passage', spawn: { x: 7, y: 5 }, spawnFacing: 'up' }],
  defaultSpawn: { x: 7, y: 1 },
});

export const MAPS: Record<string, GameMap> = { home, meadow, well, temple1, temple2, temple3, crypt1, crypt2, crypt3, passage, vault };
