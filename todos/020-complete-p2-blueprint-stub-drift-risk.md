---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, testing, architecture, maintainability]
dependencies: []
---

# `placeEthyleneIntent` hardcodes C2H4 blueprint data — silently diverges if MONOMER_TEMPLATES changes

## Problem Statement

`tests/fixtures/app.js`'s `placeEthyleneIntent` function hardcodes the `atomData` and `bondData` for C2H4 (ethylene). This data is a manual copy of `MONOMER_TEMPLATES.ETHYLENE` from `src/catalogue/monomer-templates.js`, converted to blueprint format. If the template geometry changes (atom positions, bond orders), the fixture silently diverges — tests still run but the intention seeks a different molecular composition than the catalogue advertises.

The function `createMonomerBlueprint` that performs this conversion already exists on `window` (exposed in `monomer-templates.js`).

## Findings

**Current hardcoded data in `tests/fixtures/app.js` (lines 169–194):**
```javascript
const bp = {
  formula: 'C2H4',
  atomData: [
    { index: 0, symbol: 'C', relX: -15, relY: 0 },
    { index: 1, symbol: 'C', relX:  15, relY: 0 },
    { index: 2, symbol: 'H', relX: -30, relY: -15 },
    // ...
  ],
  bondData: [
    { atom1Index: 0, atom2Index: 1, order: 2 }, // C=C
    // ...
  ],
};
```

**Source of truth in `src/catalogue/monomer-templates.js`:**
```javascript
MONOMER_TEMPLATES.ETHYLENE = {
  atomLayout: [
    { symbol: 'C', relX: -15, relY: 0 },
    { symbol: 'C', relX:  15, relY: 0 },
    // ...
  ],
  bondLayout: [
    { atom1: 0, atom2: 1, order: 2 },
    // ...
  ],
};
```

The coordinates match today, but there is no enforcement to keep them in sync.

**`window.createMonomerBlueprint` is available** (confirmed in monomer-templates.js line 503, exposed on window). It performs the `atomLayout`→`atomData` conversion.

**The fingerprint concern:** The fixture uses `fingerprint: \`intent-C2H4-${wx}-${wy}\`` (position-unique). If `window.createMonomerBlueprint` is used instead, the returned blueprint has fingerprint `monomer:ethylene:C2H4`. Two intents with the same fingerprint could cause catalogue conflicts. The position-unique fingerprint is intentional and should be preserved.

## Proposed Solutions

### Option A: Source from `createMonomerBlueprint`, override fingerprint (Recommended)
**Pros**: Single source of truth. Drift impossible.
**Cons**: Slightly more complex `page.evaluate` call.
**Effort**: Small
**Risk**: Low

```javascript
export async function placeEthyleneIntent(page, worldX, worldY) {
  await page.evaluate(([wx, wy]) => {
    // Source from canonical template — no drift risk
    const template = window.MONOMER_TEMPLATES?.ETHYLENE;
    if (!template) throw new Error('MONOMER_TEMPLATES.ETHYLENE not found');
    const bp = window.createMonomerBlueprint(template);
    // Override fingerprint to be position-unique (avoid catalogue conflicts for multiple intents)
    bp.fingerprint = `intent-C2H4-${wx}-${wy}`;
    const intent = new window.Intention('molecule', bp, wx, wy);
    window.cellApp.environment.addIntention(intent, window.cellApp.catalogue);
    window.cellApp.viewer.render();
  }, [worldX, worldY]);
}
```

### Option B: Add a comment documenting the sync requirement (Minimal)
**Pros**: Zero code change.
**Cons**: Manual process, relies on developer attention.
**Effort**: Minimal

Add a comment to `placeEthyleneIntent`:
```javascript
// SYNC WARNING: atomData/bondData must match MONOMER_TEMPLATES.ETHYLENE in monomer-templates.js.
// If geometry changes, update this stub manually.
```

### Option C: Keep as-is (Current state)
**Pros**: Works today, no change needed.
**Cons**: Silent drift risk on future ETHYLENE template updates.

## Recommended Action

Option A if `window.MONOMER_TEMPLATES` and `window.createMonomerBlueprint` are verified to be available at the time `page.evaluate` runs (they are exposed on window). Option B as a fallback.

## Technical Details

**Affected file:** `tests/fixtures/app.js`, function `placeEthyleneIntent` (lines 167–195)

**Impacted tests:** T01, T02, T03, T04, T06 — all use `placeEthyleneIntent`

## Acceptance Criteria

- [ ] `placeEthyleneIntent` sources blueprint data from `MONOMER_TEMPLATES.ETHYLENE` via `createMonomerBlueprint`
- [ ] Fingerprint remains position-unique (`intent-C2H4-${wx}-${wy}`)
- [ ] All tests (T01–T06) pass `npm test`
- [ ] No hardcoded atom coordinates remain in the fixture

## Work Log

- 2026-02-26: Identified by architecture-strategist review agent. Filed as P2.
