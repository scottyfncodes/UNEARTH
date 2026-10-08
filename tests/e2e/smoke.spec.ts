import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __unearth?: { state: () => { player: { pos: { x: number; y: number } } } };
  }
}

test('loads the title screen, begins the game, and moves CK with the touch d-pad', async ({ page }) => {
  await page.goto('/?debug=1');

  await expect(page.getByRole('heading', { name: 'UNEARTH' })).toBeVisible();
  await page.getByRole('button', { name: 'Follow the trail' }).click();

  const canvas = page.locator('canvas.game-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move down' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dig' })).toBeVisible();

  const before = await page.evaluate(() => window.__unearth!.state().player.pos);
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerup');
  const after = await page.evaluate(() => window.__unearth!.state().player.pos);

  expect(after).not.toEqual(before);
});

test('the opening is the game itself, one verb to start, and remembers where CK got to', async ({ page }) => {
  await page.goto('/?debug=1');
  // CK at home by the open door — tap to say hello, and it doesn't start the game.
  const ck = page.getByRole('button', { name: 'Say hello to CK' });
  await expect(ck).toBeVisible();
  await ck.click();
  await expect(page.getByText("Dad's gone out. CK's on the case.")).toBeAttached();
  await expect(page.getByText('The collar sings', { exact: false })).toBeAttached();
  const go = page.getByRole('button', { name: 'Follow the trail' });
  await expect(go).toBeVisible();
  // One big button, in the thumb zone, with nothing clipped at a phone's size.
  const box = (await go.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(64);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(box.y).toBeGreaterThan(844 / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'New game' })).toHaveCount(0);

  // Come back later: the title says where CK is and what has been found.
  await go.click();
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerup');
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Keep digging' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await expect(page.getByTestId('title-progress')).toContainText("CK is in CK's Home");
  await expect(page.getByTestId('title-progress')).toContainText('0/16 shinies');
});

test('opens and closes the journal overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await page.getByRole('button', { name: 'Open journal' }).click();
  await expect(page.getByText("CK's Journal")).toBeVisible();
  await page.getByRole('button', { name: 'Close journal' }).click();
  await expect(page.getByText("CK's Journal")).not.toBeVisible();
});

test('ships a home-screen icon and an app manifest that actually load', async ({ page, request }) => {
  await page.goto('/');
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(touchIcon).toBeTruthy();
  expect(manifestHref).toBeTruthy();

  const icon = await request.get(new URL(touchIcon!, page.url()).toString());
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/png');

  const manifest = await request.get(new URL(manifestHref!, page.url()).toString());
  expect(manifest.status()).toBe(200);
  const json = (await manifest.json()) as { name: string; display: string; icons: { src: string }[] };
  expect(json.name).toBe('UNEARTH');
  expect(json.display).toBe('standalone');
  for (const i of json.icons) {
    const res = await request.get(new URL(i.src, new URL(manifestHref!, page.url())).toString());
    expect(res.status(), i.src).toBe(200);
  }
});

test('a tap in a new direction turns CK on the spot before walking', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  const state = () => page.evaluate(() => (window as any).__unearth.state().player as { pos: { x: number; y: number }; facing: string });
  const before = await state();
  expect(before.facing).toBe('down');
  const left = page.getByRole('button', { name: 'Move left' });
  await left.dispatchEvent('pointerdown');
  await left.dispatchEvent('pointerup');
  const turned = await state();
  expect(turned.facing).toBe('left');
  expect(turned.pos).toEqual(before.pos);
  await left.dispatchEvent('pointerdown');
  await left.dispatchEvent('pointerup');
  expect((await state()).pos).toEqual({ x: before.pos.x - 1, y: before.pos.y });
});
