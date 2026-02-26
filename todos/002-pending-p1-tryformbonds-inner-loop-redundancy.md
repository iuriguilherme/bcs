---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, performance, environment, tryFormBonds]
---

# P1: `getIntentionForAtom(atom1)` re-computed per inner-loop candidate pair

## Problem Statement

In `Environment.tryFormBonds`, `getIntentionForAtom(atom1)` is called inside the inner loop for every candidate `atom2` that passes the distance check, instead of being hoisted outside to compute once per outer `atom1` iteration. `getIntentionForAtom` is O(I) where I = number of active intentions. At current scale this is negligible, but it scales as O(N_pairs × I) and will degrade as atom counts and intention counts grow.

## Findings

**File:** `src/core/environment.js`, lines ~694-705

```javascript
// Current — getIntentionForAtom(atom1) called per qualifying pair:
for atom1 in atoms:
    getAtomsNear(atom1, 40)  // returns nearby candidates
    for atom2 in nearby:
        if dist < bondDist:  // inner guard
            const intention1 = this.getIntentionForAtom(atom1);  // O(I), per pair
            const intention2 = this.getIntentionForAtom(atom2);  // O(I), per pair
            if (intention1 || intention2) { prob = 0; }
```

`getIntentionForAtom` iterates `this.intentions.values()` with a `distanceTo` check per intention — O(I) each call.

`atom1`'s membership is constant for the entire inner loop. Currently it's re-evaluated for every `atom2` that passes distance filtering.

Projected scale impact:
| Atoms | Intentions | Extra calls/tick (est.) |
|-------|-----------|------------------------|
| 300   | 4         | ~400                   |
| 500   | 6         | ~1,500                 |
| 1000  | 10        | ~8,000                 |

At 1000 atoms / 10 intentions = ~8,000 redundant O(10) operations = ~80,000 float operations per tick in this path alone.

## Proposed Solutions

### Option A: Hoist `atom1` check outside inner loop (Recommended)

```javascript
for (const atom1 of atoms) {
    if (atom1.availableValence === 0) continue;
    if (atom1.claimedByIntentId) continue;
    // ...existing guards...

    const intention1 = this.getIntentionForAtom(atom1); // computed ONCE per atom1

    const nearby = this.getAtomsNear(atom1, 40);
    for (const atom2 of nearby) {
        // ...distance and valence checks...
        if (dist < bondDist) {
            let prob = 1 - (dist / bondDist);
            if (intention1) {
                prob = 0; // atom1 is in a zone — no bonding
            } else {
                const intention2 = this.getIntentionForAtom(atom2); // only if needed
                if (intention2) prob = 0;
            }
        }
    }
}
```

Short-circuiting means `getIntentionForAtom(atom2)` is also skipped when `intention1` is already set.

**Pros:** Reduces call count from O(pairs × I) to O(atoms × I + pairs_with_free_atom1 × I). In dense zones where most atoms are claimed, `intention1 || intention2` short-circuits quickly.
**Effort:** Small. **Risk:** Low — pure performance refactor, same logic.

### Option B: Cache intention membership on atom (higher effort, bigger gain)

Add `atom.intentionId` computed once per tick during `_rule1_buildState` or `updateIntentions`, then read it in `tryFormBonds` without any lookup.

**Pros:** O(1) check in tryFormBonds, also benefits other callers.
**Cons:** Requires syncing the cache — an atom's zone membership changes when intentions move.
**Effort:** Medium. **Risk:** Medium (cache staleness risk).

## Recommended Action

Option A — minimal change, same logic, immediately reduces redundancy.

## Technical Details

- **Affected file:** `src/core/environment.js`
- **Affected function:** `tryFormBonds` (~lines 694-705)
- **Related function:** `getIntentionForAtom` (~lines 353-380)

## Acceptance Criteria

- [ ] `getIntentionForAtom(atom1)` called once per outer loop iteration
- [ ] `getIntentionForAtom(atom2)` only called when `intention1` is null/falsy
- [ ] Behavior identical: all atom pairs inside any intent zone have `prob = 0`
- [ ] Playwright test `test_spawner.spec.js` still passes

## Work Log

- 2026-02-25: Identified by performance-oracle agent during code review of commit 5d85d71
