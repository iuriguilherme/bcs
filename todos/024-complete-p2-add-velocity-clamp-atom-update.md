---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, performance, physics]
---

# Add velocity clamp to atom.update() to prevent instability at repulsionForce=200

## Problem Statement

`Atom.update()` has no upper bound on velocity. With `repulsionForce` raised to `200.0`, a hydrogen atom (mass=1.008) receives acceleration of ~198 units/tick², producing a terminal velocity of ~330 world-units/tick via Euler integration with 0.99 damping. At 10× simulation speed, if multiple forces accumulate in the same tick (intent expulsion + boundary bounce), the velocity could spike beyond the zone radius in a single tick — causing atoms to tunnel through boundaries and producing NaN positions if forces compound.

All current tests pass, so this is a latent risk rather than a live bug. The concern materialises when several simultaneous forces act on a very light atom at a zone boundary corner.

## Findings

- **Reporter**: performance-oracle review agent, PR #3
- **File**: `src/entities/atom.js` — `update(dt)` method (around line 207)
- **Evidence**: At `repulsionForce=200`, `mass=1.008` (H): `a ≈ 198 unit/tick²`; terminal velocity = `a * dt / (1 - 0.99)` = `198 * (1/60) / 0.01 ≈ 330 unit/tick`. Zone radius = 300. One tick could technically overshoot.
- **Comparison**: `bounceForce = 100` was the design ceiling for forces. Raising repulsion to 200 (2× bounce) was necessary but exceeded the prior implicit velocity envelope.
- **Similar pattern**: Browser physics engines (Matter.js, Planck.js) universally implement max-speed clamps for exactly this reason.

## Proposed Solutions

### Solution A: Simple speed clamp after damping (Recommended)

In `src/entities/atom.js`, inside `update(dt)`, after the damping line (`this.velocity = this.velocity.scale(0.99)`), add:

```javascript
// Clamp speed to prevent tunnelling under strong expulsion forces.
// repulsionForce=200 can produce terminal velocity ~330; zone radius=300.
const MAX_SPEED = 400;
const speed = this.velocity.length();
if (speed > MAX_SPEED) {
    this.velocity = this.velocity.scale(MAX_SPEED / speed);
}
```

**Pros**: Self-contained, does not affect any other system; 400 is safely above practical speeds (leaves headroom for combined forces)
**Cons**: Adds a square-root call per atom per tick (~O(n) atoms); negligible at typical atom counts
**Effort**: Small — 5 lines

### Solution B: Clamp per-force application in `applyForce()`

Cap the magnitude of each applied force before accumulation into acceleration.

**Pros**: Prevents large accelerations entering the system at all
**Cons**: Harder to calibrate; would require knowing which forces are intentional (bounce) vs problematic; less standard
**Effort**: Medium

### Solution C: Accept current state, add regression test

Add a test that checks no atom position becomes NaN or exceeds `3000, 3000` after 5 seconds of dense simulation.

**Pros**: Zero code change; detects if instability ever occurs
**Cons**: Doesn't fix the root cause — just detects it late
**Effort**: Small

## Recommended Action

Solution A. The clamp at 400 provides a clean safety ceiling with no physics impact at normal force levels (typical atom speeds are 1–30 units/tick) and prevents future surprises if other forces are added.

## Technical Details

- **File**: `src/entities/atom.js`
- **Method**: `update(dt)` — after `this.velocity = this.velocity.scale(0.99);` line
- **Constant value**: `MAX_SPEED = 400` (safe headroom: 330 terminal + 20% buffer)
- **Bundle rebuild required**: Yes — run `deno run --allow-read --allow-write --allow-run build.ts` after changing `atom.js`

## Acceptance Criteria

- [ ] `atom.update()` clamps speed after damping
- [ ] `MAX_SPEED` constant is defined and documented with physics rationale comment
- [ ] All 14 existing Playwright tests still pass after change
- [ ] Bundle rebuilt and committed alongside source

## Work Log

- 2026-03-01: Identified by performance-oracle during PR #3 review of fix/intention-zone-crowding
