---
title: "feat: Add Thermodynamics Temperature System for Bond Stability"
type: feat
status: completed
date: 2026-03-01
origin: docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md
---

# ✨ feat: Add Thermodynamics Temperature System for Bond Stability

## Overview

Add a simplified thermodynamics layer to BioChemSim that enables chemically accurate
molecules like Carbon Monoxide (CO, triple bond C≡O) to exist in the simulation.

Currently CO was added to `stable-molecules.js` with a triple bond but oxygen's `maxBonds=2`
blocks the bond (oxygen shows `Valence: 3/2` — an invalid over-bonded state). The root cause
is that the existing `canBondWith()` hard-returns `false` when `availableValence < order`,
and there is no mechanism to allow high-energy bonds to override valence limits.

The new system introduces:
- A global **temperature** parameter (already stored as `environment.temperature = 300`)
- **Bond stability scores** derived from the existing `BOND_ENERGIES` table
- **Thermal bond breaking** per tick in the update loop (invocation site currently missing)
- A **soft valence override** for intention-guided high-stability bonds (> 0.85 stability)
- **Intention local temperature zones** overriding global temp within the attraction radius
- A **temperature slider** in the toolbar (follows existing `speedSlider` pattern)

(see brainstorm: docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md)

---

## Deep Review Enhancements

_This section captures corrections and improvements from a 9-agent deep review pass.
Each correction is also annotated inline at the relevant phase._

### Critical Bugs to Fix (Would Silently Break CO Support)

1. **`intentId` fast-path blocks `allowOvervalence` (atom.js:81-88)** — When `canBondWith()`
   receives a context with `intentId`, it takes a fast-path that returns early before ever
   consulting `context.allowOvervalence`. Rule 6 passes `intentId`, so CO triple bonds via
   the intention system would silently fail even after Phase 3 changes. Phase 3 must
   restructure this branch, not just add code after it.

2. **Sealed bond guard must use `||` not `&&` (Phase 4)** — A sealed polymer atom must never
   break thermally. The plan originally wrote `atom1.isSealed && atom2.isSealed` (only skips
   if BOTH are sealed). The acceptance criterion says "sealed polymer atoms NEVER break" —
   this requires `atom1.isSealed || atom2.isSealed` (skip if EITHER is sealed).

3. **Rule 6 `canBondWith` calls are asymmetric (intention.js:760-761)** — Rule 6 does NOT
   call `tryFormBond()` — it makes two manual `canBondWith()` calls then `new Bond()`. The
   second call (on seedAtom) has no context and no `allowOvervalence`, blocking CO on the
   seed side. Phase 7 must patch both `canBondWith` calls in the seed branch to pass
   `{ intentId, allowOvervalence }`. The no-seed branch (lines ~800-801) also needs
   `allowOvervalence` added to its existing context objects.

4. **Missing `C≡O` in `BOND_ENERGIES`** — `getBondEnergy('C','O',3)` returns DEFAULT=60,
   giving stability=0.265. Far below the 0.85 threshold. CO would never qualify for the
   soft valence override. Phase 1 adds `'C≡O': 257` to fix this.

### Method Name Correction

- `tryBreakBondsThermal()` → **`tryBreakThermalBonds()`** (verb+NounPlural convention,
  matching `tryFormBonds()`). Applies everywhere the method is named.

### Security Fixes

- Temperature slider input must be NaN-guarded:
  `Number.isFinite(raw) ? Math.max(1, Math.min(600, raw)) : 300`
- `deserialize()` must validate `data.temperature` before assigning.
- `getTemperatureAt()` must use `== null` guard (catches both `null` and `undefined`).
- `getTemperatureAt()` must add `if (intention.fulfilled) continue` to skip completed zones.

### Performance Fixes

- Use squared distance in `getTemperatureAt()` — no `Math.sqrt` needed.
- Use persistent scratch array `this._bondsToBreak = []` reset with `.length = 0`
  (not local allocation) — avoids GC on every 6th/60th tick.
- Initialize `this._thermalBreakTick = 0` and `this._bondsToBreak = []` in constructor,
  reset both in `clear()`.

### Best-Practice Calibrations (from external research)

- **Check interval**: Academically validated pattern uses every ~6 ticks, not every
  60 ticks. This improves responsiveness while still reducing 60fps overhead. See Phase 4.
- **Formula choice**: The brainstorm chose the simple kinetics model
  `P(break) = (1-stability) × min(1, temp/298)` over Arrhenius (`exp(-E/T)`).
  Arrhenius was considered during deep-review but is **incompatible** with the CO
  acceptance criterion: `exp()` is always positive, so CO would have nonzero break
  probability. The simple model produces exactly 0% for stability=1.0. Phase 4 uses
  `bond.shouldBreakThermal(temp)` which implements the simple model. _(Resolved: Todo 032)_
- **Logarithmic slider** (optional enhancement): Temperature sliders in probabilistic
  simulations work better on a log scale. A linear 0-600K slider maps most of its
  travel to a range where nothing changes. See Phase 9 enhancement option.

### Test File Naming

- Test file must follow `tNN` convention: `t09-thermo-co-triple-bond.spec.js`
  (not `t_thermo_co_triple_bond.spec.js`).

### Simplicity Note

The `Thermodynamics` class follows the `AtomSpawner` pattern and is kept for
encapsulation clarity. The simplicity reviewer noted that all three methods could be
inlined into `environment.js` and `intention.js` directly. This remains a valid
implementation choice — either approach satisfies the acceptance criteria.

