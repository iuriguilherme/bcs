---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, documentation, testing]
dependencies: []
---

# README test table incorrectly marks T04 as `test.fail()`

## Problem Statement

`tests/README.md` contains a table listing test scenarios and their status. The row for T04 is incorrectly marked with `test.fail()` status, but `t04-polymer-intent.spec.js` does NOT contain `test.fail()` — only T05 does. This misleads developers diagnosing T04 failures (they'll think it's expected to fail when it's not).

## Findings

From architecture-strategist review: `tests/README.md` line 56 marks T04 as expected-to-fail, but the actual file `tests/scenarios/t04-polymer-intent.spec.js` has no `test.fail()` annotation.

Only `tests/scenarios/t05-cell-formation.spec.js` contains `test.fail()`.

## Proposed Solutions

### Option A: Correct the README table (Recommended)
**Effort**: Minimal
**Risk**: None

Update T04's row to show "Expected to pass" instead of `test.fail()`.

## Technical Details

**Affected file:** `tests/README.md`

## Acceptance Criteria

- [ ] README table shows T04 as "Expected to pass"
- [ ] README table shows T05 as "Known failure (`test.fail()`)"

## Work Log

- 2026-02-26: Identified by architecture-strategist review agent. Filed as P3.
