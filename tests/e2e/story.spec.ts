import { expect, test, type Page } from '@playwright/test';

/**
 * The story's UI, played with the real on-screen buttons at a phone
 * viewport: the prologue card, Dad's goodbye, knocking the vase over for a
 * find card, the old note, leaving for the Meadow — and, from a finished
 * save, the ending.
 */

async function press(page: Page, name: string, times = 1) {
  const button = page.getByRole('button', { name, exact: true });
  for (let i = 0; i < times; i++) {
    await button.dispatchEvent('pointerdown');
    await button.dispatchEvent('pointerup');
    await page.waitForTimeout(60);
  }
}

/** Tap through a conversation: each tap finishes a line that's still typing, then moves on. */
async function readThrough(page: Page) {
  const dialogue = page.getByTestId('dialogue');
  for (let i = 0; i < 30 && (await dialogue.isVisible()); i++) {
    await dialogue.click();
    await page.waitForTimeout(40);
  }
}

const pos = (page: Page) => page.evaluate(() => (window as any).__unearth.state().player.pos as { x: number; y: number });

test('the prologue: Dad leaves, the vase falls, the note is found, the door opens', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await expect(page.getByText('Twenty Minutes')).toBeVisible();

  // Down to Dad, who is standing in the doorway.
  await press(page, 'Move down', 7);
  expect(await pos(page)).toEqual({ x: 7, y: 8 });
  await press(page, 'Interact');
  const dialogue = page.getByTestId('dialogue');
  await expect(dialogue).toContainText('Dad');
  await expect(dialogue).toContainText('popping out');
  // Dad's first line is still typing: a tap finishes it rather than skipping it.
  await dialogue.click();
  expect(await page.evaluate(() => (window as any).__unearth.state().dialogue.index)).toBe(0);
  await readThrough(page);
  await expect(dialogue).not.toBeVisible();

  // The door won't open yet — CK needs a reason to go.
  await press(page, 'Move down', 2);
  await expect(page.getByRole('status')).toContainText('Where did Dad actually go');

  // Knock the vase off the table: a find card for the first shiny. (A tap in a
  // new direction turns CK on the spot first, so each turn costs one extra tap.)
  await press(page, 'Move left', 3);
  await press(page, 'Move up', 3);
  await press(page, 'Interact');
  const find = page.getByTestId('find-card');
  await expect(find).toContainText('Shiny Button');
  await expect(find).toContainText('1 of 17');
  await find.click();
  await expect(find).not.toBeVisible();

  // Bat a book off the shelf: the old note.
  await press(page, 'Move left', 4);
  await press(page, 'Move up', 7);
  await press(page, 'Interact');
  const note = page.getByTestId('note-card');
  await expect(note).toContainText('Back soon');
  await note.click();

  // Now the front door leads out into the Meadow.
  await press(page, 'Move down', 7);
  await press(page, 'Move right', 6);
  await press(page, 'Move down', 4);
  await expect(page.getByText('The Meadow')).toBeVisible();
});

test('a finished journey ends on Dad, the numbers, and the hum', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'unearth.save.v2',
      JSON.stringify({
        mapId: 'home',
        player: { pos: { x: 12, y: 8 }, facing: 'left' },
        hearts: 3,
        maxHearts: 3,
        inventory: ['idol_sunstone', 'moon_seal', 'keepers_bell'],
        flags: { dadLeft: true, foundOldNote: true, napTaken: true },
        clues: [],
        mapStates: {},
      }),
    );
  });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Keep digging' }).click();

  await press(page, 'Interact');
  const dialogue = page.getByTestId('dialogue');
  await expect(dialogue).toContainText("I'm home");
  await readThrough(page);

  const ending = page.getByTestId('ending');
  await expect(ending).toBeVisible();
  await expect(ending).toContainText('20 minutes');
  await expect(ending).toContainText('begins, very quietly, to hum');
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(ending).not.toBeVisible();
});

test('the buttons say what they would do, and the journal maps where CK has been', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  const paw = page.getByRole('button', { name: 'Interact', exact: true });
  await expect(paw).toHaveText('Paw');

  // Walk down to Dad: facing him, Paw becomes Talk.
  await press(page, 'Move down', 7);
  await expect(paw).toHaveText('Talk');
  await expect(paw).toHaveClass(/action-btn--fresh/);

  // The journal's map shows home, where CK is, and what's still there.
  await page.getByRole('button', { name: 'Open journal' }).click();
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.getByRole('img', { name: 'Map of the places CK has been' })).toBeVisible();
  await expect(page.getByText(/1 of \d+ places visited/)).toBeVisible();
});

test('the sound panel sets the score and the effects apart, and remembers them', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await page.getByRole('button', { name: 'Sound settings' }).click();
  const panel = page.getByRole('dialog', { name: 'Sound' });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Music').fill('30');
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('unearth.audio.v1') ?? '{}'));
  expect(saved.music).toBeCloseTo(0.3);
  expect(saved.sfx).toBe(1);
});

test('in the Hush, Paw becomes Mew, and the dark answers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      'unearth.save.v2',
      JSON.stringify({
        mapId: 'hush',
        player: { pos: { x: 5, y: 5 }, facing: 'right' },
        hearts: 3,
        maxHearts: 3,
        inventory: ['idol_sunstone'],
        clues: [],
        flags: { dadLeft: true, foundOldNote: true, learnedEcho: true, tookSunstone: true },
        mapStates: {},
      }),
    );
  });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Keep digging' }).click();
  await expect(page.getByText('Sunken Crypt: The Hush')).toBeVisible();
  const paw = page.getByRole('button', { name: 'Interact', exact: true });
  await expect(paw).toHaveText('Mew');
  await press(page, 'Interact');
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