---

## Problem Statement

### Immediate Bug
Oxygen in a CO molecule shows `Valence: 3/2` (Inspector). This is a genuine over-bonded
state: `bondCount=3` against `maxBonds=2`. CO was added to `stable-molecules.js` with
`order: 3` but the valence guard in `canBondWith()` prevents the triple bond from ever
forming — the reshaping path also calls `canBondWith()` and hits the same wall.

### Missing Infrastructure
`Bond.shouldBreak()` exists at `bond.js:67-71` but **is never called** in the update loop.
Thermal bond breaking has no invocation site. The probability formulas have no effect until
this is wired into `environment.update()`.

### Missing Bond Energy Entry
`getBondEnergy('C', 'O', 3)` falls through to `BOND_ENERGIES.DEFAULT = 60`, giving
`stability = 60/257 = 0.234`. This is far below the proposed `0.85` threshold — CO would
**never** qualify for the soft valence override without adding `'C≡O'` to the table.

---

## Proposed Solution

### Design Decisions (from brainstorm)
1. **Kinetics model**: `P(form) = min(1, stability × temp/298)`, `P(break) = (1-stability) × min(1, temp/298)`. Both scale with temperature → dynamic equilibrium at 298K.
2. **Stability score**: `bond.strength / MAX_BOND_ENERGY` (normalized). `bond.strength` already set via `calculateStrength()` → `getBondEnergy()` in Bond constructor.
3. **Over-valence threshold**: `stability > 0.85`. Only bonds qualifying: `C≡O` (≈1.0), `N≡N` (≈0.88). Note: `C≡N` at 213/257 ≈ 0.83 — just below threshold; intentional.
4. **Override scope**: Zone-limited. Soft valence override only passed via intention Rule 6 bonding (`context.allowOvervalence = true`), **not** in spontaneous `tryFormBonds()`.
5. **Tar-ball protection preserved**: `tryFormBonds()` guard (`prob=0` inside intention zones) stays untouched. Thermal probability applies **outside** intention zones.
6. **High-order bonds**: Only form via intention system (Rule 6). Spontaneous `tryFormBonds()` stays at order 1.
7. **Intention local temperature**: `localTemperature` property on Intention; consulted in Rule 6 as `this.localTemperature ?? environment.temperature`.
8. **No new data file**: Use existing `BOND_ENERGIES` table; add `'C≡O': 257` entry.

---

## Technical Approach

### Architecture Overview

```
temperature (environment.temperature or intention.localTemperature)
    ↓
bond.stabilityScore                        → bond.strength / MAX_BOND_ENERGY
bond.shouldBreakThermal(temp)              → (1-stability) × min(1, temp/298)
Thermodynamics.getFormationFactor(sym1, sym2, temp) → min(1, stability × temp/298)
    ↓
Environment.update()
    ├── tryBreakThermalBonds()     [NEW — delegates to bond.shouldBreakThermal(), every 6 ticks]
    └── tryFormBonds()             [MODIFIED — apply thermal factor outside intent zones]
    ↓
atom.canBondWith(other, order, { allowOvervalence: true })  [MODIFIED — valence gate]
```

### Implementation Phases

---

#### Phase 1: Data — Add `C≡O` Bond Energy

**Files**: `src/data/periodic-table.js`

- Add `'C≡O': 257` to `BOND_ENERGIES` table (line ~174).
  Real bond dissociation energy: CO ≈1076 kJ/mol vs N≡N ≈945 kJ/mol → ratio 1.14 × 226 ≈ 257.
- Update normalization constant: `MAX_BOND_ENERGY = 257` (currently `N≡N = 226`).
  This constant will be exported and used by `Thermodynamics` class.
- Export via `window.MAX_BOND_ENERGY = MAX_BOND_ENERGY` so `dev.html` separate script tags
  can access it before bundling.

```javascript
// src/data/periodic-table.js — BOND_ENERGIES table addition
'C≡N': 213,
'C≡O': 257,   // ← ADD: carbon monoxide triple bond (strongest in the table)
'N≡N': 226,

// Add constant for normalization (after BOND_ENERGIES definition):
const MAX_BOND_ENERGY = 257;  // C≡O — used by Thermodynamics for stability scoring
window.MAX_BOND_ENERGY = MAX_BOND_ENERGY;  // expose for dev.html separate script tags
```

**Acceptance**: `getBondEnergy('C', 'O', 3)` returns `257`. `257/257 = 1.0` stability score.

---

#### Phase 2: Bond — `stabilityScore` Getter + `shouldBreakThermal()` + Context on `tryFormBond()`

**Files**: `src/entities/bond.js`

Add a `stabilityScore` getter after `calculateStrength()` (line ~48):

```javascript
// src/entities/bond.js — after calculateStrength() method
get stabilityScore() {
    return this.strength / MAX_BOND_ENERGY;  // 0–1, higher = more stable
}
```

Add a `shouldBreakThermal(temperature)` method after `shouldBreak()` (line ~71):

```javascript
// src/entities/bond.js — after shouldBreak() method
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    const pBreak = (1 - stability) * Math.min(1, temperature / 298);
    return Math.random() < pBreak;
}
```

**ALSO extend `tryFormBond()` to accept a `context` parameter** (useful for any future
callers that need to forward `allowOvervalence` — Rule 6 does NOT use `tryFormBond()` but
this keeps the function signature consistent for other call sites):

