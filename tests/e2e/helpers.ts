import type { Page } from '@playwright/test';

export interface FieldTarget {
  uid: string;
  targetId: string;
  x: number;
  y: number;
  depth: number;
  dug: boolean;
  tutorial?: boolean;
}

/** Reads the live game state through the opt-in debug hook. */
export async function readState(page: Page) {
  return page.evaluate(() => {
    const hook = (window as unknown as { __unearth?: { state: () => unknown } }).__unearth;
    return hook ? (hook.state() as Record<string, unknown>) : null;
  });
}

export async function readSave(page: Page) {
  const state = (await readState(page)) as { save?: Record<string, unknown> } | null;
  return state?.save ?? null;
}

export async function readDetectorFrame(page: Page) {
  return page.evaluate(() => {
    const hook = (window as unknown as { __unearth?: { frames: { detector?: unknown } } }).__unearth;
    return (hook?.frames.detector ?? null) as {
      x: number;
      y: number;
      coilX: number;
      coilY: number;
      signal: number;
      dominant: string | null;
    } | null;
  });
}

export async function readExploreFrame(page: Page) {
  return page.evaluate(() => {
    const hook = (window as unknown as { __unearth?: { frames: { explore?: unknown } } }).__unearth;
    return (hook?.frames.explore ?? null) as { x: number; z: number; yaw: number; promptLabel: string | null } | null;
  });
}

/** Holds a movement key for a burst, the same input path a player's thumb drives. */
async function walkBurst(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(40);
}

/**
 * Walks the 3D player toward a world (x, z) using the real keyboard fallback
 * (WASD/arrows for movement, Q/E to turn) — the same LookController/MoveController
 * path a touch drag drives, just without simulating the drag itself.
 *
 * This environment's synthetic input has a large, fairly fixed round-trip cost
 * per keyboard.down/up pair (measured: a "50ms" hold and a "400ms" hold land
 * within the same few-hundred-ms ballpark), so every burst is floored well
 * above that cost and the yaw tolerance is generous — fine alignment comes
 * from re-checking after every burst, not from any single burst being precise.
 */
export async function walkToSite(page: Page, x: number, z: number, tolerance = 2.2): Promise<number> {
  const deadline = Date.now() + 55_000;
  let distance = Infinity;
  while (Date.now() < deadline) {
    const frame = await readExploreFrame(page);
    if (!frame) break;
    const dx = x - frame.x;
    const dz = z - frame.z;
    distance = Math.hypot(dx, dz);
    if (distance <= tolerance) break;

    const desiredYaw = Math.atan2(dx, -dz);
    let yawDiff = desiredYaw - frame.yaw;
    yawDiff = ((yawDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(yawDiff) > 0.5) {
      await walkBurst(page, yawDiff > 0 ? 'e' : 'q', Math.max(400, Math.min(600, (Math.abs(yawDiff) / 1.9) * 1000)));
      continue;
    }
    await walkBurst(page, 'w', Math.max(400, Math.min(1200, (Math.min(distance, 4) / 2.15) * 1000)));
  }
  return distance;
}

export async function undugTargets(page: Page): Promise<FieldTarget[]> {
  const save = (await readSave(page)) as { field?: { targets?: FieldTarget[] } } | null;
  return (save?.field?.targets ?? []).filter((t) => !t.dug);
}

/**
 * Walks the player to a world position using the real keyboard controls —
 * the same input path a player's thumb drives. Returns the final distance.
 */
export async function walkTo(page: Page, x: number, y: number, tolerance = 18): Promise<number> {
  const deadline = Date.now() + 30_000;
  let distance = Infinity;

  while (Date.now() < deadline) {
    const frame = await readDetectorFrame(page);
    if (!frame) break;
    const dx = x - frame.x;
    const dy = y - frame.y;
    distance = Math.hypot(dx, dy);
    if (distance <= tolerance) break;

    // Press the dominant axis for a short burst, then re-evaluate.
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const key = horizontal ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';
    const travel = Math.min(horizontal ? Math.abs(dx) : Math.abs(dy), 120);
    const holdMs = Math.max(40, (travel / 108) * 1000);

    await page.keyboard.down(key);
    await page.waitForTimeout(holdMs);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }

  return distance;
}

/** Presses and holds the PINPOINT control with a real pointer press. */
export async function holdPinpoint(page: Page, down: boolean): Promise<void> {
  const button = page.getByTestId('pinpoint');
  const box = await button.boundingBox();
  if (!box) throw new Error('pinpoint button not found');
  if (down) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  } else {
    await page.mouse.up();
  }
}

