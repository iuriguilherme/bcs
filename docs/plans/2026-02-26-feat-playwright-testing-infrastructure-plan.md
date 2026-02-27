---
title: feat: Add Playwright Automated Testing Infrastructure
type: feat
status: active
date: 2026-02-26
origin: docs/brainstorms/2026-02-26-automated-testing-system-brainstorm.md
---

# feat: Add Playwright Automated Testing Infrastructure

## Enhancement Summary

**Deepened on:** 2026-02-26
**Research agents:** 8 parallel (best-practices, framework-docs, architecture-strategist, performance-oracle, race-conditions, code-simplicity, solution/IndexedDB, solution/overlapping-intents)

### Critical Bugs Found in the Plan (Must Fix Before Implementation)

| # | Bug | Location | Impact |
|---|---|---|---|
| 1 | `viewer.zoom` should be `viewer.camera.zoom` | `worldToScreen` helper | NaN for all canvas clicks — every canvas interaction silently broken |
| 2 | Speed slider caps at **2×** not 10× (`100/50 = 2.0`) | Fixture step 6 | T01 has <10s of safety margin; `maxAge` ceiling fires before timeout |
| 3 | T01 assertion `molecules.size >= 1` is vacuously true | T01 `waitForFunction` | Demo H₂O satisfies condition immediately — T01 always passes regardless of intent |
| 4 | `deleteDatabase` missing `onblocked`; live `catalogue.db` connection not closed first | Fixture step 4 | Deletion blocks silently; stale IndexedDB leaks between tests |
| 5 | `enableSpawner` silently drops `atomPool` parameter | `enableSpawner` helper | Wrong atoms spawn; failures look like physics non-determinism |
| 6 | `pageerror`/`crash` listeners registered after `goto()` — must be before | T05 design | Errors during navigation are missed |

### Key Improvements Added

- `playwright.config.js`: add `webServer` (auto-starts Python server), `workers: 1`, `fullyParallel: false`, correct `retries` strategy
- Fixture: remove redundant pre-delete `waitForFunction`, close `catalogue.db` before deleting, add `onblocked`, fix `worldToScreen` to delegate to `viewer.worldToScreen()`
- Fixture: `page.route()` **already disables HTTP cache unconditionally** — no-cache headers are redundant; keep route only if response modification is needed
- Fixture: composable layer design (`appReady` → `dbIsolated` → `fastSim`) documented
- T01: fix vacuous assertion; fix speed to `setSpeed(10)`; use `polling: 500` for long waits
- T02: promoted from stub to a full regression spec (overlapping intents bug is RESOLVED — **no** `test.fail()`)
- T04: add `claimedByIntentId` assumption note

---

## Overview

Establish a mandatory, evidence-based automated testing system using committed Playwright `.spec.js` files that prevents agents from claiming a feature or fix "works" without producing verifiable results. The simulation currently suffers from **false reports**: agents write code, run synthetic tests (or none at all), and mark tasks done — while real gameplay remains broken. This plan defines the complete setup, six required test scenarios, enforcement mechanisms, and CLAUDE.md mandate.

(see brainstorm: docs/brainstorms/2026-02-26-automated-testing-system-brainstorm.md)

---

## Problem Statement

The six known gameplay bugs (see brainstorm §"The Six Known Bug Categories") were found by the user through manual testing — not by agents. Agents have consistently:

1. Written fixes that pass synthetic pre-placed-atom tests but fail with the real `AtomSpawner`
2. Claimed "works" based on console inspection, not real UI interaction
3. Never pressed the Play button — testing code logic without running the simulation
4. Produced ephemeral evidence (screenshots from a browser session) that cannot be reproduced

The direct consequence: the user is the only real tester. This must end.

---

## Proposed Solution

**Playwright committed test scenarios** are the backbone. Scenario files live in `tests/scenarios/` as `.spec.js` files. Tests are run locally by agents before any "done" claim. Evidence (test run output) is attached to PRs.