```javascript
// src/entities/bond.js — extend tryFormBond() signature
// BEFORE:
function tryFormBond(atom1, atom2, order = 1) {

// AFTER:
function tryFormBond(atom1, atom2, order = 1, context = {}) {
    if (!atom1.canBondWith(atom2, order, context)) return null;
    // ... rest of existing implementation
```

**Acceptance**:
- `new Bond(C, O, 3).stabilityScore ≈ 1.0`
- `new Bond(H, H, 1).stabilityScore ≈ 0.385` (H-H energy `99/257`)
- `tryFormBond(atom1, atom2, 1, { allowOvervalence: true })` forwards context to `canBondWith()`

Note: `shouldBreak()` (strain-based) is separate and also unused. The environment will call
BOTH checks independently — break if strain OR thermal.

---

#### Phase 3: Atom — Soft Valence Override in `canBondWith()`

**Files**: `src/entities/atom.js`

> ⚠️ **CRITICAL (deep-review finding)**: The current `canBondWith()` has an `intentId`
> fast-path at lines 81-88 that returns early before consulting `context.allowOvervalence`.
> Rule 6 always passes `intentId`, so any fix that only adds code AFTER line 88 will never
> execute for intention-guided bonds. The `intentId` branch itself must be restructured.

**Restructure the `intentId` branch (lines 81-88)**:

```javascript
// src/entities/atom.js — REPLACE the intentId fast-path block (lines ~81-88)
// BEFORE (simplified):
if (context.intentId) {
    if (context.intentId === this.claimedByIntentId) {
        const ok = this.availableValence >= order && other.availableValence >= order;
        if (!ok) return false;      // ← THIS blocks C≡O even with allowOvervalence
        return !this.isBondedTo(other);
    }
}

// AFTER — thread allowOvervalence through the intentId branch:
// (Todo 040: trust allowOvervalence as pre-validated boolean — no inline stability
//  re-check here. The call site computes stability and sets the flag. This keeps
//  entity-layer canBondWith() free of system-layer thermodynamics policy.)
if (context.intentId) {
    if (context.intentId === this.claimedByIntentId) {
        const valenceOk = this.availableValence >= order && other.availableValence >= order;
        if (!valenceOk && !context.allowOvervalence) return false;
        return !this.isBondedTo(other);
    }
}
```

**Also handle the regular valence check path** (for non-intentId calls, lines ~93-94):

```javascript
// src/entities/atom.js — lines ~93-94 in canBondWith(), BEFORE existing hard return
// (Todo 040: no inline stability re-check — trust allowOvervalence as pre-validated)
if (this.availableValence < order || other.availableValence < order) {
    if (!context.allowOvervalence) return false;
    // Caller already verified stability > 0.85 before setting allowOvervalence = true
}
```

Key invariant: `isSealed` check must remain — sealed polymer atoms cannot be over-bonded
regardless of stability. After the valence override, execution continues to the sealed check.

**Acceptance**: `oxygenAtom.canBondWith(carbonAtom, 3, { allowOvervalence: true, intentId: 'xyz', claimedByIntentId: 'xyz' })` returns `true` when both atoms are unsealed. Same call without `allowOvervalence` returns `false`.

---

#### Phase 4: Environment — Thermal Bond Breaking Sweep

**Files**: `src/core/environment.js`

**Constructor additions** (deep-review: initialize state rather than lazy-init in loop):

```javascript
// src/core/environment.js — Environment constructor, after this.temperature = 300
this._thermalBreakTick = 0;
this._bondsToBreak = [];   // persistent scratch array; avoids GC on hot ticks
this.thermodynamics = null;
```

**Add to `clear()` method** (deep-review: reset counters on clear):

```javascript
// src/core/environment.js — clear() method
this._thermalBreakTick = 0;
this._bondsToBreak = [];
```

Add `tryBreakThermalBonds()` method (renamed from original plan per pattern convention):

```javascript
// src/core/environment.js — new method
tryBreakThermalBonds() {
    // Run every 6 ticks (~10 checks/second at 60fps)
    this._thermalBreakTick++;
    if (this._thermalBreakTick % 6 !== 0) return;

    const temp = this.temperature;

    // Reuse persistent scratch array — avoids allocation every 6 ticks
    this._bondsToBreak.length = 0;

    for (const bond of this.bonds.values()) {
        // ⚠️ CRITICAL (deep-review): use || not && — skip if EITHER atom is sealed
        if (bond.atom1.isSealed || bond.atom2.isSealed) continue;

        // Delegate to Bond — simple kinetics model (brainstorm Approach B):
        //   P(break) = (1 - stability) × min(1, temp/298)
        // CO (stability=1.0): P = 0 at ANY temperature ✅
        // H-H (stability≈0.385) at 600K: P ≈ 0.615 × 1.0 = 61.5% per check ✅
        if (bond.shouldBreakThermal(temp)) {
            this._bondsToBreak.push(bond);
        }
    }

    for (const bond of this._bondsToBreak) {
        bond.break(false);        // suppress kinetic energy — thermal equilibrium, not explosion
        this.bonds.delete(bond.id);
    }
}
```

> **Why `bond.break(false)` instead of `this.removeBond(bond.id)`?**
> `removeBond()` internally calls `bond.break(true)` which fires a velocity impulse on both
> atoms. Thermal breaking should not add directed kinetic energy — only the random walk of
> temperature affects motion. Using `bond.break(false) + bonds.delete()` matches the
> reshaping pattern in `molecule.js:491 _restructureBonds()`. _(Resolved: Todo 034)_

