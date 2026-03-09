---
status: complete
priority: p1
issue_id: "032"
tags: [code-review, thermodynamics, chemistry, architecture]
dependencies: []
---

# Plan has two conflicting bond-breaking formulas — CO breaks at 37% per check at 298K

## Problem Statement

The thermodynamics plan defines two inconsistent bond-breaking formulas that contradict each other. The acceptance criterion requires "CO triple bond has 0% thermal break probability" but the formula actually used in `tryBreakThermalBonds()` gives CO a **37% break probability per check at 298K** — meaning CO disintegrates within seconds of forming. This is a fundamental design error that must be resolved before any code is written.

## Findings

- **Phase 2** adds `shouldBreakThermal(temperature)` on `Bond` using: `(1 - this.stabilityScore) * Math.min(1, temperature / 298)`
  - For CO (stability=1.0): `(1 - 1.0) * ... = 0%` — CO never breaks ✅
- **Phase 4** `tryBreakThermalBonds()` uses a completely different Arrhenius formula: `Math.min(effectiveDt * A * Math.exp(-(bond.stabilityScore) / Math.max(temp / 298, 0.01)), 1.0)`
  - For CO (stability=1.0) at 298K: `exp(-1.0 / 1.0) = exp(-1) ≈ 0.368` = **37% break probability** ❌
- **`tryBreakThermalBonds()` never calls `bond.shouldBreakThermal()`** — it recomputes inline with a different formula
- The plan's own Interaction Graph confirms the arrow goes `tryBreakThermalBonds() → bond.stabilityScore`, NOT `→ bond.shouldBreakThermal()`
- The acceptance criterion ("0% break probability for CO") is only satisfied by the Phase 2 formula, which is dead code

## Proposed Solutions

### Option 1: Use the simple kinetics formula throughout (Recommended)

Replace the Arrhenius inline formula in `tryBreakThermalBonds()` with the simple model:

```javascript
// In tryBreakThermalBonds(), per bond:
const pBreak = (1 - bond.stabilityScore) * Math.min(1, temp / 298);
if (Math.random() < pBreak) { ... }
```

This is the formula from `shouldBreakThermal()`. Call `bond.shouldBreakThermal(temp)` directly instead of inlining it again.

**Pros:**
- Directly satisfies the CO acceptance criterion (pBreak=0 for stability=1.0)
- Eliminates the formula duplication
- Simple, easy to verify

**Cons:**
- Less physically rigorous than Arrhenius (but brainstorm explicitly chose Approach B over Boltzmann for this reason)
- No `effectiveDt` factor — probability is per-check, not time-normalized

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Keep Arrhenius but fix the formula to account for stability

The Arrhenius formula should use `(1 - stability)` as the exponent driver, not raw stability:

```javascript
// Uses (1 - stability) so that high-stability bonds have near-zero probability
const pBreak = Math.min(effectiveDt * A * Math.exp(-(1 - bond.stabilityScore) * E_scale / Math.max(temp / 298, 0.01)), 1.0);
```

This way, CO (stability=1.0): `exp(-0 / T) = exp(0) = 1.0` × `effectiveDt * A` ... wait, that still isn't 0. The issue is that `exp()` can never return 0 — only approach it asymptotically. To get exactly 0% for CO, you need a direct `(1 - stability)` multiplier, not an exponential.

**Pros:** More physically correct for intermediate bonds
**Cons:** Still doesn't produce exactly 0% for CO; acceptance criterion not satisfiable with Arrhenius alone
**Effort:** 1 hour
**Risk:** Medium

---

### Option 3: Delete `shouldBreakThermal()`, use simple formula in tryBreakThermalBonds

Same as Option 1 but explicitly notes to delete `shouldBreakThermal()` as part of the fix since the logic is inlined directly in `tryBreakThermalBonds()`.

```javascript
// In tryBreakThermalBonds() — inline the simple formula:
const pBreak = (1 - bond.stabilityScore) * Math.min(1, temp / 298);
if (Math.random() < pBreak) {
    this._bondsToBreak.push(bond);
}
```

**Pros:** Eliminates dead code and formula duplication in one step
**Cons:** Slightly less modular than delegating to `bond.shouldBreakThermal()`
**Effort:** 30 minutes
**Risk:** Low

## Recommended Action

