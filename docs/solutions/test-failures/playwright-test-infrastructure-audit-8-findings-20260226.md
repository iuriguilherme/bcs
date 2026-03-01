---
title: "Playwright Test Infrastructure Code Review Audit: 8 Findings Resolved"
date: 2026-02-26
category: test-failures
tags:
  - playwright
  - test-infrastructure
  - code-review
  - security
  - xss
  - dead-code
  - ci-configuration
  - blueprint-drift
  - silent-test-failures
problem_type: test_failure
component:
  - tests/scenarios/t04-polymer-intent.spec.js
  - tests/scenarios/t05-cell-formation.spec.js
  - tests/scenarios/t06-view-consistency.spec.js
  - tests/fixtures/app.js
  - src/entities/intention.js
  - src/viewer/controls.js
  - src/main.js
  - playwright.config.js
  - tests/README.md
severity: medium
commit: 6cb8406
---

# Playwright Test Infrastructure Code Review Audit: 8 Findings Resolved

## Problem Summary

After adding Playwright automated testing infrastructure (commit `319f993`), a multi-agent code
review audit identified 8 distinct code quality issues across 3 priority levels. Left unresolved,
these would have caused: silent test semantics inversions (the most dangerous), XSS vulnerabilities
in blueprint rendering, a redundant 90-second physics wait in T06, and brittle blueprint definitions
that could silently drift from canonical templates.

**Commit**: `6cb8406` — 10 files changed, 805 insertions, 74 deletions

---

## Context: Related CI Fixes

Two immediately preceding commits also blocked the merge:

- `ec05316` — Deno lint failures: 16+ unused parameters (rename to `_prefix`), `hasOwnProperty`
  → `Object.hasOwn()`, scope `deno.json` lint rules to `src/` + `build.ts` only
- `074370c` — CI `deno test -A` step failed with "No test modules found" (project uses Playwright,
  not Deno tests); fixed by adding `tests/stub_test.ts` as a permanent placeholder

These two fixes unblocked CI; the 8-finding audit then cleaned up the test infrastructure itself.

---

## Symptoms Observed

### P1 — Silent Test Failure Risk (Critical)

`?.() || []` optional chaining in T04/T05 would return empty arrays silently if methods were
removed or renamed, preventing tests from catching API contract breaks.

**Worst case — T05 semantic inversion**: T05 is annotated `test.fail()` (expected to fail — known
broken feature). If `getAllProkaryotes` is removed/renamed, `?.() || []` silently returns `[]`.
The count check returns 0, the test fails as "expected" → Playwright marks it **green**. The bug
is still broken but the test says it's passing. This is the silent inversion.

### P2 — Redundant 90-Second T06 Physics Wait

T06 duplicated T01's entire molecule formation pipeline (spawn atoms → place intent → wait 90s for
C2H4 to form) just to test Viewer level transitions. T06's test subject (L0→L1→L2 rendering) has
no dependency on molecule formation.

### P2 — Dead Code from Incomplete Lint Fixes

Four variables were renamed with `_` prefix instead of being deleted:

- `_totalNeeded` — reads the wrong property name (should be `totalNeeded`); never used
- `_icons` — allocated every render frame, GC'd immediately; never referenced
- `_worldPos` — computed `screenToWorld()` result; never used
- `_reqType` — computed requirements type; never used

### P2 — XSS Vulnerabilities in Blueprint Rendering

Seven blueprint fields (name, formula, species, description) were interpolated directly into
`innerHTML` without HTML escaping in `src/main.js`. A `prompt()`-sourced molecule name containing
`<img src=x onerror=alert(1)>` would be stored in IndexedDB and execute on next render.

### P2 — Blueprint Drift Risk

`tests/fixtures/app.js`'s `placeEthyleneIntent` hardcoded C2H4 atom positions/bonds manually
copied from `MONOMER_TEMPLATES.ETHYLENE`. If the template's geometry changed, tests would silently
use a stale molecular geometry — passing even if the canonical blueprint broke.

