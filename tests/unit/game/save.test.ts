import { beforeAll, describe, expect, it } from 'vitest';
import { clearSave, deserialize, loadGame, saveGame, serialize } from '@/game/save';
import { baseState } from './fixtures';

/** The vitest "node" environment may not provide localStorage — a tiny in-memory stand-in. */
function installMemoryStorage(): void {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  };
}

beforeAll(() => installMemoryStorage());

describe('save/load', () => {
  it('round-trips through serialize/deserialize', () => {
    const state = baseState({ inventory: ['fragA'], clues: ['clueA'], flags: { metGuide: true }, hearts: 2 });
    const restored = deserialize(serialize(state), baseState());
    expect(restored.inventory).toEqual(['fragA']);
    expect(restored.clues).toEqual(['clueA']);
    expect(restored.flags).toEqual({ metGuide: true });
    expect(restored.hearts).toBe(2);
    expect(restored.dialogue).toBeNull();
  });

  it('falls back cleanly on corrupt save data', () => {
    const fallback = baseState();
    expect(deserialize('{not valid json', fallback)).toBe(fallback);
  });

  it('does not persist an in-progress dialogue', () => {
    const state = baseState({ dialogue: { npcId: 'npc1', lines: ['hi'], index: 0 } });
    const restored = deserialize(serialize(state), baseState());
    expect(restored.dialogue).toBeNull();
  });

  it('saveGame/loadGame round-trip through localStorage', () => {
    const state = baseState({ inventory: ['idol_sunstone'] });
    saveGame(state);
    const loaded = loadGame(baseState());
    expect(loaded.inventory).toEqual(['idol_sunstone']);
    clearSave();
    expect(loadGame(baseState()).inventory).toEqual([]);
  });
});