> ⚠️ **The six initial scenarios are illustrative starting points, not a fixed specification.** As bugs are fixed and the simulation evolves, individual test assertions — the *what* being checked — will change. What is permanent and must be preserved is the **test infrastructure architecture**: the fixture pattern, the project layout, the `playwright.config.js` dual-project setup, and the enforcement rules in `CLAUDE.md`. Scenarios are replaced or updated as needed; the infrastructure is not.

The three approaches evaluated in the brainstorm (see §"Approaches Considered"):

| Approach | Decision | Reason |
|---|---|---|
| **A: Deno Unit Tests** | ❌ Rejected | Source files use browser globals; ES module refactor is out of scope; cannot catch emergent runtime bugs |
| **B: Playwright Committed Tests** | ✅ Primary | Tests real gameplay; committed to repo; mirrors user manual testing; reproducible |
| **C: Claude-in-Chrome** | 🔶 Supplementary | Valid for exploratory debugging only; ephemeral, not regression tests |

---

## Technical Approach

### Architecture

```
tests/
├── fixtures/
│   └── app.js              ← shared setup: cache bust, app ready, IndexedDB clear
├── scenarios/
│   ├── t01-single-molecule-intent.spec.js
│   ├── t02-concurrent-molecule-intents.spec.js
│   ├── t03-inspector-state.spec.js
│   ├── t04-polymer-intent.spec.js
│   ├── t05-cell-formation.spec.js
│   └── t06-view-consistency.spec.js
├── README.md               ← how to run, prerequisites, interpreting output
└── stub_test.ts            ← existing Deno CI stub (keep; do not remove)
playwright.config.js        ← repo root; two projects: dev.html and index.html
package.json                ← minimal; only @playwright/test dependency
.gitignore                  ← add node_modules/
```

### Living Test Suite Principle

The test suite is split into two layers with different stability guarantees:

| Layer | Files | Stability | When to change |
|---|---|---|---|
| **Infrastructure** (permanent) | `playwright.config.js`, `tests/fixtures/app.js`, `tests/README.md`, `CLAUDE.md` mandate | High — must not be removed or bypassed | Only when Playwright or the app's loading model changes |
| **Scenarios** (living) | `tests/scenarios/*.spec.js` | Low — expected to evolve | Any time a bug is fixed, a new gameplay scenario is added, or an assertion proves incorrect |

Agents must treat infrastructure edits as high-risk (require justification) and scenario edits as routine (update freely as the simulation changes).

### Fixture Composability (Research Finding)

The monolithic `page` fixture can be split into three composable layers for efficiency. Tests that don't need clean IndexedDB (read-only state inspection) skip the reload:

```
appReady   — navigate + waitForFunction(initialized)  [T03, T06]
dbIsolated — appReady + deleteDatabase + reload       [T01, T02, T04, T05]
fastSim    — dbIsolated + setSpeed(10)                [all physics tests]
```

Implemented via `base.extend()` chaining. The initial plan puts everything in one fixture; this is acceptable for v1, but splitting is the recommended evolution path once the suite grows.

### Key Design Decisions (from brainstorm §"Key Decisions")

- **Tests use real UI clicks**: Play pressed via `#playPauseBtn`, atoms from `AtomSpawner`, intents placed by clicking UI palette and canvas
- **Console is read-only**: `window.cellApp.*` state read for assertions; console commands never set up test conditions
- **Tests run against both pages**: `dev.html` (22 individual `<script src>` tags) and `index.html` (bundled) — both must pass. A fix that works in dev but not production is not valid.
- **No CI integration**: Playwright is too heavy for the GitHub Actions Ubuntu runner. Agents run locally. CI continues to run only `deno lint` and `deno test -A` (stub).
- **Server prerequisite**: `python -m http.server 8765` from the repo root (`cs1/`) must be running before any test. Agents are responsible for starting it.

---

### Implementation Phases

#### Phase 1: Playwright Setup & Foundation

**Goal**: A working, reproducible Playwright config that any agent can install and run.

