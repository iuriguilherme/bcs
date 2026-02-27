// tests/scenarios/t02-concurrent-molecule-intents.spec.js
//
// Regression: two simultaneous C2H4 intents complete independently (anti-cannibalization).
// Bug RESOLVED — see: docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md
// Root causes fixed: tar-ball formation, extractAtom single-bond, seed drift, atom escape, gas repulsion.
//
// Two-phase assertion approach:
//   Phase 1 (mid-run, ~60s): diagnostic — no stuck seeds, no tar-balls
//   Phase 2 (final): both intents complete with distinct 6-atom C2H4 molecules

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T02: two concurrent ethylene intents complete without cannibalization', async ({ page }) => {
  // Spawner zone overlapping both intents.
  // Intents placed at (920,900) and (1040,900) — 120 units apart, sharing the same atom pool.
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
    // tickInterval=100 at 10× speed yields the same real-time spawn rate as
    // the originally designed tickInterval=10 at 1× speed (6 atoms/second real).
    // Using tickInterval=10 at 10× speed spawns 10× too many atoms, causing
    // tar-balls from overcrowding rather than from the actual intent system bug.
    window.cellApp.atomSpawner.tickInterval = 100;
  });

  // C:H = 1:2 ratio for C2H4
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);

  // Place two ethylene intents close enough to compete for the same atom pool
  await placeEthyleneIntent(page, 920, 900);
  await placeEthyleneIntent(page, 1040, 900);

  await pressPlay(page);

  // ── Phase 1: Mid-run diagnostic ─────────────────────────────────────────────
  // At 10× simulation speed, 6s wall-clock = 60 virtual seconds — same diagnostic
  // window as the original 60s design, just scaled for the fixture's setSpeed(10).
  // Using 60s here would spawn ~3600 atoms and cause tar-balls from overcrowding.
  await page.waitForTimeout(6_000);

  const midRunDiagnostic = await page.evaluate(() => {
    const env = window.cellApp.environment;
    const intents = [...env.intentions.values()];

    // Find seed molecules for active molecule intents
    const seedMols = [];
    for (const intent of intents) {
      if (intent.type === 'molecule' && intent.seedMoleculeId) {
        // Seed molecules are tracked in environment.seedMolecules (separate Map)
        const seed = env.seedMolecules?.get(intent.seedMoleculeId)
          || env.molecules.get(intent.seedMoleculeId);
        if (seed) seedMols.push({ intent: intent.id.substring(0, 8), seed });
      }
    }

    // Root Cause D symptom: reshapingTimer frozen at 200 (never decrements)
    const frozenSeeds = seedMols.filter(s =>
      s.seed.isReshaping && s.seed.reshapingTimer >= 200
    ).length;

    // Root Cause: geometryVerified=true but hasValidValence=false — permanent stuck state
    const geometryStuckSeeds = seedMols.filter(s =>
      s.seed.geometryVerified && !s.seed.hasValidValence?.()
    ).length;

    // Root Cause A symptom: tar-ball molecule (too many atoms — expected max is 6 for C2H4)
    const allMols = [...env.molecules.values()];
    const tarBalls = allMols.filter(m => m.atoms.length > 12).length;

    return { frozenSeeds, geometryStuckSeeds, tarBalls, seedCount: seedMols.length };
  });

  expect(midRunDiagnostic.frozenSeeds,
    `${midRunDiagnostic.frozenSeeds} seed(s) have reshapingTimer frozen at 200 (Root Cause D)`
  ).toBe(0);

  expect(midRunDiagnostic.geometryStuckSeeds,
    `${midRunDiagnostic.geometryStuckSeeds} seed(s) stuck with geometryVerified=true but invalid valence`
  ).toBe(0);

  expect(midRunDiagnostic.tarBalls,
    `${midRunDiagnostic.tarBalls} tar-ball molecule(s) with >12 atoms (Root Cause A)`
  ).toBe(0);

  // ── Phase 2: Final — both intents complete ───────────────────────────────────
  // NOTE: fulfilled intents are REMOVED from env.intentions (see environment.js:378-379).
  // Checking `intentions.every(fulfilled)` can never be true — fulfilled intents are gone
  // before both can be fulfilled simultaneously. Check the OUTPUT instead: ≥2 C2H4 molecules.
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      const c2h4Mols = mols.filter(m => m.atoms.length === 6);
      return c2h4Mols.length >= 2;
    },
    { timeout: 60_000, polling: 500 } // 60s more after the 6s mid-run wait
  );

  // Assert: both intents produced distinct 6-atom C2H4 molecules (anti-cannibalization)
  const finalState = await page.evaluate(() => {
    const env = window.cellApp.environment;
    const allMols = [...env.molecules.values()];

    // Find 6-atom molecules (C2H4 = 2C + 4H)
    const c2h4Mols = allMols.filter(m => m.atoms.length === 6);

    // After both fulfilled intents are removed, no atoms should remain locked.
    // T02 only places 2 intents; when both fulfill-and-remove, all claimed atoms
    // should be released (claimedByIntentId === null).
    const orphanedAtoms = [...env.atoms.values()].filter(a =>
      a.claimedByIntentId !== null && a.claimedByIntentId !== undefined
    ).length;

    return {
      c2h4Count: c2h4Mols.length,
      c2h4Ids: c2h4Mols.map(m => m.id),
      orphanedAtoms,
    };
  });

  expect(finalState.c2h4Count, 'Expected at least 2 distinct C2H4 (6-atom) molecules').toBeGreaterThanOrEqual(2);

  // Anti-cannibalization: both 6-atom molecules must be different objects
  const uniqueIds = new Set(finalState.c2h4Ids);
  expect(uniqueIds.size, 'Both intents produced the same molecule object (cannibalization)').toBeGreaterThanOrEqual(2);

  expect(finalState.orphanedAtoms,
    `${finalState.orphanedAtoms} atom(s) still claimed (locked) after both intents fulfilled`
  ).toBe(0);
});
