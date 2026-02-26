---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, catalogue, deduplication, monomer, latent-bug, correctness]
---

# P2: `seenFormulas.set()` in isMonomer guard creates latent monomer deletion race

## Problem Statement

In `_cleanupCatalogue()` (`catalogue.js:132-167`), the isMonomer early-continue branch
calls `seenFormulas.set(blueprint.formula, fingerprint)` before the `continue` statement.
This registers the monomer's formula in the deduplication map. Later in the same loop,
if an auto-discovered stable molecule with the same formula is encountered, the deduplication
logic sees a collision and may queue the **monomer blueprint** for deletion — the opposite
of the intended behavior.

Three independent review agents flagged this: architecture-strategist (P2), code-simplicity-
reviewer (medium severity), and security-sentinel (P2 — also noted that this path allows
malicious blueprints with matching formulas to evict trusted monomer entries from IndexedDB).

## Findings

**File:** `src/catalogue/catalogue.js:136-141`

```javascript
// Current (problematic):
if (blueprint.isMonomer) {
    seenFormulas.set(blueprint.formula, fingerprint);  // ← registers monomer formula
    continue;                                           // ← skips dedup check
}
```

When a live stable molecule is later auto-discovered with, say, formula `'C4H8O2'`
(which coincidentally matches Fatty Acid's formula), `registerMolecule()` adds it to
`this.molecules` with a JSON fingerprint. On the next `_cleanupCatalogue()` run:

1. Monomer `FATTY_ACID` (fingerprint `'monomer:fatty_acid:C4H8O2'`) runs first →
   writes `seenFormulas.set('C4H8O2', 'monomer:fatty_acid:C4H8O2')` → continues
2. Later, stable-molecule `'C4H8O2'` (fingerprint JSON string) runs → `seenFormulas.has('C4H8O2')` = true → enters dedup block → compares `createdAt` → stable molecule is newer → adds `'monomer:fatty_acid:C4H8O2'` to `toRemove` → **deletes the monomer blueprint from IndexedDB and memory**

The correct intent is: monomers should never be compared against stable molecules for
deduplication. The `continue` is correct; the `seenFormulas.set()` before it is not.

## Proposed Solutions

### Option A: Remove `seenFormulas.set()` from isMonomer guard (Recommended)

```javascript
// After:
if (blueprint.isMonomer) {
    continue;  // Skip dedup entirely — monomers are never duplicates
}
```

**Pros:** Monomers are completely isolated from the deduplication pass. Zero collision risk.
Simple one-line removal.
**Cons:** None — monomers are pre-seeded with deterministic fingerprints; they cannot be
duplicates of each other (different IDs) and should not compete with stable-molecule fingerprints.
**Effort:** Trivial. **Risk:** None — this only removes incorrect behavior.

### Option B: Guard the `toRemove.push(existingFp)` call

Before queuing the existing fingerprint for removal, check if it belongs to a monomer:

```javascript
if (existing && blueprint.createdAt > existing.createdAt) {
    if (!this.molecules.get(existingFp)?.isMonomer) {  // ← guard
        toRemove.push(existingFp);
    }
    seenFormulas.set(blueprint.formula, fingerprint);
} else {
    toRemove.push(fingerprint);
}
```

**Pros:** Monomers can still be tracked in `seenFormulas` (may be useful someday).
**Cons:** More complex than Option A. Still allows monomers into the dedup namespace.
**Effort:** Small. **Risk:** Low.

## Recommended Action

Option A — remove the `seenFormulas.set()` call from the isMonomer guard.
This is the simplest correct fix and was recommended by both simplicity and architecture agents.
A monomer blueprint is never a "duplicate" of a stable-molecule blueprint.

## Technical Details

- **Affected file:** `src/catalogue/catalogue.js`
- **Affected method:** `_cleanupCatalogue()` (lines 132-179)
- **Line to remove:** Line ~139: `seenFormulas.set(blueprint.formula, fingerprint);`

## Acceptance Criteria

- [ ] `seenFormulas.set()` no longer called inside the `if (blueprint.isMonomer)` branch
- [ ] Monomer blueprints are never added to `toRemove` during cleanup
- [ ] If a stable molecule with formula matching a monomer is auto-discovered and
  `_cleanupCatalogue` runs, both entries survive in `this.molecules`
- [ ] All 4 monomer blueprints survive multiple simulation restarts without being
  deleted from IndexedDB

## Work Log

- 2026-02-26: Identified independently by architecture-strategist (P2), code-simplicity-reviewer (medium), and security-sentinel (P2) during code review of PR #2
