import { describe, expect, it } from 'vitest';
import { getDetector } from '@/content/equipment';
import { getTarget } from '@/content/targets';
import {
  beepInterval,
  digTolerance,
  readout,
  sampleField,
  targetSignal,
  toneOf,
} from '@/systems/detection';
import type { FieldState, PlacedTarget } from '@/core/types';

const detector = getDetector('det_starter');
const coinDef = getTarget('tgt_silver_coin')!;

function placed(overrides: Partial<PlacedTarget> = {}): PlacedTarget {
  return {
    uid: 'u1',
    targetId: 'tgt_silver_coin',
    x: 0,
    y: 0,
    depth: 12,
    baseCondition: 90,
    dug: false,
    ...overrides,
  };
}

function field(targets: PlacedTarget[]): FieldState {
  return {
    locationId: 'loc_old_park',
    seed: 1,
    targets,
    playerX: 0,
    playerY: 0,
    holes: [],
    startedAt: 0,
  };
}

describe('signal strength', () => {
  it('gets stronger as the coil approaches the target', () => {
    const target = placed();
    const readings = [200, 150, 100, 60, 30, 0].map((d) =>
      targetSignal(d, 0, target, coinDef, detector),
    );
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]!).toBeGreaterThan(readings[i - 1]!);
    }
    expect(readings.at(-1)!).toBeGreaterThan(0.5);
  });

  it('is weaker for a deeper target at the same lateral distance', () => {
    const shallow = targetSignal(0, 0, placed({ depth: 8 }), coinDef, detector);
    const deep = targetSignal(0, 0, placed({ depth: 26 }), coinDef, detector);
    expect(deep).toBeLessThan(shallow);
  });

  it('collapses past the detector depth capacity', () => {
    const atCapacity = targetSignal(0, 0, placed({ depth: detector.depthCapacity }), coinDef, detector);
    const wayPast = targetSignal(0, 0, placed({ depth: detector.depthCapacity * 2 }), coinDef, detector);
    expect(wayPast).toBeLessThan(atCapacity * 0.4);
  });

  it('reads bigger objects from further away', () => {
    const small = getTarget('tgt_pull_tab')!;
    const large = getTarget('tgt_horseshoe')!;
    const atDistance = 90;
    const smallSignal = targetSignal(atDistance, 0, placed({ depth: 10 }), small, detector);
    const largeSignal = targetSignal(atDistance, 0, placed({ depth: 10 }), large, detector);
    expect(largeSignal).toBeGreaterThan(smallSignal);
  });

  it('a better detector reaches deeper than the starter', () => {
    const advanced = getDetector('det_advanced');
    const deep = placed({ depth: 36 });
    expect(targetSignal(0, 0, deep, coinDef, advanced)).toBeGreaterThan(
      targetSignal(0, 0, deep, coinDef, detector) * 2,
    );
  });
});

describe('sampleField', () => {
  it('reports nothing when the field is empty', () => {
    const sample = sampleField(field([]), 0, 0, detector, 1);
    expect(sample.dominant).toBeNull();
    expect(sample.strength).toBe(0);
  });

  it('ignores targets that have already been dug', () => {
    const sample = sampleField(field([placed({ dug: true })]), 0, 0, detector, 1);
    expect(sample.dominant).toBeNull();
  });

  it('picks the nearest of several targets as dominant', () => {
    const near = placed({ uid: 'near', x: 10, y: 0 });
    const far = placed({ uid: 'far', x: 260, y: 0 });
    const sample = sampleField(field([far, near]), 0, 0, detector, 1);
    expect(sample.dominant?.target.uid).toBe('near');
    expect(sample.contributions.length).toBeGreaterThanOrEqual(1);
  });

  it('flags a masked reading when two targets overlap', () => {
    const a = placed({ uid: 'a', x: 0, y: 0, depth: 16 });
    const b = placed({ uid: 'b', x: 70, y: 0, depth: 16 });
    const sample = sampleField(field([a, b]), 35, 0, detector, 1);
    expect(sample.masked).toBe(true);
    expect(sample.strength).toBeGreaterThan(sample.dominant!.strength);
  });

  it('a target can be missed entirely if you walk wide of it', () => {
    const sample = sampleField(field([placed({ x: 400, y: 400 })]), 0, 0, detector, 1);
    expect(sample.strength).toBeLessThan(0.02);
  });

  it('adds noise that stays within bounds', () => {
    const f = field([placed({ x: 40 })]);
    for (let t = 0; t < 60; t++) {
      const sample = sampleField(f, 0, 0, detector, t * 0.1);
      expect(sample.noisy).toBeGreaterThanOrEqual(0);
      expect(sample.noisy).toBeLessThanOrEqual(1);
    }
  });

  it('is steadier while pinpointing', () => {
    const f = field([placed({ x: 30 })]);
    let freeSpread = 0;
    let pinSpread = 0;
    for (let t = 0; t < 80; t++) {
      const time = t * 0.05;
      freeSpread += Math.abs(sampleField(f, 0, 0, detector, time).noisy - sampleField(f, 0, 0, detector, time).strength);
      pinSpread += Math.abs(
        sampleField(f, 0, 0, detector, time, { pinpointing: true }).noisy -
          sampleField(f, 0, 0, detector, time, { pinpointing: true }).strength,
      );
    }
    expect(pinSpread).toBeLessThan(freeSpread);
  });
});

describe('readout', () => {
  it('is stable for the same target and detector', () => {
    const sample = sampleField(field([placed({ x: 5 })]), 0, 0, detector, 1);
    const a = readout(sample.dominant!, detector, 0.8);
    const b = readout(sample.dominant!, detector, 0.8);
    expect(a.material).toBe(b.material);
    expect(a.depthLabel).toBe(b.depthLabel);
  });

  it('a high-discrimination detector identifies material more often', () => {
    const cheap = getDetector('det_starter');
    const good = getDetector('det_advanced');
    let cheapHits = 0;
    let goodHits = 0;
    for (let i = 0; i < 60; i++) {
      const sample = sampleField(field([placed({ uid: `u${i}`, x: 5 })]), 0, 0, cheap, 1);
      if (readout(sample.dominant!, cheap, 0.9).material === coinDef.material) cheapHits++;
      const sample2 = sampleField(field([placed({ uid: `u${i}`, x: 5 })]), 0, 0, good, 1);
      if (readout(sample2.dominant!, good, 0.9).material === coinDef.material) goodHits++;
    }
    expect(goodHits).toBeGreaterThan(cheapHits);
  });

  it('never claims to identify an unknown alloy on a cheap detector', () => {
    const sample = sampleField(
      field([placed({ targetId: 'tgt_mechanism_part', x: 4, depth: 14 })]),
      0,
      0,
      detector,
      1,
    );
    expect(readout(sample.dominant!, detector, 0.9).material).toBe('unknown');
  });
});

describe('feedback mapping', () => {
  it('beeps faster as the signal gets stronger', () => {
    expect(beepInterval(0.9)).toBeLessThan(beepInterval(0.5));
    expect(beepInterval(0.5)).toBeLessThan(beepInterval(0.15));
    expect(beepInterval(0.01)).toBe(Infinity);
  });

  it('maps materials onto distinct tone families', () => {
    expect(toneOf('ferrous')).toBe('iron');
    expect(toneOf('silver')).toBe('high');
    expect(toneOf('unknown')).toBe('odd');
  });

  it('gives a workable dig tolerance that shrinks with a tighter coil', () => {
    const wide = digTolerance(coinDef, getDetector('det_deep'));
    const tight = digTolerance(coinDef, getDetector('det_precision'));
    expect(tight).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(15);
  });
});