Call in `environment.update()` after `this.syncBonds()` (line 837):

```javascript
// src/core/environment.js — environment.update(), after syncBonds()
this.syncBonds();
this.tryBreakThermalBonds();  // ← NEW (renamed from tryBreakBondsThermal)
this.applyBoundaries();
```

**Performance note** (from solutions/performance-issues): No `console.warn` or `console.log`
in this method — it runs in the update loop. The 6-tick check interval reduces overhead
while the `effectiveDt` compensation preserves statistical accuracy.

**Acceptance**: Uses `bond.shouldBreakThermal(temp)` — the simple kinetics formula from the
brainstorm. H-H single bond at `temp=600`: `(1-0.385) × min(1, 600/298) = 0.615 × 1.0 ≈ 61.5%`
per check. CO triple bond (stability=1.0): `(1-1.0) × ... = 0%` at any temperature. _(Resolved: Todo 032)_

---

#### Phase 5: Thermodynamics System Class

**Files**: `src/systems/thermodynamics.js` (new), `build.ts`, `dev.html`

Stateless utility class providing thermodynamics calculations consumed by environment and
intention. Does not run its own update loop.

> **YAGNI cleanup (Todo 039)**: Unlike `AtomSpawner`, this class is stateless — no update
> loop, no visual rendering, no 15+ properties. Removed: `this.id` (nothing indexes it),
> `this.active` (no UI to toggle, no use case), `serialize()`/`deserialize()` (only persisted
> the unused `active` flag). Keeps the class structure for named method semantics.

```javascript
// src/systems/thermodynamics.js
class Thermodynamics {
    constructor(environment) {
        this.environment = environment;
    }

    getStabilityScore(symbol1, symbol2, order) {
        return Math.min(1, getBondEnergy(symbol1, symbol2, order) / MAX_BOND_ENERGY);
    }

    getFormationFactor(symbol1, symbol2, temperature) {
        const stability = this.getStabilityScore(symbol1, symbol2, 1);  // always order-1 for spontaneous
        return Math.min(1, stability * (temperature / 298));
    }

    // Returns local temperature at (x, y) — intention zones override global temp
    getTemperatureAt(x, y) {
        for (const intention of this.environment.intentions.values()) {
            // deep-review: == null catches both null and undefined
            if (intention.localTemperature == null) continue;
            // deep-review: skip fulfilled intentions (avoids race on last tick)
            if (intention.fulfilled) continue;
            // deep-review security: validate localTemperature from deserialized blueprints
            // NaN/Infinity/negative values silently break all thermal math
            const localTemp = intention.localTemperature;
            if (!Number.isFinite(localTemp) || localTemp < 1 || localTemp > 600) continue;
            // deep-review: use squared distance — no Math.sqrt needed
            const dx = x - intention.position.x;
            const dy = y - intention.position.y;
            const distSq = dx * dx + dy * dy;
            const radiusSq = intention.radius * intention.radius;
            if (distSq <= radiusSq) {
                return localTemp;
            }
        }
        return this.environment.temperature;
    }

}
window.Thermodynamics = Thermodynamics;
```

**Build order** — insert after `atom-spawner.js` in `build.ts`:

```typescript
// build.ts scriptOrder — insert at position after 'src/systems/atom-spawner.js'
'src/systems/atom-spawner.js',
'src/systems/thermodynamics.js',   // ← NEW
'src/systems/neural-network.js',
```

**`dev.html`** — add script tag after atom-spawner:

```html
<script src="src/systems/atom-spawner.js"></script>
<script src="src/systems/thermodynamics.js"></script>  <!-- NEW -->
```

---

#### Phase 6: Modify `tryFormBonds()` — Thermal Formation Factor

**Files**: `src/core/environment.js`

In `tryFormBonds()` at line ~641, replace the static `prob * 0.3` factor with a
temperature-scaled probability. The tar-ball guard (`prob = 0` inside intention zones)
**must remain untouched**.

```javascript
// src/core/environment.js — tryFormBonds(), current line ~641
// BEFORE:
if (Math.random() < prob * 0.3) {

// AFTER:
const sym1 = atom1.symbol;  // convention: use .symbol not .element.symbol (see bond.js:47)
const sym2 = atom2.symbol;
const thermalFactor = this.thermodynamics
    ? this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature)
    : 0.3;
if (Math.random() < prob * thermalFactor) {
```

**Guard**: `this.thermodynamics` optional check — if system not yet instantiated (during
deserialization or early startup), falls back to the original `0.3` factor. No crash.

---

#### Phase 7: Intention — Local Temperature Zone

**Files**: `src/entities/intention.js`

Add `localTemperature = null` to constructor (after `this.repulsionForce` assignment, line ~31):

```javascript
// src/entities/intention.js — Intention constructor, after repulsionForce
this.localTemperature = null;  // null = use global environment.temperature
```

**Patching Rule 6 bond formation** (`_rule6_bondClaimed()` in `intention.js`).

> ⚠️ **CRITICAL (deep-review finding)**: The plan previously described calling `tryFormBond()`
> here, but Rule 6 does NOT use `tryFormBond()`. It makes two manual `canBondWith()` calls then
> calls `new Bond()` directly. The second `canBondWith()` call (on seedAtom, line ~761) has NO
> context — missing `{ intentId, allowOvervalence }`. This asymmetry blocks CO because O's
> valence check fires on the seedAtom side with no override. Additionally, line ~754 checks
> `if (!seedAtom.availableValence) continue` which would short-circuit O atoms that already
> have 2 bonds (their max), before even reaching `canBondWith`.

