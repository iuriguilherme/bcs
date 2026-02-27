# BioChemSim Playwright Tests

Automated browser tests that run real gameplay scenarios against the simulation.

## Why Playwright?

Playwright tests real emergent behavior: atoms spawned by `AtomSpawner`, physics, bonding, and
multi-agent competition. Unit tests cannot catch these bugs — see the brainstorm at
`docs/brainstorms/2026-02-26-automated-testing-system-brainstorm.md`.

## Prerequisites

1. **Python 3** — for the HTTP server (`python -m http.server 8765`)
2. **Node.js + npm** — for running Playwright
3. **Chromium** — installed via Playwright

## First-Time Setup

```bash
# From the cs1/ project root:
npm install
npx playwright install chromium
```

## Running Tests

The `webServer` config in `playwright.config.js` **auto-starts** the Python HTTP server.
No manual server start needed. If you already have a server running on port 8765,
`reuseExistingServer: true` will use it.

```bash
# Run all tests (both dev.html and index.html projects)
npm test

# Run dev project only (faster — no bundle needed)
npm run test:dev

# Run prod project only (requires bundle: deno run ... build.ts first)
npm run test:prod

# Run a specific scenario
npx playwright test t01
npx playwright test t03

# Show HTML report after a run
npx playwright show-report
```

## Test Files

| File | Status | What it tests |
|------|--------|---------------|
| `t01-single-molecule-intent.spec.js` | ✅ Expected to pass | Single C2H4 intent completes with AtomSpawner |
| `t02-concurrent-molecule-intents.spec.js` | ✅ Expected to pass | Two overlapping C2H4 intents (anti-cannibalization) |
| `t03-inspector-state.spec.js` | ✅ Expected to pass | Inspector panel shows correct fields on intent selection |
| `t04-polymer-intent.spec.js` | ✅ Expected to pass | Polyethylene polymer from 3 molecule intents |
| `t05-cell-formation.spec.js` | ⚠️ `test.fail()` | Full E2E cell formation (atoms cramped bug) |
| `t06-view-consistency.spec.js` | ✅ Expected to pass | Molecule count stays non-zero across level switches |

## Spawn Rate Reference

The fixture sets `simulation.setSpeed(10)` for all tests, giving ~600 simulation ticks/second
(60 fps × 10 ticks per frame). The spawner fires every `tickInterval` ticks, so:

> **Effective spawn rate = 600 ÷ tickInterval atoms/second (real time)**

| Test | `tickInterval` | Effective rate | Rationale |
|------|---------------|----------------|-----------|
| T01  | 8             | ~75 atoms/sec  | Heavy supply — single intent should converge quickly |
| T02  | 100           | ~6 atoms/sec   | Deliberate drip — prevents atom overcrowding that would mask the anti-cannibalization bug |
| T04  | 10            | ~60 atoms/sec  | Heavy supply for 3-intent + polymer pipeline |
| T05  | 5             | ~120 atoms/sec | Maximum density for complex E2E cell formation path |
| T06  | —             | —              | No spawner — H2 molecule injected directly via `page.evaluate` |

T02 uses a much slower rate than the others by design: at ~75 atoms/sec (T01's rate), the two
competing intents would be overwhelmed by excess atoms before the anti-cannibalization logic has
a chance to run, producing tar-ball failures unrelated to the bug under test.

## Understanding `test.fail()`

`test.fail()` marks a test that exercises a **known bug** and is **expected to fail**.
- If the test fails → expected behavior, Playwright reports it green
- If the test unexpectedly passes → Playwright reports it as a failure (the bug was fixed!)

When a bug is fixed, remove the `test.fail()` annotation and the test becomes a regression guard.

## Test Output Interpretation

```
✓ dev > T01: single ethylene...    [PASS — intent completed]
✓ dev > T05: full E2E cell...      [PASS — because test.fail() + test actually failed = expected]
✗ dev > T05: full E2E cell...      [FAIL — unexpected: bug was fixed, remove test.fail()]
```

Screenshots and videos are saved to `playwright-report/` on failure.

## Infrastructure vs Scenarios

| Layer | Files | Stability |
|-------|-------|-----------|
| **Infrastructure** (permanent) | `playwright.config.js`, `tests/fixtures/app.js`, `tests/README.md` | High — only changes if Playwright or app loading model changes |
| **Scenarios** (living) | `tests/scenarios/*.spec.js` | Low — update freely as bugs are fixed or behavior changes |

Never remove the infrastructure. Scenarios are expected to evolve.

## Running Before Claiming "Done"

Agents MUST run `npm test` before marking any fix complete. Required evidence:
1. Test file path (committed to `tests/scenarios/`)
2. Playwright output showing relevant test(s) passing
3. No regressions on previously passing tests

See `CLAUDE.md` Testing Requirements section for the full mandate.
