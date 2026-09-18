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
  outskirts: {
    floor: '#4f8a3f',
    floorAccent: '#457c37',
    wall: '#2d4f28',
    wallTop: '#3c6633',
    water: '#3a7ea6',
    diggable: '#6b4a2e',
    diggableSpeck: '#84603f',
    catGap: '#243d20',
    plate: '#7fae52',
    hazard: '#1c3018',
    exit: '#243d20',
    bg: '#152b13',
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
};

export const ACCENT = {
  gold: '#d9a441',
  cream: '#e9e2d0',
  danger: '#c0392b',
  good: '#7fbf6a',
  ink: '#0e1210',
};
