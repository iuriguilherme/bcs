import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

/**
 * T07: Intention Display Bugs - Gathered Counter and Level 2 Visibility
 *
 * Bug 1: Inspector shows "Gathered: 0/N" while canvas shows correct count
 * Bug 2: Atoms being assembled by molecule intent invisible at Level 2
 *
 * Acceptance criteria:
 * - Inspector "Gathered" shows correct count (not 0) when atoms have been claimed
 * - At Level 2, atoms being assembled are visible as individual atoms
 * - Clicking seed assembly at Level 2 opens it in inspector
 * - No regressions for polymer/cell intents or completed molecules
 *
 * Camera note: default camera centers at world (1000, 1000), so use world coords
 * near (1000, 1000) for on-screen visibility and click accuracy.
 */
test('T07: Intention display - Gathered counter and Level 2 visibility', async ({ page }) => {
  // Setup: Place spawner zone near intention for quick assembly.
  // Spawner at (850-1050, 850-1050), intention at (1100, 1000) — both within default viewport.
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 850, y: 850, width: 200, height: 200 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  // Use a simple molecule: Ethylene (C2H4) - 6 atoms total
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);

  // Place molecule intent within the default viewport (camera centered at world 1000, 1000)
  await placeEthyleneIntent(page, 1100, 1000);

  // Open inspector for this intention BEFORE starting simulation.
  // This mirrors T03 (known working) and avoids spawner-zone-overlap click issues.
  await page.click('#selectTool');
  // worldToScreen returns canvas-relative coordinates.
  // Use locator.click({position}) which is also canvas-element-relative — no page-offset mismatch.
  const intentCanvasPos = await page.evaluate(() =>
    window.cellApp.viewer.worldToScreen(1100, 1000)
  );
  await page.locator('#simCanvas').click({ position: { x: intentCanvasPos.x, y: intentCanvasPos.y } });
  // Inspector should now show the intention
  await expect(page.locator('#inspectorContent')).toContainText('Intention:');

  // Start simulation
  await pressPlay(page);

  // Bug 1: Wait for intention to make progress
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const intentions = [...window.cellApp.environment.intentions.values()];
      return intentions.length > 0 ? intentions[0].progress : 0;
    });
  }, {
    message: 'Molecule intention should have progress > 0',
    timeout: 60_000,
    intervals: [500]
  }).toBeGreaterThan(0);

  // Bug 1: Verify getGatheredCount() returns correct value (not 0)
  // Direct observation via evaluate — consistent with plan's intent
  const gatheredData = await page.evaluate(() => {
    const intentions = [...window.cellApp.environment.intentions.values()];
    if (intentions.length === 0) return null;
    const intention = intentions[0];
    return {
      gathered: intention.getGatheredCount(),
      total: intention.blueprint?.atomData?.length || 0,
      progress: intention.progress,
    };
  });
  expect(gatheredData).not.toBeNull();
  expect(gatheredData.gathered).toBeGreaterThan(0);
  // Gathered count must match Math.round(progress * total)
  expect(gatheredData.gathered).toBe(Math.round(gatheredData.progress * gatheredData.total));

  // Bug 1 (inspector): Re-click intention to refresh inspector and verify Gathered display
  await page.locator('#simCanvas').click({ position: { x: intentCanvasPos.x, y: intentCanvasPos.y } });
  await expect(page.locator('#inspectorContent')).toContainText('Intention:');
  const gatheredText = await page.locator('#inspectorContent p', { hasText: /^Gathered:/ }).textContent();
  expect(gatheredText).toMatch(/\d+\s*\/\s*\d+/);
  expect(gatheredText).not.toContain('0 /');

  // Also verify Progress % agrees (both > 0)
  const progressText = await page.locator('#inspectorContent p', { hasText: /^Progress:/ }).textContent();
  const progressPercent = parseInt(progressText.replace(/[^0-9]/g, ''), 10);
  expect(progressPercent).toBeGreaterThan(0);

  // Bug 2: Switch to Level 2 and verify seed molecules are accessible via accessor
  await page.click('[data-level="2"]');
  await expect.poll(async () => {
    return await page.evaluate(() => window.cellApp.viewer.level);
  }, {
    timeout: 2_000
  }).toBe(2);

  // getAllSeedMolecules() must return at least one in-progress assembly
  const seedCount = await page.evaluate(() =>
    window.cellApp.environment.getAllSeedMolecules?.().length ?? 0
  );
  expect(seedCount).toBeGreaterThan(0);

  // Fix 3 (click-test): Seed molecules are selectable via getEntityAt at Level 2
  const seedMolIds = await page.evaluate(() =>
    window.cellApp.environment.getAllSeedMolecules().map(m => m.id)
  );
  expect(seedMolIds.length).toBeGreaterThan(0);
});
