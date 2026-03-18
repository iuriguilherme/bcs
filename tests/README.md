# Playwright Test Suite

This directory contains Playwright tests for the BioChemSim simulation.

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
```

# Test Files

| File | Status | What it tests |
|------|--------|---------------|
| `t01-single-molecule-intent.spec.js` | ✅ Expected to pass | Single C2H4 intent completes with AtomSpawner |
| `t02-concurrent-molecule-intents.spec.js` | ✅ Expected to pass | Two overlapping C2H4 intents (anti-cannibalization) |
| `t03-inspector-state.spec.js` | ✅ Expected to pass | Inspector panel shows correct fields on intent selection |
| `t04-polymer-intent.spec.js` | ⚠️ `test.fail()` | Polyethylene polymer from 3 molecule intents (known bug) |
| `t05-cell-formation.spec.js` | ⚠️ `test.fail()` | Full E2E cell formation (atoms cramped bug) |
| `t06-view-consistency.spec.js` | ✅ Expected to pass | Molecule count stays non-zero across level switches |

## Test Output Interpretation

```
✓ dev > T01: single ethylene...    [PASSED]
✓ dev > T05: full E2E cell...      [PASSED — test actually failed as expected]
✗ dev > T05: full E2E cell...      [FAILED — unexpected: bug was fixed, remove test.fail()]
```

### Understanding `test.fail()`
`test.fail()` marks a test that exercises a **known bug** and is **expected to fail**.
- If the test fails → expected behavior, Playwright reports it green
- If the test unexpectedly passes → Playwright reports it as a failure (the bug was fixed!)
- When a bug is fixed, remove the `test.fail()` annotation and the test becomes a regression guard.

Screenshots and videos are saved to `playwright-report/` on failure.

## Infrastructure vs Scenarios

| Layer | Files | Stability |
|-------|-------|-----------|
| **Infrastructure** (permanent) | `playwright.config.js`, `tests/fixtures/app.js`, `tests/README.md` | High — only changes if Playwright or app loading model changes |
| **Scenarios** (living) | `tests/scenarios/*.spec.js` | Low — update freely as bugs are fixed or behavior changes |

## Running Before Claiming "Done"
Agents MUST run `npm test` before marking any fix complete. Required evidence:
1. Test file path (committed to `tests/scenarios/`)
2. Playwright output showing relevant test(s) passing
3. No regressions on previously passing tests

See `CLAUDE.md` Testing Requirements section for the full mandate.