import { describe, expect, it } from 'vitest';
import { findAssembly } from '@/game/artifacts';
import { RECIPES } from './fixtures';

describe('findAssembly', () => {
  it('returns null when fragments are incomplete', () => {
    expect(findAssembly(['fragA'], RECIPES)).toBeNull();
  });

  it('assembles once every required fragment is present', () => {
    const result = findAssembly(['fragA', 'fragB'], RECIPES);
    expect(result).toEqual({ artifactId: 'key1', consumed: ['fragA', 'fragB'] });
  });

  it('ignores extra unrelated inventory', () => {
    const result = findAssembly(['trinket', 'fragA', 'fragB', 'other'], RECIPES);
    expect(result?.artifactId).toBe('key1');
  });

  it('does not re-assemble an artifact already owned', () => {
    expect(findAssembly(['fragA', 'fragB', 'key1'], RECIPES)).toBeNull();
  });
});
