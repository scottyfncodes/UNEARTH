import { expect, test } from '@playwright/test';
import {
  centreCoilOn,
  holdPinpoint,
  readDetectorFrame,
  readSave,
  scrubPit,
  startNewGame,
  undugTargets,
  walkTo,
} from './helpers';

test.describe('the core loop on a phone', () => {
  test('search, detect, locate, dig, extract, identify, collect, persist', async ({ page }) => {
    await startNewGame(page);

    // ── the first session starts with a teaching target in the ground ──
    const targets = await undugTargets(page);
    expect(targets.length).toBeGreaterThan(0);
    const tutorial = targets.find((t) => t.tutorial);
    expect(tutorial, 'a first-run target should be buried').toBeTruthy();
    await expect(page.getByTestId('hint')).toBeVisible();

    // ── walking towards it makes the signal grow ──────────────────────
    // Note: the starting reading is not necessarily silent — other things are
    // buried out there too — so this checks growth rather than an absolute.
    const far = await readDetectorFrame(page);
    expect(far!.signal).toBeLessThan(0.5);

    const located = await centreCoilOn(page, tutorial!);
    expect(located.peak, 'signal should be strong right over the target').toBeGreaterThan(0.6);
    expect(
      located.peak,
      'signal over the target should clearly beat the signal from across the field',
    ).toBeGreaterThan(far!.signal * 1.8);
    expect(located.offset, 'pinpointing should get close to the real spot').toBeLessThan(45);

    // ── pinpointing shows a readout ───────────────────────────────────
    await holdPinpoint(page, true);
    await expect(page.getByTestId('readout')).toBeVisible();
    await expect(page.getByTestId('readout')).toContainText(/cm/);
    await holdPinpoint(page, false);

    // ── dig ───────────────────────────────────────────────────────────
    await page.getByTestId('dig').click();
    await expect(page.getByTestId('pit-canvas')).toBeVisible();
    await expect(page.getByTestId('dig-readout')).toBeVisible();

    // ── excavate until it can be lifted ───────────────────────────────
    const extract = page.getByTestId('extract');
    await expect(extract).toBeDisabled();
    for (let attempt = 0; attempt < 12 && (await extract.isDisabled()); attempt++) {
      await scrubPit(page, 8);
    }
    await expect(extract).toBeEnabled();
    await extract.click();

    // ── discovery ─────────────────────────────────────────────────────
    await expect(page.getByTestId('discovery-screen')).toBeVisible();
    const name = await page.getByTestId('discovery-name').textContent();
    expect(name?.trim().length).toBeGreaterThan(0);

    // ── collection ────────────────────────────────────────────────────
    await page.getByRole('button', { name: /view in journal/i }).click();
    await expect(page.getByTestId('journal-entry').first()).toBeVisible();
    expect(await page.getByTestId('journal-entry').count()).toBe(1);

    const save = (await readSave(page)) as { discoveries: unknown[]; stats: Record<string, number> };
    expect(save.discoveries).toHaveLength(1);
    expect(save.stats.finds).toBe(1);
    expect(save.stats.holesDug).toBe(1);

    // ── the find survives a reload ────────────────────────────────────
    // A returning player lands on the map rather than the title screen.
    await page.reload();
    await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();
    await page.getByRole('button', { name: /open field journal/i }).click();
    await expect(page.getByTestId('journal-entry').first()).toBeVisible();
    const reloaded = (await readSave(page)) as { discoveries: { targetId: string }[] };
    expect(reloaded.discoveries).toHaveLength(1);
  });

  test('a hole dug in the wrong place is honestly empty', async ({ page }) => {
    await startNewGame(page);
    const targets = await undugTargets(page);

    // Find a spot far from everything buried.
    const save = (await readSave(page)) as { field: { locationId: string } };
    expect(save.field.locationId).toBe('loc_old_park');

    let spot = { x: 120, y: 120 };
    let bestDistance = 0;
    for (const candidate of [
      { x: 120, y: 120 },
      { x: 1280, y: 120 },
      { x: 120, y: 1280 },
      { x: 1280, y: 1280 },
      { x: 700, y: 140 },
    ]) {
      const distance = Math.min(...targets.map((t) => Math.hypot(t.x - candidate.x, t.y - candidate.y)));
      if (distance > bestDistance) {
        bestDistance = distance;
        spot = candidate;
      }
    }
    expect(bestDistance).toBeGreaterThan(150);

    await walkTo(page, spot.x, spot.y, 40);
    await page.getByTestId('dig').click();
    await expect(page.getByTestId('pit-canvas')).toBeVisible();
    // No condition readout means there is nothing in this hole.
    await expect(page.getByTestId('dig-readout')).toHaveCount(0);

    for (let attempt = 0; attempt < 8; attempt++) {
      if (await page.getByTestId('empty-hole').isVisible()) break;
      await scrubPit(page, 8);
    }
    await expect(page.getByTestId('empty-hole')).toBeVisible();
    await page.getByTestId('empty-hole').click();
    await expect(page.getByTestId('world-canvas')).toBeVisible();

    const after = (await readSave(page)) as { stats: Record<string, number>; discoveries: unknown[] };
    expect(after.stats.emptyHoles).toBe(1);
    expect(after.discoveries).toHaveLength(0);
  });
});
