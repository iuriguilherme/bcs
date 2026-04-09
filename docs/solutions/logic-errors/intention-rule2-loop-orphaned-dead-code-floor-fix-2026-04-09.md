---
title: "Orphaned loop body and dead-code floor in Intention._rule2_repelIrrelevantMolecules"
date: 2026-04-09
category: logic-errors
module: intention-system
problem_type: logic_error
component: service_object
symptoms:
  - "_rule2_repelIrrelevantMolecules for-loop closed prematurely — shouldRepel and applyForce calls orphaned outside the method body"
  - "_rule1_repelIrrelevantAtoms floor used Math.max(force * 0.5, force * 0.25) — 0.25 branch is always dead"
  - "Redundant targetCount precomputation: unused dead code"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - intention-system
  - orphaned-code
  - dead-code
  - loop-structure
  - repulsion
  - botched-edit
---

# Orphaned loop body and dead-code floor in Intention._rule2_repelIrrelevantMolecules

## Problem

A Python patch script (`apply_fix.py`) used to refactor `src/entities/intention.js` miscounted braces and closed the `for (const mol of environment.molecules.values())` loop one brace too early inside `_rule2_repelIrrelevantMolecules`. The `shouldRepel` check, distance calculations, and `for (const atom of mol.atoms)` force application were left orphaned outside the method body — making `_rule2` entirely non-functional and introducing a JavaScript syntax error.

## Symptoms

- `continue` statement outside any loop at runtime (lines ~563 in the broken file) — JavaScript load error.
- `_rule2_repelIrrelevantMolecules` had no effect: wrong-element and surplus molecules were never repelled from intention zones.
- Lines 541–550 contained an `isTarBall` block that referenced undefined `atom` and `dir` variables, with a dangling `atom.applyForce(dir.mul(strength))` call.
- The `shouldRepel` computation at line 553 appeared after the for-loop's `}`, making it dead code outside any loop context.
- The correct force-application body (`for (const atom of mol.atoms)`) appeared entirely outside the method.

## What Didn't Work

The automated Python script `apply_fix.py` attempted to insert the `isTarBall` block and adjust the `shouldRepel` condition by patching line ranges with regex. It inserted the new block inside the mol loop body but then added an extra `}` to "close" the inserted block — which instead prematurely closed the outer mol for-loop. Text-based patching of deeply nested JavaScript without an AST parser is unreliable and produced corrupt brace nesting.

## Solution

The method was manually reconstructed with correct brace structure. The key requirement: **all per-molecule logic must stay inside the `for (const mol ...)` loop**:

```javascript
_rule2_repelIrrelevantMolecules(environment, state) {
    const { targetFormula, totalNeeded, targetComp, claimed } = state;
    if (!targetFormula) return;

    const targetElements = new Set(Object.keys(targetComp));
    const claimedByElement = {};
    for (const atom of claimed) {
        claimedByElement[atom.symbol] = (claimedByElement[atom.symbol] || 0) + 1;
    }
    const remainingNeeded = {};
    for (const [el, count] of Object.entries(targetComp)) {
        remainingNeeded[el] = Math.max(0, count - (claimedByElement[el] || 0));
    }

    for (const mol of environment.molecules.values()) {
        if (mol.isSeedFor) continue;
        if (mol.polymerId) continue;
        if (mol.formula === targetFormula) continue;

        const hasWrongElement = mol.atoms.some(a => !targetElements.has(a.symbol));
        const isSurplus = !hasWrongElement &&
            mol.atoms.every(a => remainingNeeded[a.symbol] === 0);
        const isTarBall = mol.atoms.length > totalNeeded * 1.5;

        const shouldRepel = mol.isStable()
            || mol.atoms.length > totalNeeded
            || hasWrongElement
            || (isSurplus && !isTarBall)
            || isTarBall;
        if (!shouldRepel) continue;

        const center = mol.centerOfMass;
        const dist = center.distanceTo(this.position);
        if (dist >= this.radius || dist <= 10) continue;

        const dir = center.sub(this.position).normalize();
        const strength = Math.max(
            this.repulsionForce * (1 - dist / this.radius),
            this.repulsionForce * 0.5
        );
        for (const atom of mol.atoms) {
            atom.applyForce(dir.mul(strength));
        }
    }
}
```

Two secondary fixes in the same commit:
- **Rule 1 dead-code floor**: `Math.max(repulsionForce * 0.5, repulsionForce * 0.25)` → `Math.max(repulsionForce * (1 - dist/radius), repulsionForce * 0.5)`. The 0.25 branch was unreachable since 0.5 always wins; the distance-based falloff was also missing.
- **Unused `targetCount`**: A precomputation that duplicated `targetComp`'s keys with no consumers was removed.

## Why This Works

The `for (const mol of environment.molecules.values())` loop must contain all per-molecule logic within its braces. When the loop closed prematurely, the `shouldRepel` check and `applyForce` calls evaluated once after the loop with stale/undefined values from the last iteration — or never ran at all due to the syntax error. Restoring correct brace nesting ensures each molecule is independently evaluated and expelled within the same iteration.

## Prevention

1. **Never use automated line-range or regex patching scripts on deeply nested JavaScript.** Brace counting is fragile; a single miscount silently corrupts control flow. Use Edit/Write tools directly or an AST-aware tool.
2. **Validate syntax after any automated edit**: `node --check src/entities/intention.js` catches orphaned `continue`/`break`/`return` outside loops immediately.
3. **Run Playwright tests against both `dev.html` and `index.html`** after any intention system change — a load-time syntax error is caught by the first test that navigates to the page.
4. **Verify brace depth visually** when adding a new block inside a for-loop: count that the new block's closing `}` is at the same indent level as the block's opening `{`, not at the for-loop level.

## Related Issues

- [docs/solutions/logic-errors/dead-code-review-environment-intention-stale-bundle.md](dead-code-review-environment-intention-stale-bundle.md) — same class of error: code orphaned outside its correct scope in `intention.js` during a structural edit
- [docs/solutions/physics-issues/wrong-element-atoms-crowding-intention-zones.md](../physics-issues/wrong-element-atoms-crowding-intention-zones.md) — defines the correct Rule 2 loop body that this fix restores; canonical reference for what `_rule2_repelIrrelevantMolecules` should contain
