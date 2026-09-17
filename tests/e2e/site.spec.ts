import { expect, test } from '@playwright/test';
import { readExploreFrame, readSave } from './helpers';

/**
 * The Silent Court — the first first-person site. Confirms the whole new
 * path actually works end to end: entering from the map renders a real WebGL
 * scene, the real movement controls move the player, standing near something
 * offers exactly one contextual prompt, and using it goes through the same
 * journal/clue pipeline as a dig.
 *
 * Walks straight ahead on purpose (spawn already faces the statue dead-on, no
 * turning needed) rather than steering toward an off-axis target: this
 * environment's synthetic keyboard input has enough timing jitter that a
 * precise multi-turn walk is a flaky way to prove the interaction pipeline
 * works, when a dead-ahead walk proves the same wiring far more reliably.
 */
const SHOTS = 'test-results/screens';

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

test('walks in, renders the 3D world, and a dead-ahead notice goes through the site-flag pipeline', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_silent_court').click();
  await page.screenshot({ path: `${SHOTS}/30-site-intro.png` });

  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/31-site-spawn.png` });

  const spawnFrame = await readExploreFrame(page);
  expect(spawnFrame).toMatchObject({ yaw: 0 });

  // Spawn faces the statue dead-on (dx stays 0 the whole way) — walk straight
  // toward it with the real WASD fallback, no turning required. Each 500ms
  // hold costs roughly 2s of wall-clock in this environment's synthetic
  // input path, and the walk is ~23m at a comfortable human pace, so this
  // needs a generous budget rather than a tight one.
  const deadline = Date.now() + 90_000;
  let promptLabel: string | null = null;
  while (Date.now() < deadline) {
    const frame = await readExploreFrame(page);
    if (frame?.promptLabel) {
      promptLabel = frame.promptLabel;
      break;
    }
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    await page.keyboard.up('w');
  }
  expect(promptLabel).toBe('Look closer');
  await page.screenshot({ path: `${SHOTS}/32-site-near-statue.png` });

  const prompt = page.getByTestId('site-interact');
  await expect(prompt).toBeVisible();
  await prompt.click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('notice')).toContainText('broken wrist');
  await page.screenshot({ path: `${SHOTS}/33-site-statue-notice.png` });

  const save = (await readSave(page)) as { siteProgress?: string[] } | null;
  expect(save?.siteProgress).toContain('court_seen_statue');

  // The prompt should be gone now that this notice has fired once.
  await page.waitForTimeout(300);
  const after = await readExploreFrame(page);
  expect(after?.promptLabel).toBeNull();

  await page.getByRole('button', { name: /^leave$/i }).click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('location-loc_silent_court')).toBeVisible();
});

/**
 * Real pointer-drag input, not the keyboard fallback the rest of this suite
 * leans on. MoveController/LookController listen to generic PointerEvents —
 * they never branch on pointerType — so a mouse-driven drag exercises
 * exactly the same dead-zone/magnitude/look-delta code a touch drag would;
 * this is the same reasoning the excavation pit's own drag test (scrubPit)
 * already relies on. What's worth proving here specifically: the move stick
 * is analog (a small push should visibly lag a full push, not snap to one
 * speed like the keyboard fallback does), which matters for a hazard-dense
 * room where a player might want to creep rather than trot.
 */
test('touch-style pointer drag moves and turns CK, with analog stick pressure', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_silent_court').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();
  await page.waitForTimeout(300);

  // Left 44% of the screen is the move zone, the rest is look — see
  // ExploreScreen's moveZoneRef/lookZoneRef. Kept well clear of the top bar
  // and any contextual button.
  const moveX = 80;
  const lookX = 280;
  const y = 400;

  const spawn = await readExploreFrame(page);
  expect(spawn).toMatchObject({ x: 0, z: 15.5 });

  // A drag under the 5px dead zone must not move CK at all.
  await page.mouse.move(moveX, y);
  await page.mouse.down();
  await page.mouse.move(moveX, y - 3);
  await page.waitForTimeout(400);
  await page.mouse.up();
  const afterDeadZone = await readExploreFrame(page);
  expect(Math.hypot(afterDeadZone!.x - spawn!.x, afterDeadZone!.z - spawn!.z)).toBeLessThan(0.05);

  // A gentle push (well under the stick's full 64px radius) for a fixed hold.
  await page.mouse.move(moveX, y);
  await page.mouse.down();
  await page.mouse.move(moveX, y - 16);
  await page.waitForTimeout(500);
  await page.mouse.up();
  const afterGentle = await readExploreFrame(page);
  const gentleDist = Math.hypot(afterGentle!.x - afterDeadZone!.x, afterGentle!.z - afterDeadZone!.z);
  expect(gentleDist).toBeGreaterThan(0.05); // it did move CK, just carefully

  // A full push for the same fixed hold should cover visibly more ground —
  // the whole point of an analog stick over the keyboard's on/off fallback.
  await page.mouse.move(moveX, y);
  await page.mouse.down();
  await page.mouse.move(moveX, y - 70);
  await page.waitForTimeout(500);
  await page.mouse.up();
  const afterFull = await readExploreFrame(page);
  const fullDist = Math.hypot(afterFull!.x - afterGentle!.x, afterFull!.z - afterGentle!.z);
  expect(fullDist).toBeGreaterThan(gentleDist * 1.3);

  // The look zone turns CK the same way a finger swipe would.
  const beforeLook = await readExploreFrame(page);
  await page.mouse.move(lookX, y);
  await page.mouse.down();
  await page.mouse.move(lookX + 120, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterLook = await readExploreFrame(page);
  expect(afterLook!.yaw).not.toBeCloseTo(beforeLook!.yaw, 2);
});
