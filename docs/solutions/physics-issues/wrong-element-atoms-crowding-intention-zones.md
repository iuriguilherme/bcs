---
title: "Wrong-Element Atoms Crowding Molecule Intention Zones"
date: 2026-03-01
problem_type: physics_issue
component: intention-system
symptoms:
  - Wrong-element atoms (e.g. O inside a C₂H₄ zone) accumulate indefinitely instead of being expelled
  - Intention zone fills with wrong-composition atoms/molecules causing assembly gridlock
  - Seed molecule never forms despite intention being active for 30+ seconds
  - Progress counter stalls at 0 or very low values
  - Console shows no "Molecule formed" or assembly-related logs
affected_files:
  - src/entities/intention.js
  - src/entities/atom.js
tags:
  - intention-system
  - physics-calibration
  - repulsion-forces
  - molecule-assembly
  - zone-crowding
pr_number: 3
related_bugs:
  - "Bug #11 (Intention Repulsion Policy)"
  - "Bug #12 (isSurplus exception to Bug #11)"
---

# Wrong-Element Atoms Crowding Molecule Intention Zones

## Overview

When a molecule intention attempted to assemble a seed molecule, wrong-composition atoms and small
unstable wrong-composition molecules would drift into the intention zone and become physically stuck.
They could not bond (bonding is blocked inside intention zones) and the existing repulsion rules
failed to expel them, causing late-assembly gridlock.

**Fixed in PR #3** (`fix/intention-zone-crowding`, merged 2026-03-01).

---

## Root Cause

Three independent failures combined to produce the crowding effect:

### 1. Rule 2 had no composition check

`_rule2_repelIrrelevantMolecules` only repelled:
- Stable molecules (H₂, O₂, CH₄, etc.)
- Molecules larger than the target (tar-balls)

Small unstable wrong-composition molecules — e.g. CHO or CO inside a C₂H₄ zone — passed both
checks and remained indefinitely. Bonding was blocked inside the zone, so they simply drifted in
circles until the zone filled.

### 2. repulsionForce (8.0) was too weak

The existing repulsion force per atom was `8.0` with a floor multiplier of `0.3`, giving a minimum
push of **2.4 units/tick**. The inter-particle bonding attraction (`attractionStrength = 20` per
bonded pair) easily overcame this. A wrong atom bonded to a neighbor inside the zone felt a net
inward force and drifted back in after each push.

### 3. Rule 1 applied to free atoms only, not molecules

`_rule1_repelIrrelevantAtoms` operated on free atoms. Wrong-element atoms that had bonded into
small molecules (even a CHO dimer) bypassed Rule 1 entirely and were subject only to the weaker
Rule 2 checks.

---

## Solution

Four coordinated changes restore expulsion:

### Change 1 — Raise `repulsionForce` constant

**File:** `src/entities/intention.js`, Intention constructor

```javascript
// Before
this.repulsionForce = 8.0;

// After
// Calibrated against environment.js physics constants:
//   attractionStrength = 20 (per bonded pair within attractionRadius=80)
//   bounceForce = 100 (boundary wall reference force)
// repulsionForce must exceed attractionStrength per neighbour pair so atoms
// cannot be held inside zones by inter-particle bonding. Floor (200×0.5=100)
// equals bounceForce, ensuring boundary expulsion even with multiple neighbours.
// If attractionStrength or bounceForce change in environment.js, recalibrate.
this.repulsionForce = 200.0;
```

The 25× increase ensures the minimum repulsion force (floor = 200 × 0.5 = **100 units**) matches the
boundary bounce force and exceeds inter-particle attraction even when multiple neighbors pull inward.

### Change 2 — Raise floor multiplier in Rules 1 and 2

**File:** `src/entities/intention.js`, `_rule1_repelIrrelevantAtoms` and `_rule2_repelIrrelevantMolecules`

```javascript
// Before (both rules)
const strength = Math.max(
    this.repulsionForce * (1 - dist / this.radius),
    this.repulsionForce * 0.3   // floor = 8 × 0.3 = 2.4
);

// After (both rules)
const strength = Math.max(
    this.repulsionForce * (1 - dist / this.radius),
    this.repulsionForce * 0.5   // floor = 200 × 0.5 = 100
);
```

Note: `_attractComponents` (used by polymer/cell intents) retains `0.3`. Polymer/cell intents have
larger radii and gentler boundary dynamics — 0.3 is sufficient there. The two constants are
intentionally divergent.

### Change 3 — Add composition check to Rule 2

**File:** `src/entities/intention.js`, `_rule2_repelIrrelevantMolecules`

