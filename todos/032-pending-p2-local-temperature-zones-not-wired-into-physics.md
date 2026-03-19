---
status: pending
priority: p2
issue_id: "032"
tags: [code-review, thermodynamics, dead-code, feature-gap]
---

# Local temperature zone override — infrastructure exists but is never called

## Problem Statement

The PR description for #5 states that "intention zones override global temp" as a feature. The `Thermodynamics.getTemperatureAt(x, y)` method is implemented to iterate intention zones and return a local temperature if a position falls within one. However, **`getTemperatureAt()` is never called anywhere in the codebase**. Both `tryFormBonds()` and `tryBreakThermalBonds()` use `this.temperature` (global) directly.

As a result, setting `intention.localTemperature = 400` would have zero effect on the physics — bonds inside that zone would still form/break based on the global temperature.

## Findings

- **File**: `src/systems/thermodynamics.js:41` — `getTemperatureAt()` defined
- **File**: `src/core/environment.js:648` — `tryFormBonds()` uses `this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature)` — passes global temp
- **File**: `src/core/environment.js:849` — `tryBreakThermalBonds()` uses `const temp = this.temperature` — global only
- **File**: `src/entities/intention.js:34` — `this.localTemperature = null` field declared but never produces any physics effect

Confirmed with grep: `getTemperatureAt` appears only in thermodynamics.js (definition). Zero call sites.

## Proposed Solutions

### Option A: Wire `getTemperatureAt()` into physics (complete the feature)
In `tryFormBonds()`, compute per-atom-pair temperature:
```js
const midX = (atom1.position.x + atom2.position.x) / 2;
const midY = (atom1.position.y + atom2.position.y) / 2;
const localTemp = this.thermodynamics.getTemperatureAt(midX, midY);
const thermalFactor = this.thermodynamics.getFormationFactor(sym1, sym2, localTemp);
```
In `tryBreakThermalBonds()`, compute per-bond temperature:
```js
const midX = (bond.atom1.position.x + bond.atom2.position.x) / 2;
const midY = (bond.atom1.position.y + bond.atom2.position.y) / 2;
const temp = this.thermodynamics.getTemperatureAt(midX, midY);
```
**Pros**: Feature works as described in PR. Enables high-temp reaction zones.
**Cons**: `getTemperatureAt()` is O(intentions) per call; `tryFormBonds()` calls it per atom-pair → performance concern.
**Effort**: Small | **Risk**: Medium (requires performance validation)

### Option B: Remove dead infrastructure (accept feature is future work)
Delete `getTemperatureAt()` from Thermodynamics. Remove `localTemperature = null` from Intention. Update PR description to reflect actual scope.
**Pros**: No dead code. Simpler codebase.
**Cons**: Removes the hook for future local temperature zones.
**Effort**: Small | **Risk**: Low

### Option C: Keep as scaffolding, add a TODO comment
Add `// TODO: wire getTemperatureAt() into tryFormBonds + tryBreakThermalBonds` comment.
**Pros**: Documents intent without misleading users.
**Cons**: Still dead code.
**Effort**: Trivial | **Risk**: None

## Recommended Action

*(to be decided during triage)*

## Acceptance Criteria

- [ ] Either `getTemperatureAt()` is called in physics, or it is removed/commented
- [ ] PR description matches actual implemented behavior
- [ ] All existing tests still pass

## Work Log

- 2026-03-18: Identified during PR #5 code review via grep for `getTemperatureAt` call sites
