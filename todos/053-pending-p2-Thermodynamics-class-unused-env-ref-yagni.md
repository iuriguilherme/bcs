---
status: pending
priority: p2
issue_id: "053"
tags: [code-review, yagni, simplicity, architecture]
dependencies: []
---

# Thermodynamics class: unused environment reference and unnecessary class scaffolding

## Problem Statement

`Thermodynamics` is wired as a stateful service object but is effectively a pair of pure arithmetic functions:

```javascript
class Thermodynamics {
    constructor(environment) {
        this.environment = environment;  // ← stored but NEVER read
    }

    getStabilityScore(symbol1, symbol2, order) {
        return Math.min(1, getBondEnergy(symbol1, symbol2, order) / MAX_BOND_ENERGY);
    }

    getFormationFactor(symbol1, symbol2, temperature) {
        const stability = this.getStabilityScore(symbol1, symbol2, 1);
        return Math.min(1, stability * (temperature / 298));
    }
}
```

Both methods take all inputs as parameters. `this.environment` is stored in the constructor but never used by either method. The class adds:
- A new file (`src/systems/thermodynamics.js`)
- A `<script>` tag in `dev.html`
- A `build.ts` entry
- Two lines in `main.js` (`new Thermodynamics(...)` + back-reference wiring)
- `this.thermodynamics = null` in `Environment` constructor
- A permanently-dead null-guard `else { thermalFactor = 0.3; }` in `tryFormBonds()`

For what is functionally two one-line arithmetic expressions.

The `AtomSpawner` pattern that justified the class has 15+ stateful properties and an `update()` loop — the analogy does not hold for a purely-functional utility.

## Findings

- **Source: Simplicity Reviewer agent**
- `src/systems/thermodynamics.js`: both methods are pure functions of their parameters
- `src/main.js` lines 61-62: wiring code for a class that adds no state
- `src/core/environment.js` line 38: `this.thermodynamics = null` — environmental coupling to systems layer
- `src/core/environment.js` lines 654-663: `if (this.thermodynamics) ... else 0.3` — dead else-branch after init
- `getBondEnergy` and `MAX_BOND_ENERGY` are already global; the class adds no access control

## Proposed Solutions

### Option A: Delete class, inline at the two call sites (Recommended)
In `tryFormBonds()`:
```javascript
// Replace: this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature)
const stability = Math.min(1, getBondEnergy(sym1, sym2, 1) / MAX_BOND_ENERGY);
const thermalFactor = Math.min(1, stability * (this.temperature / 298));
```

In `intention.js` (already uses `getBondEnergy` + `MAX_BOND_ENERGY` directly).

Remove: `thermodynamics.js` file, `<script>` tag, `build.ts` entry, `main.js` wiring, `this.thermodynamics = null`, null-guard branch.

- **Effort:** Small (~50 LOC net reduction, 1 file deleted)
- **Pros:** No dead code, no class seam, no null-guard, clearer data flow
- **Cons:** Loses named method semantics (minor — the 2-line formula is self-documenting)

### Option B: Keep class but remove the unused `environment` reference
```javascript
class Thermodynamics {
    static getStabilityScore(symbol1, symbol2, order) { ... }
    static getFormationFactor(symbol1, symbol2, temperature) { ... }
}
```
Convert to static methods so the class is not instantiated.
- **Pros:** Preserves class boundary if future methods need it; removes null-guard issue
- **Cons:** Still needs script tag + build entry; still a class for two one-liners

### Option C: Leave as-is with a comment on the unused field
- **Effort:** Trivial
- **Cons:** Dead code persists; confuses future readers about `this.environment` purpose

## Acceptance Criteria

- [ ] `this.environment` is no longer stored unused in `Thermodynamics` (or class is removed)
- [ ] `if (this.thermodynamics) ... else 0.3` dead branch eliminated
- [ ] All 20 tests pass
- [ ] Bundle size unchanged or reduced

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review (Simplicity Reviewer agent) | Class scaffolding exceeds the value of two pure functions |