Tasks:
- [ ] Create `package.json` with `@playwright/test` dependency
- [ ] Create `playwright.config.js` at repo root (with `webServer`, `workers: 1`, `fullyParallel: false`, `retries: process.env.CI ? 1 : 0`)
- [ ] Create `tests/fixtures/app.js` with corrected shared setup fixture (see bug fixes in Enhancement Summary)
- [ ] Create `tests/README.md` with prerequisites, run commands, and interpretation guide
- [ ] Add `node_modules/` and `package-lock.json` to `.gitignore`
- [ ] Commit `package.json`, `playwright.config.js`, `tests/fixtures/app.js`, `tests/README.md`

> ⭐ **`webServer` in `playwright.config.js` auto-starts the Python HTTP server** — no manual prerequisite needed. `reuseExistingServer: true` allows local dev to keep their own server.

**Additional note for `main.js`:** The improved fixture's `waitForFunction` exposes init errors via `window.__initError`. Add to `main.js`:
```javascript
// Near the DOMContentLoaded listener — enables actionable fixture error messages:
window.cellApp.init().catch(e => { window.__initError = e.message; console.error(e); });
```

**`package.json`**:
```json
{
  "name": "biochemsim-tests",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.42.0"
  },
  "scripts": {
    "test": "playwright test",
    "test:dev": "playwright test --project=dev",
    "test:prod": "playwright test --project=prod"
  }
}
```

Install commands:
```bash
npm install
npx playwright install chromium
```

**`playwright.config.js`**:
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/scenarios',
  timeout: 180_000,            // 3 min per test — polymer formation worst case
  retries: process.env.CI ? 1 : 0, // no retries locally (mask bugs); 1 on CI for timing variance
  fullyParallel: false,        // serial: simulation tests are CPU-heavy; parallel degrades timing
  workers: 1,                  // one worker: physics tests must not compete for CPU

  reporter: [['list'], ['html', { open: 'never' }]],

  // ⭐ Auto-starts the Python HTTP server. No manual prerequisite needed.
  // reuseExistingServer: true lets local dev keep their own server running.
  webServer: {
    command: 'python -m http.server 8765',
    url: 'http://localhost:8765',
    reuseExistingServer: true,
    timeout: 10_000,
  },

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  // Export a project name constant to avoid the string coupling described in architecture notes.
  // In tests/fixtures/app.js, check: testInfo.project.name === DEV_PROJECT
  projects: [
    {
      name: 'dev',               // ← referenced by string in app.js fixture; keep in sync
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8765',
      },
      testMatch: '**/*.spec.js',
    },
    {
      name: 'prod',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8765',
      },
      testMatch: '**/*.spec.js',
      retries: 0,                // bundle should be stable; no retry slack
    },
  ],
});
```

**`tests/fixtures/app.js`** — the shared test fixture:

> ⚠️ **Research findings applied** — see Enhancement Summary for the critical bugs fixed here vs. the original plan.

```javascript
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

    // 2. Cache-busting note: page.route() ALREADY unconditionally disables the
    //    browser's HTTP cache for this context. The route handler below is kept
    //    only for the no-cache headers (belt-and-suspenders). If you remove it,
    //    caching is still disabled by Playwright's routing activation.
    //    See: https://github.com/microsoft/playwright/issues/7220
    await page.route('**/*.{js,css}', async route => {
      try {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      } catch (e) {
        // If the server is not running, abort cleanly instead of hanging.
        console.error('Route intercept failed for', route.request().url(), e.message);
        await route.abort();
      }
    });

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
 * ⚠️ Bug in original plan: used `viewer.zoom` (undefined) instead of
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
 * Toggle the AtomSpawner on via UI click, then (if needed) configure
 * the atom pool via page.evaluate — the spawner modal requires shift+click
 * to open, which is a separate UI flow not covered by this helper.
 *
 * atomPool is applied via evaluate (not the modal) because:
 * - The modal requires shift+click → form interaction → apply button
 * - Setting the pool property directly is equivalent for test purposes
 * - This is "test scaffolding", not "bypassing the simulation" — the spawner
 *   still drip-feeds real atoms into the physics simulation.
 *
 * ⚠️ Bug in original plan: atomPool parameter was accepted but never applied.
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
```

---

#### Phase 2: Core Scenarios (T01–T03)

**Goal**: The three most tractable scenarios; these cover the happy path and a known cannibalization bug.

**T01: Spawner + Single Molecule Intent**

Target molecule: **Ethylene (C2H4, 6 atoms)**. This is the canonical test molecule — it requires 2 carbons and 4 hydrogens, is well-documented in MEMORY.md, and is the foundation of the polyethylene polymer chain.

- [ ] Create `tests/scenarios/t01-single-molecule-intent.spec.js`

```javascript
// tests/scenarios/t01-single-molecule-intent.spec.js
import { test, expect, pressPlay, enableSpawner } from '../fixtures/app.js';

