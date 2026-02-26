---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, physics, intention-system, correctness]
---

# P2: Force floor in `_rule5_attractClaimed` activates in outer 20% of radius, not just beyond

## Problem Statement

The force floor `attractionForce * 2.0 * atom.mass` was added to prevent escaped-radius atoms from getting zero force. However, the floor actually activates at `dist > 0.8 * radius` (i.e. the outer 20% of the intent zone), not only beyond the boundary. This may be unintended behavior.

## Findings

**File:** `src/entities/intention.js`, lines 629-633

```javascript
const normalized = Math.max(0, 1 - dist / this.radius);
const forceMag = Math.max(
    this.attractionForce * 2.5 * normalized * atom.mass,
    this.attractionForce * 2.0 * atom.mass
);
```

At `dist = 0.8 * radius`:
- `normalized = 1 - 0.8 = 0.2`
- First argument: `2.5 * 0.2 * mass = 0.5 * mass`
- Second argument (floor): `2.0 * mass`
- `Math.max` selects `2.0 * mass` — the **floor wins here**

So the floor is active not only beyond `radius` but for any atom in the outer 20% of the zone. Inside the inner 80% (`dist < 0.8 * radius`), the distance-scaled formula `2.5 * normalized` > 2.0, so the floor is inactive.

The comment says "floor: always pull claimed atoms back" which implies intent was beyond-radius only, but the code applies it in the outer zone as well. This could cause atoms in the outer zone to experience a stronger-than-intended flat attraction (2.0) instead of the smoothly decaying one (2.5 * normalized ≈ 0.5-2.0 in the outer 20%).

## Proposed Solutions

### Option A: Explicitly branch on radius boundary (Recommended if outer-20% behavior is unintended)

```javascript
let forceMag;
if (dist >= this.radius) {
    // Beyond radius: use flat floor to pull escaped atoms back
    forceMag = this.attractionForce * 2.0 * atom.mass;
} else {
    // Within radius: distance-scaled force
    forceMag = this.attractionForce * 2.5 * (1 - dist / this.radius) * atom.mass;
}
```

**Pros:** Crystal clear intent, floor exclusively for escaped atoms.
**Cons:** Slight discontinuity at the boundary (2.5*0 = 0 vs floor 2.0 — the floor is actually continuous since at the boundary `normalized=0`). Actually no discontinuity: at the exact boundary, both formulas give the same 2.0 value.
**Effort:** Small. **Risk:** Low — outer-20% behavior changes but atoms in that region were already receiving near-floor forces.

### Option B: Accept current behavior with a comment

The outer-20% floor may be beneficial — it prevents the "slow down as you approach the edge" effect that could let atoms hover at the boundary. Document this explicitly:

```javascript
// The floor also activates in the outer 20% of the zone (dist > 0.8*radius)
// where normalized < 0.8. This creates a stronger flat pull near the boundary,
// preventing atoms from hovering at the edge.
const forceMag = Math.max(
    this.attractionForce * 2.5 * normalized * atom.mass,
    this.attractionForce * 2.0 * atom.mass
);
```

**Pros:** No code change, documents behavior.
**Effort:** Trivial.

## Recommended Action

Verify in testing whether outer-20% flat attraction causes any visible artifacts. If not, Option B. If atoms in the outer zone are being pulled in too strongly, Option A.

## Technical Details

- **Affected file:** `src/entities/intention.js`
- **Affected function:** `_rule5_attractClaimed` (~line 629)
- Threshold: `2.5 * normalized = 2.0` when `normalized = 0.8`, i.e. `dist = 0.2 * radius = 60 units`

## Acceptance Criteria

- [ ] Code comment clearly states whether the outer-20% floor behavior is intentional
- [ ] If not intentional, branch added at `dist >= this.radius` boundary
- [ ] Playwright test `test_spawner.spec.js` still passes

## Work Log

- 2026-02-25: Identified by architecture-strategist agent during code review of commit 5d85d71