### P3 — Documentation and CI Configuration

- `tests/README.md` incorrectly marked T04 as `⚠️ test.fail()` (only T05 has this annotation)
- `playwright.config.js` webServer timeout was 10s (cold Python start on CI takes 8–15s)
- No documentation for intentional spawn rate variation across tests (6–120 atoms/sec)

---

## Root Cause

The test infrastructure was added in a single large commit without a second-pass review. The
issues are characteristic of "first draft" infrastructure:

1. Convenience shortcuts (`?.() || []`) that prioritize brevity over explicit semantics
2. Copy-paste from source code without evaluating test isolation principles
3. Lint fix pass that renamed unused variables with `_` instead of deleting them
4. No security review for `innerHTML` interpolations involving user-sourced data

---

## Solution

### P1: Replace `?.() || []` with Explicit Method Guards

**Files**: `tests/scenarios/t04-polymer-intent.spec.js`, `tests/scenarios/t05-cell-formation.spec.js`

**Before** (T04):
```javascript
const polymers = env.getAllProteins?.() || [];
```

**After** (T04):
```javascript
if (typeof env.getAllProteins !== 'function') {
  throw new Error('env.getAllProteins() missing — API contract broken');
}
return env.getAllProteins().length > 0;
```

**Before** (T05):
```javascript
return (env.getAllProkaryotes?.() || []).filter(c => c.isAlive).length;
```

**After** (T05):
```javascript
if (typeof env.getAllProkaryotes !== 'function') {
  throw new Error('env.getAllProkaryotes() missing — API contract broken');
}
return env.getAllProkaryotes().filter(c => c.isAlive).length;
```

The explicit guard throws immediately with an actionable message. For T05, this preserves `test.fail()`
semantics: if the method is missing, the test fails with an error (not a silent pass).

---

### P2.1: Refactor T06 — Direct H2 Injection Replaces 90-Second Physics Wait

**File**: `tests/scenarios/t06-view-consistency.spec.js`

T06 tests Viewer level transitions. It needs *any* molecule to exist — not C2H4 specifically.
Replace the full spawn-and-wait pipeline with direct H2 injection:

```javascript
// Inject an H2 molecule (2 H atoms + 1 bond) at world center.
// updateMolecules() runs the BFS that groups bonded atoms into Molecule objects.
await page.evaluate(() => {
  const env = window.cellApp.environment;
  const h1 = new window.Atom('H', 990, 1000);
  const h2 = new window.Atom('H', 1010, 1000);
  env.addAtom(h1);
  env.addAtom(h2);
  const bond = new window.Bond(h1, h2, 1);
  env.addBond(bond);
  env.updateMolecules();
  window.cellApp.viewer.render();
});

// Verify injection succeeded before testing level switches
const initialCount = await page.evaluate(
  () => window.cellApp.environment.molecules.size
);
expect(initialCount, 'H2 injection failed — no molecules in environment').toBeGreaterThan(0);
```

**Result**: T06 completes in <5 seconds instead of 90+ seconds.

> `page.evaluate` for test scaffolding is explicitly permitted by CLAUDE.md's test validity rules:
> "Exception: page.evaluate for test scaffolding analogous to setting atomSpawner.zone."

---

### P2.2: Remove Dead Code (4 Variables)

**File**: `src/entities/intention.js`

```javascript
// BEFORE:
const { targetComp, seedMol, claimed, _totalNeeded } = state;

// AFTER (remove _totalNeeded — reads wrong property name, never used):
const { targetComp, seedMol, claimed } = state;

// BEFORE (allocated every render frame, GC'd immediately):
const _icons = { molecule: '&#9883;', polymer: '&#128279;', cell: '&#9678;' };
ctx.fillText(this.type === 'molecule' ? 'M' : this.type === 'polymer' ? 'P' : 'C', screenX, screenY);

// AFTER (delete _icons line entirely):
ctx.fillText(this.type === 'molecule' ? 'M' : this.type === 'polymer' ? 'P' : 'C', screenX, screenY);
```

