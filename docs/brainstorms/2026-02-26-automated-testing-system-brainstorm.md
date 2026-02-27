---
date: 2026-02-26
topic: automated-testing-system
---

# Automated Testing System for BioChemSim

## What We're Building

A mandatory, multi-layer automated testing system that prevents agents from claiming a feature or fix "works" without producing verifiable evidence. The simulation has been suffering from **false reports**: agents write code, run synthetic tests (or no real tests at all), and mark tasks done — while real gameplay still breaks. The user is the only person actually testing the software.

The system must ensure:
1. The simulation **actually runs** (Play button pressed, not just code setup)
2. Tests use **real UI interactions** (clicks, not console-only scripts)
3. Evidence is **committed to the repo** (not ephemeral agent-session artifacts)
4. Agents are **prevented by CLAUDE.md mandate** from claiming done without evidence

## The Six Known Bug Categories (Reference, Not Fix Scope)

These bugs were found by manual testing and represent the kind of failure automated tests must be able to detect and surface clearly:

1. **UI inconsistency** — Inspector tab doesn't update when molecule intent state changes on map
2. **E2E cell formation broken** — Full path (spawner + cell intent + polymer intents + molecule intents) never completes; atoms get cramped
3. **Atom locking** — Atoms inside an intent zone get locked, excluded from bonding, but never consumed by the intent
4. **Atoms disappear from higher views** — Atoms shown only at atom level (level 0), invisible at molecule/polymer view; intent never finishes
5. **Browser crash** — Placing many intents simultaneously (1 cell + 2 polymer + 7 molecule) crashes the browser
6. **Intent cannibalizing stable molecules** — Placing a second molecule intent immediately dismantles the already-completed first molecule to steal its atoms

These are ongoing known bugs, included here as reference. They are **not** fix scope for this work, and agents must not attempt to fix them before the testing system exists. They are referenced because their descriptions are useful for designing test scenarios — a testing system that can detect and surface failures like these is a sign that the workflow is improving. If these bugs are eventually fixed, it will be because the tests caught them.

## Why This Approach

### Approaches Considered

**Approach A: Deno Unit Tests**
Refactor source files to use ES modules so they can be imported in Deno. Write unit tests for pure logic (bonding, molecule formation, intention rules).

- **Pros**: Fast, deterministic, CI-friendly, no browser needed
- **Cons**: Requires major refactoring of all source files (globals → modules); cannot test UI behavior, rendering, or physics; cannot catch the actual bugs found — they are emergent, runtime issues not unit-testable
- **Verdict**: Wrong tool for this problem. The bugs are in emergent simulation behavior, not pure functions.

**Approach B: Committed Playwright Test Scenarios (Recommended)**
Write `.spec.js` test files that open both `dev.html` and `index.html`, press Play via click, place intents via UI clicks, wait, and assert outcomes via DOM queries and console log inspection.

- **Pros**: Tests real gameplay; committed to repo so they run every time; can be run by agents before claiming done; mirrors what the user does manually; can use `window.cellApp` to read state without modifying it
- **Cons**: Requires a local HTTP server; non-deterministic physics means timing needs careful handling; some assertions need `waitFor` loops
- **Verdict**: Best fit. Matches real user behavior.

**Approach C: Claude-in-Chrome Scripts**
Use the MCP chrome plugin for exploratory testing sessions.

- **Pros**: Interactive, visual, good for debugging new issues
- **Cons**: Not committed to repo, not reproducible, not in CI; same ephemeral problem that created false reports
- **Verdict**: Valid as a **supplementary** tool for exploratory debugging only, not for regression testing.

### Chosen Approach: B as primary, C as supplementary, A rejected

Playwright committed test scenarios are the backbone. Console debugging (`Debug.enable(...)`) and chrome MCP automation support exploratory testing and debugging only. Deno unit tests are not viable without major refactoring and cannot catch the actual class of bugs present.

## Key Decisions

- **Test files committed to `tests/`**: All scenario tests live in `tests/scenarios/` as `*.spec.js` files runnable with Playwright
- **Tests use UI clicks, not console injection**: Atoms are spawned by the in-app spawner (not placed via `window.cellApp`); intents are placed by clicking the UI; Play is pressed by clicking the button — mirroring actual user behavior
- **Console is a read-only debugging tool in tests**: Tests may read `Debug` logs and `window.cellApp` state but must not use console commands to set up test conditions. The console is for observation, not control.
- **Simulation must actually run**: Every test must press the Play button. Tests that never start the simulation are invalid.
- **CLAUDE.md mandate**: No fix or feature may be marked complete without a passing Playwright test that covers the scenario. Agents must run the tests, capture the result, and attach evidence.
- **Artifacts before completion**: Before any PR or "done" claim, agents must show: (1) test file committed, (2) test run output showing pass, (3) no regressions on existing passing tests.

## Test Scenario Coverage Required

These scenarios must each have a committed test:

| ID | Scenario | Key Assertion |
|----|----------|---------------|
| T01 | Spawner + single molecule intent | Intent completes; atom count matches expected molecule formula |
| T02 | Two simultaneous molecule intents, same type | Both complete; second intent does NOT steal atoms from first completed molecule |
| T03 | Inspector reflects intent state | Selecting a molecule intent on map shows correct status in inspector tab |
| T04 | Spawner + polymer intent + 3 molecule intents | Polymer seals within timeout; no atom locking |
| T05 | Full E2E (cell intent) | Cell forms within extended timeout; no browser crash |
| T06 | Atom view vs molecule/polymer view consistency | Atoms captured by intent visible at all zoom levels, not hidden |

## Enforcement Mechanism (Two Layers)

### Layer 1: CLAUDE.md Mandate
Add to `CLAUDE.md` under a new **Testing Requirements** section:
- Agents MUST run Playwright tests before marking any task done
- Evidence required: test file path + output showing pass
- Claiming "works" without this is not acceptable
- The simulation must actually RUN in tests (Play must be pressed)

### Layer 2: Committed Test Artifacts
- `tests/scenarios/` contains `.spec.js` files for each scenario
- Tests run against **both** `http://localhost:8765/dev.html` (source files) **and** `http://localhost:8765/index.html` (production bundle, what GitHub Pages serves). Both must pass — a fix that works in dev but breaks in production is not a valid fix.
- **Prerequisite**: A local HTTP server must be running at port 8765 before running any test. The Python server (`python -m http.server 8765`) is already used in this project. Tests must not assume a server is already running — agents must start it if needed.
- CI (`deno.yml`) does NOT run Playwright (too heavy for CI runner) — but agents must run them locally
- A `tests/README.md` documents how to run the suite and what passing looks like

## Open Questions

- **Can overlapping intents coexist?** — The intent system's behaviour when multiple intents operate simultaneously (molecule + polymer + cell intents all active at once) is not verified. This affects T02, T04, T05 and is the suspected cause of bugs #2–5. An investigation test must determine whether the system supports concurrent overlapping intents at all. If it does, they must work correctly. If it does not, this must be documented as a known limitation and the user must be guided to build hierarchically (finish one intent before starting the next) rather than placing all intents simultaneously.

## Next Steps

→ `/workflows:plan` to define the implementation: Playwright setup, test file structure, scenario scripts, and CLAUDE.md additions
