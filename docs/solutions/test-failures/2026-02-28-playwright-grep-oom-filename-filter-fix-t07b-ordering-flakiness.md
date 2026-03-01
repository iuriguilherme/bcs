---
title: "Playwright --grep OOM crash and T07b ordering flakiness from residual environment state"
date: 2026-02-28
category: test-failures
tags:
  - playwright
  - chromium
  - out-of-memory
  - grep
  - test-filtering
  - test-isolation
  - environment-clear
  - ordering-flakiness
  - t07
  - t07b
  - heap-exhaustion
module: Test Infrastructure
symptom: "npm test -- --grep='T07' crashes Node with out-of-memory; T07b fails non-deterministically depending on which test ran before it"
root_cause: "--grep pattern-matches across all test files causing simultaneous Chromium V8 snapshot deserializations that exhaust heap; T07b timing depends on whether T05's residual atoms have been cleared from the environment before T07b starts"
---

# Playwright `--grep` OOM Crash and T07b Ordering Flakiness

Two distinct test-infrastructure failures discovered while running the T07/T07b intention-display regression tests after the `fix/intention-display-bugs` branch landed.

---

## Failure 1: `--grep` Causes Out-of-Memory Crash

### Symptom

Running the test suite with a grep pattern to filter to the T07 tests:

```bash
npm test -- --grep="T07"
```

Crashes mid-run with a Node.js out-of-memory error. The crash is non-deterministic in timing but reproducible on the configuration: `workers: 1`, `fullyParallel: false`, `retries: process.env.CI ? 1 : 0`.

### Root Cause

`--grep` is a Playwright pattern filter applied at **test registration time** — not at file load time. Playwright must load and parse **all test files** to evaluate which tests match the pattern. When combined with `retries`, the grep evaluation runs again for each retry attempt, resulting in two concurrent test-runner initialisation passes both loading all test files simultaneously.

Each test file (T01 through T07b) calls `page.goto()` which triggers a Chromium V8 heap snapshot deserialisation. With two concurrent initialisations, two V8 snapshot deserialisations run in parallel, exceeding the available heap on the development machine.

The long-running physics simulations (T01: 6000–8000 ticks, T05: 120 atoms/sec spawn rate) already hold large JS heaps (live atom, bond, and molecule objects). Adding a second concurrent deserialisation crosses the OOM threshold.

### Confirmation

```bash
# CRASHES — grep loads all files, concurrent V8 deserialization on retry
npm test -- --grep="T07"

# Works — filename filter restricts which files Playwright even opens
npm run test:dev -- "t07-intention-display"
```

The dev-only variant works because the file path argument is resolved before Playwright starts its worker pool — only `t07-intention-display.spec.js` is ever loaded, so there is only one V8 deserialisation path.

### Fix

Use **filename-based filtering** instead of `--grep` when targeting a subset of tests:

```bash
# Run only T07 tests (dev)
npm run test:dev -- "t07-intention-display"

# Run only T07 tests (both dev + prod)
npx playwright test t07-intention-display

# Run all tests (never use --grep on this suite)
npm test
npm run test:dev
```

No changes to source files were needed. This is a workflow/process fix.

---

## Failure 2: T07b Non-Deterministic Ordering Flakiness

### Symptom

`T07b` (seed atoms invisible at Level 2 regression test) passes when run in isolation:

```bash
npx playwright test t07-intention-display
```

But fails non-deterministically when the full suite runs and T05 executed immediately before it. T07b's wait conditions time out or the atom count assertion fails.

### Root Cause

T05 spawns atoms at a high rate (120 atoms/sec, `tickInterval: 1`) over its full test duration. After T05 completes, these atoms remain in the environment (persisted via IndexedDB) unless `env.clear()` is explicitly called. When T07b starts in the same browser context, it inherits T05's residual atoms.

T07b's timing is calibrated for a near-empty environment: it waits for seed molecules to acquire atoms within a fixed timeout window. With hundreds of residual atoms already present, the spawner's atom pool is effectively diluted — atoms that T07b's molecule intention needs are competing with T05's leftover atoms for bonding slots, slowing assembly past the timeout threshold.

The flakiness is ordering-dependent: T07b passes when T05 does not precede it (e.g., when running the file in isolation), and fails when it does.

### Fix

Add `environment.clear()` at the start of the T07b test body, before any spawner or intention setup:

```javascript
// tests/scenarios/t07-intention-display.spec.js

test('T07b: seed molecule atoms visible at Level 2', async ({ page }) => {
    // ...setup...

    await page.evaluate(() => {
        // Clear residual state from any previously-run test in this context
        window.cellApp.environment.clear();
    });

    // ...rest of test...
});
```

This was already the established pattern from `MEMORY.md`:

> `env.clear()` needed before tests — environment persists atoms via IndexedDB

T07 (the first test in the file) already did this; T07b was added without it.

---

## Prevention Strategies

### 1. Never use `--grep` on the BioChemSim test suite

`--grep` is unsafe for any Playwright project where:
- Tests perform heavy JS heap work (physics simulation, canvas rendering)
- `retries > 0` is configured
- Test files are numerous