```javascript
// Precompute claimed element counts for the surplus check.
const targetElements = new Set(Object.keys(targetComp));
const claimedCount = {};
for (const atom of claimed) {
    claimedCount[atom.symbol] = (claimedCount[atom.symbol] || 0) + 1;
}

for (const mol of environment.molecules.values()) {
    if (mol.isSeedFor) continue;
    if (mol.polymerId) continue;
    if (mol.formula === targetFormula) continue;

    // Condition 1: wrong-element check.
    // A molecule containing any element NOT in the target can never become
    // the target molecule through chemistry, so expel it immediately.
    const hasWrongElement = mol.atoms.some(a => !targetElements.has(a.symbol));

    // Condition 2: surplus check.
    // A molecule with only correct elements but whose elements are all already
    // fully claimed is surplus — expel it to prevent late-assembly crowding.
    //
    // NOTE: This intentionally overrides Bug #11's "leave unstable molecules alone" rule.
    // An unstable same-element mol (e.g. C2H3 in a C2H4 zone where 2C+4H are claimed)
    // could theoretically gain an H and become the target, but once claiming is complete
    // the intent bonds and fulfills within a few ticks — that window is negligible and
    // leaving surplus molecules creates late-assembly gridlock. Do NOT remove isSurplus
    // citing Bug #11; the trade-off is deliberate.
    const isSurplus = !hasWrongElement &&
        mol.atoms.every(a => (claimedCount[a.symbol] || 0) >= (targetComp[a.symbol] || 0));

    const shouldRepel = mol.isStable()
        || mol.atoms.length > totalNeeded
        || hasWrongElement   // NEW
        || isSurplus;        // NEW
    if (!shouldRepel) continue;
    // ... apply repulsion per atom ...
}
```

### Change 4 — Add `MAX_SPEED` velocity clamp to `Atom.update()`

**File:** `src/entities/atom.js`, `update(dt)`

```javascript
// After damping, before position update:
// Clamp speed to prevent tunnelling under strong expulsion forces.
// repulsionForce=200 gives H atoms (mass=1.008) a terminal velocity of
// ~330 world-units/tick, which exceeds the 300-unit intent zone radius.
const MAX_SPEED = 400;
const speed = this.velocity.length();
if (speed > MAX_SPEED) {
    this.velocity = this.velocity.mul(MAX_SPEED / speed);
}
```

At `repulsionForce = 200`, a hydrogen atom (mass ≈ 1) reaches a terminal velocity of ≈ 330 units/tick —
greater than the 300-unit zone radius. Without a clamp, atoms could tunnel through zone boundaries in
a single tick, breaking the spatial-grid collision system. The clamp at 400 provides safe headroom
above the terminal velocity while preventing tunnelling.

---

## Why It Works — Physics Analysis

### Force balance at zone boundary

| Force | Magnitude | Notes |
|-------|-----------|-------|
| Inter-particle attraction | 20 per bonded pair | env.js `attractionStrength` |
| Boundary bounce force | 100 | env.js `bounceForce` |
| Intention repulsion (floor) | **100** (200 × 0.5) | Must exceed attraction |
| Intention repulsion (centre) | 200 | Full force at dist=0 |

At the zone boundary with two bonded neighbours, the inward pull is 40 units. The new floor of 100
units provides a 2.5× margin, ensuring reliable outward drift despite damping.

### Terminal velocity formula

```
v_ss = (F / mass) * dt / (1 - damping)
     = (200 / 1.008) * (1/60) / 0.01
     ≈ 330 world-units/tick   (for H, the lightest atom)
```

Zone exit time at floor force: `300 units / 100 units/tick² * tick` ≈ few ticks. At 10× simulation
speed that is well under 1 second of wall time.

### Composition check logic

- **`hasWrongElement`**: A molecule like CHO contains oxygen, which cannot be removed by any reaction
  in this simulation. The molecule is chemically disqualified and expelled unconditionally.

- **`isSurplus`**: Once an intent has claimed 2C + 4H for C₂H₄, any additional CH₂ or C₂H₃ molecule
  is surplus. The intent will bond and fulfill within a few ticks; keeping surplus molecules creates
  gridlock. This check only triggers when claiming is fully complete, so it never discards potentially
  useful atoms during the assembly phase.

---

## Test Coverage

**T08** (`tests/scenarios/t08-intention-wrong-composition-expulsion.spec.js`):

- Spawns O atoms (wrong element) one at a time (tickInterval=120) into a C₂H₄ intent zone
- Runs 5 seconds wall-clock (≈ 25 O atoms spawned)
- Asserts `oCountInZone < 15` at steady state
  - Working: 0–12 (boundary oscillation of O₂ molecules that form outside the zone)
  - Broken (Rule 1 removed): ≈ 25 atoms stuck indefinitely

