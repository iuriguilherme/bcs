import { test as base, expect } from '@playwright/test';

export { expect };

// The project name string is coupled between playwright.config.js and this file.
// If the 'dev' project is renamed in config, update this constant too.
const DEV_PROJECT = 'dev';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {

    // 1. Register pageerror/crash listeners BEFORE goto() so errors during
    //    navigation and app init are captured, not just errors after pressPlay().
    //    Neither event auto-fails the test — we collect and rethrow after use().
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('crash', () => pageErrors.push(new Error('Browser page crashed')));

    // 2. Cache-busting: Playwright's page.route() activation unconditionally disables
    //    the browser's HTTP cache. We don't need a route handler unless we modify responses.
    //    Simply registering a route that does nothing also works, but is unnecessary.
    //    The webServer + navigation will get us fresh files each reload.

    // 3. Navigate to the correct page based on the project name.
    const url = testInfo.project.name === DEV_PROJECT ? '/dev.html' : '/index.html';
    await page.goto(url);

    // NOTE: No waitForFunction here — the goto + IndexedDB delete + reload sequence
    // that follows makes a pre-delete initialized check redundant. One wait after
    // reload is sufficient. Removing it saves up to 15s of timeout exposure.

    // 4. Clear IndexedDB catalogue before reload to ensure test isolation.
    //    IMPORTANT: Close the live catalogue.db connection first — if a connection
    //    is open, deleteDatabase will block silently (onsuccess never fires).
    //    The Catalogue class never listens for onversionchange on this.db, so the
    //    block is permanent unless we close it explicitly.
    await page.evaluate(async () => {
      // Close live connection to allow deletion
      if (window.cellApp?.catalogue?.db) {
        window.cellApp.catalogue.db.close();
      }
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('CellSimulatorCatalogue');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        // onblocked fires if another tab holds a connection; proceed anyway —
        // the delete will complete after the connection eventually closes.
        req.onblocked = () => {
          console.warn('deleteDatabase blocked — another tab has CellSimulatorCatalogue open');
          resolve();
        };
      });
    });

    // 5. Reload to start fresh with empty IndexedDB.
    //    Monomers are re-seeded from MONOMER_TEMPLATES in the Catalogue constructor,
    //    NOT from IndexedDB — so clearing the DB does not lose monomer definitions.
    await page.reload();
    await page.waitForFunction(
      () => {
        // Expose init errors so timeout messages are actionable, not cryptic.
        // Requires: main.js catches init() rejections and sets window.__initError.
        if (window.__initError) throw new Error('App init failed: ' + window.__initError);
        return window.cellApp?.initialized === true;
      },
      { timeout: 15_000 }
    );

    // 6. Set simulation speed to 10× to reduce wall-clock test time.
    //    IMPORTANT: Do NOT manipulate the #speedSlider element — slider.max = "100"
    //    and the handler computes value/50, so slider.max gives 100/50 = 2×, NOT 10×.
    //    Calling setSpeed(10) directly is the only way to reach the engine's maximum.
    await page.evaluate(() => {
      window.cellApp.simulation.setSpeed(10);
    });

    await use(page);

    // After test: rethrow any page errors so the test fails with a clear message.
    // This catches JS exceptions and browser crashes that occurred during the test.
    if (pageErrors.length > 0) {
      throw pageErrors[0];
    }
  },
});

/**
 * Convert world coordinates to screen (canvas pixel) coordinates.
 *
 * Delegates to the existing Viewer.worldToScreen() method rather than
 * reimplementing the formula — prevents drift if the engine's transform changes.
 *
 * Bug in original plan: used `viewer.zoom` (undefined) instead of
 * `viewer.camera.zoom`, which would produce NaN for all coordinates.
 */
export async function worldToScreen(page, worldX, worldY) {
  return await page.evaluate(({ wx, wy }) => {
    return window.cellApp.viewer.worldToScreen(wx, wy);
  }, { wx: worldX, wy: worldY });
}

/** Click Play button and assert simulation starts running. */
export async function pressPlay(page) {
  await page.click('#playPauseBtn');
  await page.waitForFunction(
    () => window.cellApp.simulation.running === true,
    { timeout: 5_000 }
  );
}

