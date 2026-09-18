/**
 * Fragments are inert until CK is carrying every piece a recipe calls for —
 * then they assemble into the artifact that actually opens something. This
 * is the discover → understand → assemble → unlock beat of the core loop.
 */
export interface ArtifactRecipe {
  id: string;
  name: string;
  /** Fragment item ids consumed when this artifact assembles. */
  requires: string[];
}

export interface AssemblyResult {
  artifactId: string;
  consumed: string[];
}

/** Returns the first recipe satisfied by `inventory` that isn't already owned, or null. */
export function findAssembly(inventory: string[], recipes: readonly ArtifactRecipe[]): AssemblyResult | null {
  for (const recipe of recipes) {
    if (inventory.includes(recipe.id)) continue;
    if (recipe.requires.every((fragmentId) => inventory.includes(fragmentId))) {
      return { artifactId: recipe.id, consumed: recipe.requires };
    }
  }
  return null;
}