test('T01: single ethylene molecule intent completes', async ({ page }) => {
  // Spawner zone at (400,400): away from world center demo atoms (H2O + 10 random atoms
  // placed by _addDemoAtoms() at init). C:H = 1:2 ratio for ethylene (C2H4).
  await page.evaluate(() => {
    window.cellApp.atomSpawner.zone = { x: 400, y: 400, width: 300, height: 300 };
    window.cellApp.atomSpawner.tickInterval = 8;
  });

  // enableSpawner now correctly sets the atomPool before toggling
  await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']); // 1:2 C:H ratio

  // Select ethylene blueprint from catalogue/palette and place at world (1000, 1000)
  // (Implementation note: use catalogue-ui click or drag from palette)
  // ... [canvas click interactions to place molecule intent] ...

  // Register console listener BEFORE pressing play
  const sealMessages = [];
  page.on('console', msg => {
    if (/ethylene|sealed|complete/i.test(msg.text())) sealMessages.push(msg.text());
  });

  await pressPlay(page);

  // Wait for intent to complete (up to 90s wall-clock).
  // IMPORTANT: Use polling: 500 — the default 'raf' polling checks on every animation
  // frame (60/s) which is wasteful for a convergence test that runs for tens of seconds.
  //
  // ⚠️ Bug in original plan: `molecules.size >= 1` was vacuously true because
  // _addDemoAtoms() places an H2O molecule at world center before the test starts.
  // The correct assertion is `some(m => m.atoms.length === 6)` for C2H4.
  await page.waitForFunction(
    () => {
      const mols = [...window.cellApp.environment.molecules.values()];
      // Check for intent fulfillment OR a 6-atom molecule (C2H4 = 2C + 4H).
      // Do NOT check `molecules.size >= 1` — demo H2O satisfies that immediately.
      const intents = [...window.cellApp.environment.intentions.values()];
      const intentFulfilled = intents.some(i => i.type === 'molecule' && i.fulfilled === true);
      const ethyleneExists = mols.some(m => m.atoms.length === 6);
      return intentFulfilled || ethyleneExists;
    },
    { timeout: 90_000, polling: 500 }
  );

  // Assert: at least one molecule with exactly 6 atoms (C2H4)
  const molAtomCounts = await page.evaluate(() => {
    const mols = [...window.cellApp.environment.molecules.values()];
    return mols.map(m => m.atoms.length);
  });
  expect(molAtomCounts.some(count => count === 6)).toBe(true);
});
```

**T02: Two Simultaneous Molecule Intents, Anti-Cannibalization**

> ✅ Bug status: `docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md` — RESOLVED. **Do NOT annotate with `test.fail()`.**
> This is a regression guard for five root causes (tar-ball, bond-breaking, anchor force, atom escape, free-atom repulsion). The ephemeral `test_spawner.spec.js` mentioned in the solution was never committed; this spec replaces it permanently.

- [ ] Create `tests/scenarios/t02-concurrent-molecule-intents.spec.js`

```javascript
// tests/scenarios/t02-concurrent-molecule-intents.spec.js
//
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
import { test, expect, pressPlay, enableSpawner } from '../fixtures/app.js';