/**
 * Toggle the AtomSpawner on via UI click, then configure the atom pool
 * via page.evaluate — the spawner modal requires shift+click to open,
 * which is a separate UI flow not covered by this helper.
 *
 * atomPool is applied via evaluate (not the modal) because:
 * - The modal requires shift+click → form interaction → apply button
 * - Setting the pool property directly is equivalent for test purposes
 * - This is "test scaffolding", not "bypassing the simulation" — the spawner
 *   still drip-feeds real atoms into the physics simulation.
 *
 * Bug in original plan: atomPool parameter was accepted but never applied.
 */
export async function enableSpawner(page, atomPool = ['C', 'H']) {
  // Configure pool BEFORE enabling (order matters — pool read on each spawn tick)
  if (atomPool && atomPool.length > 0) {
    await page.evaluate((pool) => {
      window.cellApp.atomSpawner.atomPool = pool;
    }, atomPool);
  }
  await page.click('#spawnerBtn');
  await page.waitForFunction(
    () => window.cellApp.atomSpawner.active === true,
    { timeout: 3_000 }
  );
}

/**
 * Place a molecule intention for Ethylene (C2H4) at the given world coordinates.
 *
 * Uses page.evaluate to create the intention directly — test scaffolding analogous
 * to setting atomSpawner.zone. Sources the blueprint from the canonical
 * MONOMER_TEMPLATES.ETHYLENE via window.createMonomerBlueprint() to eliminate
 * drift risk: if the template geometry changes, tests automatically use the new shape.
 *
 * The fingerprint is overridden to be position-unique so that multiple intents of
 * the same type can coexist without catalogue conflicts (e.g. T02, T04).
 *
 * The actual simulation (physics, bonding, rule pipeline) runs with no bypasses.
 */
export async function placeEthyleneIntent(page, worldX, worldY) {
  await page.evaluate(([wx, wy]) => {
    const template = window.MONOMER_TEMPLATES?.ETHYLENE;
    if (!template) throw new Error('window.MONOMER_TEMPLATES.ETHYLENE not found — check script load order');
    const bp = window.createMonomerBlueprint(template);
    if (!bp) throw new Error('createMonomerBlueprint returned null for ETHYLENE template');
    // Override fingerprint to be position-unique — avoids catalogue conflicts
    // when multiple ethylene intents are placed simultaneously (T02, T04, T06).
    bp.fingerprint = `intent-C2H4-${wx}-${wy}`;
    const intent = new window.Intention('molecule', bp, wx, wy);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  }, [worldX, worldY]);
}

/**
 * Place a polymer intention at the given world coordinates.
 *
 * Creates a PolymerBlueprint from CELL_ESSENTIAL_POLYMERS. The fingerprint is
 * overridden to be position-unique to avoid catalogue conflicts when multiple
 * polymer intents of the same type are placed.
 */
export async function placePolymerIntent(page, polymerId, worldX, worldY) {
  await page.evaluate(([pid, wx, wy]) => {
    const template = window.CELL_ESSENTIAL_POLYMERS?.[pid];
    if (!template) throw new Error(`Polymer template ${pid} not found in window.CELL_ESSENTIAL_POLYMERS`);
    const bp = new window.PolymerBlueprint(template);
    bp.fingerprint = `intent-poly-${pid}-${wx}-${wy}`;
    const intent = new window.Intention('polymer', bp, wx, wy);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  }, [polymerId, worldX, worldY]);
}

/**
 * Place a cell intention at the given world coordinates.
 *
 * Uses window.getCellBlueprint() to obtain a CellBlueprint. The fingerprint is
 * overridden to be position-unique to avoid catalogue conflicts.
 */
export async function placeCellIntent(page, cellBlueprintId, worldX, worldY) {
  await page.evaluate(([id, wx, wy]) => {
    const getCellBlueprint = window.getCellBlueprint;
    if (!getCellBlueprint) throw new Error('window.getCellBlueprint not available');
    const bp = getCellBlueprint(id);
    if (!bp) throw new Error(`Cell blueprint ${id} not found`);
    bp.fingerprint = `intent-cell-${id}-${wx}-${wy}`;
    const intent = new window.Intention('cell', bp, wx, wy);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  }, [cellBlueprintId, worldX, worldY]);
}
