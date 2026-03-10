---
status: pending
priority: p1
issue_id: "051"
tags: [code-review, bug, physics, correctness]
dependencies: []
---

# shouldBreakThermal formula makes 298K maximally destructive for all bonds

## Problem Statement

`bond.shouldBreakThermal(temperature)` uses the formula:

```javascript
const pBreak = (1 - stability) * Math.min(1, temperature / 298);
```

At 298K (room temperature): `Math.min(1, 298/298) = 1.0`, so `pBreak = (1 - stability)`.

This means at the default temperature:
- **H₂** (stability ≈ 0.385): P(break) ≈ **61.5% per check**
- **O-O** (stability ≈ 0.136): P(break) ≈ **86.4% per check**
- **C-H** (stability ≈ 0.385): P(break) ≈ **61.5% per check**

The check runs every 6 ticks at 60fps = ~10 checks/second. H₂ survives P(survive per second) = (1 - 0.615)^10 ≈ 0.4% — dissolves in under 1 second at room temperature. The simulation would be incapable of sustaining any molecule at default temperature except CO.

**Why it matters:** This blocks the core simulation — molecules cannot stabilize at 298K. The formula was chosen to guarantee CO's stability=1.0 produces 0% break chance, but the scaling factor `temp/298` reaching 1.0 at room temperature was not accounted for. 298K is treated as the maximum-breakage point rather than a stable baseline.

## Findings

- **Source: Performance Oracle agent**
- `src/entities/bond.js` lines 64-67: `shouldBreakThermal()` implementation
- `src/core/environment.js` lines 851-876: `tryBreakThermalBonds()` (6-tick cadence)
- H₂ bond energy = 99 kJ/mol → stability = 99/257 ≈ 0.385 → P(break at 298K) = 0.615
- CO bond energy = 257 kJ/mol → stability = 1.0 → P(break) = 0 ✅ (CO correctly protected)
- The CO protection works; all other bonds are overcorrected

## Proposed Solutions

### Option A: Shift the reference so 298K is the low-activity baseline (Recommended)
Subtract a floor so that bonds are essentially stable at room temperature:

```javascript
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    // Scale relative to 298K: no breaking at or below 298K,
    // increasing breakage above it. Max factor at 600K ≈ 1.0.
    const thermalFactor = Math.max(0, (temperature - 298) / 302);
    const pBreak = (1 - stability) * thermalFactor;
    return Math.random() < pBreak;
}
```

- At 298K: `thermalFactor = 0` → P(break) = 0 for ALL bonds ✅
- At 600K: `thermalFactor = 1.0` → P(break) = 1 - stability ✅
- CO at any temp: `(1 - 1.0) × factor = 0` ✅
- H₂ at 600K: `0.615 × 1.0 = 61.5%` (reasonable for very hot conditions)
- **Pros:** Bonds stable at room temp; CO protection preserved; simple
- **Cons:** No breaking below 298K (acceptable for this simulation)

### Option B: Use a steeper exponential scaling
```javascript
const thermalFactor = Math.max(0, Math.pow(temperature / 298, 4) - 1) / (Math.pow(600/298, 4) - 1);
```
Exponential acceleration above 298K. More "Arrhenius-like" feel.
- **Pros:** Smoother curve; more physical
- **Cons:** More complex; still doesn't give exact 0% below 298K

### Option C: Introduce a per-bond stability floor (YAGNI)
Keep formula but clamp minimum P(break) at 0 only for stability > 0.5.
- **Cons:** Arbitrary threshold; still breaks weak bonds at room temp; not recommended

## Acceptance Criteria

- [ ] At 298K: H₂, CH₄, H₂O, and all common molecules have P(break) ≤ 1% per check
- [ ] At 600K: Weak bonds (O-O, N-N) have measurably elevated break probability
- [ ] CO (stability=1.0) still has P(break) = 0 at any temperature
- [ ] T09 Playwright test still passes (CO forms triple bond)
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review (Performance Oracle agent) | Formula scaling flaw identified |
