## Testing Requirements (Mandatory)

### Before Marking Any Task Done

Agents MUST run Playwright tests before marking any fix or feature complete.

**Required evidence:**
1. Test file path (committed to `tests/scenarios/`)
2. Playwright output showing the relevant test(s) passing
3. No regressions on previously passing tests

**Claiming "works" without this evidence is not acceptable.**

### Running Tests

Prerequisites:
1. Install dependencies (first time): `npm install && npx playwright install chromium`
2. Build production bundle if testing `index.html`: `deno run --allow-read --allow-write --allow-run build.ts`

The `webServer` config auto-starts the Python HTTP server — no manual start needed.

Run all tests:
```bash
npm test
```

Run dev only:
```bash
npm run test:dev
```

Run the production-only project (requires bundled `index.html`):
```bash
npm run test:prod
```

Run a specific scenario:
```bash
npx playwright test t01
```

### Test Validity Rules

- **The simulation MUST run**: Every test must click `#playPauseBtn`. Tests that never start the simulation are invalid.
- **No console-injection setup**: Tests must not use `window.cellApp.*` calls to set up test conditions. Console is observation-only. (Exception: `page.evaluate` for test scaffolding analogous to setting `atomSpawner.zone`.)
- **Both pages must pass**: `dev.html` and `index.html` must both pass. A fix that works in dev but fails in production is not a valid fix.
- **Spawner-based atom delivery**: Atoms must come from `AtomSpawner`, not manual placement. This mirrors real gameplay.

### Test Annotations

- `test.fail()` — test exercises a known bug; expected to fail. When bug is fixed, remove annotation.
- `test.skip()` — test is temporarily disabled. Must include a comment explaining why.

### Test Output Interpretation

```
✓ dev > T01: single ethylene...    [PASSED]
✓ dev > T05: full E2E cell...      [PASSED — test actually failed as expected]
✗ dev > T05: full E2E cell...      [FAILED — unexpected: bug was fixed, remove test.fail()]
```

Screenshots and videos are saved to `playwright-report/` on failure.

### Infrastructure vs Scenarios

| Layer | Files | Stability |
|-------|-------|-----------|
| **Infrastructure** (permanent) | `playwright.config.js`, `tests/fixtures/app.js`, `tests/README.md` | High — only changes if Playwright or app loading model changes |
| **Scenarios** (living) | `tests/scenarios/*.spec.js` | Low — update freely as bugs are fixed or behavior changes |

## Running Before Claiming "Done"

Agents MUST run `npm test` before marking any fix or feature complete. Required evidence:
1. Test file path (committed to `tests/scenarios/`)
2. Playwright output showing relevant test(s) passing
3. No regressions on previously passing tests

See `Testing Requirements (Mandatory)` section for the full mandate.