---
title: "Hot-path console.warn, defensive slice, redundant allocation, and guard inconsistency in viewer/intention display"
date: 2026-02-28
category: performance-issues
tags:
  - console.warn
  - hot-path
  - render-loop
  - defensive-copy
  - unnecessary-allocation
  - guard-style
  - accessor-contract
  - playwright
  - intention-system
  - viewer
  - inspector
  - code-review
module: Viewer / Inspector / Intention
symptom: "Render-frame code paths in viewer.js and Inspector tick logic contained console flooding, unnecessary array copies, redundant object allocations, inconsistent guard patterns, and a test bypassing the accessor contract"
root_cause: "Six distinct quality and performance defects introduced during the fix/intention-display-bugs feature branch, discovered via 8-agent parallel code review and fixed in commit da3e45e"
---

# Hot-path console.warn, Defensive Slice, Redundant Allocation, and Guard Inconsistency

Six quality/performance findings from a multi-agent code review of the `fix/intention-display-bugs` branch. All fixed in commit `da3e45e`. Findings 1–3 are performance-critical (60fps render path); findings 4–6 are code-quality hygiene (style consistency, accessor contract, comment semantics).

---

## Finding 1: Hot-path `console.warn` in `_renderSeedMoleculeAtoms`

**File**: `src/viewer/viewer.js`

### Symptom

`console.warn` would fire at 60 Hz any time `getAllSeedMolecules` was absent from the environment — flooding DevTools and degrading render performance.

### Before

```javascript
_renderSeedMoleculeAtoms(scale, offset) {
    if (!this.environment.getAllSeedMolecules) {
        console.warn('[Viewer] getAllSeedMolecules not available; seed atoms will not render');
        return;
    }
    const seedMolecules = this.environment.getAllSeedMolecules();
    if (seedMolecules.length === 0) return;
    // ...
}
```

### After

```javascript
_renderSeedMoleculeAtoms(scale, offset) {
    const seedMolecules = this.environment.getAllSeedMolecules
        ? this.environment.getAllSeedMolecules()
        : [];
    for (const seedMol of seedMolecules) {
        for (const atom of seedMol.atoms) {
            atom.render(this.ctx, scale, offset);
        }
    }
}
```

The `console.warn` was replaced with the established viewer ternary pattern. The absence of `getAllSeedMolecules` is a silent no-op — an empty array is returned and no atoms are rendered. This matches how every other optional accessor is handled in viewer.js (`_renderIntentions`, `getEntityAt`, etc.).

---

## Finding 2: Unnecessary `atoms.slice()` in single-threaded JS

**File**: `src/viewer/viewer.js`

### Before

```javascript
for (const seedMol of seedMolecules) {
    const atoms = seedMol.atoms.slice(); // snapshot to prevent mutation issues
    for (const atom of atoms) {
        atom.render(this.ctx, scale, offset);
    }
}
```

### After

```javascript
for (const seedMol of seedMolecules) {
    for (const atom of seedMol.atoms) {
        atom.render(this.ctx, scale, offset);
    }
}
```

### Why

JavaScript is single-threaded. The render loop and the physics update loop are never interleaved mid-iteration — the JS event loop ensures one call stack completes before the next starts. The `.slice()` snapshot cannot protect against any real mutation. It allocates a new array object on every render frame at 60fps, adding GC pressure with zero correctness benefit.

---

## Finding 3: Redundant `getRequirements()` allocation in `getGatheredCount()`

**File**: `src/entities/intention.js`

### Before

```javascript
getGatheredCount() {
    if (this.type === 'molecule') {
        const requirements = this.getRequirements(); // allocates a new object
        const reqCount = requirements?.count || 0;
        return Math.round(this.progress * reqCount);
    }
    return this.gatheredComponents.size;
}
```

### After

```javascript
getGatheredCount() {
    if (this.type === 'molecule') {
        const total = this.blueprint.atomData?.length || 0;
        return Math.round(this.progress * total);
    }
    return this.gatheredComponents.size;
}
```

### Why

`getRequirements()` constructs and returns a fresh `{ type, count, elements, ... }` object every call. `getGatheredCount()` is called by the inspector every render frame while an intention is selected. The only needed value was `count`, which equals `blueprint.atomData.length` — accessible directly on the blueprint without any allocation.

---

