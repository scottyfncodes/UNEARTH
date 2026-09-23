import type { GameMap } from '@/game/types';

export interface RegionPalette {
  floor: string;
  floorAccent: string;
  wall: string;
  wallTop: string;
  water: string;
  diggable: string;
  diggableSpeck: string;
  catGap: string;
  plate: string;
  hazard: string;
  exit: string;
  bg: string;
}

/** Each region gets its own palette so no two areas of the world read the same. */
export const PALETTES: Record<GameMap['region'], RegionPalette> = {
  home: {
    floor: '#8a5a3c',
    floorAccent: '#7a4d32',
    wall: '#4a3122',
    wallTop: '#6b4630',
    water: '#3d6b8a',
    diggable: '#5c3d28',
    diggableSpeck: '#77543a',
    catGap: '#2c1c14',
    plate: '#b08858',
    hazard: '#241612',
    exit: '#2c1c14',
    bg: '#1c130d',
  },
  meadow: {
    floor: '#5f9a45',
    floorAccent: '#548c3c',
    wall: '#2f5a2a',
    wallTop: '#447a36',
    water: '#3a7ea6',
    diggable: '#6b4a2e',
    diggableSpeck: '#84603f',
    catGap: '#1f3a1c',
    plate: '#7fae52',
    hazard: '#1c3018',
    exit: '#c9b27a',
    bg: '#152b13',
  },
  well: {
    floor: '#7c8a5a',
    floorAccent: '#6f7d50',
    wall: '#4a4e44',
    wallTop: '#61665a',
    water: '#2f6f7a',
    diggable: '#6b4a2e',
    diggableSpeck: '#84603f',
    catGap: '#26291f',
    plate: '#8e9a6a',
    hazard: '#1b1e17',
    exit: '#0b0d0a',
    bg: '#15180f',
  },
  temple: {
    floor: '#5c6470',
    floorAccent: '#525a65',
    wall: '#33383f',
    wallTop: '#454c55',
    water: '#2f6f7a',
    diggable: '#6e5a3c',
    diggableSpeck: '#83704e',
    catGap: '#20242a',
    plate: '#7a8a8e',
    hazard: '#1b1e22',
    exit: '#20242a',
    bg: '#111317',
  },
  crypt: {
    floor: '#3f4a5c',
    floorAccent: '#37414f',
    wall: '#1f2530',
    wallTop: '#2e3645',
    water: '#1f4e63',
    diggable: '#4d4234',
    diggableSpeck: '#62553f',
    catGap: '#10141b',
    plate: '#5b6a80',
    hazard: '#0b0e13',
    exit: '#0b0e13',
    bg: '#07090d',
  },
  vault: {
    floor: '#b8904f',
    floorAccent: '#a88043',
    wall: '#5c4424',
    wallTop: '#7a5b31',
    water: '#3a7ea6',
    diggable: '#6b4a2e',
    diggableSpeck: '#84603f',
    catGap: '#2e2112',
    plate: '#d0a860',
    hazard: '#2e2112',
    exit: '#3a2a16',
    bg: '#1e160b',
  },
};

export const ACCENT = {
  gold: '#d9a441',
  cream: '#e9e2d0',
  danger: '#c0392b',
  good: '#7fbf6a',
  ink: '#0e1210',
};
