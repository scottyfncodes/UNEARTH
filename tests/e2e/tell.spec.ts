import { expect, test } from '@playwright/test';
import { readExploreFrame, readSave, walkToSite } from './helpers';

/**
 * The Tell — where the Undercroft's bronze marker leads. Three standing
 * stones carry symbols the player has met before (the Silent Court's
 * serpent, the railway badge's sun, the tablet's knot); a broken cairn sits
 * between two of them on a dead-straight line the third stone doesn't share.
 * A half-buried field note records the archaeologist's own doubt about that
 * third stone — he tested moving it, found it hadn't budged, and crossed out
 * his own first guess. The alignment itself only resolves from a tumbled
 * stone beside the cairn that only a cat can climb; from there, a fourth
 * stone further along the same line carries a mark that matches nothing else
 * in the game yet.
 *
 * Seeds chain_undercroft_trail as already complete (loc_tell unlocked) — the
 * marker itself is covered by undercroft.spec.ts — so this test can go
 * straight to what it exists to prove: the note and the three familiar
 * symbols are each independently findable, the ledge-gated vantage notice
 * only appears after CK actually climbs, and finding everything completes
 * the pattern-recognition payoff tying every prior mystery thread together.
 */
const SEEDED_SAVE = {
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  discoveries: [
    {
      uid: 'f1',
      targetId: 'tgt_undercroft_relic',
      condition: 100,
      depthCm: 0,
      locationId: 'loc_undercroft',
      foundAt: 1000,
      value: 140,
    },
  ],
  clues: ['clue_court_vessel', 'clue_undercroft_relic'],
  chainsComplete: ['chain_court_vessel', 'chain_undercroft_trail'],
  unlockedLocations: ['loc_old_park', 'loc_old_railway', 'loc_silent_court', 'loc_undercroft', 'loc_tell'],
  detectorId: 'det_starter',
  ownedEquipment: ['det_starter', 'tool_scoop', 'tool_brush'],
  money: 0,
  stats: { sweeps: 0, signalsFound: 0, holesDug: 0, emptyHoles: 0, finds: 1, bestCondition: 100 },
  field: null,
  adventures: {},
  settings: { sound: false, haptics: false },
  flags: { seenIntro: true, tutorialFound: true },
  examined: [],
  assembled: [],
  siteProgress: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('unearth.save.v1')) {
      localStorage.setItem('unearth.save.v1', JSON.stringify(save));
    }
  }, SEEDED_SAVE);
});

/**
 * Turns toward (x, z) and steps a short burst, over and over, stopping only
 * once the prompt actually seen matches `expected` (or after maxAttempts).
 * Re-aiming after every burst (rather than trusting one walkToSite tolerance)
 * matters here for the same reason it did in the Undercroft: several of
 * these interactables sit beside solid props CK can't stand on top of, and a
 * couple sit close enough to each other that CK passes through one's range
 * on the way to another.
 */
async function creepToPrompt(
  page: Parameters<typeof walkToSite>[0],
  x: number,
  z: number,
  expected: RegExp,
  maxAttempts = 30,
): Promise<string | null> {
  let last: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const frame = await readExploreFrame(page);
    if (!frame) break;
    last = frame.promptLabel;
    if (last && expected.test(last)) return last;
    const dx = x - frame.x;
    const dz = z - frame.z;
    const desiredYaw = Math.atan2(dx, -dz);
    let yawDiff = desiredYaw - frame.yaw;
    yawDiff = ((yawDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    const key = Math.abs(yawDiff) > 0.3 ? (yawDiff > 0 ? 'e' : 'q') : 'w';
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }
  return last;
}

test('the vantage notice stays hidden until CK actually climbs the ledge', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_tell').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // Before CK ever goes near the tumbled stone, the ledge flag isn't set —
  // confirmed from spawn, well outside that proximity zone.
  const beforeClimb = (await readSave(page)) as { siteProgress: string[] };
  expect(beforeClimb.siteProgress).not.toContain('tell_used_ledge');

  // Walking up to the tumbled stone is climbing it — the same proximity zone
  // doubles as the ledge, exactly like the Silent Court's and Undercroft's
  // cat-only gaps.
  await walkToSite(page, 2, -3, 1.0);
  await page.waitForTimeout(300);
  const afterClimb = (await readSave(page)) as { siteProgress: string[] };
  expect(afterClimb.siteProgress).toContain('tell_used_ledge');

  const prompt = await creepToPrompt(page, 2, -3, /look out from here/i);
  expect(prompt).toMatch(/look out from here/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/single straight cut across the hillside/i);
});

test('finding the note, all three familiar marks, and the fourth completes the pattern', async ({
  page,
}) => {
  test.setTimeout(300_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_tell').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── the archaeologist's own doubt, found first ────────────────────────
  await walkToSite(page, -3, 6, 1.2);
  let prompt = await creepToPrompt(page, -3, 6, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/crossed out/i);

  // ── the cairn itself ───────────────────────────────────────────────────
  await walkToSite(page, 0, -4.8, 1.2);
  prompt = await creepToPrompt(page, 0, -4, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/cast a line across this ground/i);

  // ── the serpent, a symbol already seen at the Silent Court ────────────
  await walkToSite(page, -6, -5.5, 1.2);
  prompt = await creepToPrompt(page, -6, -4, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toContainText(/coiled serpent/i);
  await page.getByTestId('keep-searching').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── the sun, a symbol already seen on a railway badge ──────────────────
  await walkToSite(page, 6, -5.5, 1.2);
  prompt = await creepToPrompt(page, 6, -4, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toContainText(/three-pointed sun/i);
  await page.getByTestId('keep-searching').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── the knot, off the line the note already doubted ────────────────────
  await walkToSite(page, 3, -10.5, 1.2);
  prompt = await creepToPrompt(page, 3, -9, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toContainText(/woven knot/i);
  await page.getByTestId('keep-searching').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── the fourth mark, further out along the serpent/sun line ────────────
  await walkToSite(page, 10, -5.5, 1.2);
  prompt = await creepToPrompt(page, 10, -4, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toContainText(/fourth mark/i);
  await expect(page.getByTestId('chain-banner')).toContainText(/not two mysteries\. one\./i);
  await page.getByTestId('keep-searching').click();

  const finalSave = (await readSave(page)) as {
    discoveries: { targetId: string }[];
    clues: string[];
    chainsComplete: string[];
  };
  const foundIds = finalSave.discoveries.map((d) => d.targetId);
  expect(foundIds).toContain('tgt_tell_serpent_mark');
  expect(foundIds).toContain('tgt_tell_sun_mark');
  expect(foundIds).toContain('tgt_tell_knot_mark');
  expect(foundIds).toContain('tgt_tell_unknown_mark');
  expect(finalSave.chainsComplete).toContain('chain_tell_pattern');

  // The Links tab should now show the serpent connecting the Tell back to
  // the Silent Court, if that thread was ever picked up there.
  await page.getByRole('button', { name: /^leave$/i }).click();
  await expect(page.getByTestId('location-loc_tell')).toBeVisible();
  await page.getByRole('button', { name: /journal/i }).first().click();
  await page.getByTestId('tab-connections').click();
  await expect(page.getByText(/twin serpent coil/i).first()).toBeVisible();
});
