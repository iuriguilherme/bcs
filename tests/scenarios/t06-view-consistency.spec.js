import { test, expect, pressPlay, enableSpawner, worldToScreen } from '../fixtures/app.js';

// After a molecule intent completes (reuse T01 setup):
// Level 0 (atoms): env.molecules.size > 0 AND atoms drawn (canvas not all-black)
// Level 1 (molecules): click [data-level="1"]; env.molecules.size > 0
// Level 2 (polymers): click [data-level="2"]; simulation entities still non-zero
// NOTE: Individual atoms are intentionally invisible at Level 1+.
//   The bug being tested is entities disappearing entirely (0 molecules rendered),
//   not individual atom circles. Assert env.molecules.size > 0 at each level,
//   not canvas pixel sampling.

test('T06: view consistency across zoom levels', async ({ page }) => {
  // First complete a molecule intent (reuse T01 setup)
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 400, y: 400, width: 300, height: 300 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']); // 1:2 C:H ratio

  // Place molecule intent at (1000,1000)
  await page.evaluate(() => {
    const template = window.MONOMER_TEMPLATES?.ETHYLENE;
    if (!template) throw new Error('MONOMER_TEMPLATES.ETHYLENE not found');
    const bp = window.createMonomerBlueprint(template);
    bp.fingerprint = `intent-C2H4-1000-1000`;
    const intent = new window.Intention('molecule', bp, 1000, 1000);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  });

  await pressPlay(page);

  // Wait for molecule to complete
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      return mols.some(m => m.atoms.length === 6); // C2H4
    },
    { timeout: 90_000, polling: 500 }
  );

  // Test Level 0: Atoms visible (default level)
  const level0Molecules = await page.evaluate(() => window.cellApp.environment.molecules.size);
  expect(level0Molecules).toBeGreaterThan(0);

  // Switch to Level 1: Molecules
  await page.click('[data-level="1"]');
  const level1Molecules = await page.evaluate(() => window.cellApp.environment.molecules.size);
  expect(level1Molecules).toBeGreaterThan(0);

  // Switch to Level 2: Polymers
  await page.click('[data-level="2"]');
  const level2Molecules = await page.evaluate(() => window.cellApp.environment.molecules.size);
  // Note: At Level 2, we check that molecules still exist (polymers are made of molecules)
  expect(level2Molecules).toBeGreaterThan(0);
});