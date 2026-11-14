import { expect, test, type Page } from '@playwright/test';

/**
 * The game canvas must land on whole device pixels: every art pixel the
 * same size on screen, on any phone and after any resize. These tests read
 * the real rendered pixels back from a device-scale screenshot and measure
 * CK's collar, a colour only CK wears.
 */

const COLLAR = [0x2f, 0xa3, 0x9a];

interface Geometry {
  dpr: number;
  canvasWidth: number;
  canvasHeight: number;
  rect: { left: number; top: number; width: number; height: number };
  box: { left: number; top: number; width: number; height: number };
}

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas.game-canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    const b = c.parentElement!.getBoundingClientRect();
    return {
      dpr: devicePixelRatio,
      canvasWidth: c.width,
      canvasHeight: c.height,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      box: { left: b.left, top: b.top, width: b.width, height: b.height },
    };
  });
}

function expectWholePixels(g: Geometry): number {
  const scaleX = (g.rect.width * g.dpr) / g.canvasWidth;
  const scaleY = (g.rect.height * g.dpr) / g.canvasHeight;
  expect(Math.abs(scaleX - Math.round(scaleX)), `x scale ${scaleX}`).toBeLessThan(1e-3);
  expect(Math.abs(scaleY - Math.round(scaleY)), `y scale ${scaleY}`).toBeLessThan(1e-3);
  expect(Math.round(scaleX)).toBe(Math.round(scaleY));
  // Starts on the device-pixel grid, and covers the whole play area.
  for (const edge of [g.rect.left, g.rect.top]) expect(Math.abs(edge * g.dpr - Math.round(edge * g.dpr))).toBeLessThan(1e-3);
  expect(g.rect.left).toBeLessThanOrEqual(g.box.left + 1e-3);
  expect(g.rect.top).toBeLessThanOrEqual(g.box.top + 1e-3);
  expect(g.rect.left + g.rect.width).toBeGreaterThanOrEqual(g.box.left + g.box.width - 1e-3);
  expect(g.rect.top + g.rect.height).toBeGreaterThanOrEqual(g.box.top + g.box.height - 1e-3);
  return Math.round(scaleX);
}

/** Horizontal runs of CK's collar colour, in device pixels, read back from a real screenshot. */
async function collarRuns(page: Page, g: Geometry): Promise<{ starts: number[]; lengths: number[] }> {
  const png = (await page.screenshot({ scale: 'device' })).toString('base64');
  return page.evaluate(
    async ({ png, g, collar }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const x0 = Math.round(Math.max(g.box.left, 0) * g.dpr);
      const y0 = Math.round(Math.max(g.box.top, 0) * g.dpr);
      const x1 = Math.min(img.width, Math.round((g.box.left + g.box.width) * g.dpr));
      const y1 = Math.min(img.height, Math.round((g.box.top + g.box.height) * g.dpr));
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const origin = Math.round(g.rect.left * g.dpr);
      const starts: number[] = [];
      const lengths: number[] = [];
      for (let y = y0; y < y1; y++) {
        let run = 0;
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.width + x) * 4;
          const hit = x < x1 && data[i] === collar[0] && data[i + 1] === collar[1] && data[i + 2] === collar[2];
          if (hit) run++;
          else if (run) {
            starts.push(x - run - origin);
            lengths.push(run);
            run = 0;
          }
        }
      }
      return { starts, lengths };
    },
    { png, g, collar: COLLAR },
  );
}

async function begin(page: Page) {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
  // A new game opens on the prologue's title card, which dims the room; it clears itself.
  await expect(page.locator('.chapter-card')).toBeVisible();
  await expect(page.locator('.chapter-card')).toHaveCount(0, { timeout: 8000 });
  await page.waitForTimeout(400);
}

async function expectCrispCK(page: Page, scale: number, g: Geometry) {
  const { starts, lengths } = await collarRuns(page, g);
  expect(lengths.length, 'CK should be on screen').toBeGreaterThan(0);
  // One art pixel is two canvas pixels, so every run of collar is a whole number of art pixels...
  const art = scale * 2;
  for (const len of lengths) expect(len % art, `run of ${len}px at ${art}px per art pixel`).toBe(0);
  // ...and every run starts on the canvas's pixel grid.
  for (const s of starts) expect(s % scale).toBe(0);
}

const PHONES = [
  { name: 'iPhone SE', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 },
  { name: 'iPhone 13', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: 'iPhone 15 Pro Max', viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
  { name: 'Pixel 7 (fractional DPR)', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 },
];

for (const phone of PHONES) {
  test.describe(phone.name, () => {
    test.use({ viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor });

    test(`${phone.name}: the game canvas lands on whole device pixels and CK is drawn crisp`, async ({ page }) => {
      await begin(page);
      const g = await geometry(page);
      const scale = expectWholePixels(g);
      await expectCrispCK(page, scale, g);
    });
  });
}

test('resizing the window (rotation, a browser bar) refits to whole pixels and keeps CK crisp and in view', async ({ page }) => {
  await begin(page);
  for (const size of [
    { width: 390, height: 664 },
    { width: 375, height: 812 },
    { width: 430, height: 739 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(700);
    const g = await geometry(page);
    const scale = expectWholePixels(g);
    await expectCrispCK(page, scale, g);
  }
});

test('walking keeps CK on the pixel grid and the camera on CK', async ({ page }) => {
  await begin(page);
  for (const dir of ['Move down', 'Move right', 'Move right']) {
    const button = page.getByRole('button', { name: dir });
    await button.dispatchEvent('pointerdown');
    await page.waitForTimeout(80);
    await button.dispatchEvent('pointerup');
    await page.waitForTimeout(700);
  }
  const g = await geometry(page);
  const scale = expectWholePixels(g);
  await expectCrispCK(page, scale, g);
});
