---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, physics, intention-system, correctness]
---

# P1: Seed velocity damping bypasses mass normalization

## Problem Statement

In `_rule5_attractClaimed`, the seed anchor's outward-velocity correction applies the same absolute velocity delta to every seed atom regardless of mass. Carbon (mass=12) and Hydrogen (mass=1) receive identical velocity cancellation, which is inconsistent with all other forces in Rule 5 that explicitly multiply by `atom.mass` to normalize acceleration.

## Findings

**File:** `src/entities/intention.js`, lines 650–653

```javascript
// Current — mass-unnormalized:
const outward = seedAtom.velocity.dot(dir) * -1;
if (outward > 0) {
    seedAtom.velocity = seedAtom.velocity.add(dir.mul(outward * 0.5));
}
```

All other force applications in the same function multiply by mass:
```javascript
seedAtom.applyForce(dir.mul(this.attractionForce * 15.0 * seedAtom.mass)); // line 647
const forceMag = Math.max(
    this.attractionForce * 2.5 * normalized * atom.mass,  // line 630
    this.attractionForce * 2.0 * atom.mass                // line 631
);
```

The velocity delta `outward * 0.5` is the same for C (mass=12) as H (mass=1), meaning hydrogen atoms get 12× more deceleration relative to their momentum than carbon atoms. This means carbon-heavy seeds will drift more than hydrogen-heavy ones even when anchoring forces are identical.

Additionally, this is a direct velocity write — it bypasses the force/acceleration integration pipeline (`applyForce → acceleration → velocity += acc*dt → velocity *= 0.99 → position += velocity*dt`). It runs before the `0.99` damping in the same tick, is order-dependent on `updateIntentions` executing before `atom.update()`.

## Proposed Solutions

### Option A: Convert to mass-normalized force (Recommended)
Replace the velocity write with a damping force through the standard pipeline:

```javascript
// Resist outward velocity via damping force (mass-normalised, order-independent).
const outward = -seedAtom.velocity.dot(dir); // negative dot = moving away
if (outward > 0) {
    seedAtom.applyForce(dir.mul(outward * 0.5 * seedAtom.mass));
}
```

**Pros:** Mass-normalized, flows through integration, order-independent, consistent with rest of Rule 5.
**Cons:** Slightly different magnitude than current (passes through dt integration and 0.99 damping), may need re-tuning of 0.5 factor.
**Effort:** Small. **Risk:** Low — same direction, slightly different magnitude.

### Option B: Mass-normalize the direct write
Keep velocity mutation but normalize by mass:

```javascript
const outward = -seedAtom.velocity.dot(dir);
if (outward > 0) {
    // Normalize: heavier atoms get smaller velocity correction (same momentum impulse)
    const correction = outward * 0.5 / seedAtom.mass;
    seedAtom.velocity = seedAtom.velocity.add(dir.mul(correction));
}
```

**Pros:** Preserves the direct-write pattern and existing timing. Fixes the mass-normalization issue.
**Cons:** Still order-dependent. Still bypasses pipeline.
**Effort:** Small. **Risk:** Very low.

### Option C: Document as intentional (accept the asymmetry)
Add a comment explaining this is intentional — perhaps the stronger damping on hydrogen is actually desirable since H atoms have higher velocity due to lower mass.

**Pros:** No code change.
**Cons:** The inconsistency remains hidden and will confuse future readers.
**Effort:** Trivial. **Risk:** None (no change).

## Recommended Action

Option A — converts to the established force-based pipeline and eliminates order-dependency.

## Technical Details

- **Affected file:** `src/entities/intention.js`
- **Affected function:** `_rule5_attractClaimed` (~line 647-653)
- **Related code:** `applyForce` in `atom.js`; `update()` method in `atom.js`

## Acceptance Criteria

- [ ] Seed damping applies equal deceleration per unit momentum (mass-normalized)
- [ ] Velocity correction no longer reads/writes `seedAtom.velocity` directly
- [ ] Playwright test `test_spawner.spec.js` still passes (success: true in <6000 ticks)
- [ ] Carbon and hydrogen seed atoms converge at similar rates in diagnostic run

## Work Log

- 2026-02-25: Identified by pattern-recognition-specialist and architecture-strategist agents during code review of commit 5d85d71
