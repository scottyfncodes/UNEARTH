import { describe, expect, it } from 'vitest';
import { getLocation } from '@/content/locations';
import { getTarget } from '@/content/targets';
import { getTool } from '@/content/equipment';
import {
  applyTool,
  canExtract,
  computeExposure,
  createExcavation,
  drainEvents,
  extract,
  heatAt,
  pitCleared,
  type ExcavationState,
} from '@/systems/excavation';

const park = getLocation('loc_old_park')!;
const coin = getTarget('tgt_silver_coin')!;
const locket = getTarget('tgt_locket')!; // fragile
const scoop = getTool('tool_scoop')!;
const brush = getTool('tool_brush')!;
const pick = getTool('tool_pick')!;

function pit(overrides: Partial<Parameters<typeof createExcavation>[0]> = {}): ExcavationState {
  return createExcavation({
    def: coin,
    location: park,
    accuracy: 1,
    offsetAngle: 0,
    baseCondition: 100,
    seed: 'seed-1',
    ...overrides,
  });
}

/**
 * Approximates a continuous drag: the tool is applied on a grid finer than its
 * own radius, so every cell actually gets worked, the way a finger would.
 */
function work(state: ExcavationState, tool = brush, passes = 30, now = 0, step = 0.025): number {
  return workRegion(state, tool, passes, { x0: 0, x1: 1, y0: 0, y1: 1 }, now, step);
}

function workRegion(
  state: ExcavationState,
  tool: typeof brush,
  passes: number,
  box: { x0: number; x1: number; y0: number; y1: number },
  now = 0,
  step = 0.025,
): number {
  let time = now;
  let damage = 0;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = box.y0; y <= box.y1; y += step) {
      for (let x = box.x0; x <= box.x1; x += step) {
        time += 20;
        damage += applyTool(state, tool, x, y, 0.03, time).damage;
      }
    }
  }
  return damage;
}

/**
 * Simulates an attentive player: scoop out the bulk, and the moment the tool
 * reports touching something, put the scoop down and finish with the brush —
 * exactly what the game's own feedback tells you to do.
 */
function excavateProperly(state: ExcavationState): { contacts: number } {
  const step = 0.03;
  let time = 0;
  let contacts = 0;
  outer: for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y <= 1; y += step) {
      for (let x = 0; x <= 1; x += step) {
        time += 20;
        const result = applyTool(state, scoop, x, y, 0.03, time);
        if (result.contact) {
          contacts++;
          if (contacts >= 3) break outer;
        }
      }
    }
  }
  work(state, brush, 6, time + 2000);
  return { contacts };
}

describe('pit setup', () => {
  it('places the object in the pit when the dig was accurate', () => {
    const state = pit();
    expect(state.hasObject).toBe(true);
    expect(state.maskCount).toBeGreaterThan(20);
    expect(state.centerX).toBeCloseTo(0.5, 1);
  });

  it('offsets the object when the dig was sloppy', () => {
    const state = pit({ accuracy: 0.15, offsetAngle: 0 });
    expect(state.hasObject).toBe(true);
    expect(state.centerX).toBeGreaterThan(0.6);
  });

  it('creates an honestly empty hole when the dig missed', () => {
    const state = pit({ accuracy: 0 });
    expect(state.hasObject).toBe(false);
    expect(state.maskCount).toBe(0);
    expect(canExtract(state)).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const a = pit({ seed: 'same' });
    const b = pit({ seed: 'same' });
    expect([...a.dirt]).toEqual([...b.dirt]);
    expect([...a.debris]).toEqual([...b.debris]);
  });

  it('starts with the pit full of dirt and nothing exposed', () => {
    const state = pit();
    expect(state.exposed).toBe(0);
    expect(pitCleared(state)).toBeLessThan(0.05);
    expect([...state.dirt].every((v) => v > 0.1)).toBe(true);
  });

  it('packs harder ground for a difficult target', () => {
    const easy = pit({ def: getTarget('tgt_bottle_cap')! });
    const hard = pit({ def: getTarget('tgt_mechanism_part')!, location: getLocation('loc_abandoned_mine')! });
    expect(hard.hardness).toBeGreaterThan(easy.hardness);
  });
});