**Gaps:**
Rule 2's `isSurplus` path (unstable correct-element molecules drifting in after claiming completes)
cannot be triggered deterministically via Playwright — those molecules must form outside the zone and
drift in, which is non-deterministic. This path is validated by:
- Code inspection of the `isSurplus` guard
- T01/T02 passing (confirms valid molecules are NOT incorrectly expelled)

---

## Prevention & Future-Proofing

### Detecting this bug class

```javascript
// Paste in browser console while simulation runs
const env = window.cellApp.environment;
const intent = [...env.intentions.values()][0];
const wrongCount = [...env.atoms.values()].filter(a =>
    a.symbol === 'O' &&
    Math.hypot(a.position.x - intent.position.x, a.position.y - intent.position.y) < intent.radius
).length;
console.log('Wrong atoms in zone:', wrongCount);
// Fixed: ≤ 3 (boundary oscillation only)
// Broken: 15+
```

### Physics constants invariants

These relationships must hold if `attractionStrength` or `bounceForce` change in `environment.js`:

| Invariant | Current value | Formula |
|-----------|--------------|---------|
| floor > attractionStrength | 100 > 20 ✅ | `repulsionForce × 0.5 > attractionStrength` |
| floor ≥ bounceForce | 100 = 100 ✅ | `repulsionForce × 0.5 ≥ bounceForce` |
| MAX_SPEED > terminal velocity | 400 > 330 ✅ | `MAX_SPEED > repulsionForce / H_mass × 1.1` |

### Recalibration checklist

Run this checklist any time `attractionStrength` or `bounceForce` change:

- [ ] **New repulsionForce** = `max(attractionStrength × 10, bounceForce × 2)`
- [ ] **Verify floor** = `repulsionForce × 0.5 > attractionStrength`
- [ ] **New MAX_SPEED** = `ceil(repulsionForce / 1.008 × 1.2)` (H mass, 20% margin)
- [ ] Update physics comment block in `Intention` constructor (intention.js lines 23–31)
- [ ] Update `MAX_SPEED` comment in `atom.js` `update()`
- [ ] Run `npm test t08` — must pass
- [ ] Run `npm test` — no regressions on T01–T08

**Example**: If `attractionStrength` doubles to 40:
```
new_repulsionForce = max(40×10, 100×2) = 400
new_floor = 400 × 0.5 = 200 > 40  ✅
new_MAX_SPEED = ceil(400 / 1.008 × 1.2) = 476
```

### Common mistakes — do NOT repeat

| Mistake | Consequence | Guard |
|---------|-------------|-------|
| Remove `isSurplus` check citing Bug #11 | Late-assembly gridlock; zones fill with correct-element molecules that can't bond | Comment at intention.js:503–513 explains deliberate override |
| Lower `repulsionForce` below 150 | Floor falls below `attractionStrength`; atoms creep back in | Run T08 after any force change |
| Leave floor at 0.3 when raising `repulsionForce` | Floor may still be insufficient despite higher base force | Always raise both together |
| Apply repulsion via `mol.applyForce()` | Force divided by total molecule mass; negligible per-atom | Use `atom.applyForce()` inside `for (const atom of mol.atoms)` loop |
| Confuse `_attractComponents` floor (0.3) with Rules 1–2 floor (0.5) | Both are correct; they serve different intent types | Comments at all four `_attractComponents` call sites explain divergence |

---

## Related Documentation

- **Brainstorm**: [`docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md`](../../brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md) — design decisions and approach selection
- **Prior intention fix**: [`docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`](../logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md) — tar-ball formation, seed drift, claimed atom escape
- **AGENTS.md Bug #11** — Intention repulsion policy; `isSurplus` exception documented under "Key Rules"
- **AGENTS.md Bug #12** — isSurplus override of Bug #11; do not remove citing Bug #11
- **GitHub PR #3** — https://github.com/iuriguilherme/bcs/pull/3

### Commits

| SHA | Message |
|-----|---------|
| `f31783c` | fix: expel wrong-composition atoms/molecules from molecule intent zones |
| `f77052f` | fix: add MAX_SPEED=400 velocity clamp to atom.update() |
| `c6e3226` | docs(intention): document claimed start-of-tick snapshot invariant |
| `a98c329` | docs(intention): document isSurplus intentional override of Bug #11 rule |
| `04171c1` | docs: fix stale comment and document floor multiplier divergence (P3) |
| `1343dfa` | refactor(intention): simplify surplus check to single claimedCount map |