Rule 6 has two bond-formation paths. **Only the seed branch is broken** — the no-seed branch
(lines ~800-801) already passes `{ intentId: this.id }` to both `canBondWith` calls.

**Fix 1: Seed branch — add context to both `canBondWith` calls and relax valence guard**
(intention.js, lines ~753-764):

```javascript
// src/entities/intention.js — _rule6_bondClaimed(), seed branch
// BEFORE:
for (const seedAtom of seedMol.atoms) {
    if (!seedAtom.availableValence) continue;           // ← blocks O with 0 valence
    // ...distance check...
    if (!atom.canBondWith(seedAtom, 1, { intentId: this.id })) continue;  // has context
    if (!seedAtom.canBondWith(atom, 1)) continue;       // ← NO context!
    const bond = new Bond(atom, seedAtom, 1);
}

// AFTER — pass context to BOTH calls; allow overvalence for high-stability pairs:
for (const seedAtom of seedMol.atoms) {
    // Relaxed valence guard: allow 0-valence atoms if the pair qualifies for overvalence
    const stability = getBondEnergy(atom.symbol, seedAtom.symbol, 1) / MAX_BOND_ENERGY;
    const allowOvervalence = stability > 0.85;
    if (!seedAtom.availableValence && !allowOvervalence) continue;
    // ...distance check (unchanged)...
    const ctx = { intentId: this.id, allowOvervalence };
    if (!atom.canBondWith(seedAtom, 1, ctx)) continue;
    if (!seedAtom.canBondWith(atom, 1, ctx)) continue;  // ← now gets context
    const bond = new Bond(atom, seedAtom, 1);
}
```

**Note on bond order=1**: Rule 6 creates single bonds during assembly. The template's actual
bond orders (e.g. order=3 for C≡O) are applied later by Rule 7's reshaping step
(`molecule._restructureBonds()`), which uses `new Bond(atom1, atom2, order)` directly —
bypassing `canBondWith()` entirely. So Rule 6 does not need template-driven bond orders;
`allowOvervalence` ensures O can accept a single bond despite appearing "full" at valence 2.

**Fix 2: No-seed branch — add `allowOvervalence` to context** (lines ~800-801):

```javascript
// src/entities/intention.js — _rule6_bondClaimed(), no-seed branch
// BEFORE:
if (!atom.canBondWith(other, 1, { intentId: this.id })) continue;
if (!other.canBondWith(atom, 1, { intentId: this.id })) continue;

// AFTER — add allowOvervalence for high-stability pairs:
const stability = getBondEnergy(atom.symbol, other.symbol, 1) / MAX_BOND_ENERGY;
const allowOvervalence = stability > 0.85;
const ctx = { intentId: this.id, allowOvervalence };
if (!atom.canBondWith(other, 1, ctx)) continue;
if (!other.canBondWith(atom, 1, ctx)) continue;
```

> **Why `atom.symbol` not `atom.element.symbol`?** Convention: `bond.js:47` uses
> `this.atom1.symbol` (direct property). Both are equivalent but `.symbol` is the
> codebase-standard access pattern.

---

#### Phase 8: CO Reshaping Path — Confirmed No-Op + Inspector Display Fix

**Files**: `src/entities/molecule.js` (no changes), `src/viewer/controls.js`

> **Confirmed** (deep-review): `_restructureBonds()` at `molecule.js:502` uses
> `new Bond(atom1, atom2, order)` directly — bypasses `canBondWith()` entirely.
> **No changes to `molecule.js` are needed.** The CO triple bond is created by reshaping
> without any valence check interference.

**However**, after reshaping creates a CO triple bond, the O atom has `bondCount=3`,
`maxBonds=2`, `availableValence=-1`. The Inspector at `controls.js:552` displays
`Valence: 3/2` — which is the original bug symptom.

**Inspector display fix** — update `controls.js:552` to handle intentionally over-bonded atoms:

```javascript
// src/viewer/controls.js — line ~552, Inspector atom display
// BEFORE:
<p>Valence: ${atom.bondCount}/${atom.maxBonds}</p>

// AFTER — show effective max for over-bonded atoms in stable molecules:
<p>Valence: ${atom.bondCount}/${atom.bondCount > atom.maxBonds
    ? atom.bondCount + '*' : atom.maxBonds}</p>
```

This displays CO oxygen as `Valence: 3/3*` (the `*` indicates over-bonded but intentional)
and normal atoms as `Valence: 2/2` unchanged.

**Acceptance**: CO oxygen in Inspector shows `Valence: 3/3*` (not `3/2`). Normal atoms
are unaffected.

---

#### Phase 9: UI — Temperature Slider

**Files**: `dev.html`, `src/main.js`

Add slider HTML to the `.sim-controls` section in `dev.html` after the speed slider (line ~33):

```html
<!-- dev.html — in .sim-controls, after speedSlider -->
<label for="temperatureSlider" title="Temperature (K)">🌡️</label>
<input type="range" id="temperatureSlider" min="1" max="600" value="300"
       title="Temperature (K)">
<span id="temperatureValue">300K</span>
```

Note: minimum is `1` (not `0`) to avoid `temp/298` producing near-zero formation forever.

