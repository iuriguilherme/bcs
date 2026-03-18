---
status: pending
priority: p2
issue_id: "056"
tags: [code-review, architecture, dead-code, intention-system]
dependencies: []
---

# Legacy `atoms`-type branches in `_attractComponents` / `_checkCompletion` are now unreachable maintenance traps

## Problem Statement

After the molecule-intent rule pipeline was introduced, `Intention._attractComponents()` and `Intention._checkCompletion()` still contain `requirements.type === 'atoms'` branches — the old code paths for molecule assembly. These branches are now completely unreachable for molecule intents (which are routed exclusively through the `_rule1`–`_rule7` pipeline), but their continued presence creates two risks:

1. **Maintenance trap:** A developer debugging molecule-intent assembly may read `_attractComponents` and believe it is the live code path for `atoms`-type intents. It is not.
2. **Accidental re-routing:** If `Intention.update()` is refactored carelessly (e.g., the outer `type === 'molecule'` guard is removed), molecule intents would silently fall through to `_attractComponents`, producing different (incorrect) physics behavior with no obvious error.

`_formMolecule()` (the legacy bond-formation method called from `_checkCompletion` → `requirements.type === 'atoms'`) is similarly dead.

## Findings

- **Source:** Architecture strategist, code simplicity reviewer
- `src/entities/intention.js` — `_attractComponents()`: contains `if (requirements.type === 'atoms')` branch (line ~970–1059)
- `src/entities/intention.js` — `_checkCompletion()`: contains `if (requirements.type === 'atoms')` branch (line ~1240–1461)
- `src/entities/intention.js` — `_formMolecule()`: legacy method called only from the dead `_checkCompletion` atoms branch
- None of these are reachable from `Intention.update()` when `this.type === 'molecule'` (routed through rule pipeline)

## Proposed Solutions

### Option A: Delete atoms-type branches from `_attractComponents` and `_checkCompletion`, delete `_formMolecule` (Recommended)
- **When:** After confirming the rule pipeline is stable (run full test suite, manual smoke test)
- **Effort:** Medium (surgical deletion, verify nothing calls `_formMolecule` externally)
- **Pros:** Eliminates maintenance traps; `_attractComponents` becomes polymer/cell-only and its purpose becomes clear
- **Cons:** Irreversible — keep the old code in git history

### Option B: Add an explicit guard comment at the top of the atoms-type branches
```js
// NOTE: This branch is unreachable for type='molecule' intents (routed through _rule1-7 pipeline).
// It remains for historical reference only. Remove once rule pipeline is confirmed stable.
```
- **Effort:** Small (add comments)
- **Pros:** Low risk; documents intent
- **Cons:** Comments rot; doesn't remove the maintenance hazard

## Acceptance Criteria

- [ ] `_attractComponents()` contains no `requirements.type === 'atoms'` branch
- [ ] `_checkCompletion()` contains no `requirements.type === 'atoms'` branch
- [ ] `_formMolecule()` is deleted (or confirmed unreachable with a comment)
- [ ] All t01–t06 tests pass after deletion

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-18 | Created from code review (architecture strategist finding) | Safe to delete once rule pipeline passes full regression |