**File**: `src/viewer/controls.js`

```javascript
// BEFORE:
const _worldPos = this.viewer.screenToWorld(screenX, screenY);  // never used
const _reqType = requirements?.type || 'components';             // never used

// AFTER: delete both lines
```

---

### P2.3: Add HTML Escaping to Blueprint Rendering

**File**: `src/main.js`

Add `escHtml()` at the top of the file:

```javascript
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

Apply to 7 unescaped interpolations across `_renderMoleculePalette`, `_renderCellPalette`, and
`_showCellBlueprintInspector`. Example:

```javascript
// BEFORE:
`<span class="formula">${bp.name || bp.formula}</span>`
`<span class="info">${bp.formula} &bull; ${bp.atomData.length} atoms</span>`

// AFTER:
`<span class="formula">${escHtml(bp.name || bp.formula)}</span>`
`<span class="info">${escHtml(bp.formula)} &bull; ${bp.atomData.length} atoms</span>`
```

---

### P2.4: Source Blueprint from Canonical Template

**File**: `tests/fixtures/app.js`

```javascript
// BEFORE: hardcoded atom/bond coordinates copied from MONOMER_TEMPLATES.ETHYLENE
const bp = {
  formula: 'C2H4', name: 'Ethylene', type: 'molecule',
  atomData: [
    { index: 0, symbol: 'C', relX: -15, relY: 0 },
    { index: 1, symbol: 'C', relX:  15, relY: 0 },
    /* ... 4 more H atoms hardcoded ... */
  ],
  bondData: [ /* ... 5 bonds hardcoded ... */ ],
};

// AFTER: source from canonical template
const template = window.MONOMER_TEMPLATES?.ETHYLENE;
if (!template) {
  throw new Error('window.MONOMER_TEMPLATES.ETHYLENE not found — check script load order');
}
const bp = window.createMonomerBlueprint(template);
if (!bp) {
  throw new Error('createMonomerBlueprint returned null for ETHYLENE template');
}
// Position-unique fingerprint prevents catalogue conflicts when multiple intents coexist (T02, T04)
bp.fingerprint = `intent-C2H4-${wx}-${wy}`;
```

The fingerprint override is intentional and must be preserved: the canonical fingerprint is
`monomer:ethylene:C2H4`, which causes catalogue conflicts when T02/T04 place multiple ethylene
intents simultaneously. The `intent-C2H4-${wx}-${wy}` format makes each intent catalogue-unique.

---

### P3: Documentation and CI Fixes

**`tests/README.md`**:
- Fix T04 row: remove incorrect `⚠️ test.fail()` annotation (only T05 has this)
- Add Spawn Rate Reference table documenting intentional `tickInterval` variation:

| Test | `tickInterval` | Effective rate (at 10× speed) | Rationale |
|------|----------------|-------------------------------|-----------|
| T01  | 8              | ~75 atoms/sec                 | Heavy supply for single intent |
| T02  | 100            | ~6 atoms/sec                  | Deliberate drip — prevents overcrowding that would mask anti-cannibalization logic |
| T04  | 10             | ~60 atoms/sec                 | Heavy supply for 3-intent + polymer pipeline |
| T05  | 5              | ~120 atoms/sec                | Maximum density for complex cell formation path |
| T06  | —              | —                             | No spawner — H2 injected via page.evaluate |

T02's slow rate is intentional: at 75 atoms/sec, competing intents would be overwhelmed before the
anti-cannibalization logic has a chance to run, producing unrelated failures.

**`playwright.config.js`**:

```javascript
webServer: {
  // 10s → 30s: cold Python start on CI takes 8–15s; 10s was a race condition
  timeout: 30_000,
},
use: {
  // With retries: 1, 'retain-on-failure' discards failure video if retry passes.
  // On CI: keep ALL attempts — physics flakiness needs evidence even when retries succeed.
  // Locally: only on failure avoids disk bloat during development.
  video: process.env.CI ? 'on' : 'retain-on-failure',
},
```

---

## Prevention

### Checklist for Future Test Infrastructure

- [ ] **Never use `?.() || []` in test assertions** — use explicit `typeof fn === 'function'`
  guards with descriptive error messages
- [ ] **Audit `test.fail()` tests for semantic inversions** — trace every code path that could
  silently return a truthy/falsy value instead of throwing
- [ ] **Test isolation principle**: Ask "does this test actually need the full pipeline, or just
  scaffolding?" T06's mistake was coupling a UI test to molecule formation physics
- [ ] **Source test data from canonical sources**: Blueprint data in tests must come from
  `MONOMER_TEMPLATES` via `createMonomerBlueprint()`, never hardcoded copies
- [ ] **Complete lint fixes**: When prefixing a variable with `_`, decide: should this be deleted
  instead? Prefix only when the parameter is required by the call signature
- [ ] **HTML escape all user-sourced data**: Any field from `prompt()`, IndexedDB, or external
  input must be escaped before `innerHTML`
- [ ] **CI webServer timeouts**: 30s minimum; never below 20s for cold-start Python/Node servers
- [ ] **Video retention on CI**: `process.env.CI ? 'on' : 'retain-on-failure'` preserves
  flakiness evidence when retries succeed

### Pre-Push Verification

```bash
# 1. Lint (Deno)
deno lint

