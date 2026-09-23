import type { ArtifactRecipe } from '@/game/artifacts';

export const RECIPES: ArtifactRecipe[] = [
  {
    id: 'key_bronze',
    name: 'Ancient Bronze Key',
    requires: ['fragment_bronze_handle', 'fragment_bronze_blade'],
  },
  {
    id: 'moon_seal',
    name: 'The Moon Seal',
    requires: ['moon_crescent', 'moon_face', 'moon_rim'],
  },
];
