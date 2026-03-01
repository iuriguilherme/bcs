---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, architecture, documentation, maintenance]
dependencies: []
---

# Add Bug #11 interaction comment to `isSurplus` to prevent future agents from removing it

## Problem Statement

AGENTS.md Bug #11 states: _"Only repel STABLE unrelated molecules — unstable ones may still become the target"_. The new `isSurplus` condition in `_rule2_repelIrrelevantMolecules` intentionally violates this rule in a specific edge case: an unstable molecule containing only correct elements whose elements are all already fully claimed.

Example: C2H4 intent has claimed 2C + 4H. An unstable C2H3 radical drifts in. `hasWrongElement = false`, but `isSurplus = true` (all remaining needed counts are 0). C2H3 is repelled — even though per Bug #11, it could theoretically gain an H and become C2H4.

This is a **deliberate, justified trade-off**: once claiming is complete, the intent bonds its claimed atoms and fulfills within a few ticks; the window in which a surplus unstable molecule could be useful is negligible. Without this comment, a future agent following Bug #11 strictly would see an apparent violation and remove the `isSurplus` path, reintroducing the crowding bug.

## Findings

- **Reporter**: agent-native-reviewer agent, PR #3
- **File**: `src/entities/intention.js` — `_rule2_repelIrrelevantMolecules()`, around lines 491–494
- **Evidence**: `shouldRepel = mol.isStable() || mol.atoms.length > totalNeeded || hasWrongElement || isSurplus;`. The `isSurplus` branch can fire for an unstable molecule (e.g., C2H3) if all element counts are fully claimed. This conflicts with Bug #11 wording.
- **Institutional risk**: AGENTS.md is used by future Claude agents as the primary behavioral reference. An undocumented exception will be seen as a bug, not an intentional decision.

## Proposed Solutions

### Solution A: Inline comment explaining the Bug #11 trade-off (Recommended)

Add a comment directly above the `isSurplus` definition:

```javascript
// Condition 2: surplus check.
// Repel a correct-element molecule when the intent has already claimed
// its full quota of every element in the molecule.
// NOTE: This can repel unstable same-element molecules (vs. Bug #11's rule
// "leave unstable molecules alone"). This is intentional: once claiming is
// complete, the intent fulfills within a few ticks; the window for a surplus
// unstable molecule to contribute is negligible, while leaving it creates
// late-assembly gridlock (documented: docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md).
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => remainingNeeded[a.symbol] === 0);
```

**Pros**: Comment is right where future maintainers will read it; links to the decision record
**Cons**: None
**Effort**: Trivial — 6 lines of comment

### Solution B: Update Bug #11 in AGENTS.md to add an explicit sub-rule

In AGENTS.md Bug #11, append: _"Exception: surplus unstable molecules (whose elements are fully claimed) ARE repelled by isSurplus in Rule 2."_

**Pros**: Keeps AGENTS.md authoritative
**Cons**: AGENTS.md should be updated anyway (separately) to add T08 to the test table; may be combined
**Effort**: Trivial

## Recommended Action

Both A and B, together. The inline comment is the critical one — it's encountered first when reading the code. The AGENTS.md update (see todo 030) documents it at the institutional level.

## Technical Details

- **File**: `src/entities/intention.js`
- **Location**: `_rule2_repelIrrelevantMolecules()`, above the `const isSurplus = ...` line
- **Bundle rebuild required**: Yes

## Acceptance Criteria

- [ ] Comment added above `isSurplus` definition explaining Bug #11 trade-off and linking to brainstorm doc
- [ ] AGENTS.md Bug #11 entry updated (can be done together with todo #030)
- [ ] All 14 tests still pass

## Work Log

- 2026-03-01: Identified by agent-native-reviewer during PR #3 review of fix/intention-zone-crowding
