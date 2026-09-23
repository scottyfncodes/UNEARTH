import { describe, expect, it } from 'vitest';
import { computeDetectorReading, DETECTOR_RADIUS } from '@/game/detector';
import { buildMap } from '@/game/mapBuilder';
import { CTX, baseState } from './fixtures';

describe('computeDetectorReading', () => {
  it('reports a buried reading when a fragment is the nearest source', () => {
    const state = baseState({ player: { pos: { x: 3, y: 1 }, facing: 'right' } });
    const reading = computeDetectorReading(CTX.maps.room1!, state);
    expect(reading.kind).toBe('buried');
    expect(reading.distance).toBe(1);
    expect(reading.strength).toBeGreaterThan(0);
  });

  it('reports a mechanism reading when a detectable trap is closer than any buried item', () => {
    const state = baseState({ player: { pos: { x: 5, y: 4 }, facing: 'up' } });
    const reading = computeDetectorReading(CTX.maps.room1!, state);
    expect(reading.kind).toBe('mechanism');
    expect(reading.distance).toBe(1);
  });

  it('stops reading a buried source once it has been dug up', () => {
    const dug = baseState({
      player: { pos: { x: 3, y: 1 }, facing: 'right' },
      mapStates: { room1: { dug: { '4,1': true }, takenItems: {}, openedDoors: {}, toggledSwitches: {}, movedBlocks: {}, disarmedTraps: {}, foundSecrets: {}, usedDecorations: {} } },
    });
    const reading = computeDetectorReading(CTX.maps.room1!, dug);
    expect(reading.kind).not.toBe('buried');
  });

  it('stops reading a trap once it has been disarmed', () => {
    const state = baseState({
      player: { pos: { x: 5, y: 4 }, facing: 'up' },
      mapStates: { room1: { dug: {}, takenItems: {}, openedDoors: {}, toggledSwitches: {}, movedBlocks: {}, disarmedTraps: { trap1: true }, foundSecrets: {}, usedDecorations: {} } },
    });
    const reading = computeDetectorReading(CTX.maps.room1!, state);
    expect(reading.kind).not.toBe('mechanism');
  });

  it('reports nothing beyond its radius', () => {
    const farMap = buildMap({
      id: 'far',
      name: 'Far',
      region: 'temple',
      rows: Array.from({ length: DETECTOR_RADIUS + 4 }, (_, y) =>
        y === 0 ? 'D'.padEnd(DETECTOR_RADIUS + 4, '.') : '.'.repeat(DETECTOR_RADIUS + 4),
      ),
      entities: [],
      buried: { '0,0': { itemId: 'x' } },
      defaultSpawn: { x: 0, y: 0 },
    });
    const state = baseState({ mapId: 'far', player: { pos: { x: DETECTOR_RADIUS + 3, y: DETECTOR_RADIUS + 3 }, facing: 'down' } });
    const reading = computeDetectorReading(farMap, state);
    expect(reading.kind).toBeNull();
    expect(reading.strength).toBe(0);
  });
});
