import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __unearth?: { state: () => { player: { pos: { x: number; y: number } } } };
  }
}

test('loads the title screen, begins the game, and moves CK with the touch d-pad', async ({ page }) => {
  await page.goto('/?debug=1');

  await expect(page.getByText('UNEARTH')).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();

  const canvas = page.locator('canvas.game-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move down' })).toBeVisible();

  const before = await page.evaluate(() => window.__unearth!.state().player.pos);
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Move down' }).dispatchEvent('pointerup');
  const after = await page.evaluate(() => window.__unearth!.state().player.pos);

  expect(after).not.toEqual(before);
});

test('opens and closes the journal overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Open journal' }).click();
  await expect(page.getByText("CK's Journal")).toBeVisible();
  await page.getByRole('button', { name: 'Close journal' }).click();
  await expect(page.getByText("CK's Journal")).not.toBeVisible();
});
