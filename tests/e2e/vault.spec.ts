import { expect, test } from '@playwright/test';
import { readExploreFrame, readSave, scrubPit, walkToSite } from './helpers';

/**
 * The Silent Court's inner vault — the cat-traversal + booby-trap vertical
 * slice. Proves the whole new loop end to end with real input: CK squeezes
 * through a gap the site itself calls too narrow for the archaeologist who
 * built it, digs up a buried find that resolves the "someone else was here"
 * thread, reads a warning before the dart trap ever fires, and solves the
 * weight puzzle (push the loose stone onto the plate) to disarm the trap and
 * reach the vault's own reward — all through the same contextual-button
 * pipeline as everywhere else in the game, no new UI.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('unearth.save.v1')) return;
    localStorage.setItem(
      'unearth.save.v1',
      JSON.stringify({
        version: 1,
        createdAt: 1,
        updatedAt: 1,
        discoveries: [],
        clues: [],
        chainsComplete: [],
        unlockedLocations: ['loc_old_park', 'loc_old_railway', 'loc_silent_court'],
        detectorId: 'det_starter',
        ownedEquipment: ['det_starter', 'tool_scoop', 'tool_brush'],
        money: 0,
        stats: { sweeps: 0, signalsFound: 0, holesDug: 0, emptyHoles: 0, finds: 0, bestCondition: 0 },
        field: null,
        adventures: {},
        settings: { sound: false, haptics: false },
        flags: { seenIntro: true, tutorialFound: true },
        examined: [],
        assembled: [],
        siteProgress: [],
      }),
    );
  });
});

test('reaches the vault through a cat-only gap, digs the intruder tin, and solves the plate to reach the cache', async ({
  page,
}) => {
  test.setTimeout(300_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_silent_court').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // Tolerances here are kept at or under 0.6m on purpose: nearestInteractable
  // only waives its facing-cone check inside 0.6m (see systems/explore.ts),
  // and walkToSite's own turn-then-forward approach doesn't re-align after
  // its last burst, so a looser tolerance can leave CK close enough by
  // distance but facing the wrong way once he's overshot past the target.

  // ── find the gap and read the warning that it's cat-only ────────────
  await walkToSite(page, 9.3, 6, 0.5);
  await page.waitForTimeout(200);
  const gapPrompt = page.getByTestId('site-interact');
  await expect(gapPrompt).toBeVisible({ timeout: 15_000 });
  await gapPrompt.click();
  await expect(page.getByTestId('notice')).toContainText(/could never have fit/i);
  const afterGapNotice = (await readSave(page)) as { siteProgress: string[] };
  expect(afterGapNotice.siteProgress).toContain('court_seen_vault_gap');

  // ── squeeze through and dig the buried tin ───────────────────────────
  await walkToSite(page, 10.9, 7, 0.6);
  const afterGap = (await readSave(page)) as { siteProgress: string[] };
  expect(afterGap.siteProgress).toContain('court_used_vault_gap');

  // digTolerance for this find is ~0.38m, tighter than walkToSite's own
  // tolerance above — creep the rest of the way in short bursts and stop
  // the moment "Dig here" actually appears, rather than betting a single
  // walkToSite call lands inside that narrower window under load.
  for (let attempt = 0; attempt < 15; attempt++) {
    const frame = await readExploreFrame(page);
    if (frame?.promptLabel === 'Dig here') break;
    const dx = 10.9 - frame!.x;
    const dz = 7 - frame!.z;
    const desiredYaw = Math.atan2(dx, -dz);
    let yawDiff = desiredYaw - frame!.yaw;
    yawDiff = ((yawDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    const key = Math.abs(yawDiff) > 0.3 ? (yawDiff > 0 ? 'e' : 'q') : 'w';
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }

  const digSpot = await readExploreFrame(page);

  const digPrompt = page.getByTestId('site-interact');
  await expect(digPrompt).toHaveText(/dig here/i, { timeout: 15_000 });
  await digPrompt.click();
  await expect(page.getByTestId('pit-canvas')).toBeVisible();

  const extract = page.getByTestId('extract');
  for (let attempt = 0; attempt < 12 && (await extract.isDisabled()); attempt++) {
    await scrubPit(page, 8);
  }
  await expect(extract).toBeEnabled();
  await extract.click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await page.getByTestId('keep-searching').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── the dig detours through 'excavate'/'discovery', unmounting this
  // screen — CK must come back roughly where he was digging, deep inside
  // the vault, not reset all the way out at the site's front-door spawn.
  await page.waitForTimeout(300);
  const backInExplore = await readExploreFrame(page);
  expect(Math.hypot(backInExplore!.x - digSpot!.x, backInExplore!.z - digSpot!.z)).toBeLessThan(1);

  // ── read the trap warning and the plate's own explanation ────────────
  await walkToSite(page, 10.7, 4.3, 0.5);
  await expect(page.getByTestId('site-interact')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/holes/i);

  await walkToSite(page, 12.5, 7.6, 0.5);
  await expect(page.getByTestId('site-interact')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/weight/i);

  // ── push the stone onto the plate: disarms the trap, opens the recess ─
  await walkToSite(page, 12.8, 7.6, 0.5);
  const plateButton = page.getByTestId('site-interact');
  await expect(plateButton).toHaveText(/push the stone/i, { timeout: 15_000 });
  await plateButton.click();
  await expect(page.getByTestId('notice')).toContainText(/recess/i);
  const afterPlate = (await readSave(page)) as { siteProgress: string[] };
  expect(afterPlate.siteProgress).toContain('vault_mechanism_shaken');

  // ── take the cache the vault was hiding ──────────────────────────────
  await walkToSite(page, 12.7, 6.7, 0.5);
  const revealButton = page.getByTestId('site-interact');
  await expect(revealButton).toHaveText(/take the cache/i, { timeout: 15_000 });
  await revealButton.click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  const name = await page.getByTestId('discovery-name').textContent();
  expect(name).toContain('Inner Cache');
  await page.getByTestId('keep-searching').click();

  const finalSave = (await readSave(page)) as { discoveries: { targetId: string }[] };
  const foundIds = finalSave.discoveries.map((d) => d.targetId);
  expect(foundIds).toContain('tgt_court_intruder_tin');
  expect(foundIds).toContain('tgt_court_hidden_cache');
});

test('springing the dart trap outright grants the same progress as solving the plate carefully', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_silent_court').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // Through the gap, then straight at the trap's own centre — no notices
  // read first, no plate touched. Recklessness has to be a real
  // alternative, not a soft-lock.
  await walkToSite(page, 9.3, 6, 0.5);
  await walkToSite(page, 10.9, 7, 0.5); // a safe, proven waypoint inside the vault

  // walkToSite's own tolerance can't express "cross this boundary" — the
  // hazard pushes CK back out the moment he enters it, so he can never
  // actually settle within the radius, only ever touch it. Creep toward the
  // trap in short bursts instead and stop the moment it actually fires.
  let sprung = false;
  for (let attempt = 0; attempt < 20 && !sprung; attempt++) {
    const frame = await readExploreFrame(page);
    const dx = 11.6 - frame!.x;
    const dz = 3.6 - frame!.z;
    const desiredYaw = Math.atan2(dx, -dz);
    let yawDiff = desiredYaw - frame!.yaw;
    yawDiff = ((yawDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    const key = Math.abs(yawDiff) > 0.3 ? (yawDiff > 0 ? 'e' : 'q') : 'w';
    await page.keyboard.down(key);
    await page.waitForTimeout(300);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
    const save = (await readSave(page)) as { siteProgress: string[] };
    sprung = save.siteProgress.includes('vault_mechanism_shaken');
  }
  expect(sprung).toBe(true);
  await expect(page.getByTestId('notice')).toContainText(/snaps forward/i);

  // The same reward the careful path unlocks is now reachable — no separate
  // "you did it wrong" branch, just the one flag either route can grant.
  await walkToSite(page, 12.7, 6.7, 0.5);
  const revealButton = page.getByTestId('site-interact');
  await expect(revealButton).toHaveText(/take the cache/i, { timeout: 15_000 });
  await revealButton.click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();

  // Consequence, not catastrophe: sprung and all, CK is still on his feet,
  // still in the vault, and the run is still winnable.
  await page.getByTestId('keep-searching').click();
  const finalSave = (await readSave(page)) as { discoveries: { targetId: string }[] };
  expect(finalSave.discoveries.map((d) => d.targetId)).toContain('tgt_court_hidden_cache');
});
