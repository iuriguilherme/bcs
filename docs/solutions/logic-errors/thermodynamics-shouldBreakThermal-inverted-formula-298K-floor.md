---
title: "Thermodynamics: inverted shouldBreakThermal formula caused bonds to break at room temperature"
date: "2026-03-09"
problem_type: logic_error
component: "src/entities/bond.js, src/core/environment.js, src/entities/atom.js"
symptoms:
  - "H₂ molecules had ~61.5% break probability per check at default 298K temperature"
  - "Bond stability decreased at room temperature instead of increasing"
  - "Temperature-dependent bonding behaved inversely to physical chemistry expectations"
  - "CO triple bond (the most stable bond) was not reliably preserved"
tags:
  - thermodynamics
  - bond-stability
  - formula-inversion
  - yagni
  - deserialization-validation
  - hot-path
  - context-scoping
related_files:
  - src/entities/bond.js
  - src/entities/atom.js
  - src/core/environment.js
  - src/systems/thermodynamics.js
severity: critical
resolution_time: "1 session"
pr_branch: feat/thermodynamics-temperature-bond-stability
---

# Thermodynamics: inverted shouldBreakThermal formula caused bonds to break at room temperature

## Problem Symptom

After the thermodynamics system was added, bonds broke constantly at room temperature (298K — the slider default). H₂ molecules had approximately 61.5% break probability per check at 298K. The CO triple bond (the strongest in the table, intended to be unbreakable) could not reliably form or persist. Bond formation was also miscalibrated. The simulation was chemically inverted.

## Root Cause Analysis

Six bugs were identified, one critical. They share a common theme: the formula semantics at 298K were never verified against expected physical behavior.

### Bug 1 (Critical): Inverted shouldBreakThermal formula

The thermal factor `Math.min(1, temp/298)` equals **1.0 at room temperature** (298K). With H₂ stability ≈ 0.385 and thermalFactor = 1.0, `pBreak = (1 - 0.385) × 1.0 = 0.615`. Bonds broke constantly at the default temperature.

The formula modeled **proximity to** 298K, when it should model **departure above** 298K. Bonds must be stable at room temperature and only destabilize at elevated temperatures.

### Bug 2: Thermodynamics class stored an unused environment reference (YAGNI)

The `Thermodynamics` class accepted `environment` in its constructor and stored `this.environment`, but neither `getStabilityScore()` nor `getFormationFactor()` ever read it. Both methods were pure arithmetic. The class added a file, a `<script>` tag, a build entry, wiring in `main.js`, a field in `Environment`, and a dead null-guard else-branch in `tryFormBonds()` — for two one-liner arithmetic expressions.

### Bug 3: Bond.stabilityScore missing upper clamp

`this.strength / MAX_BOND_ENERGY` was returned without `Math.min(1, ...)`. For any future bond exceeding `MAX_BOND_ENERGY`, `stabilityScore` would return > 1.0, making `pBreak` negative (silently always-false). A parallel method `getStabilityScore()` in the Thermodynamics class correctly applied the clamp.

### Bug 4: _formationCache lazy-initialized inside hot method

`_formationCache` was created with `new Map()` inside `tryFormBonds()` via `this._formationCache || (this._formationCache = new Map())`. This causes a V8 hidden class transition on first invocation and is inconsistent with the constructor initialization pattern used for all other `_thermal*` fields.

### Bug 5: Atom.deserialize() did not validate element symbols

All numeric fields were guarded with `Number.isFinite`, but `data.symbol` was passed directly to `new Atom()`. An unknown symbol causes `ELEMENTS[symbol] = undefined`, which crashes the render loop with `TypeError: Cannot read properties of undefined` when accessing `atom.element.color`, etc.

### Bug 6: allowOvervalence context flag leaked to free bonding

The `context.allowOvervalence` flag is intended for high-stability bonds formed inside intention zones (e.g., CO triple bond directed by an `Intention`). The guard only checked the flag, not whether `context.intentId` was set. Atoms bonding spontaneously in free space could also receive the valence override.

## Working Solution

### Fix 1: shouldBreakThermal — use departure model, not proximity model

```javascript
// BEFORE (inverted — 1.0 at room temp):
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    const thermalFactor = Math.min(1, temperature / 298);
    const pBreak = (1 - stability) * thermalFactor;
    return Math.random() < pBreak;
}

// AFTER (correct — 0.0 at 298K, 1.0 at 600K):
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    // 298K = stable floor (factor 0); 600K = max activity (factor 1.0)
    const thermalFactor = Math.max(0, (temperature - 298) / 302);
    const pBreak = (1 - stability) * thermalFactor;
    return Math.random() < pBreak;
}
```

**Boundary behavior:**
- 298K: `thermalFactor = max(0, 0/302) = 0` → bonds never break thermally at room temperature
- 600K: `thermalFactor = max(0, 302/302) = 1.0` → maximum thermal stress
- CO triple bond (stability = 1.0): `pBreak = 0` always — unbreakable at any temperature

### Fix 2: Delete Thermodynamics class, inline at call site

Delete `src/systems/thermodynamics.js` entirely. Replace the call in `environment.tryFormBonds()`:

```javascript
// BEFORE (via Thermodynamics class with null-guard):
let thermalFactor;
if (this.thermodynamics) {
    const pairKey = sym1 < sym2 ? sym1 + sym2 : sym2 + sym1;
    thermalFactor = formationCache.get(pairKey);
    if (thermalFactor === undefined) {
        thermalFactor = this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature);
        formationCache.set(pairKey, thermalFactor);
    }
} else {
    thermalFactor = 0.3;  // dead branch after init
}

// AFTER (inlined, no null-guard):
const pairKey = sym1 < sym2 ? sym1 + sym2 : sym2 + sym1;
let thermalFactor = this._formationCache.get(pairKey);
if (thermalFactor === undefined) {
    const stability = Math.min(1, getBondEnergy(sym1, sym2, 1) / MAX_BOND_ENERGY);
    thermalFactor = Math.min(1, stability * (this.temperature / 298));
    this._formationCache.set(pairKey, thermalFactor);
}
```