## Finding 4: Guard style inconsistency in `getEntityAt()`

**File**: `src/viewer/viewer.js`

### Before

```javascript
// if-block guard — different from every other optional accessor in the file
if (this.environment.getAllSeedMolecules) {
    for (const seedMol of this.environment.getAllSeedMolecules()) {
        if (seedMol.containsPoint(screenX, screenY, scale, offset)) {
            return { type: 'molecule', entity: seedMol };
        }
    }
}
```

### After

```javascript
// ternary guard — matches every other optional accessor in the file
const seedMolecules = this.environment.getAllSeedMolecules
    ? this.environment.getAllSeedMolecules()
    : [];
for (const seedMol of seedMolecules) {
    if (seedMol.containsPoint(screenX, screenY, scale, offset)) {
        return { type: 'molecule', entity: seedMol };
    }
}
```

Every other optional-accessor call in viewer.js uses the `const x = this.environment.method ? this.environment.method() : []` ternary. The `if`-block style in the initial fix was inconsistent and made the code harder to scan. Standardising to the ternary form makes the guard strategy uniform across the file.

---

## Finding 5: T07 test accessing raw `env.intentions` Map

**File**: `tests/scenarios/t07-intention-display.spec.js`

### Before

```javascript
// Inside page.evaluate() — two locations:
const intents = [...window.cellApp.environment.intentions.values()];
const intent = intents.find(i => i.type === 'molecule');
```

### After

```javascript
const env = window.cellApp.environment;
const intents = env.getAllIntentions ? env.getAllIntentions() : [...env.intentions.values()];
const intent = intents.find(i => i.type === 'molecule');
```

### Why

`environment.intentions` is a `Map` — an internal implementation detail. All production viewer/controls code uses `getAllIntentions()`. A test that reaches into the raw Map couples itself to the internal storage structure: if the Map is ever refactored, the test breaks in an unrelated way. The ternary fallback maintains compatibility with any environment that pre-dates the accessor while preferring the public API.

---

## Finding 6: `TODO` → `NOTE` on `gatheredComponents` asymmetry

**File**: `src/entities/intention.js`

### Before

```javascript
// TODO: gatheredComponents is only populated for type='polymer'/'cell'.
// For type='molecule', use getGatheredCount() which reads from this.progress instead.
this.gatheredComponents = new Set();
```

### After

```javascript
// NOTE: gatheredComponents is only populated for type='polymer'/'cell'.
// For type='molecule', use getGatheredCount() which reads from this.progress instead.
// This asymmetry is intentional — molecule intents track progress as a float (0-1),
// while polymer/cell intents track it as a Set of gathered component IDs.
this.gatheredComponents = new Set();
```

### Why

A `TODO` signals pending work. The asymmetry between the two progress representations is a deliberate design decision (not deferred refactoring). Leaving it as `TODO` would mislead contributors into trying to "fix" working code. Changing to `NOTE` with an explanation of the rationale documents the intent and prevents unnecessary churn.

---

## Discovery

Found by 8 parallel review agents including `performance-oracle`, `code-simplicity-reviewer`, and `pattern-recognition-specialist` during a multi-agent code review of the `fix/intention-display-bugs` branch (commit 203f369). Fixed in the follow-up commit `da3e45e`.

---

## Related Documentation

- **[`docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`](../test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md)** — Prior code review audit (8 findings), covers raw Map access patterns, `?.() || []` pitfall, `_icons` hot-path GC allocation, and the `test.fail()` vs `test.skip()` comment convention.

- **[`docs/solutions/ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md`](../ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md)** — The feature branch these findings came from. Documents the accessor contract rule and the two-pipeline asymmetry that made Finding 3 and Finding 6 necessary.

- **[`docs/solutions/security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md`](../security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md)** — Companion code review finding: XSS in inspector innerHTML. Documents `escHtml()` duplication across 3 files as open technical debt.

- **[`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`](../logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md)** — Prior partial lint fix leaving dead `_prefix` variables and partial `escHtml()` coverage — the same "incomplete sweep" pattern that caused XSS Finding 1 above.

---

## Prevention Strategies

### 1. Hot-path logging rules

`console.*` calls are banned inside any method called by `render()`, `update()`, `tick()`, or `_rule*()`. These run at 60fps.

**Safe**: one-time init paths, user event handlers, async callbacks.