The only safe way to select a test subset in this project is by **filename**:

```bash
# Safe — filename filter, resolved before workers start
npx playwright test t07          # matches any file containing "t07"
npx playwright test t07-intention-display  # exact file match

# Unsafe — loads all files, OOM on retry
npm test -- --grep="T07"
npm test -- --grep="T07.*seed"
```

**Quick reference — the four safe commands:**

| Intent | Command |
|---|---|
| Run all tests (dev + prod) | `npm test` |
| Run all tests (dev only) | `npm run test:dev` |
| Run specific file (dev + prod) | `npx playwright test t07-intention-display` |
| Run specific file (dev only) | `npm run test:dev -- "t07-intention-display"` |

### 2. Always call `environment.clear()` at the start of every test

Every test in `tests/scenarios/` must begin with `environment.clear()` inside a `page.evaluate()` block:

```javascript
test('T0N: my new test', async ({ page }) => {
    await page.goto('dev.html');
    await page.click('#playPauseBtn');

    // MANDATORY — prevent state bleed from prior tests
    await page.evaluate(() => {
        window.cellApp.environment.clear();
    });

    // ...test body...
});
```

**Why this is not optional**: Environment state persists through IndexedDB. Atoms, molecules, intentions, and seed molecules from a prior test are still present when the next test starts in the same context. Missing `env.clear()` produces ordering-dependent timing failures that appear intermittent.

**Checklist when writing a new test:**
- [ ] Does the test call `environment.clear()` before any spawner or intention setup?
- [ ] Does the test call `#playPauseBtn` click before any `page.evaluate` that touches `window.cellApp`?
- [ ] Does the test set `spawner.active = true` explicitly after the clear (the clear resets spawner state)?

### 3. Detecting state-leakage flakiness

**Signature of an ordering-dependent failure:**
- Test passes when run in isolation (`npx playwright test tNN`)
- Test fails when preceded by a specific other test
- Failure mode is a timeout on a `waitForFunction` or assertion on an entity count

**Debugging steps:**
1. Run the failing test in isolation. If it passes, the failure is ordering-dependent.
2. Add `environment.clear()` at the start of the test body and re-run the full suite.
3. If the failure disappears, state leakage was the cause.
4. If the failure remains, the test has a genuine logic bug.

### 4. Memory-conscious test design

For new tests that run long physics simulations:

- **Prefer direct injection over spawn-and-wait**: Inject entities with `page.evaluate` (equivalent to `atomSpawner.zone` setup) rather than waiting for the spawner to produce them organically. Reduces simulation ticks needed per test.
- **Use `tickInterval: 8` as baseline**: T01–T07 use this. Lower values (`tickInterval: 1`) spike memory rapidly — only reduce for tests that genuinely require high spawn density.
- **Avoid `Debug.enable('intentions')` in tests**: This floods the Playwright console message buffer. Each `console.*` call inside a test's page context is buffered in memory for the duration of the test.

### 5. `--grep` danger zones in Playwright

Contexts where `--grep` is especially dangerous:

| Config | Risk | Reason |
|---|---|---|
| `retries: 1` + `--grep` | Very high | Triggers concurrent file loading on first retry |
| `video: 'on'` + long physics tests | High | Video encoder holds frame buffers for full test duration |
| `workers: 1, fullyParallel: false` + `--grep` | High | Serial retry still loads all files for pattern matching |
| `workers: 4` + `--grep` | Moderate | OOM depends on machine RAM |

---

## Related Documentation

- **[`docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`](playwright-test-infrastructure-audit-8-findings-20260226.md)** — Prior 8-finding audit of the Playwright infrastructure. Documents: `webServer` timeout race condition (10s → 30s), T06 90-second physics wait removed via direct injection, `video: 'on'` vs `retain-on-failure` choice, `?.() || []` silent-failure pitfall, `test.fail()` vs `test.skip()` semantics, XSS in blueprint name rendering.

- **[`docs/solutions/performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md`](../performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md)** — Code-review findings that directly reduce test-context memory: `atoms.slice()` defensive copy removed (60fps allocation), `getRequirements()` redundant object removed (inspector tick path), `console.warn` at 60fps removed (Playwright console buffer growth). Read together with this document.

- **[`docs/solutions/ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md`](../ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md)** — The feature branch that introduced T07 and T07b. Documents `getAllSeedMolecules()` accessor, `_renderSeedMoleculeAtoms()` helper, and the two-pipeline asymmetry that T07b exercises.

- **[`docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`](../logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md)** — Stuck-intention behaviour (intention runs its pipeline indefinitely). Relevant because a stuck intention running for the full test timeout duration sustains memory growth for the entire timeout window.

---

## Discovery

- **OOM crash**: Discovered when running `npm test -- --grep="T07"` locally to verify T07/T07b after the `fix/intention-display-bugs` branch landed. Node exited with a heap allocation failure mid-run.
- **T07b flakiness**: Observed during the full `npm test` run on the same branch. T07b passed 3/5 runs, failing the other 2. Isolated to ordering by running `npx playwright test t07-intention-display` (always passed) vs the full suite (intermittent).