// [Full implementation derived from solution file analysis — see agent output]
// The two-phase assertion approach (mid-run stuck-seed check + final state check)
// is critical: it gives actionable root-cause information before the test times out.
```

**T03: Inspector Reflects Intent State**

- [ ] Create `tests/scenarios/t03-inspector-state.spec.js`

```javascript
// tests/scenarios/t03-inspector-state.spec.js
// Place molecule intent at world (1000, 1000) = canvas center at default zoom.
// Switch to Select tool (#selectTool).
// Click canvas at screen center (worldToScreen(page, 1000, 1000)).
// Assert #inspectorContent contains: "Intention:", "Type:", "Progress:", "Gathered:", "Fulfilled:".
```

---

#### Phase 3: Complex Scenarios (T04–T06)

> ⚠️ These scenarios exercise known broken code paths (see brainstorm §"The Six Known Bug Categories"). Use `test.fail()` annotation on first commit. When the underlying bug is fixed, the annotation becomes visible technical debt to clean up.

**T04: Polymer Intent + 3 Molecule Intents**

- [ ] Create `tests/scenarios/t04-polymer-intent.spec.js`

```javascript
// tests/scenarios/t04-polymer-intent.spec.js
test.fail(); // Known bug: atom locking; polymer never seals

// Setup: 3 ethylene molecule intents at (900,940), (1100,940), (1000,1100)
//        1 polyethylene polymer intent at (1000, 1000)
// Spawner: C and H atoms, zone: (800,800,400,400)
// Assert polymer seals: listen for console /sealed/i OR
//   window.cellApp.environment.polymers.size > 0 within 120s
// Assert no atom locking after sealing:
//   [...env.atoms.values()].every(a =>
//     a.claimedByIntentId === null ||
//     env.intentions.has(a.claimedByIntentId)
//   )
//
// ⚠️ ASSUMPTION: `atom.claimedByIntentId` exists on atom objects. If atom locking
//    was never implemented (vs. implemented but not releasing), this field is
//    `undefined` and `undefined === null` is false — the assertion passes vacuously.
//    When implementing this test, first confirm the field exists in atom.js.
//    If undefined, adjust the assertion to check the locking mechanism's actual API.
```

**T05: Full E2E Cell Formation**

- [ ] Create `tests/scenarios/t05-cell-formation.spec.js`

```javascript
// tests/scenarios/t05-cell-formation.spec.js
test.fail(); // Known bug: E2E cell path never completes; atoms get cramped

// Register crash listener:
//   page.on('crash', () => fail('browser crashed'));
//   page.on('pageerror', err => fail(`JS error: ${err.message}`));
// Place cell intent. Press Play. Wait 180s.
// Assert: window.cellApp.environment.cells.size > 0
// Assert: no browser crash (crash listener fires test failure)
```

**T06: View Consistency Across Zoom Levels**

- [ ] Create `tests/scenarios/t06-view-consistency.spec.js`

```javascript
// tests/scenarios/t06-view-consistency.spec.js
// After a molecule intent completes (reuse T01 setup):
// Level 0 (atoms): env.molecules.size > 0 AND atoms drawn (canvas not all-black)
// Level 1 (molecules): click [data-level="1"]; env.molecules.size > 0
// Level 2 (polymers): click [data-level="2"]; simulation entities still non-zero
// NOTE: Individual atoms are intentionally invisible at Level 1+.
//   The bug being tested is entities disappearing entirely (0 molecules rendered),
//   not individual atom circles. Assert env.molecules.size > 0 at each level,
//   not canvas pixel sampling.
```

---

#### Phase 4: CLAUDE.md Mandate & Documentation

**Goal**: Enforcement is codified so future agents cannot bypass it.

- [ ] Add **Testing Requirements** section to `CLAUDE.md`
- [ ] Complete `tests/README.md` with run instructions, prerequisites, and output interpretation

**CLAUDE.md addition** (under Testing section):

```markdown
## Testing Requirements (Mandatory)

### Before Marking Any Task Done

Agents MUST run Playwright tests before marking any fix or feature complete.

