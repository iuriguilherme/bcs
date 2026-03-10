// tests/scenarios/t09-thermo-co-triple-bond.spec.js
//
// Thermodynamics: CO molecule intent forms a triple bond (order=3) via
// soft valence override (allowOvervalence). Carbon monoxide requires C
// to exceed its normal valence of 4 when bonded to O with order=3
// (C uses 3 slots, O uses 3 slots — O's normal valence is 2, so
// allowOvervalence must kick in for the bond to form).

import { test, expect, pressPlay, enableSpawner } from '../fixtures/app.js';

/**
 * Place a CO molecule intention at the given world coordinates.
 * Sources blueprint from STABLE_MOLECULES.CO which defines a 2-atom
 * molecule with a single order-3 bond.
 *
 * Constructs a blueprint-compatible plain object (same pattern as
 * createMonomerBlueprint) since MoleculeBlueprint's constructor
 * expects a live Molecule instance, not raw template data.
 */
async function placeCOIntent(page, worldX, worldY) {
  await page.evaluate(([wx, wy]) => {
    const stableMol = window.STABLE_MOLECULES?.['CO'];
    if (!stableMol) throw new Error('STABLE_MOLECULES.CO not found — check script load order');

    // Build a blueprint-compatible object from stable molecule data
    const atomData = stableMol.atoms.map((atom, index) => ({
      index,
      symbol: atom.symbol,
      relX: atom.relX,
      relY: atom.relY,
    }));

    const bondData = stableMol.bonds.map(bond => ({
      atom1Index: bond.atom1,
      atom2Index: bond.atom2,
      order: bond.order || 1,
    }));

    const bp = {
      type: 'molecule',
      name: stableMol.name,
      formula: stableMol.formula,
      fingerprint: `intent-CO-${wx}-${wy}`,
      atomData,
      bondData,
      mass: 28,  // C(12) + O(16)
      isStable: true,
      createdAt: Date.now(),
    };

    const intent = new window.Intention('molecule', bp, wx, wy);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  }, [worldX, worldY]);
}

test('T09: CO molecule intent forms triple bond via thermodynamics', async ({ page }) => {
  // Configure spawner zone centered on intent area.
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 800, y: 800, width: 400, height: 400 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  // C:O = 1:1 ratio for CO (1 carbon, 1 oxygen)
  await enableSpawner(page, ['C', 'O']);

  // Place CO molecule intention at world center.
  await placeCOIntent(page, 1000, 1000);

  // Listen for console messages about sealing/completion.
  const sealMessages = [];
  page.on('console', msg => {
    if (/carbon.monoxide|CO|sealed|complete|triple/i.test(msg.text())) {
      sealMessages.push(msg.text());
    }
  });

  await pressPlay(page);

  // Wait for a bond with order===3 to appear (CO triple bond).
  // Timeout: 120s wall-clock — triple bonds require soft valence override
  // which may take longer than standard single bonds.
  await page.waitForFunction(
    () => {
      const bonds = [...window.cellApp.environment.bonds.values()];
      return bonds.some(b => b.order === 3);
    },
    { timeout: 120_000, polling: 500 }
  );

  // Assert: at least one bond with order===3 exists
  const tripleResult = await page.evaluate(() => {
    const bonds = [...window.cellApp.environment.bonds.values()];
    const triple = bonds.find(b => b.order === 3);
    if (!triple) return null;
    return {
      order: triple.order,
      atom1Symbol: triple.atom1.symbol,
      atom2Symbol: triple.atom2.symbol,
    };
  });

  expect(tripleResult).not.toBeNull();
  expect(tripleResult.order).toBe(3);

  // The triple bond should be between C and O atoms
  const symbols = [tripleResult.atom1Symbol, tripleResult.atom2Symbol].sort();
  expect(symbols).toEqual(['C', 'O']);

  // Assert: a molecule containing the C-O triple bond exists.
  // The molecule may have more than 2 atoms if other atoms bonded
  // before the intention sealed, so we check for a molecule that
  // contains at least one C and one O connected by a triple bond.
  const hasCOInMolecule = await page.evaluate(() => {
    const bonds = [...window.cellApp.environment.bonds.values()];
    const triple = bonds.find(b => b.order === 3);
    if (!triple) return false;
    // Both atoms of the triple bond should share the same moleculeId
    return triple.atom1.moleculeId != null &&
           triple.atom1.moleculeId === triple.atom2.moleculeId;
  });
  expect(hasCOInMolecule).toBe(true);
});