Wire in `src/main.js` `_setupUI()` after the speed slider handler (line ~128):

```javascript
// src/main.js — _setupUI(), after speedSlider handler
const temperatureSlider = document.getElementById('temperatureSlider');
const temperatureValue = document.getElementById('temperatureValue');
temperatureSlider?.addEventListener('input', (e) => {
    // deep-review security: NaN guard required
    const raw = parseInt(e.target.value, 10);
    const temp = Number.isFinite(raw) ? Math.max(1, Math.min(600, raw)) : 300;
    this.environment.temperature = temp;
    if (temperatureValue) temperatureValue.textContent = `${temp}K`;
});
```

**Optional logarithmic slider** (best-practices recommendation): Temperature sliders in
probabilistic simulations behave better on a log scale because the Arrhenius exponential
makes low-temperature behavior linear but high-temperature behavior saturated. If the linear
slider feels unresponsive at low temperatures, consider:

```javascript
// Logarithmic mapping (optional enhancement)
const T_MIN = 1, T_MAX = 600;
const sliderPos = raw / 600;  // normalized 0-1
const temp = Math.round(T_MIN * Math.pow(T_MAX / T_MIN, sliderPos));
```

---

#### Phase 10: Wire Thermodynamics in main.js + Serialization Security

**Files**: `src/main.js`, `src/core/environment.js`

Instantiate `Thermodynamics` after environment setup:

```javascript
// src/main.js — after environment instantiation
this.thermodynamics = new Thermodynamics(this.environment);
this.environment.thermodynamics = this.thermodynamics;  // back-reference for tryFormBonds
```

**Serialization security** (deep-review: validate on deserialize):

```javascript
// src/core/environment.js — deserialize(), where temperature is loaded
// BEFORE:
this.temperature = data.temperature;

// AFTER — validate bounds to prevent corrupted saves from breaking thermal math:
const rawTemp = data.temperature;
if (Number.isFinite(rawTemp) && rawTemp >= 1 && rawTemp <= 600) {
    this.temperature = rawTemp;
} else {
    this.temperature = 300;  // default on invalid save data
}

// deep-review security (Todo 038): validate width/height — Infinity/NaN causes
// spatial grid to produce infinite loop bounds, hanging the browser tab.
const rawWidth = data.width;
const rawHeight = data.height;
this.width = (Number.isFinite(rawWidth) && rawWidth > 0 && rawWidth <= 10000) ? rawWidth : 2000;
this.height = (Number.isFinite(rawHeight) && rawHeight > 0 && rawHeight <= 10000) ? rawHeight : 2000;
```

---

#### Phase 11: Build and Playwright Tests

**Build**: `deno run --allow-read --allow-write --allow-run build.ts`
Both `dev.html` and `index.html` must pass all Playwright tests.

**New Playwright test** — `tests/scenarios/t09-thermo-co-triple-bond.spec.js`:
_(Note: file named per `tNN` convention, not underscore convention)_

The test must:
1. Clear environment, activate spawner with `['C','O']` pool
2. Add a CO molecule intention zone at center (1000, 1000)
3. Click `#playPauseBtn` (mandatory per project testing rules)
4. Run for 4000 ticks
5. Assert: at least one bond in the environment has `order === 3`
6. Assert: the bonded C and O atoms form a CO molecule (`formula === 'CO'`)

**Test validity rules** (from CLAUDE.md):
- Atoms must come from `AtomSpawner` — no manual placement
- `#playPauseBtn` must be clicked to start simulation
- Both `dev.html` and `index.html` must pass

---

## System-Wide Impact

### Interaction Graph

```
environment.temperature (modified by UI slider)
    → environment.tryBreakThermalBonds()          [new, every 6 ticks]
        → bond.shouldBreakThermal(temp)           [new method — (1-stability)×min(1,T/298)]
        → bond.break(false) + bonds.delete()      [silent removal — no kinetic impulse]
    → environment.tryFormBonds()                  [modified — thermal factor]
        → thermodynamics.getFormationFactor()     [new]
    → intention._rule6_bondClaimed()              [modified — allowOvervalence]
        → atom.canBondWith(seedAtom, 1, ctx)     [BOTH calls get context now]
        → seedAtom.canBondWith(atom, 1, ctx)     [was missing context — CRITICAL fix]
        → new Bond(atom, seedAtom, 1)            [order=1; reshaping upgrades later]
```

### Tar-ball Protection (Critical)

The existing guard in `tryFormBonds()` sets `prob = 0` for atoms inside molecule intention
zones. This runs BEFORE the `thermalFactor` multiplication. Therefore:
- Inside intention zone: `prob = 0` → `0 × thermalFactor = 0` → no spontaneous bonding ✅
- Outside intention zone: `prob × thermalFactor` — thermodynamics applies ✅

Tar-ball protection is preserved automatically.

### Error & Failure Propagation

- `getBondEnergy()` always returns a value (has `DEFAULT=60` fallback) — no null risk
- `bond.stabilityScore` returns float in `[0, ~1.14]` for known bonds; `Math.min(1, ...)` in
  `getStabilityScore()` caps it for future bonds above MAX_BOND_ENERGY
- `this.thermodynamics` is optional — `tryFormBonds()` falls back to `0.3` if null
- `getTemperatureAt()` now guards `localTemperature == null` (not `=== null`) to catch
  both `null` and `undefined`

### State Lifecycle Risks

