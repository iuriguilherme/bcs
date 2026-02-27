// tests/scenarios/t05-cell-formation.spec.js
//
// Full end-to-end: atoms → monomers → polymers → cell.
//
// Known bug: E2E cell path never completes; atoms get cramped before forming a cell.
// When the underlying bug is fixed, remove the test.fail() annotation.

import { test, expect, pressPlay, enableSpawner } from '../fixtures/app.js';

test.fail(); // Known bug: E2E cell path never completes; atoms get cramped

test('T05: full E2E cell formation from atom spawner', async ({ page }) => {
  // Register crash/pageerror listeners — cell formation is the most complex code path.
  // These are already registered in the base fixture. This comment documents why they matter here.

  // Configure spawner for all biologically relevant atoms including P (for nucleotides)
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 600, y: 600, width: 800, height: 800 };
    window.cellApp.atomSpawner.tickInterval = 5;
  });
  await enableSpawner(page, ['C', 'H', 'O', 'N', 'P', 'C', 'H', 'O']); // P enabled for nucleotides

  // Place a MINIMAL_CELL intent (simplest cell: 1× PHOSPHOLIPID + 1× DNA_STRAND)
  await page.evaluate(() => {
    const templates = window.getAllCellBlueprints?.() || [];
    const cellBp = templates.find(t =>
      t.id === 'minimal_cell' || t.name?.toLowerCase().includes('minimal')
    );
    if (!cellBp) throw new Error('MINIMAL_CELL blueprint not found in getAllCellBlueprints()');

    const intent = new window.Intention('cell', cellBp, 1000, 1000);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  });

  await pressPlay(page);

  // Wait 20 real seconds (= 200 virtual seconds at 10× speed).
  // The original test was designed for 180s virtual at 1× speed; 20s at 10× is equivalent.
  // Using waitForTimeout (fixed pause) instead of waitForFunction avoids Playwright's
  // framework timeout taking precedence over our per-action timeout option.
  // After the wait, check if cells formed — if not, expect() fails, test.fail() catches it.
  await page.waitForTimeout(20_000);

  // Assert at least one living cell formed.
  // Expected to fail (test.fail() annotation above) because E2E cell formation is broken.
  // When the bug is fixed, this assertion will pass and test.fail() will report "unexpected
  // pass" — the signal to remove the test.fail() annotation.
  const cellCount = await page.evaluate(() => {
    const env = window.cellApp.environment;
    if (typeof env.getAllProkaryotes !== 'function') throw new Error('env.getAllProkaryotes() missing — API contract broken');
    return env.getAllProkaryotes().filter(c => c.isAlive).length;
  });
  expect(cellCount, 'Expected at least one living cell to form').toBeGreaterThan(0);
});