Use Option 1 or Option 3 — they are equivalent. Update Phase 4 in the plan to use `bond.shouldBreakThermal(temp)` (or the inlined simple formula). Delete the Arrhenius inline formula from `tryBreakThermalBonds()`. The simple kinetics model was the brainstorm's chosen approach; the Arrhenius formula was introduced by the best-practices researcher but is incompatible with the acceptance criteria for CO.

Also update the plan's acceptance criteria section to correct "H-H single bond at 600K has ~61% break probability per 60-tick check" — with the simple formula: `(1 - 0.385) * min(1, 600/298) ≈ 0.615 * 1.0 ≈ 61.5%` per check, which happens to match. CO: `(1-1.0)*... = 0%` ✅.

## Technical Details

**Affected plan phases:**
- Phase 2 (`shouldBreakThermal` definition in `bond.js`)
- Phase 4 (`tryBreakThermalBonds` in `environment.js`)
- Acceptance criteria section

**The simple formula** (from brainstorm doc):
- `P(break) = (1 - stability) × min(1, temp/298)`
- At 298K: `P(break) ≈ 1 - stability` (weak bonds break readily, stable bonds don't)
- At 600K: `P(break) = min(1, 2.01) × (1-stability) = 1 × (1-stability)`
- CO (stability=1.0): `P(break) = 0` at ANY temperature ✅

## Acceptance Criteria

- [ ] Plan Phase 4 uses the simple kinetics formula `(1-stability) × min(1, temp/298)`
- [ ] CO triple bond (stability=1.0) has 0% thermal break probability at all temperatures
- [ ] H-H single bond (stability≈0.385) has ~61.5% break probability at 600K
- [ ] `bond.shouldBreakThermal()` is the single source of truth for the formula (called by `tryBreakThermalBonds`)
- [ ] No Arrhenius formula (`Math.exp(-stability/T)`) remains in the plan

## Work Log

### 2026-03-01 - Identified by Architecture Strategist + Code Simplicity Reviewer

**By:** Code review agents (technical_review workflow)

**Actions:**
- Architecture agent found that `exp(-stability/T)` for CO at 298K gives 37% not 0%
- Simplicity agent confirmed `shouldBreakThermal()` is never called by `tryBreakThermalBonds()`
- Pattern agent confirmed the same discrepancy

**Learnings:**
- Two formulas were introduced from different sources: simple kinetics from brainstorm, Arrhenius from best-practices researcher
- The two models are architecturally incompatible for the CO use case
- The simple model satisfies all stated acceptance criteria; the Arrhenius model does not

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 2, Phase 4
- **Brainstorm:** `docs/brainstorms/2026-02-27-thermodynamics-bond-stability-brainstorm.md` — kinetics model decision
- **Related:** Todo 033 (Rule 6 context), Todo 034 (removeBond kinetics)

---

### 2026-03-01 - Resolved

**By:** Claude Code

**Actions:**
- Replaced Arrhenius formula `Math.exp(-stability/T)` with `bond.shouldBreakThermal(temp)` delegation in Phase 4
- Phase 4 `tryBreakThermalBonds()` now calls `bond.shouldBreakThermal(temp)` which uses `(1-stability) × min(1, T/298)`
- Fixed Phase 4 acceptance text to show correct formula derivation
- Updated Architecture Overview to show `bond.shouldBreakThermal` not `Thermodynamics.getBreakProbability`
- Updated system-wide interaction graph to show `bond.shouldBreakThermal(temp)` delegation
- Updated Deep Review Enhancements: "Best-Practice Calibrations" now explains why Arrhenius was rejected
- Updated Alternative Approaches Considered: Arrhenius now listed as explicitly rejected with rationale
- Updated Dependencies & Risks table: removed Arrhenius reference
- Updated State Lifecycle: `bond.break(false) + bonds.delete()` replaces `removeBond()` (also resolves Todo 034)
- Updated External Research references: Arrhenius noted as considered-and-rejected
- CO (stability=1.0): `(1-1.0)×... = 0%` at ANY temperature ✅
- H-H (stability≈0.385) at 600K: `(1-0.385)×min(1,600/298) = 0.615×1.0 ≈ 61.5%` per check ✅

**Learnings:**
- The simple kinetics model from the brainstorm and the Arrhenius model from the best-practices researcher are fundamentally incompatible: `exp()` can never return 0, but the acceptance criteria require exactly 0% for CO
- Always verify that externally-recommended formulas satisfy the stated acceptance criteria before incorporating them into the plan
