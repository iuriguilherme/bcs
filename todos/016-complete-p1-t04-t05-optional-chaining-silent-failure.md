---
status: pending
priority: p1
issue_id: "016"
tags: [code-review, testing, architecture, reliability]
dependencies: []
---

# T04/T05: `?.() || []` pattern silently masks broken API contracts

## Problem Statement

In `t04-polymer-intent.spec.js` and `t05-cell-formation.spec.js`, the test predicates use optional chaining (`?.()`) with an array fallback (`|| []`). If `getAllProteins` or `getAllProkaryotes` is ever removed or renamed, the condition silently evaluates to `false` on every poll, causing the test to timeout at 120 seconds with a generic timeout error — rather than an immediate, actionable "method not found" error.

In T05's case, since it is annotated `test.fail()`, a silent empty array could convert an expected-failure into an unexpected-pass, completely inverting the test's intent.

This directly undermines the test suite's purpose as a regression guard.

## Findings

**T04** (`tests/scenarios/t04-polymer-intent.spec.js`, lines 53–57):
```javascript
() => {
  const env = window.cellApp.environment;
  const polymers = env.getAllProteins?.() || [];
  return polymers.length > 0;
}
```
If `getAllProteins` is missing → `undefined || []` → `[].length > 0` → `false` → 120s timeout.

**T05** (`tests/scenarios/t05-cell-formation.spec.js`, line 51):
```javascript
return (env.getAllProkaryotes?.() || []).filter(c => c.isAlive).length;
```
If `getAllProkaryotes` is missing → `(undefined || []).filter(...)` → `0` → `expect(0).toBeGreaterThan(0)` fails → `test.fail()` catches it as "expected failure" → test incorrectly shows green.

**Both methods currently exist** (confirmed in `src/core/environment.js` lines 251 and 911). The `?.` is unnecessary and harmful.

**Flagged independently by**: architecture-strategist agent, performance-oracle agent.

## Proposed Solutions

### Option A: Throw on missing method (Recommended)
**Pros**: Immediate, actionable error. Clear regression signal.
**Cons**: None.
**Effort**: Small
**Risk**: None

```javascript
// T04 waitForFunction predicate:
() => {
  const env = window.cellApp.environment;
  if (typeof env.getAllProteins !== 'function') {
    throw new Error('env.getAllProteins() is not defined — API contract broken');
  }
  return env.getAllProteins().length > 0;
}

// T05 assertion:
const cellCount = await page.evaluate(() => {
  const env = window.cellApp.environment;
  if (typeof env.getAllProkaryotes !== 'function') {
    throw new Error('env.getAllProkaryotes() is not defined — API contract broken');
  }
  return env.getAllProkaryotes().filter(c => c.isAlive).length;
});
```

### Option B: Dual-condition check (also valid for T04)
**Pros**: Resilient to naming changes; mirrors T01's approach.
**Cons**: Less explicit about API contract.
**Effort**: Small

```javascript
// T04:
() => {
  const env = window.cellApp.environment;
  const intents = [...env.intentions.values()];
  const polymerFulfilled = intents.some(i => i.type === 'polymer' && i.fulfilled === true);
  const proteinCount = env.proteins ? env.proteins.size : 0;
  return polymerFulfilled || proteinCount > 0;
}
```

## Recommended Action

Option A for T05 (most critical — wrong test result). Option A or B for T04 (either is fine).

## Technical Details

**Affected files:**
- `tests/scenarios/t04-polymer-intent.spec.js` — lines 53, 61
- `tests/scenarios/t05-cell-formation.spec.js` — line 51

**Why T05 is most critical:** `test.fail()` annotations flip pass/fail semantics. A silent vacuous pass (0 prokaryotes due to missing method) would be reported as "unexpected pass" — the exact opposite signal from what we want when the underlying bug (E2E cell formation) is actually broken.

## Acceptance Criteria

- [ ] T04 `waitForFunction` predicate throws immediately if `getAllProteins` is missing, not after 120s timeout
- [ ] T05 `page.evaluate` throws immediately if `getAllProkaryotes` is missing
- [ ] Both tests still pass their actual assertions correctly when methods exist
- [ ] Tests run without regression (`npm test`)

## Work Log

- 2026-02-26: Identified by architecture-strategist and performance-oracle review agents. Filed as P1 because it inverts test semantics for T05.
