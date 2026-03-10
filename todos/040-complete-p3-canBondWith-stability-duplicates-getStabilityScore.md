---
status: complete
priority: p3
issue_id: "040"
tags: [code-review, thermodynamics, architecture, simplicity]
dependencies: ["039"]
---

# `canBondWith()` inlines stability calculation duplicating `getStabilityScore` without `Math.min(1,...)` clamp

## Problem Statement

Phase 3 adds `getBondEnergy(s1, s2, order) / MAX_BOND_ENERGY` inline inside `canBondWith()` twice (in the `intentId` branch and the regular valence path). This is the same calculation as `Thermodynamics.getStabilityScore()` but lacks the `Math.min(1, ...)` clamp. This creates: (1) a subtle behavioral difference for bonds with energy > MAX_BOND_ENERGY, and (2) an architectural boundary violation where entity-layer atom.js contains system-layer thermodynamics policy.

## Findings

- `Thermodynamics.getStabilityScore(s1, s2, order)`: `Math.min(1, getBondEnergy(s1,s2,order) / MAX_BOND_ENERGY)` — clamped
- `canBondWith()` inline (Phase 3): `getBondEnergy(this.element.symbol, other.element.symbol, order) / MAX_BOND_ENERGY` — NOT clamped
- If any future bond energy exceeds `MAX_BOND_ENERGY=257`, `canBondWith` would compare stability > 0.85 against an unclamped value; `getStabilityScore` would cap at 1.0
- `atom.js` is in the entity layer; `getStabilityScore` logic is in the systems layer — crossing the dependency direction
- The dual 0.85 check (call site + `canBondWith`) was flagged by simplicity reviewer as redundant; consolidating to `canBondWith` makes sense IF `canBondWith` is the policy enforcement point

## Proposed Solutions

### Option 1: Remove stability re-check from `canBondWith()` — trust the caller's `allowOvervalence` boolean (Recommended)

The call site (Rule 6 in intention.js) already computes stability and sets `allowOvervalence: stability > 0.85`. `canBondWith()` should trust this boolean and not re-verify:

```javascript
// In canBondWith() — Phase 3 correction
if (this.availableValence < order || other.availableValence < order) {
    if (!context.allowOvervalence) return false;
    // Trust caller — they already checked stability > 0.85
    // No getBondEnergy call here
}
```

**Pros:** Removes inline duplication; keeps entity/system boundary clean; eliminates missing clamp issue
**Cons:** `canBondWith()` no longer enforces the chemistry threshold internally
**Effort:** 10 minutes
**Risk:** Low

---

### Option 2: Keep check in `canBondWith()` but add `Math.min(1, ...)` clamp

```javascript
const stability = Math.min(1, getBondEnergy(this.element.symbol, other.element.symbol, order) / MAX_BOND_ENERGY);
if (stability <= 0.85) return false;
```

**Pros:** `canBondWith()` remains self-contained; matches `getStabilityScore`
**Cons:** Still duplicates the calculation; still crosses entity/system boundary
**Effort:** 5 minutes
**Risk:** Low

---

### Option 3: Use `atom.symbol` instead of `atom.element.symbol` (minor consistency fix)

Regardless of which option above is chosen, the inline calculation should use `this.symbol` not `this.element.symbol`:

- Convention: `bond.js:47` uses `this.atom1.symbol` and `this.atom2.symbol` (direct property)
- `this.element.symbol === this.symbol` for valid atoms but `this.symbol` is the conventional access pattern

**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

Option 1 — remove the stability check from `canBondWith()` and trust `allowOvervalence` as pre-validated. Also fix `atom.symbol` access (Option 3 as a bundle). Update Phase 3 in the plan accordingly. If Todo 039's class is deleted, Option 1 becomes the natural outcome since `getStabilityScore()` won't exist to call.

## Technical Details

**Affected files:**
- `src/entities/atom.js` — `canBondWith()` Phase 3 changes
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 3

**Also note:** Plan uses `this.element.symbol` but convention is `this.symbol` (atom.js:15, bond.js:47).

## Acceptance Criteria

- [ ] No duplicate stability calculation between `canBondWith()` and call sites
- [ ] If stability check kept in `canBondWith()`: uses `Math.min(1, ...)` clamp
- [ ] Uses `this.symbol` / `other.symbol` not `this.element.symbol` / `other.element.symbol`
- [ ] Architecture: entity layer doesn't re-implement system layer calculations

## Work Log

### 2026-03-01 - Identified by Pattern Recognition Specialist + Architecture Strategist

**By:** Code review agents (technical_review workflow)

---

### 2026-03-01 - Resolved (Option 1: remove re-check, trust allowOvervalence)

**By:** Claude Code

**Actions:**
- Removed inline `getBondEnergy(...) / MAX_BOND_ENERGY` stability re-checks from BOTH branches in Phase 3's `canBondWith()`
- intentId branch: collapsed to `if (!valenceOk && !context.allowOvervalence) return false` (one line)
- Regular valence branch: collapsed to `if (!context.allowOvervalence) return false` with comment "caller already verified"
- Added Todo 040 attribution comments explaining the design decision
- Fixed `atom.element.symbol` → `atom.symbol` convention in Phase 6 `tryFormBonds()` code
- Entity-layer `canBondWith()` no longer contains system-layer thermodynamics policy

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 3
- **Related:** Todo 039 (Thermodynamics class kept but stripped of YAGNI)
