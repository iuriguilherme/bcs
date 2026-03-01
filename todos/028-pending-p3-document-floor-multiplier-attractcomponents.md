---
status: pending
priority: p3
issue_id: "028"
tags: [code-review, documentation, physics, maintenance]
---

# Document 0.3 vs 0.5 floor multiplier divergence at _attractComponents sites

## Problem Statement

After this PR, two code paths in `intention.js` use different floor multipliers for the repulsion formula:

- **7-rule pipeline** (Rules 1 and 2, molecule-type intents): `repulsionForce * 0.5`
- **`_attractComponents`** (polymer/cell-type intents): `repulsionForce * 0.3`

The divergence is intentional — polymer/cell intents operate at larger radii with different physics dynamics. But with `repulsionForce` now at 200, the minimum forces are:
- Molecule-type Rules 1/2: `200 × 0.5 = 100`
- Polymer/cell _attractComponents: `200 × 0.3 = 60`

A future maintainer reading `_attractComponents` will not know whether `0.3` is intentional or was simply not updated along with Rules 1/2. There are 4 sites in `_attractComponents` with `this.repulsionForce * 0.3`.

## Findings

- **Reporters**: pattern-recognition-specialist and architecture-strategist, PR #3
- **File**: `src/entities/intention.js`
- **Approximate lines**: 947, 998, 1038, 1074 (all inside `_attractComponents`)
- **Current code at each site**:
  ```javascript
  const repelStrength = Math.max(this.repulsionForce * (1 - dist / this.radius), this.repulsionForce * 0.3);
  ```

## Proposed Solution

Add a short comment at each of the 4 `_attractComponents` repulsion sites explaining why `0.3` differs from the `0.5` used in Rules 1/2:

```javascript
// Floor 0.3 (not 0.5 as in molecule-intent Rules 1/2): polymer/cell intents
// have larger radii and gentler physics context; 0.3 is sufficient here.
const repelStrength = Math.max(
    this.repulsionForce * (1 - dist / this.radius),
    this.repulsionForce * 0.3
);
```

Alternatively: if the intent is to also raise the polymer/cell floor to 0.5, change all 4 sites consistently.

**Effort**: Small — 4 × 1 comment line, or 4 × 1 number change

## Acceptance Criteria

- [ ] All 4 `repulsionForce * 0.3` sites in `_attractComponents` have a comment explaining the 0.3 vs 0.5 divergence
- [ ] OR: all 4 sites updated to 0.5 if that's the preferred behaviour (with T04 regression test confirming no breakage)
- [ ] Bundle rebuilt if source changed

## Work Log

- 2026-03-01: Identified by pattern-recognition-specialist and architecture-strategist during PR #3 review
