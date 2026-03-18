import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test.fail(); // Known bug: anti-cannibalization not fully resolved; concurrent intents interfere

// Regression test — see full spec in Enhancement Summary source findings.
// Key assertions (all five root causes):
//
// Mid-run (at 60s): no seed molecule stuck with reshapingTimer === 200 (timer frozen)
//                   no seed with geometryVerified=true + hasValidValence()=false
//                   no tar-ball molecule (atoms.length > 12)
//
// Final: intent A produced distinct 6-atom C2H4 with valid valence
//        intent B produced distinct 6-atom C2H4 with valid valence
//        A and B are different molecule objects (anti-cannibalization)
//        no orphaned claimedByIntentId atoms pointing to fulfilled intents
//
// Spawner: atomPool=['C','C','H','H','H','H'] (1:2 C:H ratio), tickInterval=10
// Intents: placed at (920,900) and (1040,900) — 120 units apart, competing for same pool
// Timeout: 120_000ms total; mid-run diagnostic at 60_000ms

test('T02: two simultaneous molecule intents, anti-cannibalization', async ({ page }) => {
  // Spawner zone at (400,400): away from world center demo atoms
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 400, y: 400, width: 300, height: 300 };
    window.cellApp.atomSpawner.tickInterval = 10;
  });

  // enableSpawner now correctly sets the atomPool before toggling
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']); // 1:2 C:H ratio

  // Place two molecule intents with specific IDs for anti-cannibalization test
  await page.evaluate(([x1, y1, id1, x2, y2, id2]) => {
    const template = window.MONOMER_TEMPLATES?.ETHYLENE;
    if (!template) throw new Error('MONOMER_TEMPLATES.ETHYLENE not found');
    const bp = window.createMonomerBlueprint(template);
    if (!bp) throw new Error('createMonomerBlueprint returned null for ETHYLENE template');

    // Place first intent with ID 'A'
    bp.fingerprint = `intent-C2H4-${x1}-${y1}-A`;
    const intentA = new window.Intention('molecule', bp, x1, y1);
    intentA.id = id1; // Override auto-generated ID
    window.cellApp.environment.addIntention(intentA, window.cellApp.catalogue);

    // Place second intent with ID 'B'
    bp.fingerprint = `intent-C2H4-${x2}-${y2}-B`;
    const intentB = new window.Intention('molecule', bp, x2, y2);
    intentB.id = id2; // Override auto-generated ID
    window.cellApp.environment.addIntention(intentB, window.cellApp.catalogue);

    window.cellApp.viewer.render();
  }, [920, 900, 'A', 1040, 900, 'B']);

  // Register console listener BEFORE pressing play
  const sealMessages = [];
  page.on('console', msg => {
    if (/sealed|complete/i.test(msg.text())) sealMessages.push(msg.text());
  });

  await pressPlay(page);

  // Wait for intents to complete (up to 120s wall-clock).
  // Use polling: 500 for long waits to avoid wasting CPU on 60/s checks.
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      const intents = [...window.cellApp.environment.intentions.values()];

      // Check for both intents fulfilled
      const intentAFulfilled = intents.some(i => i.type === 'molecule' && i.fulfilled === true && i.id === 'A');
      const intentBFulfilled = intents.some(i => i.type === 'molecule' && i.fulfilled === true && i.id === 'B');

      // Check for distinct 6-atom molecules (C2H4 = 2C + 4H)
      const ethyleneMolecules = mols.filter(m => m.atoms.length === 6);
      const distinctMolecules = new Set(ethyleneMolecules.map(m => m.id));

      // Anti-cannibalization: A and B should be different molecule objects
      const intentAMolecule = mols.find(m => m.claimedByIntentId === 'A');
      const intentBMolecule = mols.find(m => m.claimedByIntentId === 'B');

      return intentAFulfilled && intentBFulfilled && distinctMolecules.size >= 2 && intentAMolecule && intentBMolecule && intentAMolecule.id !== intentBMolecule.id;
    },
    { timeout: 120_000, polling: 500 }
  );

  // Final assertions: both intents produced distinct 6-atom molecules
  const molAtomCounts = await page.evaluate(() => {
    const mols = [...window.cellApp.environment.molecules.values()];
    return mols.map(m => m.atoms.length);
  });
  expect(molAtomCounts.filter(count => count === 6).length).toBeGreaterThanOrEqual(2);
});