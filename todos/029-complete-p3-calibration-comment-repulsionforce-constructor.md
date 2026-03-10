---
status: complete
priority: p3
issue_id: "029"
tags: [code-review, documentation, physics]
---

# Add calibration comment at repulsionForce = 200.0 in Intention constructor

## Problem Statement

The Intention constructor currently sets:

```javascript
this.repulsionForce = 200.0;
```

With a vague inline comment but no physics rationale. The calibration reasoning (must overcome inter-particle attraction of 20 per pair; should be comparable to bounceForce=100) lives only in the commit message and PR description — not in the code. Commit messages are not visible when reading the constructor during future maintenance.

The architecture-strategist noted: "If `attractionStrength` or `bounceForce` change in `environment.js`, there is no mechanism to signal that `repulsionForce` may need adjustment."

## Findings

- **Reporter**: architecture-strategist, PR #3
- **File**: `src/entities/intention.js`, constructor, line ~24
- **Current code**:
  ```javascript
  this.attractionForce = 3.0;
  this.repulsionForce = 200.0; // Strong repulsion — must overcome inter-particle attraction (20) and physics scale
  ```

## Proposed Solution

Expand the comment to explicitly state the calibration relationship:

```javascript
this.attractionForce = 3.0;
// Calibrated against environment.js physics constants:
//   attractionStrength = 20 (per bonded pair within attractionRadius=80)
//   bounceForce = 100 (boundary wall)
// repulsionForce must exceed attractionStrength to expel atoms resisted by
// neighbour bonds. At 200: floor (200×0.5=100) = bounceForce, ensuring reliable
// expulsion even at zone boundary with multiple attracting neighbours.
// If attractionStrength or bounceForce change, recalibrate this value.
this.repulsionForce = 200.0;
```

**Effort**: Trivial — 6 lines of comment

## Acceptance Criteria

- [ ] Constructor `repulsionForce` line has calibration comment referencing `attractionStrength` and `bounceForce`
- [ ] Comment notes that recalibration is needed if those environment.js constants change
- [ ] Bundle rebuilt

## Work Log

- 2026-03-01: Identified by architecture-strategist during PR #3 review of fix/intention-zone-crowding
