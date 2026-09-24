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

const pos = (page: Page) => page.evaluate(() => (window as any).__unearth.state().player.pos as { x: number; y: number });

test('the prologue: Dad leaves, the vase falls, the note is found, the door opens', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByText('Twenty Minutes')).toBeVisible();

  // Down to Dad, who is standing in the doorway.
  await press(page, 'Move down', 7);
  expect(await pos(page)).toEqual({ x: 7, y: 8 });
  await press(page, 'Interact');
  const dialogue = page.getByTestId('dialogue');
  await expect(dialogue).toContainText('Dad');
  await expect(dialogue).toContainText('popping out');
  for (let i = 0; i < 3; i++) await dialogue.click();
  await expect(dialogue).not.toBeVisible();

  // The door won't open yet — CK needs a reason to go.
  await press(page, 'Move down', 2);
  await expect(page.getByRole('status')).toContainText('Where did Dad actually go');

  // Knock the vase off the table: a find card for the first shiny.
  await press(page, 'Move left', 2);
  await press(page, 'Move up', 2);
  await press(page, 'Interact');
  const find = page.getByTestId('find-card');
  await expect(find).toContainText('Shiny Button');
  await expect(find).toContainText('1 of 12');
  await find.click();
  await expect(find).not.toBeVisible();

  // Bat a book off the shelf: the old note.
  await press(page, 'Move left', 3);
  await press(page, 'Move up', 6);
  await press(page, 'Interact');
  const note = page.getByTestId('note-card');
  await expect(note).toContainText('Back soon');
  await note.click();

  // Now the front door leads out into the Meadow.
  await press(page, 'Move down', 6);
  await press(page, 'Move right', 5);
  await press(page, 'Move down', 3);
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
        tool: 'detector',
        detectorOn: true,
        inventory: ['idol_sunstone', 'moon_seal', 'keepers_bell'],
        flags: { dadLeft: true, foundOldNote: true, napTaken: true },
        clues: [],
        mapStates: {},
      }),
    );
  });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Continue' }).click();

  await press(page, 'Interact');
  const dialogue = page.getByTestId('dialogue');
  await expect(dialogue).toContainText("I'm home");
  for (let i = 0; i < 5; i++) await dialogue.click();

  const ending = page.getByTestId('ending');
  await expect(ending).toBeVisible();
  await expect(ending).toContainText('20 minutes');
  await expect(ending).toContainText('begins, very quietly, to hum');
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(ending).not.toBeVisible();
});

test('the home button returns to the title, and Continue picks up where CK left off', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Begin' }).click();
  await press(page, 'Move down', 3);
  const before = await pos(page);

  await page.getByRole('button', { name: 'Back to title screen' }).click();
  await expect(page.getByText('UNEARTH')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('button', { name: 'Back to title screen' })).toBeVisible();
  expect(await pos(page)).toEqual(before);
});