**Required evidence:**
1. Test file path (committed to `tests/scenarios/`)
2. Playwright output showing the relevant test(s) passing
3. No regressions on previously passing tests

**Claiming "works" without this evidence is not acceptable.**

### Running Tests

Prerequisites:
1. Start the HTTP server: `python -m http.server 8765` (from `cs1/` directory)
2. Install dependencies (first time): `npm install && npx playwright install chromium`
3. Build production bundle if testing `index.html`: `deno run --allow-read --allow-write --allow-run build.ts`

Run all tests:
```bash
npm test
```

Run dev only:
```bash
npm run test:dev
```

Run a specific scenario:
```bash
npx playwright test t01
```

### Test Validity Rules

- **The simulation MUST run**: Every test must click `#playPauseBtn`. Tests that never start the simulation are invalid.
- **No console-injection setup**: Tests must not use `window.cellApp.*` calls to set up test conditions. Console is observation-only.
- **Both pages must pass**: `dev.html` and `index.html` must both pass. A fix that works in dev but fails in production is not a valid fix.
- **Spawner-based atom delivery**: Atoms must come from `AtomSpawner`, not manual placement. This mirrors real gameplay.

### Test Annotations

- `test.fail()` — test exercises a known bug; expected to fail. When bug is fixed, remove annotation.
- `test.skip()` — test is temporarily disabled. Must include a comment explaining why.
```

---

## Alternative Approaches Considered

(Carried forward from brainstorm §"Approaches Considered")

| Approach | Status | Reason |
|---|---|---|
| Deno Unit Tests | ❌ Rejected | Source files use `window.*` globals; ES module refactor is prohibitively large. More importantly, the actual bugs are emergent simulation behavior (physics, timing, multi-agent competition) — not pure function logic. Unit tests cannot catch them. |
| Claude-in-Chrome Scripts | 🔶 Supplementary | Valid for exploratory debugging in a single session. Not reproducible, not committed, not in CI — same ephemeral problem that created false reports. Valid as a tool alongside, not as replacement. |
| Playwright Committed Tests | ✅ Chosen | Reproducible, committed, mirrors real user behavior, can read `window.cellApp` state without modifying it, catches runtime emergent failures. |

---

## System-Wide Impact

### Interaction Graph

The test infrastructure does not change simulation code. The system-wide impact is on the **agent workflow**:

```
Agent implements fix
    ↓
Playwright test is written/updated (mandatory)
    ↓
HTTP server started (prerequisite)
    ↓
npm test (runs against dev.html and index.html)
    ↓
Output captured and attached to PR
    ↓