Also remove: `<script>` tag from `dev.html`, `'src/systems/thermodynamics.js'` from `build.ts`, `new Thermodynamics(...)` from `main.js`, `this.thermodynamics = null` from `Environment` constructor.

### Fix 3: Clamp Bond.stabilityScore

```javascript
// BEFORE:
get stabilityScore() {
    return this.strength / MAX_BOND_ENERGY;
}

// AFTER:
get stabilityScore() {
    return Math.min(1, this.strength / MAX_BOND_ENERGY);
}
```

### Fix 4: Initialize _formationCache in constructor

```javascript
// In Environment constructor (alongside other _thermal* fields):
this._thermalBreakTick = 0;
this._bondsToBreak = [];
this._formationCache = new Map();  // ← add here

// In Environment.clear():
this._thermalBreakTick = 0;
this._bondsToBreak = [];
this._formationCache.clear();  // ← add here

// In tryFormBonds() — replace lazy-init with direct clear:
this._formationCache.clear();
```

### Fix 5: Validate symbol in Atom.deserialize()

```javascript
static deserialize(data) {
    const symbol = (typeof data.symbol === 'string' && ELEMENTS[data.symbol]) ? data.symbol : 'H';
    const x = Number.isFinite(data.x) ? data.x : 0;
    const y = Number.isFinite(data.y) ? data.y : 0;
    const atom = new Atom(symbol, x, y);
    // ...
}
```

Unknown or non-string symbols fall back to hydrogen, which has well-defined physics and prevents render-loop crashes.

### Fix 6: Scope allowOvervalence to intention context

```javascript
// In Atom.canBondWith():
// BEFORE: allowOvervalence applied without checking intentId
if (context.allowOvervalence && stability > OVERVALENCE_STABILITY_THRESHOLD) {
    // skip valence check
}

// AFTER: only applies inside an intention zone
if (context.intentId && context.allowOvervalence && stability > OVERVALENCE_STABILITY_THRESHOLD) {
    // skip valence check
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/entities/bond.js` | Fix `shouldBreakThermal` formula; add `Math.min(1,...)` to `stabilityScore` |
| `src/entities/atom.js` | Validate symbol in `deserialize()`; scope `allowOvervalence` with `intentId` |
| `src/core/environment.js` | Inline formation factor; eager-init `_formationCache`; remove `this.thermodynamics` |
| `src/systems/thermodynamics.js` | **Deleted** |
| `dev.html` | Remove `<script>` tag for deleted module |
| `build.ts` | Remove `thermodynamics.js` from concatenation list |
| `src/main.js` | Remove `Thermodynamics` instantiation and environment back-reference |

## Prevention

### The invariant to verify for any physics formula

Always evaluate the formula at boundary values before committing:

```
// At 298K (room temp): thermalFactor should be 0.0 (no thermal stress)
// At 600K (slider max): thermalFactor should be 1.0
// At 0K: thermalFactor should be 0.0 (floor)
```

If the comment contradicts the formula, the formula is wrong.

### Checklist for thermodynamics/physics formula work

- [ ] What is the output at the stable reference point (298K)?
- [ ] Is the formula modeling *departure from* a baseline, or *proximity to* it?
- [ ] Is `Math.max(0, ...)` applied to prevent physically meaningless negative values?
- [ ] Is `Math.min(1, ...)` applied where the quantity is bounded above?
- [ ] Does every constructor argument get used by at least one method? (Detect YAGNI classes)
- [ ] Are any `new Map()` / `new Set()` / `[]` allocations inside per-tick methods?
- [ ] Does every string field in `deserialize()` validate against a domain table?
- [ ] Does every context flag check both the flag and the `intentId` that scopes it?

### Tests that would have caught these bugs

```javascript
// Bug 1 — shouldBreakThermal boundary assertions
assert(bond.shouldBreakThermal(298) === false);          // room temp: no break
assert(bond.shouldBreakThermal(0) === false);            // absolute zero: no break
// CO triple bond: never breaks regardless of temperature
assert(coBond.shouldBreakThermal(600) === false);

// Bug 3 — stabilityScore bounded at 1.0
const overpoweredBond = /* bond with strength > MAX_BOND_ENERGY */;
assert(overpoweredBond.stabilityScore <= 1.0);

// Bug 5 — deserialize rejects unknown symbol
const atom = Atom.deserialize({ symbol: 'Xx', x: 0, y: 0 });
assert(atom.symbol === 'H');  // fallback

// Bug 6 — free bonding respects valence even with allowOvervalence flag
const context = { allowOvervalence: true };  // no intentId
assert(saturatedAtom.canBondWith(otherAtom, 1, context) === false);
```

## Related Documentation

- `docs/brainstorms/archive/2026-02-27-thermodynamics-bond-stability-brainstorm.md` — Original design: temperature range, kinetics model, CO triple bond motivation, rejected alternatives (Boltzmann, Enthalpy)
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Implementation plan; "Deep Review Enhancements" section is the direct origin of all six fixes
- `docs/solutions/physics-issues/wrong-element-atoms-crowding-intention-zones.md` — Force balance invariants and hot-path performance rules; informed `bond.break(false)` thermal breaking pattern
- `docs/solutions/performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md` — No `console.log` in hot paths, persistent scratch arrays; applies to `tryBreakThermalBonds()`
- Todos 051–055: per-bug tracking files with full proposed solutions and acceptance criteria
