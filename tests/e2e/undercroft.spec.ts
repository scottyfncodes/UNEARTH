import { expect, test } from '@playwright/test';
import { readExploreFrame, readSave, walkToSite } from './helpers';

/**
 * The Undercroft — the archaeological-deduction puzzle unlocked once the
 * Silent Court's vessel is assembled. Four stone posts ring a waystone; only
 * one (the coiled serpent, worn smooth from repeated use, matching a
 * half-legible note found nearby) actually turns it. The other three grind
 * and lock — wrong, but recoverable, not a reset. Only after the waystone is
 * set does a cat-only gap behind it lead to the final catch a person could
 * never reach, which CK finishes with a single light push.
 *
 * Seeds chain_court_vessel as already complete (loc_undercroft unlocked) —
 * the vessel-assembly path itself is covered by vessel.spec.ts — so this test
 * can go straight to what it exists to prove: a wrong post is a real,
 * consequence-bearing dead end rather than a soft no-op; the correct post is
 * the one the environment's own evidence points to; and CK's traversal is
 * the one thing that actually finishes the mechanism.
 *
 * Every post, the platform and the two rocks the notices are tucked beside
 * are solid, and none of them can be approached closer than the 0.6m radius
 * nearestInteractable waives its facing check inside — so a single
 * walkToSite call routinely lands close enough by distance but facing the
 * wrong way after being deflected around the collider. Long transits use
 * walkToSite (loose tolerance, obstacles routed around explicitly); the last
 * stretch into every interactable uses creepToPrompt, which re-aims toward
 * the target after every short step rather than committing to one approach.
 */
const SEEDED_SAVE = {
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  discoveries: [
    {
      uid: 'f1',
      targetId: 'tgt_court_vessel',
      condition: 100,
      depthCm: 0,
      locationId: 'loc_silent_court',
      foundAt: 1000,
      value: 200,
    },
  ],
  clues: ['clue_court_vessel'],
  chainsComplete: ['chain_court_vessel'],
  unlockedLocations: ['loc_old_park', 'loc_old_railway', 'loc_silent_court', 'loc_undercroft'],
  detectorId: 'det_starter',
  ownedEquipment: ['det_starter', 'tool_scoop', 'tool_brush'],
  money: 0,
  stats: { sweeps: 0, signalsFound: 0, holesDug: 0, emptyHoles: 0, finds: 1, bestCondition: 100 },
  field: null,
  adventures: {},
  settings: { sound: false, haptics: false },
  flags: { seenIntro: true, tutorialFound: true },
  examined: [],
  assembled: ['tgt_court_vessel'],
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
 * Unlike walkToSite's own tolerance check, this re-aims after every single
 * burst — including after a collider deflects CK sideways — so it reliably
 * finishes facing whatever it just walked up to. Matching against `expected`
 * (rather than "any prompt", the way the vault's own approach loops check for
 * "Dig here" specifically) matters here because a couple of these interactables
 * sit close enough together that CK passes through another one's range on the
 * way — a plain "stop at the first prompt" loop would stall on the wrong one.
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

test('a wrong post grinds and locks, but stays fully recoverable', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/?debug=1');
  await expect(page.getByTestId('location-loc_undercroft')).toBeVisible();
  await page.getByTestId('location-loc_undercroft').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // The spawn faces the south post (spiral) dead ahead — try the wrong post
  // first, on purpose.
  await walkToSite(page, 0, -1.6, 1.5);
  const wrongPrompt = await creepToPrompt(page, 0, -0.8, /turn the spiral post/i);
  expect(wrongPrompt).toMatch(/turn the spiral post/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/grinds a stiff quarter turn and locks/i);

  const afterWrong = (await readSave(page)) as { siteProgress: string[] };
  expect(afterWrong.siteProgress).toContain('undercroft_wrong_turned');
  expect(afterWrong.siteProgress).not.toContain('undercroft_dial_aligned');

  // Recoverable: route around the platform to the correct post, which is
  // still fully available afterwards.
  await walkToSite(page, 3.6, -0.8, 1.0);
  await walkToSite(page, 3.6, -5.2, 1.0);
  await walkToSite(page, 0.8, -5.2, 1.0);
  const rightPrompt = await creepToPrompt(page, 0, -5.2, /turn the coiled-serpent post/i);
  expect(rightPrompt).toMatch(/turn the coiled-serpent post/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/turns without protest/i);

  const afterRight = (await readSave(page)) as { siteProgress: string[] };
  expect(afterRight.siteProgress).toContain('undercroft_dial_aligned');
});

test('reading the evidence, turning the serpent post, and crawling through solves the waystone', async ({
  page,
}) => {
  test.setTimeout(240_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_undercroft').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // ── gather the evidence first ─────────────────────────────────────────
  await walkToSite(page, -3, 3.8, 1.5);
  let prompt = await creepToPrompt(page, -3, 3, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/trust it again/i);

  await walkToSite(page, 0, -3.2, 1.5);
  prompt = await creepToPrompt(page, 0, -4.1, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/worn pale and smooth/i);

  // ── turn the post the evidence actually points to ─────────────────────
  await walkToSite(page, 0, -4.8, 1.0);
  prompt = await creepToPrompt(page, 0, -5.2, /turn the coiled-serpent post/i);
  expect(prompt).toMatch(/turn the coiled-serpent post/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/turns without protest/i);

  // The post interactables should now be gone — nothing left to "solve" twice.
  await page.waitForTimeout(300);
  const afterAligned = await readExploreFrame(page);
  expect(afterAligned?.promptLabel).toBeNull();

  // ── crawl through the gap CK alone can use ────────────────────────────
  await walkToSite(page, 0, -6.5, 0.8);
  const afterCrawl = (await readSave(page)) as { siteProgress: string[] };
  expect(afterCrawl.siteProgress).toContain('undercroft_used_crawl');

  // ── the tool a person left behind, then the catch only CK can finish ──
  await walkToSite(page, 0.6, -6.2, 1.2);
  prompt = await creepToPrompt(page, 0.6, -6.9, /look closer/i);
  expect(prompt).toMatch(/look closer/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/neither one fit/i);

  await walkToSite(page, 0, -7.4, 1.0);
  prompt = await creepToPrompt(page, 0, -7.8, /nudge the catch/i);
  expect(prompt).toMatch(/nudge the catch/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('notice')).toContainText(/almost no weight at all/i);

  const afterOpened = (await readSave(page)) as { siteProgress: string[] };
  expect(afterOpened.siteProgress).toContain('undercroft_opened');

  // ── the payoff ─────────────────────────────────────────────────────────
  prompt = await creepToPrompt(page, 0.6, -7.9, /take it/i);
  expect(prompt).toMatch(/take it/i);
  await page.getByTestId('site-interact').click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toHaveText(/sealed bronze disc/i);
  await expect(page.getByTestId('chain-banner')).toContainText(/marked where he was going/i);
  await page.getByTestId('keep-searching').click();

  const finalSave = (await readSave(page)) as {
    discoveries: { targetId: string }[];
    clues: string[];
    chainsComplete: string[];
  };
  expect(finalSave.discoveries.map((d) => d.targetId)).toContain('tgt_undercroft_relic');
  expect(finalSave.clues).toContain('clue_undercroft_relic');
  expect(finalSave.chainsComplete).toContain('chain_undercroft_trail');
});
