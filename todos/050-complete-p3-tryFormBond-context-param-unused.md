---
status: complete
priority: p3
issue_id: "050"
tags: [code-review, quality, dead-code]
dependencies: []
---

# tryFormBond() context parameter is never passed by any caller

## Problem Statement

The PR adds a `context = {}` parameter to `tryFormBond()` in bond.js, but no caller currently passes a context argument. `Environment.tryFormBonds()` calls `tryFormBond(atom1, atom2, 1)` without context. Intention Rule 6 creates bonds directly via `new Bond()`, bypassing `tryFormBond` entirely. The parameter is dead code.

## Findings

- **Source: Pattern Recognition agent**
- `src/entities/bond.js` line 313: `function tryFormBond(atom1, atom2, order = 1, context = {})`
- `src/core/environment.js` line 652: `tryFormBond(atom1, atom2, 1)` — no context

## Proposed Solutions

### Option A: Remove the context parameter
- **Effort:** Trivial
- **Risk:** If future code needs it, re-add it then

### Option B: Keep as forward-compatible API
- **Effort:** None
- The parameter has a default value so it doesn't break anything

## Acceptance Criteria

- [ ] Either remove unused parameter or add a comment explaining the forward-compatibility intent

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review | Pattern agent flagged dead parameter |
