import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent, placePolymerIntent } from '../fixtures/app.js';

// Setup: 3 ethylene molecule intents at (900,940), (1100,940), (1000,1100)
//        1 polyethylene polymer intent at (1000, 1000)
// Spawner: C and H atoms, zone: (800,800,400,400)
// Assert polymer seals: listen for console /sealed/i OR
//   window.cellApp.environment.polymers.size > 0 within 120s
// Assert no atom locking after sealing:
//   [...env.atoms.values()].every(a =>
//     a.claimedByIntentId === null ||
//     env.intentions.has(a.claimedByIntentId)
//   )

test('T04: polymer intent with 3 molecule intents', async ({ page }) => {
  // Spawner configuration
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 800, y: 800, width: 400, height: 400 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  await enableSpawner(page, ['C', 'H']);

  // Place 3 ethylene intents
  await placeEthyleneIntent(page, 900, 940);
  await placeEthyleneIntent(page, 1100, 940);
  await placeEthyleneIntent(page, 1000, 1100);

  // Place 1 polyethylene polymer intent (using uppercase key POLYETHYLENE)
  await placePolymerIntent(page, 'POLYETHYLENE', 1000, 1000);

  const sealMessages = [];
  page.on('console', msg => {
    if (/sealed|polymer/i.test(msg.text())) sealMessages.push(msg.text());
  });

  await pressPlay(page);

  // Wait for polymer to seal (up to 120s)
  await page.waitForFunction(
    () => {
      const polymers = [...window.cellApp.environment.polymers.values()];
      const intents = [...window.cellApp.environment.intentions.values()];
      const polymerSealed = polymers.length > 0;
      const allAtomsUnlocked = [...window.cellApp.environment.atoms.values()].every(
        a => a.claimedByIntentId === null || intents.some(i => i.id === a.claimedByIntentId)
      );
      return polymerSealed && allAtomsUnlocked;
    },
    { timeout: 120_000, polling: 500 }
  );

  // Assert polymer exists and no orphaned locking
  const polymerCount = await page.evaluate(() => window.cellApp.environment.polymers.size);
  expect(polymerCount).toBeGreaterThan(0);
});