- Thermal break reuses `this._bondsToBreak` (persistent scratch array) — length reset
  before each use; no mid-iteration mutation of `this.bonds`
- `bond.break(false) + bonds.delete()` for thermal breaking — suppresses kinetic impulse.
  `atom.bonds` arrays will be dirty until next tick's `syncBonds()` — acceptable behavior.
- `_thermalBreakTick` initialized in constructor, reset in `clear()` — no stale state

### Serialization

- `environment.temperature` is already serialized/deserialized (lines 954/974)
  — Phase 10 adds validation on deserialize
- `bond.order` is already serialized — CO triple bond persists across save/load
- `intention.localTemperature` is NOT serialized (intentions are not serialized today)
  — acceptable known limitation; local temp resets on reload

---

## Alternative Approaches Considered

(see brainstorm: docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md)

- **Approach A (Boltzmann)**: More rigorous but required careful tuning of activation
  energy constants and had emergent instability risk. Rejected.
- **Approach C (Enthalpy Scoring)**: Internally consistent but expensive (per-bond enthalpy
  delta on every formation attempt). Rejected.
- **Global soft valence override**: Rejected in SpecFlow analysis — would allow free O atoms
  to spontaneously acquire 3 bonds at high temp, breaking all O-containing chemistry.
  Zone-limited override is correct.
- **Gillespie SSA**: Exact stochastic simulation algorithm but requires global propensity
  sum before advancing time — incompatible with BioChemSim's fixed 60fps update loop.
- **Arrhenius per-tick**: `P = dt × A × exp(-E/T)` — academically validated for particle
  sims. However, `exp()` is always positive, so stability=1.0 bonds (CO) would always have
  nonzero break probability. Incompatible with acceptance criterion "CO 0% break". Rejected
  in favor of the simple kinetics model which guarantees 0% via `(1 - stability)` multiplier.
- **Bond age accumulation**: More exact for large timesteps but requires per-bond age state
  and a conceptually tricky reset-on-survival mechanism. Not worth complexity at 60fps.

---

## Acceptance Criteria

### Functional Requirements

- [ ] `getBondEnergy('C', 'O', 3)` returns `257` (not `60` DEFAULT)
- [ ] CO molecule can form with triple bond via a CO intention zone at default 298K
- [ ] Oxygen in CO shows `Valence: 3/3*` in Inspector (not `3/2`) — `*` indicates intentional over-bond
- [ ] At `temp=600K`, CO triple bond has 0% thermal break probability
- [ ] At `temp=100K`, formation factor ≈ `stability × 0.34` — significantly reduced activity
- [ ] Temperature slider updates `environment.temperature` in real-time with NaN guard
- [ ] Slider value clamped: `Math.max(1, Math.min(600, raw))` — no out-of-range temperatures
- [ ] Intention zones with `localTemperature` set override global temp for atoms inside them
- [ ] `tryFormBonds()` tar-ball guard (`prob=0` inside molecule intention zones) is untouched
- [ ] Sealed polymer atoms are never thermally broken (`|| isSealed` check, not `&&`)

### Non-Functional Requirements

- [ ] `tryBreakThermalBonds()` runs at most once per 6 ticks — reduces 60fps overhead
- [ ] No `console.warn/log/error` in the thermal breaking or formation code paths
- [ ] No defensive `.slice()` copies inside hot-path methods
- [ ] `deserialize()` validates `data.temperature` before assigning

### Quality Gates

- [ ] All existing Playwright tests pass (no regressions)
- [ ] New Playwright test `t09-thermo-co-triple-bond.spec.js` passes on both `dev.html` and `index.html`
- [ ] Bundle rebuilt and `index.html` updated: `deno run --allow-read --allow-write --allow-run build.ts`

---

## Dependencies & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `intentId` fast-path blocks `allowOvervalence` in canBondWith (lines 81-88) | **CRITICAL** | Phase 3 restructures the intentId branch, not just adds code after it |
| Rule 6 seed branch: `seedAtom.canBondWith` has no context (line 761), blocks CO on O side | **CRITICAL** | Phase 7 patches both `canBondWith` calls to pass `{ intentId, allowOvervalence }` |
| Rule 6 seed branch: `!seedAtom.availableValence` guard (line 754) blocks O with 0 valence | **CRITICAL** | Phase 7 relaxes guard: skip only if `!availableValence && !allowOvervalence` |
| CO reshaping path uses `new Bond()` directly, bypassing `canBondWith()` | Medium | Phase 8 investigates `molecule.js:439+`; if `new Bond()`, it's a no-op fix |
| Rule 6 creates order-1 bonds; CO needs order-3 — comes later via reshaping in Rule 7 | Medium | Phase 8: reshaping uses `new Bond(a1, a2, order)` directly, bypasses valence checks |
| High-temperature oscillatory instability (bonds rapidly form and break) | Medium | 6-tick check interval dampens this; simple kinetics model self-limits via `(1-stability)` ceiling; monitor at 600K |
| `MAX_BOND_ENERGY` global variable naming collision in dev.html | Low | Export explicitly via `window.MAX_BOND_ENERGY` (Phase 1) |
| `_thermalBreakTick` lazy init was a code smell | Low | Phase 4 initializes in constructor and resets in `clear()` |

---

## Files to Create or Modify