**How to log from hot paths during debugging**: use the existing `Debug.*` category system — it is designed to be toggled off. Never use bare `console.warn/log/error` in simulation or render methods:

```javascript
// WRONG — fires every frame
_renderSeedMoleculeAtoms(scale, offset) {
    if (!this.environment.getAllSeedMolecules)
        console.warn('not available'); // 60 warnings/second
}

// RIGHT — zero cost when disabled
_renderSeedMoleculeAtoms(scale, offset) {
    if (!this.environment.getAllSeedMolecules) {
        Debug.log('viewer', 'getAllSeedMolecules not available');
        return;
    }
}
```

**Code review rule**: Any bare `console.*` inside a method reachable from `render()` or `update()` is an automatic review failure.

### 2. Defensive copies: when justified vs unnecessary

JavaScript is single-threaded. Within a synchronous call chain, no other code can mutate an array between reading it and finishing iteration. A `.slice()` inside a synchronous render method buys nothing.

**Justified**: returning a copy to external callers (the `getAll*()` pattern), passing to an uncontrolled method that may sort/splice in place, saving a snapshot for later comparison.

**Not justified**: iterating inside the owning method, passing to a method you wrote that only reads, any place inside the 60fps render or update loop.

```javascript
// WRONG — allocates a throw-away array every frame
const atoms = seedMol.atoms.slice();
for (const atom of atoms) { atom.render(...); }

// RIGHT — iterate directly
for (const atom of seedMol.atoms) { atom.render(...); }
```

**Litmus test**: "Could any code mutate this array between `.slice()` and when I finish using it, within this synchronous call?" If no, remove the copy.

### 3. Avoiding redundant allocations in render and inspector methods

In any method called at frame rate or from the inspector panel update cycle, access fields directly on the object. Reserve factory/aggregator methods (`getRequirements()`, `getStats()`, `build*()`) for one-time calls:

```javascript
// WRONG — allocates a new requirements object every inspector refresh
const reqs = blueprint.getRequirements();
const count = reqs.count;

// RIGHT — read directly
const count = blueprint.atomData?.length || 0;
```

**Code review rule**: Any method call inside `render()` or an inspector refresh whose name starts with `get`, `build`, `compute`, or `make` should be scrutinised — ask whether it allocates and whether the same data is available as a direct field.

### 4. Guard style consistency

Establish one canonical guard pattern per file. For viewer.js, the established pattern is the ternary optional-accessor form:

```javascript
// Canonical — matches all other optional accessor sites in viewer.js
const items = this.environment.optionalMethod
    ? this.environment.optionalMethod()
    : [];
```

When writing new code in a file, check the three nearest methods and match their pattern exactly. If a file mixes patterns, normalise in a separate cleanup commit — not mixed with a feature change.

### 5. Playwright test accessor contract

Tests must never read raw internal Maps (`env.intentions`, `env.molecules`, `cat.molecules`). Use the `getAll*()` accessors that production code uses:

```javascript
// WRONG — couples test to internal Map structure
const intents = [...window.cellApp.environment.intentions.values()];

// RIGHT — uses the public accessor contract
const env = window.cellApp.environment;
const intents = env.getAllIntentions ? env.getAllIntentions() : [...env.intentions.values()];
```

If no accessor exists for the data you need, add one to the source — that is a feature gap, not a reason to bypass the contract in the test.

**Review checklist**: grep the test file for `.atoms`, `.bonds`, `.molecules`, `.intentions`, `.polymers` accessed without a method call. Each raw access is a candidate for replacement.

### 6. Comment type taxonomy

| Prefix | Meaning | Use when |
|---|---|---|
| `NOTE:` | Permanent explanation; no work implied | Code is correct but non-obvious; a "simpler" alternative was intentionally rejected |
| `TODO:` | Deferred work; something is incomplete | Current code is suboptimal and the author intends to fix it |
| `FIXME:` | Known broken; higher urgency than TODO | Code is wrong right now; track with an issue |
| `HACK:` | Correct but fragile workaround | Works now but will need revisiting if surrounding code changes |

**Rule**: A comment labelled `TODO:` that contains only explanatory text and no actionable task must be converted to `NOTE:`. A comment labelled `NOTE:` that contains "should" or "need to" is likely a `TODO:` in disguise.