/** Walks one axis to a target world coordinate using the keyboard controls. */
export async function walkAxis(
  page: Page,
  axis: 'x' | 'y',
  value: number,
  tolerance = 8,
  speed = 108,
): Promise<number> {
  let delta = Infinity;
  for (let attempt = 0; attempt < 50; attempt++) {
    const frame = await readDetectorFrame(page);
    if (!frame) break;
    const current = axis === 'x' ? frame.x : frame.y;
    delta = value - current;
    if (Math.abs(delta) <= tolerance) break;
    const key =
      axis === 'x'
        ? delta > 0
          ? 'ArrowRight'
          : 'ArrowLeft'
        : delta > 0
          ? 'ArrowDown'
          : 'ArrowUp';
    const hold = Math.max(24, Math.min(700, (Math.abs(delta) / speed) * 1000));
    await page.keyboard.down(key);
    await page.waitForTimeout(hold);
    await page.keyboard.up(key);
    await page.waitForTimeout(30);
  }
  return delta;
}

/** How far ahead of the player the coil sits while pinpointing. */
const PINPOINT_COIL_FORWARD = 62 * 0.8;

export interface PinpointResult {
  /** Best signal seen while closing in. */
  peak: number;
  /** Distance from the marked spot to the real target, in centimetres. */
  offset: number;
}

/**
 * Locates a buried target the way a player does: approach from below, stop the
 * sweep with PINPOINT, then creep forward until the signal peaks. The coil is
 * ahead of the player, so this closes the last stretch in small steps and
 * stops at the strongest reading. Leaves PINPOINT released (which marks the
 * spot) so the caller can press DIG.
 */
export async function centreCoilOn(page: Page, target: FieldTarget): Promise<PinpointResult> {
  // Approach from directly below so the coil ends up pointing at the target.
  await walkAxis(page, 'y', target.y + 240, 40);
  await walkAxis(page, 'x', target.x, 6);
  await walkAxis(page, 'y', target.y + PINPOINT_COIL_FORWARD + 42, 8);

  await holdPinpoint(page, true);
  // Let the sweep settle to centre before reading the coil position.
  await page.waitForTimeout(320);

  let peak = 0;
  let best = Infinity;
  for (let attempt = 0; attempt < 40; attempt++) {
    const frame = await readDetectorFrame(page);
    if (!frame) break;
    peak = Math.max(peak, frame.signal);
    const offset = Math.hypot(frame.coilX - target.x, frame.coilY - target.y);
    // Creeping forward stops the moment the coil starts moving away again:
    // that minimum is the strongest point, which is what a player listens for.
    if (offset < 12 || offset > best + 3) break;
    best = Math.min(best, offset);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(45);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(25);
  }

  const frame = await readDetectorFrame(page);
  const finalOffset = frame
    ? Math.hypot(frame.coilX - target.x, frame.coilY - target.y)
    : Number.POSITIVE_INFINITY;
  peak = Math.max(peak, frame?.signal ?? 0);
  await holdPinpoint(page, false);
  return { peak, offset: finalOffset };
}

/** Drags a tool across the pit in a raster, as a finger would. */
export async function scrubPit(page: Page, rows = 7, passes = 1): Promise<void> {
  const canvas = page.getByTestId('pit-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('pit canvas has no box');
  const size = Math.min(box.width - 24, box.height - 24);
  const left = box.x + (box.width - size) / 2;
  const top = box.y + (box.height - size) / 2;

  for (let pass = 0; pass < passes; pass++) {
    for (let row = 0; row < rows; row++) {
      const y = top + ((row + 0.5) / rows) * size;
      const startX = row % 2 === 0 ? left + 4 : left + size - 4;
      const endX = row % 2 === 0 ? left + size - 4 : left + 4;
      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 18 });
      await page.mouse.up();
    }
  }
}

export async function startNewGame(page: Page): Promise<void> {
  await page.goto('/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /begin/i }).click();
  await page.getByTestId('world-canvas').waitFor();
}
