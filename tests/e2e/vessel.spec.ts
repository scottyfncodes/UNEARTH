import { expect, test } from '@playwright/test';
import { readSave, walkToSite } from './helpers';

/**
 * The Silent Court's second artifact thread: a glazed shard found in the
 * open near the west wall, and its match sealed behind the vault's weight
 * plate. Neither half means anything alone — assembling them (same Journal
 * mechanism as the tablet's three shards) is what turns two ordinary-looking
 * fragments into a vessel carrying the court's own carved symbol, with a
 * break that reads as deliberate rather than accidental.
 *
 * Seeds the first shard as already found (that pickup is covered by
 * site.spec.ts-style walk tests already) and the vault's plate as already
 * solved, so this test can go straight to what it actually exists to prove:
 * taking the second shard through real site interaction, then driving the
 * Journal's Assemble tab to the discovery/chain/connection payoff.
 */
const SEEDED_SAVE = {
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  discoveries: [
    {
      uid: 'f1',
      targetId: 'tgt_court_shard',
      condition: 100,
      depthCm: 0,
      locationId: 'loc_silent_court',
      foundAt: 1000,
      value: 5,
    },
    {
      uid: 'f2',
      targetId: 'tgt_court_carving_west',
      condition: 100,
      depthCm: 0,
      locationId: 'loc_silent_court',
      foundAt: 1000,
      value: 4,
    },
    {
      uid: 'f3',
      targetId: 'tgt_court_carving_east',
      condition: 100,
      depthCm: 0,
      locationId: 'loc_silent_court',
      foundAt: 1000,
      value: 4,
    },
  ],
  clues: ['clue_court_coil_west', 'clue_court_coil_east'],
  chainsComplete: ['chain_court_coil'],
  unlockedLocations: ['loc_old_park', 'loc_old_railway', 'loc_silent_court'],
  detectorId: 'det_starter',
  ownedEquipment: ['det_starter', 'tool_scoop', 'tool_brush'],
  money: 0,
  stats: { sweeps: 0, signalsFound: 0, holesDug: 0, emptyHoles: 0, finds: 3, bestCondition: 100 },
  field: null,
  adventures: {},
  settings: { sound: false, haptics: false },
  flags: { seenIntro: true, tutorialFound: true },
  examined: [],
  assembled: [],
  // The plate is already pushed — this test is about the assembly payoff,
  // not re-proving the trap/plate sequence vault.spec.ts already covers.
  siteProgress: ['vault_mechanism_shaken'],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('unearth.save.v1')) {
      localStorage.setItem('unearth.save.v1', JSON.stringify(save));
    }
  }, SEEDED_SAVE);
});

test('taking the vault\'s second shard and assembling the vessel connects it to the wall carvings', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto('/?debug=1');
  await page.getByTestId('location-loc_silent_court').click();
  await page.getByTestId('explore-begin').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  // Straight to the vault's reward — the mechanism is already solved.
  await walkToSite(page, 9.3, 6, 0.5);
  await walkToSite(page, 12.7, 6.7, 0.5);
  const revealButton = page.getByTestId('site-interact');
  await expect(revealButton).toHaveText(/take the shard/i, { timeout: 15_000 });
  await revealButton.click();
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toContainText(/shard/i);
  await page.getByTestId('keep-searching').click();
  await expect(page.getByTestId('explore-canvas')).toBeVisible();

  const afterShard = (await readSave(page)) as { discoveries: { targetId: string }[] };
  expect(afterShard.discoveries.map((d) => d.targetId)).toContain('tgt_court_shard_b');

  // Leave the site and open the Journal to assemble the two shards.
  await page.getByRole('button', { name: /^leave$/i }).click();
  await expect(page.getByTestId('location-loc_silent_court')).toBeVisible();
  await page.getByRole('button', { name: /journal/i }).first().click();
  await page.getByTestId('tab-assemble').click();

  const row = page.getByTestId('assembly-row');
  await expect(row).toBeVisible();
  await expect(row).toContainText('2/2');

  const assembleBtn = page.getByTestId('assemble-tgt_court_vessel');
  await expect(assembleBtn).toBeVisible();
  await assembleBtn.click();

  // Assembly reuses the ordinary discovery ceremony — including the
  // "wait, that matches" connection to the two wall carvings, which share
  // the vessel's Twin Serpent Coil symbol, and the chain's payoff text.
  await expect(page.getByTestId('discovery-screen')).toBeVisible();
  await expect(page.getByTestId('discovery-name')).toHaveText(/reassembled vessel/i);
  await expect(page.getByTestId('connection-banner')).toBeVisible();
  await expect(page.getByTestId('chain-banner')).toContainText(/split it on purpose/i);

  const save = (await readSave(page)) as {
    discoveries: { targetId: string }[];
    assembled: string[];
    clues: string[];
    chainsComplete: string[];
  };
  expect(save.assembled).toContain('tgt_court_vessel');
  expect(save.discoveries.some((d) => d.targetId === 'tgt_court_vessel')).toBe(true);
  expect(save.clues).toContain('clue_court_vessel');
  expect(save.chainsComplete).toContain('chain_court_vessel');

  // The Links tab should now show the coil connecting all three finds.
  await page.getByRole('button', { name: /view in journal/i }).click();
  await page.getByRole('button', { name: /^close$/i }).click();
  await page.getByTestId('tab-connections').click();
  await expect(page.getByText(/twin serpent coil/i).first()).toBeVisible();
});