"Done" claim is valid
```

For the `CLAUDE.md` mandate: adding a **Testing Requirements** section replaces the existing "No automated test framework is set up" paragraph. This is a documentation change with behavioral enforcement for agents.

### IndexedDB Isolation

`Catalogue` persists to IndexedDB (`CellSimulatorCatalogue` database). If tests do not clear this between runs, discovered blueprints from one test contaminate the next. The fixture deletes the database before each test via:
```javascript
indexedDB.deleteDatabase('CellSimulatorCatalogue')
```
Then reloads the page to re-initialize from a clean catalogue.

### Demo Atom Contamination

`_addDemoAtoms()` runs on every `App.init()` and places an H₂O molecule plus 10 random atoms (C, H, O, N) at world center. These are present before any intention is placed. Mitigation:
- Set spawner zone at (400, 400) — away from world center
- Target ethylene (C2H4) for T01, which is unlikely to match the demo H₂O
- Accept that demo atoms are part of the "real gameplay" environment

### Error & Failure Propagation

For T05 specifically:
- `page.on('crash', ...)` catches browser tab crashes
- `page.on('pageerror', ...)` catches unhandled JavaScript exceptions
- Both must be registered **before** `pressPlay()` to capture errors during simulation

### State Lifecycle Risks

Since tests reload the page between runs, the risk of shared live state is minimal. The primary risk is IndexedDB (handled by the fixture) and Playwright browser context reuse across test files. The `playwright.config.js` creates a new browser context per test file by default.

### API Surface Parity

The only API surface change is in `CLAUDE.md` and `tests/`. No simulation source files are modified in this plan. The `deno.json` linter excludes `tests/` already — no change needed.

### Integration Test Scenarios

These ARE the integration test scenarios. Cross-layer flows not caught by unit tests:

| Scenario | Cross-layer path |
|---|---|
| T01 | AtomSpawner → Intention._rule7 → Bond formation → Molecule.isStable() → Catalogue.autoDiscover() |
| T02 | Two parallel Intentions competing for same atom pool via _rule3/_rule6 |
| T04 | Molecule intents → Polymer intent._attractComponents → PolymerBlueprint.seal() |
| T05 | Full stack: Cell intent → Prokaryote factory → neural network init |

---

## Acceptance Criteria

### Functional Requirements

- [ ] `package.json` created with `@playwright/test` dependency
- [ ] `playwright.config.js` created at repo root with two projects: `dev` (dev.html) and `prod` (index.html)
- [ ] `tests/fixtures/app.js` created with corrected fixture: `pageerror`/`crash` listeners before `goto()`, IndexedDB connection closed before delete, `onblocked` handler, single `waitForFunction` after reload, `setSpeed(10)` (not slider), `worldToScreen` delegating to `viewer.worldToScreen()`, `enableSpawner` correctly applying `atomPool`
- [ ] **Initial** six scenario files committed to `tests/scenarios/` (scenarios are living — assertions may be revised as simulation evolves; filenames and structure are illustrative):
  - `t01-single-molecule-intent.spec.js` (passes both projects)
  - `t02-concurrent-molecule-intents.spec.js` (passes both projects)
  - `t03-inspector-state.spec.js` (passes both projects)
  - `t04-polymer-intent.spec.js` (`test.fail()` annotated — expected until atom-locking bug is fixed)
  - `t05-cell-formation.spec.js` (`test.fail()` annotated — expected until E2E cell path is fixed)
  - `t06-view-consistency.spec.js` (passes both projects)
- [ ] `tests/README.md` documents: prerequisites, install commands, run commands, output interpretation, `test.fail()` meaning
- [ ] `CLAUDE.md` updated with Testing Requirements section including the mandatory evidence rule
- [ ] `.gitignore` updated to exclude `node_modules/` and `package-lock.json`
- [ ] `stub_test.ts` preserved (do not remove; CI depends on it)

### Non-Functional Requirements

- [ ] T01 completes within 90s wall-clock on a mid-range laptop
- [ ] T03 completes within 10s (inspector-only, no spawner wait)
- [ ] T04/T05 annotated as `test.fail()` — tests run but expected to fail; if unexpectedly they pass, Playwright reports this as a failure (a good signal the bug was fixed)
- [ ] Screenshot and video artifacts captured on failure (via `playwright.config.js` `use.screenshot` and `use.video` settings)

### Quality Gates

- [ ] `npm test` runs without configuration error (server running at 8765 assumed)
- [ ] `npm run test:dev` produces clean output showing 6 tests (T01, T02, T03, T06 pass; T04, T05 expected-fail)
- [ ] No Deno lint regressions (`deno lint` still passes)
- [ ] CI `deno test -A` still passes (`stub_test.ts` unchanged)

---

## Success Metrics

The testing system is working correctly when:

1. **An agent can reproduce a test run** — any agent following `tests/README.md` gets the same pass/fail results
2. **T04/T05 flip to green** when the corresponding bugs (atom locking, E2E cell path) are fixed — the `test.fail()` annotation itself becomes a breaking signal that prompts annotation removal
3. **False "done" claims drop to zero** — no PR is merged that doesn't include Playwright output in the evidence
4. **New bug regressions are caught automatically** — a future fix that breaks T01 is discovered before the PR merges

---

## Dependencies & Prerequisites

| Prerequisite | Details | Blocking? |
|---|---|---|
| Python 3 | `python3 -m http.server 8765` from `cs1/` | ✅ Yes |
| Node.js + npm | For `npm install` and `npx playwright install` | ✅ Yes |
| Chromium | Installed via `npx playwright install chromium` | ✅ Yes |
| Production bundle | Run `deno run ... build.ts` before testing `index.html` | Only for prod project |
| Port 8765 free | No other process using this port | ✅ Yes |

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Non-deterministic physics causes flaky tests | High | Medium | `retries: process.env.CI ? 1 : 0`; `polling: 500` for long `waitForFunction`; `AtomSpawner` with real params |
| T01/T02 contaminated by demo atoms | Medium | Low | Spawner zone at (400,400); assert `m.atoms.length === 6`, not `molecules.size >= 1` |
| Browser JS cache makes stale code appear as new | High | Critical | `page.route()` activation already disables cache unconditionally; headers are belt-and-suspenders |
| IndexedDB delete blocked by live connection | High | High | Close `catalogue.db` explicitly before calling `deleteDatabase`; add `onblocked` handler |
| IndexedDB contamination between tests | Medium | Medium | `deleteDatabase` + page reload; monomer templates re-seed from MONOMER_TEMPLATES, not DB |
| Port 8765 not running when tests start | Low | High | `webServer` in `playwright.config.js` auto-starts; eliminated as a manual prerequisite |
| T04-T06 become permanent expected-failures | Medium | Low | `test.fail()` annotation is self-documenting technical debt; addressed by fixing the bugs |
| `test.fail()` annotations + retries waste CPU | Low | Low | Per-describe `test.describe.configure({ retries: 0 })` for `test.fail()` groups |
| Intention `maxAge` (10,000 ticks) fires before 90s timeout at 2× | High | High | Use `setSpeed(10)` (not slider); at 10× speed, 10,000 ticks = ~17s, well inside 90s window |
| `worldToScreen` calculation NaN from `viewer.zoom` | Was Critical | Fixed | Delegate to `viewer.worldToScreen()` — eliminated by corrected fixture |

---

## Documentation Plan

The following docs need updating as part of this plan:

1. **`CLAUDE.md`** — Replace "No automated test framework is set up" with the full Testing Requirements mandate
2. **`tests/README.md`** — New file; complete guide to running the suite
3. **`AGENTS.md`** — Add a note cross-referencing the Playwright scenarios (optional, out of scope for this plan)

---

## Sources & References

### Origin

**Brainstorm document:** [docs/brainstorms/2026-02-26-automated-testing-system-brainstorm.md](../brainstorms/2026-02-26-automated-testing-system-brainstorm.md)

Key decisions carried forward:
- Playwright as primary backbone; Deno unit tests rejected; Chrome MCP as supplementary only
- Tests use UI clicks, never console injection; console is observation-only
- CLAUDE.md mandate as enforcement Layer 1; committed test files as Layer 2
- Tests target both `dev.html` and `index.html`; both must pass

### Internal References

- Simulation global API: `src/main.js:986` — `window.cellApp = new App()`
- App init signal: `src/main.js:92` — `this.initialized = true`
- Play button: `dev.html` `#playPauseBtn`; state: `window.cellApp.simulation.running`
- Atom locking field: `src/entities/atom.js` — `atom.claimedByIntentId`
- Demo atom setup: `src/main.js` — `_addDemoAtoms()`
- Spawner active flag: `src/systems/atom-spawner.js` — `AtomSpawner.active` (not `enabled`)
- Intentions Map: `src/core/environment.js` — `env.intentions` (Map, iterate with `.values()`)
- Browser cache gotcha: `docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md:129`
- Synthetic vs real gameplay: same file, lines 108–127

### External References

- Playwright docs: https://playwright.dev/docs/intro
- Playwright `page.route` for caching: https://playwright.dev/docs/network#modify-responses
- Playwright `test.fail()` annotation: https://playwright.dev/docs/api/class-test#test-fail

### Related Work

- Previous plan: `docs/plans/2026-01-23-fix-molecule-intent-system-plan.md`
- Monomer seeding plan: `docs/plans/2026-02-26-fix-show-monomers-in-catalogue-ui-plan.md`