| File | Action | What changes |
|------|--------|-------------|
| `src/data/periodic-table.js` | Modify | Add `'C≡O': 257`, `MAX_BOND_ENERGY = 257`, `window.MAX_BOND_ENERGY` |
| `src/entities/bond.js` | Modify | Add `stabilityScore` getter, `shouldBreakThermal(temp)`, extend `tryFormBond()` to accept `context` |
| `src/entities/atom.js` | Modify | Restructure `intentId` branch in `canBondWith()` to thread `allowOvervalence`; add soft override to regular valence check |
| `src/core/environment.js` | Modify | Constructor: add `_thermalBreakTick`, `_bondsToBreak`, `thermodynamics = null`; add `tryBreakThermalBonds()`; call from `update()`; modify `tryFormBonds()` factor; validate temperature in `deserialize()` |
| `src/entities/intention.js` | Modify | Add `localTemperature = null` to constructor; Phase 7: patch BOTH `canBondWith` calls in seed branch (lines ~760-761) to pass `{ intentId, allowOvervalence }`; relax `!availableValence` guard (line ~754); add `allowOvervalence` to no-seed branch context (lines ~800-801) |
| `src/entities/molecule.js` | No change | Phase 8: confirmed `_restructureBonds()` uses `new Bond()` directly — no-op |
| `src/viewer/controls.js` | Modify | Phase 8: Inspector display fix — show `3/3*` for over-bonded atoms instead of `3/2` |
| `src/systems/thermodynamics.js` | **Create** | New system class: `getStabilityScore()`, `getFormationFactor()`, `getTemperatureAt()` with fulfilled guard + squared distance |
| `src/main.js` | Modify | Instantiate `Thermodynamics`; wire temperature slider with NaN guard + clamp |
| `dev.html` | Modify | Add `<script>` for thermodynamics.js; add temperature slider HTML |
| `build.ts` | Modify | Add `'src/systems/thermodynamics.js'` to scriptOrder after atom-spawner.js |
| `tests/scenarios/t09-thermo-co-triple-bond.spec.js` | **Create** | Playwright test: CO triple bond forms in intention zone at 298K (tNN naming convention) |

---

## Future Considerations

- **Molecule decay rate**: `molecule.update()` decay timer is hardcoded (500-1500 ticks).
  Future work: multiply `decayRate` by `(temp/298)` — faster decay at high temp.
- **Bond order upgrades in `tryFormBonds()`**: Currently always spawns order-1 bonds. Future:
  attempt order-2 upgrade if both atoms have remaining valence after first bond.
- **Intention `localTemperature` serialization**: Intentions are not currently serialized.
  Future: add `intention.serialize()`/`deserialize()` to persist intention state including
  local temperature across save/load.
- **Polymer temperature sensitivity**: Current polymer assembly in `updatePolymers()` has no
  thermal probability. Future: add formation probability to monomer-to-polymer bonding.
- **Logarithmic temperature slider**: If the linear slider feels unresponsive at low temp,
  convert to log scale (Phase 9 enhancement option).
- **Labeled temperature presets**: Research (Baymard, PhET) suggests named presets
  ("Frozen", "Warm", "Hot", "Plasma") are more user-friendly than Kelvin labels.

---

## Sources & References

### Origin

- **Brainstorm document**: [docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md](docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md)
  Key decisions carried forward: kinetics model (`stability × temp/298`), zone-limited
  valence override, Intention local temperature zones, default stability 0.30 for unlisted pairs.

### Internal References

- `src/data/periodic-table.js:160-181` — `BOND_ENERGIES` table and `getBondEnergy()` (lines 246-252)
- `src/entities/bond.js:13-30` — Bond constructor and `calculateStrength()`
- `src/entities/bond.js:67-71` — `shouldBreak()` (strain-only, currently unused in loop)
- `src/entities/atom.js:49-58` — `bondCount` and `availableValence` getters
- `src/entities/atom.js:77-108` — `canBondWith()` with existing context pattern including `intentId` fast-path
- `src/core/environment.js:32` — `this.temperature = 300` (already exists, serialized)
- `src/core/environment.js:588-650` — `tryFormBonds()` including tar-ball guard
- `src/core/environment.js:835-885` — full `update()` loop with insertion points
- `src/entities/intention.js:15-60` — Intention constructor (no `localTemperature` yet)
- `src/systems/atom-spawner.js` — pattern to follow for `thermodynamics.js`
- `build.ts:19-46` — script loading order

### Institutional Learnings

- `docs/solutions/physics-issues/wrong-element-atoms-crowding-intention-zones.md` —
  Force balance invariants; hot-path performance rules
- `docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md` —
  Tar-ball protection in `tryFormBonds()`; bond extraction completeness
- `docs/solutions/performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md` —
  No console.log in hot paths; no defensive .slice() in render loop; persistent scratch arrays

### External Research (Best Practices)

- Arrhenius per-tick probability: `P = dt * A * exp(-E/T)` validated pattern for real-time
  particle simulations — considered and rejected because `exp()` cannot produce exactly 0%
  for stability=1.0 bonds (CO). Simple kinetics `(1-stability)×min(1,T/298)` chosen instead.
- Metropolis acceptance criterion: thermodynamic basis for bond breaking probability
- Gillespie SSA: why it's NOT suitable for fixed-timestep game loops
- N-tick throttling: academically validated pattern; 6-tick interval balances accuracy and performance
- Logarithmic slider: Baymard/Smashing Magazine UX research; PhET simulation design guidelines
- Bond energy normalization: dimensionless ratios relative to reference bond (C-H=1.0) preserve Arrhenius exponential sensitivity better than 0-1 linear clamp
