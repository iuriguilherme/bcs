---
status: pending
priority: p2
issue_id: "038"
tags: [code-review, thermodynamics, testing, test-coverage]
---

# T09 doesn't test thermal bond breaking — primary thermo feature has zero test coverage

## Problem Statement

PR #5's primary feature is temperature-dependent bond stability (bonds break based on temperature). T09, the test file added for this PR, only tests CO triple bond formation via `allowOvervalence`. The test never:
1. Sets a non-default temperature
2. Verifies that any bond breaks due to thermal energy
3. Exercises `shouldBreakThermal()` or `tryBreakThermalBonds()`

The `shouldBreakThermal` function, `tryBreakThermalBonds` sweep, and the `Thermodynamics.getFormationFactor` effect on bond formation probability are all entirely untested by Playwright.

## Findings

- **T09 test**: `/tests/scenarios/t09-thermo-co-triple-bond.spec.js` — tests overvalence only
- **Untested code paths**:
  - `bond.shouldBreakThermal(temp)` (bond.js:64-68)
  - `environment.tryBreakThermalBonds()` (environment.js:845-863)
  - `Thermodynamics.getFormationFactor()` effect on bond formation probability
  - High-temperature simulation (slider at 400-600K)
- **CLAUDE.md requirement**: "Every test must click #playPauseBtn" — T09 does click it, so that's fine. The issue is missing coverage.

## Proposed Solution

Add a new test `t10-thermo-thermal-breaking.spec.js` that:
1. Spawns only O and O atoms (O-O bond has stability=0.136, very low)
2. Forms O₂ molecules (by keeping at default temp initially)
3. Raises temperature to 500K via slider click
4. Waits and verifies O-O bonds break (bond count decreases)
5. Lowers temperature back to 298K
6. Verifies bond stability at room temperature

Alternatively, extend T09 to verify that increasing temperature visibly affects the CO bond formation rate or that the slider changes `environment.temperature`.

**Effort**: Medium | **Risk**: Low (new test file, no code changes)

## Acceptance Criteria

- [ ] At least one test exercises `tryBreakThermalBonds` at elevated temperature
- [ ] Test verifies temperature slider changes `environment.temperature` (UI↔physics sync)
- [ ] Test follows CLAUDE.md validity rules: uses spawner, clicks play, both pages pass
- [ ] No regressions on T01–T09

## Work Log

- 2026-03-19: Identified by agent-native-reviewer and performance-oracle agents during PR #5 review
