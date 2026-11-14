import { describe, expect, it } from 'vitest';
import { MAPS } from '@/content/maps';
import { ISO_ROOM_IDS } from '@/core/preview';
import { step, type Direction } from '@/game/types';
import { architecture, heightRows, heightSteps } from '@/render/iso/rooms';
import { floorElev, wallHeight } from '@/render/iso/terrain';
import { project } from '@/render/iso/project';
import { facesCamera, mirrored } from '@/render/iso/ckIso';

const isWallish = (t: string | undefined) => t === 'wall' || t === 'catGap';

describe('isometric preview rooms', () => {
  for (const id of ISO_ROOM_IDS) {
    const map = MAPS[id]!;

    it(`${id}: has a height layer the same size as the room`, () => {
      const rows = heightRows(id)!;
      expect(rows).toHaveLength(map.height);
      for (const row of rows) {
        expect(row).toHaveLength(map.width);
        expect(row).toMatch(/^[0-9]+$/);
      }
    });

    it(`${id}: every change in level between walkable tiles is a single step`, () => {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.tiles[y]![x] === 'wall') continue;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const) {
            const n = map.tiles[y + dy]?.[x + dx];
            if (!n || n === 'wall') continue;
            expect(Math.abs(heightSteps(map, x, y) - heightSteps(map, x + dx, y + dy)), `${x},${y} → ${x + dx},${y + dy}`).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it(`${id}: no wall (other than an authored pillar) hides the centre of a walkable tile behind it`, () => {
      const { pillars } = architecture(id);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (!isWallish(map.tiles[y]![x]) || pillars[`${x},${y}`]) continue;
          let base = 0;
          for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
            const n = map.tiles[y + dy]?.[x + dx];
            if (n && !isWallish(n)) base = Math.max(base, floorElev(map, x + dx, y + dy));
          }
          const top = base + wallHeight(map, x, y);
          // Same screen column, further up the screen: the wall's top edge must stay below that tile's centre.
          for (let k = 1; k < 16; k++) {
            const a = x - k;
            const b = y - k;
            const t = map.tiles[b]?.[a];
            if (!t || t === 'wall') continue;
            const wallTopY = project(x, y, top).y;
            const centreY = project(a + 0.5, b + 0.5, floorElev(map, a, b)).y;
            expect(wallTopY >= centreY - 0.001 || top - base <= 6, `wall ${x},${y} hides ${a},${b}`).toBe(true);
          }
        }
      }
    });

    it(`${id}: lintels only span open tiles`, () => {
      for (const l of architecture(id).lintels) expect(isWallish(map.tiles[l.y]![l.x])).toBe(false);
    });
  }
});

describe('CK in three-quarter view', () => {
  it('faces the camera when walking toward the bottom of the screen, and mirrors for the left side', () => {
    const screen = (d: Direction) => {
      const to = step({ x: 0, y: 0 }, d);
      return project(to.x, to.y);
    };
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      const s = screen(d);
      expect(facesCamera(d), d).toBe(s.y > 0);
      expect(mirrored(d), d).toBe(s.x < 0);
    }
  });
});
