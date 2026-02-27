// tests/scenarios/t06-view-consistency.spec.js
//
// Validates that switching between level buttons (0→1→2) does not cause
// entities to disappear from the environment state.
//
// NOTE: Individual atoms are intentionally invisible at Level 1+ (the rendering
// hides detail at higher levels). The bug being tested is entities *disappearing*
// from environment state entirely (molecules.size drops to 0), not pixel rendering.
// Assert env.molecules.size > 0 at each level — not canvas pixel sampling.
//
// Setup: injects an H2 molecule directly (2 H atoms + 1 bond) rather than running
// the full C2H4 intent pipeline. T01 is the regression guard for molecule formation;
// T06 only needs *a* molecule to exist in order to test the level-switch code path.
// This brings T06 from a 90s worst-case wait down to < 5s.

import { test, expect } from '../fixtures/app.js';

test('T06: molecule count stays non-zero after level transitions', async ({ page }) => {
  // Inject an H2 molecule (2 H atoms + 1 bond) at world center.
  // window.Atom, window.Bond, and env.updateMolecules() are all available.
  // updateMolecules() runs the BFS that groups bonded atoms into Molecule objects.
  await page.evaluate(() => {
    const env = window.cellApp.environment;
    const h1 = new window.Atom('H', 990, 1000);
    const h2 = new window.Atom('H', 1010, 1000);
    env.addAtom(h1);
    env.addAtom(h2);
    const bond = new window.Bond(h1, h2, 1);
    env.addBond(bond);
    env.updateMolecules();
    window.cellApp.viewer.render();
  });

  // Verify injection succeeded before testing level switches
  const initialCount = await page.evaluate(() => window.cellApp.environment.molecules.size);
  expect(initialCount, 'H2 injection failed — no molecules in environment').toBeGreaterThan(0);

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
