import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T01: single ethylene molecule intent completes', async ({ page }) => {
  // Spawner zone at (400,400): away from world center demo atoms (H2O + 10 random atoms
  // placed by _addDemoAtoms() at init). C:H = 1:2 ratio for ethylene (C2H4).
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 400, y: 400, width: 300, height: 300 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  // enableSpawner now correctly sets the atomPool before toggling
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']); // 1:2 C:H ratio

  // Place ethylene molecule intent at world (1000, 1000)
  await placeEthyleneIntent(page, 1000, 1000);

  // Register console listener BEFORE pressing play
  const sealMessages = [];
  page.on('console', msg => {
    if (/ethylene|sealed|complete/i.test(msg.text())) sealMessages.push(msg.text());
  });

  await pressPlay(page);

  // Wait for intent to complete (up to 90s wall-clock).
  // IMPORTANT: Use polling: 500 — the default 'raf' polling checks on every animation
  // frame (60/s) which is wasteful for a convergence test that runs for tens of seconds.
  //
  // ⚠️ Bug in original plan: `molecules.size >= 1` was vacuously true because
  // _addDemoAtoms() places an H2O molecule at world center before the test starts.
  // The correct assertion is `some(m => m.atoms.length === 6)` for C2H4.
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      // Check for intent fulfillment OR a 6-atom molecule (C2H4 = 2C + 4H).
      // Do NOT check `molecules.size >= 1` – demo H2O satisfies that immediately.
      const intents = [...window.cellApp.environment.intentions.values()];
      const intentFulfilled = intents.some(i => i.type === 'molecule' && i.fulfilled === true);
      const ethyleneExists = mols.some(m => m.atoms.length === 6);
      return intentFulfilled || ethyleneExists;
    },
    { timeout: 90_000, polling: 500 }
  );

  // Assert: at least one molecule with exactly 6 atoms (C2H4)
  const molAtomCounts = await page.evaluate(() => {
    const mols = [...window.cellApp.environment.molecules.values()];
    return mols.map(m => m.atoms.length);
  });
  expect(molAtomCounts.some(count => count === 6)).toBe(true);
});