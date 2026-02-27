---
status: pending
priority: p3
issue_id: "023"
tags: [code-review, documentation, testing]
dependencies: []
---

# Undocumented spawn rate variation across tests — add reference table

## Problem Statement

The 5 physics tests (T01, T02, T04, T05, T06) use wildly different `tickInterval` values (5, 8, 10, 100) with no global documentation of the intended effective spawn rates. Since the fixture sets `speed=10` for all tests, the tick interval must account for the 10× tick rate multiplier. The T02 comment explains its own reasoning but doesn't document the inconsistency across tests.

A developer tuning spawn rates or diagnosing a flaky test must mentally simulate the relationship for each test independently.

**Effective spawn rates at 10× speed** (600 ticks/second):
| Test | tickInterval | Effective rate | Intent |
|------|-------------|----------------|--------|
| T01  | 8           | 75 atoms/sec   | Heavy supply for single intent |
| T02  | 100         | 6 atoms/sec    | Controlled for anti-cannibalization test |
| T04  | 10          | 60 atoms/sec   | Heavy supply for polymer chain |
| T05  | 5           | 120 atoms/sec  | Maximum density for cell formation |
| T06  | 8           | 75 atoms/sec   | Same as T01 |

The asymmetry between T01 (75/s) and T02 (6/s) is intentional: T02 deliberately slows spawn rate to prevent tar-balls that would mask the cannibalization bug. But this is only documented in T02 itself.

## Proposed Solutions

### Option A: Add spawn rate table to tests/README.md
**Effort**: Minimal
**Risk**: None

Add a section to `tests/README.md` after the scenario table:

```markdown
## Spawn Rate Reference

All tests run at `simulation.setSpeed(10)` (set by fixture), giving ~600 simulation ticks/second.
Effective spawn rate = 600 / tickInterval atoms/second (real time).

| Test | tickInterval | Effective rate | Rationale |
|------|-------------|----------------|-----------|
| T01  | 8           | 75 atoms/sec   | Heavy supply ensures single intent converges quickly |
| T02  | 100         | 6 atoms/sec    | Slow drip prevents tar-ball overcrowding; tests anti-cannibalization logic |
| T04  | 10          | 60 atoms/sec   | Heavy supply for 3-intent + 1-polymer chain pipeline |
| T05  | 5           | 120 atoms/sec  | Maximum density for complex E2E cell formation |
| T06  | 8           | 75 atoms/sec   | Same as T01 (tests viewer level-switch, not formation rate) |
```

### Option B: Also add comment in T02 about T01/T04 comparison
Add cross-reference in T02's comment:
```javascript
// T01 and T04 use tickInterval=8/10 (aggressive: 60-75 atoms/sec) for single-intent tests.
// T02 uses tickInterval=100 (conservative: 6 atoms/sec) to test anti-cannibalization
// without the confounding factor of atom overcrowding.
```

## Technical Details

**Affected file:** `tests/README.md`, optionally `tests/scenarios/t02-concurrent-molecule-intents.spec.js`

## Acceptance Criteria

- [ ] `tests/README.md` contains spawn rate reference table
- [ ] Table accurately reflects current tickInterval values for all 5 physics tests
- [ ] T02 comment optionally cross-references T01/T04 asymmetry

## Work Log

- 2026-02-26: Identified by performance-oracle and architecture-strategist review agents. Filed as P3.
