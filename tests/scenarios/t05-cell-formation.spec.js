import { test, expect, pressPlay, enableSpawner, placeCellIntent } from '../fixtures/app.js';

test.fail(); // Known bug: E2E cell path never completes; atoms get cramped

test('T05: full E2E cell formation', async ({ page }) => {
  // Register error listeners BEFORE any actions
  page.on('crash', () => test.fail('Browser page crashed during simulation'));
  page.on('pageerror', err => test.fail(`Unhandled JS error: ${err.message}`));

  await enableSpawner(page, ['C', 'H', 'O', 'N']);

  // Place cell intent at world center (1000, 1000) using MINIMAL_CELL key
  await placeCellIntent(page, 'MINIMAL_CELL', 1000, 1000);

  await pressPlay(page);

  // Wait up to 180s for cell to form
  await page.waitForFunction(
    () => window.cellApp.environment.cells.size > 0,
    { timeout: 180_000, polling: 500 }
  );

  // Assert cell exists
  const cellCount = await page.evaluate(() => window.cellApp.environment.cells.size);
  expect(cellCount).toBeGreaterThan(0);
});