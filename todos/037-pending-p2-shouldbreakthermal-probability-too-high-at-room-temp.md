---
status: pending
priority: p2
issue_id: "037"
tags: [code-review, thermodynamics, physics-calibration, gameplay]
---

# `shouldBreakThermal` breaks common bonds too aggressively at room temperature

## Problem Statement

The thermal break formula `P(break) = (1 - stability) × min(1, temp/298)` produces extremely high break probabilities for common bonds at 298K (room temperature):

| Bond | Energy | Stability | P(break) at 298K |
|------|--------|-----------|------------------|
| C-H  | 99/257 | 0.385     | **0.615 (61.5%)** |
| C-C  | 83/257 | 0.323     | **0.677 (67.7%)** |
| O-O  | 35/257 | 0.136     | **0.864 (86.4%)** |
| C≡O  | 257/257| 1.000     | 0.000 (immune)   |

`tryBreakThermalBonds()` runs every 6 ticks. At 60fps, that's 10 break-checks per second per bond. Expected lifetime of a C-H bond at 298K: 1/(0.615 × 10) ≈ 0.16 seconds. A CH4 molecule would dissolve in fractions of a second at room temperature — which is chemically incorrect.

The tests pass because T09 tests CO triple bond (stability=1.0, immune) and other tests have long enough timeouts that molecules reassemble faster than they dissolve. But gameplay with methane, ethylene, etc. at default 300K temperature would show molecules constantly dissolving.

## Findings

- **File**: `src/entities/bond.js:64-68` — `shouldBreakThermal(temperature)`
- **Formula**: `(1 - stability) × min(1, temp/298)` — linear model, no threshold floor
- **Root cause**: The formula equals `(1-stability)` exactly at 298K (min=1.0). For bonds weaker than max, this is always a large probability
- **Real chemistry**: Room-temperature bond stability requires activation energy — bonds don't break stochastically without activation. A Boltzmann/Arrhenius model would use `exp(-E/kT)`, producing near-zero break rates for strong bonds at 298K

## Proposed Solutions

### Option A: Add a stability floor (simplest fix)
Only break bonds with stability below a threshold:
```js
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    if (stability >= 0.5) return false; // Stable bonds don't break at room temp
    const pBreak = (1 - stability * 2) * Math.min(1, temperature / 298);
    return Math.random() < pBreak;
}
```
**Pros**: Simple, fast to tune. **Cons**: Discontinuity at threshold.
**Effort**: Small | **Risk**: Requires gameplay testing

### Option B: Temperature-threshold formula
Only break bonds when temperature exceeds a bond-specific threshold:
```js
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    const breakTemp = stability * 600; // CO breaks at 600K, O-O breaks at ~82K
    if (temperature < breakTemp) return false;
    const pBreak = (1 - stability) * Math.min(1, (temperature - breakTemp) / 300);
    return Math.random() < pBreak;
}
```
**Pros**: More physically realistic. **Cons**: More complex. **Effort**: Small | **Risk**: Low

### Option C: Rate constant multiplier
Scale down the probability by a small constant:
```js
const THERMAL_BREAK_RATE = 0.001; // Only 0.1% × stability factor per check
const pBreak = THERMAL_BREAK_RATE * (1 - stability) * Math.min(1, temperature / 298);
```
**Pros**: Minimal change, keeps formula shape. **Cons**: Magic constant needs tuning.
**Effort**: Trivial | **Risk**: Low

## Recommended Action

*(to be decided during triage — verify first by playing with slider at 300K)*

## Acceptance Criteria

- [ ] At 298K: C-H bonds in CH4 survive for at least 10 seconds
- [ ] At 600K: Weak bonds (O-O, C-C) break within a few seconds
- [ ] CO triple bond remains immune at all temperatures
- [ ] All existing tests pass (T01–T20)
- [ ] T09 still passes (CO triple bond forms)

## Work Log

- 2026-03-19: Identified by performance-oracle agent during PR #5 code review
