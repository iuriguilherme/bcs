// tests/scenarios/t06-view-consistency.spec.js
//
// Validates that switching between level buttons (0→1→2) does not cause
// entities to disappear from the environment state.
//
// NOTE: Individual atoms are intentionally invisible at Level 1+ (the rendering
// hides detail at higher levels). The bug being tested is entities *disappearing*
// from environment state entirely (molecules.size drops to 0), not pixel rendering.
// Assert env.molecules.size > 0 at each level — not canvas pixel sampling.

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T06: molecule count stays non-zero after level transitions', async ({ page }) => {
  // ── Setup: same as T01 — run until a C2H4 molecule forms ─────────────────────
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);
  await placeEthyleneIntent(page, 1000, 1000);
  await pressPlay(page);

  // Wait for at least one 6-atom molecule to exist
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      return mols.some(m => m.atoms.length === 6);
    },
    { timeout: 90_000, polling: 500 }
  );

  // ── Assertions: check molecule count at each level ────────────────────────────

  // Level 0 (atoms): molecules should still exist
  await page.click('[data-level="0"]');
  const atLevelZero = await page.evaluate(
    () => window.cellApp.environment.molecules.size
  );
  expect(atLevelZero, 'molecules.size dropped to 0 at Level 0 after level switch').toBeGreaterThan(0);

  // Level 1 (molecules): same molecules should still be tracked
  await page.click('[data-level="1"]');
  await page.waitForFunction(
    () => window.cellApp.viewer.level === 1,
    { timeout: 2_000 }
  );
  const atLevelOne = await page.evaluate(
    () => window.cellApp.environment.molecules.size
  );
  expect(atLevelOne, 'molecules.size dropped to 0 after switching to Level 1').toBeGreaterThan(0);

  // Level 2 (polymers): molecules should persist (no polymers yet, but atoms/molecules remain)
  await page.click('[data-level="2"]');
  await page.waitForFunction(
    () => window.cellApp.viewer.level === 2,
    { timeout: 2_000 }
  );
  const atLevelTwo = await page.evaluate(
    () => window.cellApp.environment.molecules.size
  );
  expect(atLevelTwo, 'molecules.size dropped to 0 after switching to Level 2').toBeGreaterThan(0);
});
