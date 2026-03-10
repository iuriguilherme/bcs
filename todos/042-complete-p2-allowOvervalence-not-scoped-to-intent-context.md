---
status: complete
priority: p2
issue_id: "042"
tags: [code-review, architecture, correctness]
dependencies: []
---

# allowOvervalence bypasses valence check globally, not just for intents

## Problem Statement

In `atom.js` lines 93-95, the `allowOvervalence` context flag bypasses valence checks for ALL atoms, not just intent-claimed ones. Any future code path that passes `{ allowOvervalence: true }` without an `intentId` would permit overvalence bonding for free atoms.

**Why it matters:** The `intentId` context flag is properly scoped inside its `if (context.intentId)` block. The `allowOvervalence` flag should follow the same scoping pattern but doesn't.

## Findings

- **Source: Pattern Recognition + Architecture agents**
- `src/entities/atom.js` lines 93-95: The regular valence check applies globally
- Currently no code path passes `allowOvervalence` without `intentId`, so this is a latent risk

```javascript
// Current (too permissive):
if (this.availableValence < order || other.availableValence < order) {
    if (!context.allowOvervalence) return false;
}

// Should be:
if (this.availableValence < order || other.availableValence < order) {
    if (!context.intentId || !context.allowOvervalence) return false;
}
```

## Proposed Solutions

### Option A: Add intentId guard to the overvalence check (Recommended)
- **Effort:** Small (add `!context.intentId ||` to the condition)
- **Risk:** Low — only intent-driven code currently uses allowOvervalence
- **Pros:** Prevents accidental overvalence from non-intent sources

### Option B: Leave as-is with a comment
- **Effort:** Trivial
- **Risk:** Future code paths could accidentally bypass valence
- **Pros:** No code change

## Acceptance Criteria

- [ ] `allowOvervalence` only takes effect when `context.intentId` is present
- [ ] T09 CO triple bond test still passes
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from code review | Pattern + architecture agents flagged this |
