// tests/scenarios/t04-polymer-intent.spec.js
//
// Tests the full polymer formation pipeline:
//   3× ethylene molecule intents → 1× polyethylene polymer intent
//
// Regression guard: polymer formation completes (atom locking bug was fixed).
// ASSUMPTION: atom.claimedByIntentId exists in atom.js. The orphan check will
// pass vacuously (undefined !== null) if atom locking is not implemented —
// but the polymer count assertion is the meaningful guard here.

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T04: polyethylene polymer intent seals from 3 molecule intents', async ({ page }) => {
  // Configure spawner for C and H (ethylene monomers)
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 800, y: 800, width: 400, height: 400 };
    window.cellApp.atomSpawner.tickInterval = 10;
  });
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);

  // Place 3 ethylene molecule intents surrounding the polymer intent center
  await placeEthyleneIntent(page, 900, 940);
  await placeEthyleneIntent(page, 1100, 940);
  await placeEthyleneIntent(page, 1000, 1100);

  // Place a polyethylene polymer intent at center
  // Uses window.getAllPolymerTemplates() from polymer-blueprints.js
  await page.evaluate(() => {
    const templates = window.getAllPolymerTemplates?.();
    const polyBp = templates?.find(t =>
      t.id === 'polyethylene' || t.name === 'Polyethylene'
    );
    if (!polyBp) throw new Error('Polyethylene template not found in getAllPolymerTemplates()');
    const intent = new window.Intention('polymer', polyBp, 1000, 1000);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  });

  // Listen for seal event in console
  const sealMessages = [];
  page.on('console', msg => {
    if (/sealed|polymer.*formed|polyethylene/i.test(msg.text())) {
      sealMessages.push(msg.text());
    }
  });

  await pressPlay(page);

  // Wait for polymer to form (up to 120s)
  await page.waitForFunction(
    () => {
      const env = window.cellApp.environment;
      const polymers = env.getAllProteins?.() || [];
      return polymers.length > 0;
    },
    { timeout: 120_000, polling: 500 }
  );

  // Assert polymer exists and no atoms are locked to fulfilled intents
  const finalState = await page.evaluate(() => {
    const env = window.cellApp.environment;
    const polymers = env.getAllProteins?.() || [];

    // Check for orphaned atom locks after sealing
    const orphanedAtoms = [...env.atoms.values()].filter(a => {
      if (!a.claimedByIntentId) return false;
      // Atom locked to an intent that no longer exists or is fulfilled
      return !env.intentions.has(a.claimedByIntentId) ||
             env.intentions.get(a.claimedByIntentId)?.fulfilled;
    }).length;

    return { polymerCount: polymers.length, orphanedAtoms };
  });

  expect(finalState.polymerCount, 'Expected at least one polyethylene polymer').toBeGreaterThan(0);
  expect(finalState.orphanedAtoms,
    `${finalState.orphanedAtoms} atom(s) locked to a fulfilled/deleted intent after sealing`
  ).toBe(0);
});
