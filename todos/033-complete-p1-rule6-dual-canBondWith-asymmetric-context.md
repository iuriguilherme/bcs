---
status: complete
priority: p1
issue_id: "033"
tags: [code-review, thermodynamics, intention-system, architecture]
dependencies: []
---

# Rule 6 calls `canBondWith` twice with asymmetric context — CO triple bond still blocked on seedAtom side

## Problem Statement

The thermodynamics plan's Phase 7 describes changing Rule 6 to call `tryFormBond(atom1, atom2, order, { intentId, allowOvervalence })`. But the actual Rule 6 code does NOT call `tryFormBond()` — it makes TWO separate `canBondWith()` calls manually, then calls `new Bond()` directly. The second `canBondWith()` call has no context and no `allowOvervalence`, so the O atom's valence guard fires on the "other" side check and CO triple bond is still blocked. The plan's Phase 7 fix targets a code path that doesn't exist in the actual implementation.

## Findings

- **Rule 6 actual code** (intention.js:760-764):
  ```javascript
  if (!atom.canBondWith(seedAtom, 1, { intentId: this.id })) continue;   // ← gets context
  if (!seedAtom.canBondWith(atom, 1)) continue;                          // ← NO context!
  const bond = new Bond(atom, seedAtom, 1);  // ← direct Bond constructor, not tryFormBond
  ```
- **Phase 7 plan** shows calling `tryFormBond(atom1, atom2, order, { intentId: this.id, allowOvervalence })` — but this function is NEVER called in Rule 6. The plan modifies a phantom code path.
- For CO triple bond (order=3): the first `canBondWith` call (on claimed C atom) gets `allowOvervalence` via the restructured `intentId` branch. But the second call (on seed O atom) has `availableValence = -1` at order 3, no context, no `allowOvervalence` → returns false → CO bond blocked.
- Additionally, Rule 6 currently creates bonds with `order = 1` hardcoded. CO needs `order = 3`. The plan does not specify how Rule 6 determines the bond order to attempt for template-driven molecules.

## Proposed Solutions

### Option 1: Patch both `canBondWith` calls in Rule 6 to pass context (Recommended)

Find the actual Rule 6 bond-formation code and patch both `canBondWith` calls:

```javascript
// In intention.js — Rule 6 bond formation, BOTH calls get context
const stability = getBondEnergy(atom.element.symbol, seedAtom.element.symbol, bondOrder) / MAX_BOND_ENERGY;
const allowOvervalence = stability > 0.85;
const ctx = { intentId: this.id, allowOvervalence };

if (!atom.canBondWith(seedAtom, bondOrder, ctx)) continue;
if (!seedAtom.canBondWith(atom, bondOrder, ctx)) continue;  // ← add ctx here
const bond = new Bond(atom, seedAtom, bondOrder);
```

`bondOrder` must come from the molecule template (the plan already says template-driven bonds have order from blueprint).

**Pros:**
- Minimal change to actual code
- Preserves existing Rule 6 structure
- Both atoms checked symmetrically

**Cons:**
- Must also add `bondOrder` parameter (not just order=1)
- Phase 7 in plan needs rewriting to describe this exact change

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Extract bond formation into `tryFormBond()` and call from Rule 6

Refactor Rule 6 to use `tryFormBond()`:

```javascript
const bond = tryFormBond(atom, seedAtom, bondOrder, { intentId: this.id, allowOvervalence });
if (!bond) continue;
```

Where `tryFormBond()` (after Phase 2 changes) calls `canBondWith()` on both atoms with the context internally.

**Pros:** Centralizes bond formation logic in one place
**Cons:** Requires understanding exactly how `tryFormBond()` checks both atoms; may have unintended side effects on other Rule 6 paths
**Effort:** 2 hours
**Risk:** Medium

## Recommended Action

Option 1 — it's the minimal targeted fix. The critical action items:
1. Audit ALL `canBondWith` call sites in `intention.js` Rule 6 and ensure both `atom.canBondWith` and `seedAtom.canBondWith` receive the context object with `{ intentId, allowOvervalence }`.
2. Determine where `bondOrder` comes from in the template — the CO blueprint has `order: 3`, so the intent should pass that to the bond formation code.
3. Update Phase 7 in the plan to describe patching the two existing `canBondWith` calls directly, NOT calling a non-existent `tryFormBond()`.

## Technical Details

**Affected files:**
- `src/entities/intention.js` — Rule 6 bond formation (lines ~760-764)
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 7 rewrite

**Related architecture finding:**
- Confirmed `atom.claimedByIntentId` (on the `atom` being bonded) is set, but `seedAtom.claimedByIntentId` may be null after joining the seed. The `intentId` fast-path in `canBondWith` only fires when `context.intentId === this.claimedByIntentId`. For the seedAtom with null `claimedByIntentId`, the regular valence check at lines 93-94 applies — which is where `allowOvervalence` MUST also be present to work.

## Acceptance Criteria

- [ ] Phase 7 in plan correctly describes patching two `canBondWith` calls in Rule 6, not calling `tryFormBond()`
- [ ] Both `atom.canBondWith` and `seedAtom.canBondWith` receive `{ intentId, allowOvervalence }` in Rule 6
- [ ] Bond order is determined from the molecule template, not hardcoded to 1
- [ ] CO molecule intention zone results in a triple bond forming end-to-end

## Work Log

### 2026-03-01 - Identified by Architecture Strategist

**By:** Architecture Strategist review agent

**Actions:**
- Traced actual Rule 6 code at intention.js:760-764
- Found two separate `canBondWith` calls; second has no context
- Confirmed `tryFormBond` is not used in Rule 6's seed bonding path
- Confirmed both `canBondWith` calls must receive context for CO to work

---

### 2026-03-01 - Resolved

**By:** Claude Code

**Actions:**
- Rewrote Phase 7 in plan to describe patching the TWO actual `canBondWith` calls in Rule 6 seed branch (lines ~760-761), not the phantom `tryFormBond()` path
- Added `allowOvervalence` context to both seed-branch calls and relaxed the `!seedAtom.availableValence` guard at line ~754
- Added `allowOvervalence` to no-seed branch context objects (lines ~800-801)
- Updated Deep Review Enhancements item #3 to describe actual Rule 6 pattern
- Updated Interaction Graph to show `canBondWith` calls instead of `tryFormBond`
- Updated Phase 2 note: `tryFormBond` context extension is useful but not required by Phase 7
- Added three new rows to Dependencies & Risks table for Rule 6 asymmetry, valence guard, and order-1 assembly flow
- Updated Files table with specific line references for intention.js changes

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 7
- **Source:** `src/entities/intention.js:760-764` — actual Rule 6 bond formation
- **Related:** Todo 032 (formula), Todo 034 (energy release), Todo 035 (dead code)
