// tests/scenarios/t08-intention-wrong-composition-expulsion.spec.js
//
// Smoke test: wrong-element atoms do not accumulate inside a molecule intent zone.
//
// What this tests:
//   Rule 1 (_rule1_repelIrrelevantAtoms) continuously repels free O atoms from
//   a C2H4 intent zone. Part B of the fix (repulsionForce 8→12, floor 0.3→0.5)
//   means the minimum force is 6.0 units (was 2.4) — reliable expulsion even at boundary.
//
// Why tickInterval=120 (very slow):
//   Atoms arrive one at a time, each expelled before the next arrives.
//   Denser spawn rates cause mutual inter-atom repulsion to counteract the intent's
//   outward force (gridlock), which is a many-body physics effect unrelated to this fix.
//
// Observed steady-state behavior (with expulsion working):
//   - Each O atom is expelled in ~30 ticks, then bonds with another O outside the zone → O2.
//   - O2 molecules (stable) oscillate near the zone boundary: Rule 2 pushes them out
//     when dist < 300; no force keeps them away when outside; they drift back.
//   - At any moment: 0–12 O atoms inside (boundary oscillation of a few O2 molecules).
//   - Total atoms in environment after 5s ≈ 25 (all eventually forming O2 outside).
//
// Without expulsion (if Rule 1 were broken):
//   - All ~25 spawned atoms stay inside indefinitely → count ≈ 25.
//
// Threshold of 15 clearly separates working (≤ 12) from broken (≈ 25).
//
// Note: Rule 2's new composition check for UNSTABLE wrong-composition molecules (CO,
// CHO etc.) cannot be reliably triggered via Playwright — those molecules must form
// outside the zone (bonding is blocked inside) and drift in, which is non-deterministic.
// That code path is validated by code inspection and by T01/T02 continuing to pass
// (valid molecules are not incorrectly expelled).

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

test('T08: wrong-element O atoms do not accumulate in ethylene intent zone', async ({ page }) => {
  // Clear demo atoms — _addDemoAtoms() seeds C/H atoms which would let the ethylene
  // intent fulfill immediately, halting rule execution and allowing free accumulation.
  await page.evaluate(async () => {
    await window.cellApp.environment.clear();
  });

  // Very slow spawn rate: one O atom every 120 ticks.
  // Each atom is individually expelled before the next arrives — no crowding effect.
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 900, y: 900, width: 200, height: 200 };
    window.cellApp.atomSpawner.tickInterval = 120;
  });

  await enableSpawner(page, ['O']);
  await placeEthyleneIntent(page, 1000, 1000);
  await pressPlay(page);

  // Run for 5 seconds wall-clock (≈ 3000 ticks at 10× speed → ~25 O atoms spawned).
  // This is long enough for steady-state expulsion behavior to establish.
  await page.waitForTimeout(5_000);

  // Count O atoms (free + in molecules) inside the zone radius.
  const oCountInZone = await page.evaluate(() => {
    const env = window.cellApp.environment;
    const cx = 1000, cy = 1000, r2 = 300 * 300;
    let count = 0;
    for (const atom of env.atoms.values()) {
      if (atom.symbol !== 'O') continue;
      const dx = atom.position.x - cx;
      const dy = atom.position.y - cy;
      if (dx * dx + dy * dy < r2) count++;
    }
    return count;
  });

  // Working: 0–12 (boundary oscillation of O2 molecules).
  // Broken (no Rule 1): ~25 (all atoms stuck inside zone).
  expect(oCountInZone).toBeLessThan(15);
});
