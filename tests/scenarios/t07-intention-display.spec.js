// tests/scenarios/t07-intention-display.spec.js
//
// Regression tests for two molecule-intention display bugs:
//
// Bug 1: Inspector "Gathered" counter always shows 0 for molecule-type intentions.
//   Root cause: gatheredComponents is never populated by the 7-rule pipeline;
//   the inspector was reading gatheredComponents.size (always 0) instead of
//   getGatheredCount() which derives the count from this.progress.
//   Fix: controls.js now calls intention.getGatheredCount().
//
// Bug 2: Atoms assembled by a molecule intention are invisible at Level 2 (molecule view).
//   Root cause: seed molecules live in environment.seedMolecules (a separate Map),
//   not in environment.molecules. Neither getAllMolecules() nor the free-atom loop
//   reaches them, so they vanish at Level 2.
//   Fix: _renderSeedMoleculeAtoms() added and called in _renderMoleculeLevel() and
//   _renderProteinLevel().

import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent, worldToScreen } from '../fixtures/app.js';

// ── Bug 1: Inspector "Gathered" count should reflect actual progress ─────────

test('T07: molecule intention inspector shows non-zero gathered count when atoms collected', async ({ page }) => {
    // Configure spawner zone overlapping the intent area.
    // A dense zone ensures atoms arrive quickly, shortening wall-clock time.
    await page.evaluate(() => {
        window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
        window.cellApp.atomSpawner.tickInterval = 8;
    });

    // C:H = 1:2 ratio for C2H4 (2 carbons, 4 hydrogens per molecule)
    await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);

    // Place ethylene intent at world center.
    await placeEthyleneIntent(page, 1000, 1000);

    await pressPlay(page);

    // Wait until at least one atom has been gathered into the seed molecule.
    // The intention's progress field is updated by the 7-rule pipeline every tick.
    await expect.poll(
        async () => page.evaluate(() => {
            const intents = [...window.cellApp.environment.intentions.values()];
            const intent = intents.find(i => i.type === 'molecule');
            return intent ? intent.progress : 0;
        }),
        { timeout: 90_000, intervals: [500] }
    ).toBeGreaterThan(0);

    // Switch to Select tool and click the intent at its world position.
    // Intentions take highest hit-test priority (checked before atoms/molecules),
    // so clicking world (1000,1000) reliably selects the intent.
    await page.click('#selectTool');
    await page.waitForFunction(
        () => window.cellApp.controls.tool === 'select',
        { timeout: 3_000 }
    );

    const screenPos = await worldToScreen(page, 1000, 1000);
    await page.click('#simCanvas', {
        position: {
            x: Math.round(screenPos.x),
            y: Math.round(screenPos.y),
        },
    });

    // Wait for inspector to show intention fields
    await page.waitForFunction(
        () => {
            const content = document.getElementById('inspectorContent')?.innerText || '';
            return content.includes('Intention:') && content.includes('Gathered:');
        },
        { timeout: 5_000 }
    );

    const inspectorText = await page.locator('#inspectorContent').innerText();

    // Assert "Gathered: X / Y" format is present
    const gatheredMatch = inspectorText.match(/Gathered:\s*(\d+)\s*\/\s*(\d+)/);
    expect(gatheredMatch, 'Inspector should show "Gathered: X / Y" format').not.toBeNull();

    const gatheredDisplay = parseInt(gatheredMatch[1], 10);
    const totalDisplay = parseInt(gatheredMatch[2], 10);

    // Bug 1 regression: gathered count should be > 0 (was always 0 before fix)
    expect(gatheredDisplay, 'Inspector gathered count should be > 0 when atoms have been gathered (Bug 1 regression)').toBeGreaterThan(0);
    expect(totalDisplay, 'Inspector total should equal C2H4 atom count (6)').toBe(6);

    // Verify inspector display matches getGatheredCount() directly
    const gatheredFromMethod = await page.evaluate(() => {
        const intents = [...window.cellApp.environment.intentions.values()];
        const intent = intents.find(i => i.type === 'molecule');
        return intent ? intent.getGatheredCount() : -1;
    });
    expect(gatheredDisplay, 'Inspector value should match getGatheredCount()').toBe(gatheredFromMethod);
});

// ── Bug 2: Seed molecule atoms remain tracked at Level 2 ─────────────────────

test('T07b: seed molecule atoms remain accessible via getAllSeedMolecules() at Level 2', async ({ page }) => {
    await page.evaluate(() => {
        window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
        window.cellApp.atomSpawner.tickInterval = 8;
    });

    await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);
    await placeEthyleneIntent(page, 1000, 1000);

    await pressPlay(page);

    // Wait for at least one atom to be held in a seed molecule.
    // getAllSeedMolecules() was the new accessor added as part of the Bug 2 fix.
    await expect.poll(
        async () => page.evaluate(() => {
            const env = window.cellApp.environment;
            if (!env.getAllSeedMolecules) return 0;
            return env.getAllSeedMolecules().reduce((sum, m) => sum + m.atoms.length, 0);
        }),
        { timeout: 90_000, intervals: [500] }
    ).toBeGreaterThan(0);

    // Record total gathered atom count at Level 0 (atom view)
    const atomsAtLevel0 = await page.evaluate(() => {
        const env = window.cellApp.environment;
        if (!env.getAllSeedMolecules) return 0;
        return env.getAllSeedMolecules().reduce((sum, m) => sum + m.atoms.length, 0);
    });
    expect(atomsAtLevel0, 'Should have gathered atoms before switching levels').toBeGreaterThan(0);

    // Switch to Level 2 (molecule / polymer view)
    await page.click('[data-level="2"]');
    await page.waitForFunction(
        () => window.cellApp.viewer.level === 2,
        { timeout: 3_000 }
    );

    // Bug 2 regression: seed molecules should still be reachable at Level 2.
    // Before the fix, seedMolecules was a separate Map never iterated by the
    // render path, so atoms appeared to "vanish" when switching to molecule view.
    const atomsAtLevel2 = await page.evaluate(() => {
        const env = window.cellApp.environment;
        if (!env.getAllSeedMolecules) return 0;
        return env.getAllSeedMolecules().reduce((sum, m) => sum + m.atoms.length, 0);
    });
    expect(atomsAtLevel2, 'Seed molecule atoms should still be accessible at Level 2 (Bug 2 regression)').toBeGreaterThan(0);
    expect(atomsAtLevel2, 'Seed molecule atom count should not change across level switch').toBe(atomsAtLevel0);
});
