// tests/scenarios/t01-single-molecule-intent.spec.js
//
// Regression: single C2H4 (ethylene) molecule intent completes with AtomSpawner.
// Target: 6-atom molecule (2C + 4H) produced by intent.

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T01: single ethylene molecule intent completes', async ({ page }) => {
  // Configure spawner zone overlapping the intent area.
  // Zone covers world (700-1300, 700-1300) — centered on intent at (1000, 1000).
  // tickInterval=8 provides a steady supply of atoms without flooding.
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  // C:H = 1:2 ratio for C2H4 (2 carbons, 4 hydrogens per molecule)
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);

  // Place ethylene intent at world center.
  // _addDemoAtoms() places H2O at center; the intent's _rule2 will repel it.
  await placeEthyleneIntent(page, 1000, 1000);

  // Register console listener BEFORE pressing play to catch seal messages.
  const sealMessages = [];
  page.on('console', msg => {
    if (/ethylene|sealed|complete|Molecule.*formed/i.test(msg.text())) {
      sealMessages.push(msg.text());
    }
  });

  await pressPlay(page);

  // Wait for intent to complete or a 6-atom molecule to appear (up to 90s wall-clock).
  // polling: 500ms — default 'raf' polling (60/s) is wasteful for a long convergence wait.
  //
  // Bug in original plan: `molecules.size >= 1` was vacuously true because
  // _addDemoAtoms() places an H2O molecule before the test starts.
  // Correct assertion: some(m => m.atoms.length === 6) for C2H4.
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      const intents = [...window.cellApp.environment.intentions.values()];
      const intentFulfilled = intents.some(i => i.type === 'molecule' && i.fulfilled === true);
      const ethyleneExists = mols.some(m => m.atoms.length === 6);
      return intentFulfilled || ethyleneExists;
    },
    { timeout: 90_000, polling: 500 }
  );

  // Assert: at least one molecule with exactly 6 atoms (C2H4 = 2C + 4H)
  const molAtomCounts = await page.evaluate(() => {
    const mols = [...window.cellApp.environment.molecules.values()];
    return mols.map(m => m.atoms.length);
  });
  expect(molAtomCounts.some(count => count === 6)).toBe(true);
});
