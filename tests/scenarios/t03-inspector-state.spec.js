// tests/scenarios/t03-inspector-state.spec.js
//
// Validates that clicking a molecule intention in Select mode populates
// the inspector panel with the correct fields.
// No spawner or simulation run needed — this is a pure UI state test.

import { test, expect, worldToScreen, placeEthyleneIntent } from '../fixtures/app.js';

test('T03: inspector reflects molecule intention state on selection', async ({ page }) => {
  // Place ethylene intent at world center (1000, 1000).
  // Camera starts centered at (1000, 1000), so screen center maps to world center.
  await placeEthyleneIntent(page, 1000, 1000);

  // Switch to Select tool so clicking the canvas selects entities
  await page.click('#selectTool');
  await page.waitForFunction(
    () => window.cellApp.controls.tool === 'select',
    { timeout: 3_000 }
  );

  // Click the canvas at world (1000, 1000) to select the intention.
  // The intent circle has radius 300 units, so clicking the center hits it.
  // worldToScreen delegates to viewer.worldToScreen() — avoids coordinate drift.
  const screenPos = await worldToScreen(page, 1000, 1000);
  await page.click('#simCanvas', {
    position: {
      x: Math.round(screenPos.x),
      y: Math.round(screenPos.y),
    },
  });

  // Wait for inspector tab to become active (controls._switchToInspectorTab() fires on selection)
  await page.waitForFunction(
    () => document.getElementById('inspectorTab')?.classList.contains('active'),
    { timeout: 3_000 }
  );

  // Assert inspector content contains the expected intention fields.
  // These match the HTML template in controls.js _updateInspector():
  //   <h3>Intention: ${bpName}</h3>
  //   <p>Type: ${intention.type}</p>
  //   <p>Progress: ${...}%</p>
  //   <p>Gathered: ${...} / ${...}</p>
  //   <p>Fulfilled: ${...}</p>
  const inspectorText = await page.locator('#inspectorContent').innerText();

  expect(inspectorText).toContain('Intention:');
  expect(inspectorText).toContain('Type:');
  expect(inspectorText).toContain('Progress:');
  expect(inspectorText).toContain('Gathered:');
  expect(inspectorText).toContain('Fulfilled:');

  // Assert intention type is 'molecule'
  expect(inspectorText).toContain('molecule');

  // Assert not yet fulfilled (simulation never started)
  expect(inspectorText).toContain('No');
});