describe('tools', () => {
  it('removes dirt where the tool is applied and nowhere else', () => {
    const state = pit();
    const before = [...state.dirt];
    applyTool(state, scoop, 0.2, 0.2, 0.04, 100);
    let changed = 0;
    let untouchedFar = true;
    for (let j = 0; j < state.rows; j++) {
      for (let i = 0; i < state.cols; i++) {
        const idx = j * state.cols + i;
        if (state.dirt[idx]! !== before[idx]!) changed++;
        if (i > state.cols * 0.7 && state.dirt[idx]! !== before[idx]!) untouchedFar = false;
      }
    }
    expect(changed).toBeGreaterThan(0);
    expect(untouchedFar).toBe(true);
  });

  it('a scoop shifts dirt faster than a brush', () => {
    const a = pit();
    const b = pit();
    for (let i = 0; i < 10; i++) {
      applyTool(a, scoop, 0.5, 0.5, 0.03, i * 20);
      applyTool(b, brush, 0.5, 0.5, 0.03, i * 20);
    }
    expect(a.totalRemoved).toBeGreaterThan(b.totalRemoved);
  });

  it('a brush barely touches debris; a pick chews straight through it', () => {
    const mine = getLocation('loc_abandoned_mine')!;
    const fragment = getTarget('tgt_stone_fragment')!;
    // Find a cell that actually has debris on it in this seeded pit.
    const probe = pit({ def: fragment, location: mine, seed: 'debris' });
    let spot: { x: number; y: number } | null = null;
    for (let j = 0; j < probe.rows && !spot; j++) {
      for (let i = 0; i < probe.cols && !spot; i++) {
        if (probe.debris[j * probe.cols + i]! > 0.5) {
          spot = { x: (i + 0.5) / probe.cols, y: (j + 0.5) / probe.rows };
        }
      }
    }
    expect(spot).not.toBeNull();

    const withBrush = pit({ def: fragment, location: mine, seed: 'debris' });
    const withPick = pit({ def: fragment, location: mine, seed: 'debris' });
    const idx = Math.floor(spot!.y * probe.rows) * probe.cols + Math.floor(spot!.x * probe.cols);
    for (let i = 0; i < 12; i++) {
      applyTool(withBrush, brush, spot!.x, spot!.y, 0.03, i * 20);
      applyTool(withPick, pick, spot!.x, spot!.y, 0.03, i * 20);
    }
    expect(withPick.debris[idx]!).toBeLessThan(0.05);
    expect(withBrush.debris[idx]!).toBeGreaterThan(withPick.debris[idx]!);
  });
});