# 2. Deno tests (stub_test.ts ensures this exits 0)
deno test -A

# 3. Playwright test suite
npm test

# 4. Verify bundle is current
deno run --allow-read --allow-write --allow-run build.ts
git diff --quiet index.html || echo "⚠ index.html needs regenerating — commit it"
```

---

## Gotchas

**`test.fail()` is not `test.skip()`**: `test.fail()` means the test is *expected* to fail
(a known broken feature). If the test unexpectedly *passes*, Playwright marks it red (unexpected
success). If the failure is silent — empty array instead of a throw — the test still "fails" but
for the wrong reason, looking like the known bug is still present even if it's been fixed.

**Fingerprint override is required**: After sourcing from `createMonomerBlueprint`, always override
`bp.fingerprint = \`intent-C2H4-${wx}-${wy}\``. The canonical fingerprint (`monomer:ethylene:C2H4`)
causes catalogue deduplication conflicts when multiple ethylene intents coexist (T02, T04).

**`escHtml` is per-file for now**: Added to `main.js`, `controls.js`, and `catalogue-ui.js`
separately. Future refactor should move to `utils.js`, but this commit kept scope minimal.

**Spawn rate table assumes 10× simulation speed**: All effective rates assume `simulation.setSpeed(10)`
(set by fixture in `tests/fixtures/app.js`). If that multiplier changes, recalculate the table.

---

## Related Docs

- [`docs/brainstorms/2026-02-26-automated-testing-system-brainstorm.md`](../../brainstorms/2026-02-26-automated-testing-system-brainstorm.md) — Why mandatory Playwright testing was introduced
- [`docs/plans/2026-02-26-feat-playwright-testing-infrastructure-plan.md`](../../plans/2026-02-26-feat-playwright-testing-infrastructure-plan.md) — The infrastructure plan this audit reviewed
- [`docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`](../logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md) — Earlier fix exercised by T04
- [`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`](../logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md) — Earlier fix in the test suite's coverage area
- `CLAUDE.md` — Testing Requirements section (mandatory Playwright before any task is "done")

### CI Pipeline Fix Commits (Preconditions for This Fix)

- `ec05316` — Deno lint failures: scope `deno.json` to `src/`, `_prefix` unused params, `Object.hasOwn()`
- `074370c` — Add `tests/stub_test.ts` so CI `deno test -A` exits 0
- `319f993` — feat: add Playwright automated testing infrastructure (the commit this audit reviewed)
