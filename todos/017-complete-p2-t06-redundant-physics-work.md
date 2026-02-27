---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, testing, performance]
dependencies: []
---

# T06 duplicates T01's physics work — up to 90 seconds of redundant wall-clock time

## Problem Statement

T06 ("molecule count stays non-zero after level transitions") runs the identical C2H4 molecule formation scenario from scratch: same spawner config, same intent placement at (1000, 1000), same 90-second `waitForFunction` with 500ms polling. The only new behaviour T06 actually tests is the three level-switch button clicks and their effect on `environment.molecules.size`.

T06's actual subject is `Viewer.level` transitions — it should not be testing intent fulfillment, which is already covered by T01.

**Worst-case impact:** Two-project suite runtime ~170 seconds longer than necessary.

## Findings

`t06-view-consistency.spec.js` lines 1–38:
```javascript
// ── Setup: same as T01 — run until a C2H4 molecule forms ─────────────────────
await page.evaluate(() => {
  window.cellApp.atomSpawner.zone = { x: 700, y: 700, width: 600, height: 600 };
  window.cellApp.atomSpawner.tickInterval = 8;
});
await enableSpawner(page, ['C', 'C', 'H', 'H', 'H', 'H']);
await placeEthyleneIntent(page, 1000, 1000);
await pressPlay(page);

await page.waitForFunction(
  () => {
    const mols = [...window.cellApp.environment.molecules.values()];
    return mols.some(m => m.atoms.length === 6);
  },
  { timeout: 90_000, polling: 500 }
);
```

This exact scenario already exists in T01. The page is reloaded for each test so state cannot be shared — T06 pays the full formation cost again.

## Proposed Solutions

### Option A: Inject molecule directly via page.evaluate (Recommended)
**Pros**: T06 completes in < 5s. Clearly tests what it claims to test (viewer level transitions). No physics dependency.
**Cons**: Requires creating atoms/molecule in a specific way that satisfies `molecules.size > 0`.
**Effort**: Medium
**Risk**: Low — injection is test scaffolding; doesn't affect simulation rules

```javascript
test('T06: molecule count stays non-zero after level transitions', async ({ page }) => {
  // Inject an H2 molecule (simplest stable molecule) directly to avoid 90s physics wait.
  // H2 = 2 hydrogen atoms bonded together. This is not testing formation — just level UI.
  await page.evaluate(() => {
    const env = window.cellApp.environment;
    const h1 = new window.Atom('H', 990, 1000);
    const h2 = new window.Atom('H', 1010, 1000);
    env.addAtom(h1);
    env.addAtom(h2);
    const bond = new window.Bond(h1, h2, 1);
    env.addBond(bond);
    env.updateMolecules(); // trigger BFS to group into a Molecule object
    window.cellApp.viewer.render();
  });

  // Assert molecule was created
  const initialCount = await page.evaluate(() => window.cellApp.environment.molecules.size);
  expect(initialCount).toBeGreaterThan(0);

  // ── Assertions: check molecule count at each level ────────────────────────────
  // ... (level switch checks as-is)
});
```

### Option B: Reduce T06's formation timeout
**Pros**: No structural change. Still validates the full physics pipeline in T06.
**Cons**: Still duplicates T01's work; just slightly cheaper on average.
**Effort**: Small

Use `timeout: 30_000` instead of 90_000 in T06. If T01 passes, T06 should form the molecule faster since it runs after the suite is already "warmed up" (same browser context).

### Option C: Accept duplication
**Pros**: Zero effort, currently working.
**Cons**: 85s of wall-clock time wasted per project run.
**Effort**: None

## Recommended Action

Option A if H2 injection is feasible (need to verify `Bond` and `updateMolecules` are accessible). Option B as a low-effort interim fix. Option C is the current state.

## Technical Details

**Affected file:** `tests/scenarios/t06-view-consistency.spec.js`

**Spawn rate context:** T06 uses `tickInterval=8` at `10×` speed → ~75 atoms/second real time. Plenty of supply, but physics non-determinism means formation can take anywhere from 5–90s.

## Acceptance Criteria

- [ ] T06 completes in under 30s (wall-clock)
- [ ] T06 still correctly detects if `molecules.size` drops to 0 during level transitions
- [ ] T06 passes `npm test` (both dev and prod projects)

## Work Log

- 2026-02-26: Identified by performance-oracle review agent. Filed as P2.