describe('uncovering and damage', () => {
  it('uncovers the object and eventually allows extraction', () => {
    const state = pit();
    expect(canExtract(state)).toBe(false);
    excavateProperly(state);
    expect(state.exposed).toBeGreaterThan(0.7);
    expect(canExtract(state)).toBe(true);
    expect(computeExposure(state)).toBeCloseTo(state.exposed, 5);
  });

  it('a brush does almost no damage over a long, careful dig', () => {
    const state = pit({ def: locket }); // the most fragile thing in the game
    // Roughly two minutes of continuous brushing at 20ms per contact tick.
    const damage = work(state, brush, 3);
    expect(state.exposed).toBeGreaterThan(0.7);
    expect(damage).toBeLessThan(10);
    expect(state.condition).toBeGreaterThan(90);
    expect(state.strikes).toBe(0);
  });

  it('rewards a player who stops scooping the moment they feel contact', () => {
    const state = pit();
    excavateProperly(state);
    expect(state.exposed).toBeGreaterThan(0.7);
    expect(state.condition).toBeGreaterThan(85);
  });

  it('a scoop over an exposed artifact damages it', () => {
    const state = pit();
    excavateProperly(state);
    const before = state.condition;
    work(state, scoop, 6, 300_000);
    expect(state.condition).toBeLessThan(before);
    expect(state.strikes).toBeGreaterThan(0);
  });

  it('damages fragile artifacts more than robust ones', () => {
    const sturdy = pit({ def: getTarget('tgt_nail')! }); // fragility 0
    const fragile = pit({ def: locket }); // fragility 0.75
    // Uncover both safely, then give each the same short, careless scoop.
    work(sturdy, brush, 3);
    work(fragile, brush, 3);
    const sturdyBefore = sturdy.condition;
    const fragileBefore = fragile.condition;
    for (let i = 0; i < 12; i++) {
      applyTool(sturdy, scoop, sturdy.centerX, sturdy.centerY, 0.03, 500_000 + i * 150);
      applyTool(fragile, scoop, fragile.centerX, fragile.centerY, 0.03, 500_000 + i * 150);
    }
    const sturdyLoss = sturdyBefore - sturdy.condition;
    const fragileLoss = fragileBefore - fragile.condition;
    expect(fragileLoss).toBeGreaterThan(sturdyLoss * 2);
    // The brief's shape: a handful of careless contacts, not instant ruin.
    expect(sturdyLoss).toBeLessThan(25);
  });

  it('never drives condition below the floor', () => {
    const state = pit({ def: locket });
    excavateProperly(state);
    work(state, pick, 40, 400_000);
    expect(state.condition).toBeGreaterThanOrEqual(4);
  });

  it('carries the pre-dig condition through', () => {
    const state = pit({ baseCondition: 62 });
    expect(state.condition).toBe(62);
    excavateProperly(state);
    expect(state.condition).toBeLessThanOrEqual(62);
    expect(state.condition).toBeGreaterThan(52);
  });

  it('emits events the presentation layer can react to', () => {
    const state = pit();
    applyTool(state, scoop, 0.5, 0.5, 0.04, 10);
    const events = drainEvents(state);
    expect(events.length).toBeGreaterThan(0);
    expect(drainEvents(state)).toHaveLength(0);
  });
});

describe('extraction', () => {
  it('returns a rounded condition and locks the pit', () => {
    const state = pit();
    excavateProperly(state);
    const condition = extract(state);
    expect(state.extracted).toBe(true);
    expect(condition).toBe(Math.round(state.condition));
    expect(canExtract(state)).toBe(false);
    // No further changes once it is out of the ground.
    const result = applyTool(state, scoop, 0.5, 0.5, 0.05, 999_999);
    expect(result.removed).toBe(0);
  });

  it('penalises lifting something that is still half buried', () => {
    // Same tool, same care — the only difference is how much was uncovered.
    const clean = pit({ def: locket });
    work(clean, brush, 3);
    const cleanBefore = clean.condition;
    const cleanDrop = cleanBefore - extract(clean);

    const rushed = pit({ def: locket });
    workRegion(rushed, brush, 3, { x0: 0, x1: 0.5, y0: 0, y1: 0.5 });
    const rushedBefore = rushed.condition;
    const rushedDrop = rushedBefore - extract(rushed);

    expect(rushed.exposed).toBeLessThan(clean.exposed);
    expect(rushedDrop).toBeGreaterThan(cleanDrop);
  });

  it('reports pinpointer heat that peaks over the object', () => {
    const state = pit({ accuracy: 1 });
    expect(heatAt(state, state.centerX, state.centerY)).toBeCloseTo(1, 2);
    expect(heatAt(state, 0.02, 0.02)).toBeLessThan(0.2);
    expect(heatAt(pit({ accuracy: 0 }), 0.5, 0.5)).toBe(0);
  });

  it('reports how much of an empty pit has been cleared', () => {
    const state = pit({ accuracy: 0 });
    expect(pitCleared(state)).toBeLessThan(0.05);
    work(state, scoop, 3);
    expect(pitCleared(state)).toBeGreaterThan(0.5);
  });
});
