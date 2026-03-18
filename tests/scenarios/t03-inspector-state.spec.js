import { test, expect, pressPlay, enableSpawner, placeEthyleneIntent } from '../fixtures/app.js';

// Place molecule intent at world (1000, 1000) = canvas center at default zoom.
// Switch to Select tool (#selectTool).
// Click canvas at screen center (worldToScreen(page, 1000, 1000)).
// Assert #inspectorContent contains: "Intention:", "Type:", "Progress:", "Gathered:", "Fulfilled:".

test('T03: Inspector reflects intent state', async ({ page }) => {
  // Place ethylene molecule intent at world center (1000, 1000)
  await placeEthyleneIntent(page, 1000, 1000);

  // Switch to Select tool
  await page.click('#selectTool');

  // Click canvas at screen center (world coordinates 1000, 1000)
  await page.click('canvas'); // Click center of canvas - we'll use worldToScreen for precision

  // More precise: calculate screen coordinates for world (1000, 1000)
  const centerClick = await page.evaluate(async () => {
    const screenPos = window.cellApp.viewer.worldToScreen(1000, 1000);
    return { x: screenPos.x, y: screenPos.y };
  });

  // Actually click at the calculated position
  await page.mouse.click(centerClick.x, centerClick.y);

  // Assert inspector content shows the expected fields
  const inspectorContent = await page.textContent('#inspectorContent');
  expect(inspectorContent).toContain('Intention:');
  expect(inspectorContent).toContain('Type:');
  expect(inspectorContent).toContain('Progress:');
  expect(inspectorContent).toContain('Gathered:');
  expect(inspectorContent).toContain('Fulfilled:');
});