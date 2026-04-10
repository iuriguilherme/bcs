---
title: "feat: Add Prokaryote Self-Replication via Binary Fission"
type: feat
status: active
date: 2026-04-09
origin: docs/brainstorms/2026-02-27-prokaryote-self-replication-brainstorm.md
deepened: 2026-04-09
---

# feat: Add Prokaryote Self-Replication via Binary Fission

## Overview

Prokaryotes should replicate autonomously via binary fission. A synthesis progress counter (0→1) advances each tick while ribosomes consume ATP. When progress reaches 1.0, the parent cell divides: its polymer structures are cloned into a daughter `Prokaryote`, the parent resets, and the daughter spawns at a spatial offset. This replaces the existing `_divide()` stub (which creates an empty, component-less offspring) with a biologically-motivated state machine.

## Problem Frame

The existing `_divide()` creates structurally empty offspring (`membrane: [], nucleoid: [], ribosomes: []`) with no polymer components. The current `canDivide()` gate (ATP ≥ 150, age > 100) triggers division instantly without any synthesis phase. The brainstorm selected Approach A — a synthesis progress counter driven by ribosome count and ATP consumption — as the right balance between biological fidelity and implementation simplicity.  
(see origin: `docs/brainstorms/2026-02-27-prokaryote-self-replication-brainstorm.md`)

## Requirements Trace

- R1. Prokaryotes must replicate via a synthesis phase (state: `idle → synthesizing → idle`) when ATP ≥ divisionThreshold AND age > 100.
- R2. Synthesis advances `replicationProgress` (0→1) each tick; ribosomes consume ATP to drive progress.
- R3. If ATP drops below a minimum threshold mid-synthesis, progress **pauses** (freezes, does not reset). Progress resumes when ATP recovers.
- R4. At `replicationProgress >= 1.0`: clone all parent polymer structures; spawn a new `Prokaryote` at an offset position; reset parent progress to 0 and return to `idle`.
- R5. Daughter cell receives cloned polymer arrays (membrane, nucleoid, ribosomes) as new objects with identical sequences. Daughter ATP starts at `divisionThreshold * 0.3`.
- R6. Parent retains its original polymer components after division; `divisionCooldown` resets.
- R7. Visual: prokaryote body shifts toward a warmer/brighter color as `replicationProgress` increases during the `synthesizing` state.
- R8. No DNA mutation in this iteration.

## Scope Boundaries

- No physical polymer objects are built inside the cell boundary during synthesis (Approach B rejected).
- No instant ATP-threshold split without synthesis phase (Approach C rejected).
- No DNA mutation or genetic variation — daughter is an identical structural clone.
- Neural network reproduction on the `Cell` class is a separate concern — not part of this story.
- No new UI inspector fields are required, though `replicationProgress` and `replicationStage` will be readable via the existing inspector if it already displays cell properties.

## Context & Research

### Relevant Code and Patterns

- `src/entities/prokaryote.js` — main implementation target; contains `canDivide()`, the `_divide()` stub to replace, `update(dt, environment)`, and `render()`
- `src/entities/polymer.js` — needs a `clone()` method (no existing clone/copy path)
- `src/core/environment.js` — `addProkaryote(prokaryote)` at line 239; use this to spawn the daughter
- `src/viewer/viewer.js` — delegates cell rendering entirely to `prokaryote.render()`; no changes needed in viewer itself
- ATP system: `this.cytoplasm.atp` (float 0–200), consumed at `baseMetabolism * dt` (0.05/tick), death at ≤ 0; `divisionThreshold = 150`
- Ribosomes: stored in `this.ribosomes` (array of PROTEIN Polymer objects); identified by array membership, not by type-check inside `update()`
- `getComponentSummary()` returns `{ membrane, nucleoid, ribosomes, totalPolymers }` — useful for inspecting counts

### Institutional Learnings

- **Monomer invariant** (`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`): When cloning Molecule objects, three fields must be set together: `isMonomer`, `monomerId`, `monomerTemplate`. If the source molecule had `isMonomer === true`, call `_detectMonomerType()` on the clone immediately after construction. Violating this causes silent catalogue corruption on the next IndexedDB cycle.
- **Silent undefined-property bug** (`docs/solutions/logic-errors/getAtomsNear-grid-removal-and-progress-regression.md`): Any render-path condition that reads a new entity property (e.g. `cell.replicationStage`) must be verified to exist on the class before use in `render()`. An undefined property evaluates silently to falsy in JS — the tint will never render without error.
- **Hot-path console ban** (`docs/solutions/performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md`): No bare `console.*` calls anywhere reachable from `render()`. Use `Debug.log(category, message)` instead. Violation triggers automatic code review failure.
- **Last-statement deletion risk** (`docs/solutions/logic-errors/getAtomsNear-grid-removal-and-progress-regression.md`): The final statement in a flattened conditional block (e.g. the progress-advance call) is the most likely casualty of future refactors. After implementing the replication update pipeline, verify that the progress-advance call survives line-by-line.
- **Behavior on entity, not container** (`docs/solutions/logic-errors/dead-code-review-environment-intention-stale-bundle.md`): ATP consumption, progress advancement, and division logic belong on `Prokaryote`. Only cross-entity orchestration (spawning the daughter) touches `Environment`.
- **Stale bundle** (`docs/solutions/logic-errors/dead-code-review-environment-intention-stale-bundle.md`): Run `deno run --allow-read --allow-write --allow-run build.ts` before `npm test` or `npm run test:prod`. A dev-pass with prod-timeout is always a stale bundle.

## Key Technical Decisions

- **Synthesis rate**: `ribosomes.length × 0.0005` progress/tick. With 1 ribosome this is ~2000 ticks per cycle (~33 seconds). With 0 ribosomes, synthesis does not advance (preventing replication in cells with no ribosomes).
- **ATP cost during synthesis**: `~0.05 ATP/tick` for synthesis on top of `baseMetabolism` (0.05/tick). Over 2000 ticks ≈ 100 ATP for synthesis + 100 ATP base = 200 ATP net demand. Gate ensures divisionThreshold is met before synthesis starts.
- **Pause threshold**: Synthesis pauses (progress frozen) when `cytoplasm.atp < ~10`. This prevents the synthesis load from starving the cell to death mid-cycle while not resetting progress.
- **replicationStage as string enum**: `'idle'` | `'synthesizing'`. Avoids boolean proliferation; easily extensible.
- **Polymer cloning strategy**: Add a `Polymer.clone()` method. The actual `Polymer` constructor signature is `constructor(monomers = [], monomerTemplate = null, name = null)` — positional args, not an object literal. The clone call must be `new Polymer(clonedMoleculesArray, this.monomerTemplate, this.name)`. Cloned molecule entries are new `Molecule` instances with `atoms = []` (no live atom references), but with `formula`, `isMonomer`, `monomerId`, and `monomerTemplate` copied directly from the source. `monomerId` must be copied manually — `_detectMonomerType()` does NOT write it. Cloned polymers carry no live atoms and are structural descriptors for the daughter cell.
- **ATP cost model — tick-by-tick only**: The tick-by-tick synthesis ATP consumption (`~0.05/tick × ~2000 ticks ≈ 100 ATP`) serves as the full synthesis cost. The existing lump deduction in `_divide()` (`divisionThreshold * 0.7` = 105 ATP) must be **removed** when rewriting `_divide()`. Keeping both would double-charge ATP and likely kill the parent immediately post-division.
- **Tint implementation in `prokaryote.render()`**: Interpolate the background gradient color stops between normal green and a warm amber based on `replicationProgress` when `replicationStage === 'synthesizing'`. The `render()` method is already self-contained — the viewer does not pass color parameters.
- **`canDivide()` decision**: Rename to `canStartSynthesis()` with the additional guard `this.ribosomes.length > 0`. The `replicationStage === 'idle'` guard is added. Keep `canDivide()` as a deprecated alias until all callers are confirmed absent (check `controls.js`, `catalogue-ui.js`, and any test files before removing).
- **`canStartSynthesis()` ribosome guard**: Must require `ribosomes.length > 0`. A cell with zero ribosomes that enters `synthesizing` would hang there indefinitely (progress stays 0, ATP still drains from synthesis cost).
- **Daughter spawn direction**: Use a random angle (uniform 0–2π) for the 50–80 unit offset. Tests that need deterministic positioning should inject a known rng seed or check only that `daughter.position !== parent.position` (not exact coordinates).

## Open Questions

### Resolved During Planning

- **Which entity**: Prokaryote (not Cell). Cell neural-network reproduction is a separate concern. (from origin)
- **Replication mechanism**: Approach A — synthesis progress + programmatic polymer cloning. (from origin)
- **Synthesis rate**: ~0.0005 progress/tick/ribosome → ~2000 ticks with 1 ribosome. (from origin)
- **ATP synthesis cost**: ~0.05 ATP/tick during synthesis. Pauses (does not reset) when ATP drops below minimum. (from origin)
- **Daughter components**: Cloned polymer structures — new objects with identical type/sequence. No live atoms in the clones. (from origin)
- **Parent after division**: Retains original polymers; `replicationProgress → 0`; `divisionCooldown` resets. (from origin)
- **Visual indicator**: Warm/amber color tint applied via `render()` gradient interpolation as `replicationProgress` increases. (from origin)
- **No mutation**: Out of scope for this iteration. (from origin)

### Resolved During Deepening (added 2026-04-09)

- **Polymer constructor signature**: `constructor(monomers = [], monomerTemplate = null, name = null)` — positional, not object literal. `clone()` must use `new Polymer(clonedMoleculesArray, this.monomerTemplate, this.name)`.
- **`monomerId` is NOT written by `_detectMonomerType()`**: Must copy `monomerId` directly from the source molecule in `clone()`.
- **`updateProkaryotes()` iterates live Map**: The current loop does NOT snapshot — daughter will receive an `update()` call in the same tick it is born. Fix required in `environment.js` (see Unit 4).
- **ATP double-deduction**: Tick-by-tick synthesis consumption is the full cost. Remove the lump deduction in the rewritten `_divide()`.
- **Ribosome-less cells**: `canStartSynthesis()` must guard `ribosomes.length > 0` to prevent indefinite `synthesizing` hang.
- **Daughter spawn direction**: Random angle (uniform 0–2π), 50–80 unit offset.

### Deferred to Implementation

- **Exact pause-threshold value**: Nominal guidance is ~10 ATP; final value may be tuned during implementation based on observed starvation behavior. Tests should use a named constant, not a hardcoded literal.
- **`_detectMonomerType()` accessibility**: Whether this is a class method on Molecule or a module-level function needs to be confirmed when reading `src/entities/molecule.js` before cloning — but `monomerId` must be copied directly from source regardless.
- **Inspector display of replicationProgress**: Whether the existing inspector already reads all Prokaryote properties or needs a new field is an implementation-time question.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### State Machine

```
         age > 100
         ATP >= divisionThreshold
         divisionCooldown == 0
              │
         [idle] ──────────────────────────────────────────►
              │                                            │
              ▼                                            │ (ATP < pause threshold)
        [synthesizing] ── progress += ribosomes * rate ──►│── progress FROZEN (no reset)
              │                                            │
              │ (ATP >= pause threshold)                   │
              │ ◄─────────────────────────────────────────┘
              │
              │ (replicationProgress >= 1.0)
              ▼
          [_divide()]
            - clone membrane polymers
            - clone nucleoid polymers
            - clone ribosome polymers
            - spawn daughter Prokaryote at offset
            - reset parent: replicationProgress = 0, replicationStage = 'idle'
            - reset divisionCooldown
              │
              ▼
           [idle]
```

### Polymer Cloning Path

```
Prokaryote._divide()
  └─► for each polymer in [this.membrane, this.nucleoid, this.ribosomes]
        └─► polymer.clone()
              └─► new Polymer({ type, name, monomerTemplate })
                    └─► for each molecule in polymer.molecules
                          └─► copy metadata; if isMonomer → _detectMonomerType()
```

## Implementation Units

- [ ] **Unit 1: Add replication state to Prokaryote**

**Goal:** Introduce the replication state machine properties and wire `update()` to call a new `_updateReplication(dt, environment)` method instead of the current direct `canDivide() → _divide()` call.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/entities/prokaryote.js`
- Modify: `index.html` (sync bundle after source change)

**Approach:**
- Add to constructor: `replicationProgress: 0`, `replicationStage: 'idle'`, `synthesisRatePerRibosome` (directional: 0.0005), `synthesisAtpCostPerTick` (directional: 0.05), `synthesisMinAtp` (directional: ~10)
- Replace the `canDivide() / _divide()` block in `update()` with a single `this._updateReplication(dt, environment)` call
- Add `_updateReplication(dt, environment)`: dispatches on `replicationStage` — `idle` checks `canStartSynthesis()`, `synthesizing` calls `_synthesize(dt, environment)`
- Rename/repurpose `canDivide()` → add `canStartSynthesis()` with same logic but guarding `replicationStage === 'idle'`
- Keep `canDivide()` as an alias or remove it — confirm no external callers before removing

**Patterns to follow:**
- `update(dt, environment)` in `src/entities/prokaryote.js` — existing ATP deduction and component-update chain
- `divisionCooldown` / `divisionCooldownMax` pattern for cooldown management

**Test scenarios:**
- Happy path: Cell with age > 100 and ATP >= 150 transitions from `idle` to `synthesizing` on the next update tick
- Edge case: Cell with age ≤ 100 remains in `idle` regardless of ATP
- Edge case: Cell with ATP < divisionThreshold remains in `idle`
- Edge case: Cell with `divisionCooldown > 0` remains in `idle`
- Edge case: Cell already in `synthesizing` does not re-enter the `idle → synthesizing` transition

**Verification:**
- After one update tick with qualifying conditions, `cell.replicationStage === 'synthesizing'`
- Cells not meeting conditions remain in `'idle'`
- No regressions in existing `update()` behavior (ATP deduction, nutrient absorption)

---

- [ ] **Unit 2: Implement `_synthesize(dt, environment)` with progress and ATP consumption**

**Goal:** Advance `replicationProgress` each tick while consuming ATP. Pause when ATP falls below the minimum. Trigger division when progress reaches 1.0.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/entities/prokaryote.js`
- Test: `tests/scenarios/t08-prokaryote-replication.spec.js`
- Modify: `index.html` (sync bundle)

**Approach:**
- `_synthesize(dt, environment)`: if `atp < synthesisMinAtp` → return (progress frozen); else consume `synthesisAtpCostPerTick * dt` ATP, advance `replicationProgress` by `ribosomes.length * synthesisRatePerRibosome * dt`; if `replicationProgress >= 1.0` → call `_divide(environment)`, reset progress to 0, stage to `'idle'`
- Guard against `ribosomes.length === 0`: synthesis does not advance (cell cannot replicate without ribosomes)
- Progress must never exceed 1.0 or go below 0

**Patterns to follow:**
- ATP deduction: `this.cytoplasm.atp -= cost * dt` in existing `update()`
- `Math.min` / `Math.max` clamps used elsewhere in the codebase

**Test scenarios:**
- Happy path: Cell in synthesizing with 1 ribosome and ample ATP shows `replicationProgress > 0` after several ticks
- Happy path: Progress increases proportionally to `ribosomes.length` (2 ribosomes → 2x rate)
- Edge case: ATP below pause threshold → `replicationProgress` does not change across multiple ticks
- Edge case: ATP recovers above threshold → progress resumes from frozen value (not reset to 0)
- Edge case: Cell with `ribosomes.length === 0` → `replicationProgress` stays at 0 indefinitely
- Edge case: `replicationProgress` clamps at 1.0 — does not exceed 1.0 even if one tick overshoots
- Integration: At `replicationProgress >= 1.0`, `_divide()` is called and stage returns to `'idle'`

**Verification:**
- `replicationProgress` advances measurably after N ticks of synthesis with ribosomes present
- Progress freezes exactly when ATP < threshold and resumes without reset when ATP recovers
- At progress 1.0, a daughter Prokaryote appears in the environment

---

- [ ] **Unit 3: Add `Polymer.clone()` method**

**Goal:** Provide a way to create a new `Polymer` instance with identical structural metadata (type, name, monomerTemplate, molecule sequences) but no live atoms. Required by the division logic.

**Requirements:** R4, R5

**Dependencies:** None (can be implemented independently)

**Files:**
- Modify: `src/entities/polymer.js`
- Modify: `index.html` (sync bundle)

**Approach:**
- `clone()` method on `Polymer`: construct using positional signature `new Polymer(clonedMoleculesArray, this.monomerTemplate, this.name)`. **Do NOT pass an object literal** — the constructor signature is `(monomers=[], monomerTemplate=null, name=null)`.
- Cloned molecules are **new Molecule instances** with `atoms = []` (no live atom references). Copy these fields from the source molecule directly: `formula`, `isMonomer`, `monomerId`, `monomerTemplate`.
- **Monomer invariant**: `monomerId` must be copied directly from the source molecule — `_detectMonomerType()` does NOT write `monomerId`. Never set `isMonomer = true` without also copying `monomerId` and `monomerTemplate`.
- The cloned polymer's `molecules` array must have the same length and order as the original for structural identity checks.
- `clone()` assigns a fresh `id` (via `Utils.generateId()`) to the new polymer.

**Patterns to follow:**
- `serialize()` / `deserialize()` in `src/entities/polymer.js` — existing data-export pattern showing which fields describe a polymer's structure
- `Molecule` constructor in `src/entities/molecule.js` — confirm which fields are constructor params vs. externally set properties before cloning

**Test scenarios:**
- Happy path: `polymer.clone()` returns a new Polymer with different `id` but same `type`, `name`, `monomerTemplate`
- Happy path: Cloned polymer's `molecules.length` equals original's `molecules.length`
- Edge case: Clone of a polymer with `isMonomer === true` molecules → cloned molecules have valid `monomerId` (not null)
- Edge case: Clone of a polymer with 0 molecules → returns a valid empty Polymer
- Edge case: Mutating the clone's `molecules` array does not affect the original

**Verification:**
- `cloned.id !== original.id`
- `cloned.type === original.type`
- All monomer molecules in the clone pass the invariant check (isMonomer, monomerId, monomerTemplate all set)

---

- [ ] **Unit 4: Rewrite `_divide()` with polymer cloning and daughter spawning**

**Goal:** Replace the stub `_divide()` with a real implementation that clones the parent's polymer structures, creates a structurally complete daughter `Prokaryote`, and spawns it in the environment. Also fix `environment.updateProkaryotes()` to snapshot the Map before iteration.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `src/entities/prokaryote.js`
- Modify: `src/core/environment.js` (snapshot fix for `updateProkaryotes()`)
- Modify: `index.html` (sync bundle)

**Approach:**
- **`environment.js` snapshot fix first**: `updateProkaryotes()` currently iterates `this.prokaryotes.values()` (live Map). A daughter added via `addProkaryote()` during the loop is visited in the same tick — it fires `update()` at age 0 before the parent has finished its tick. Fix: capture `Array.from(this.prokaryotes.values())` before the loop and iterate the snapshot.
- `_divide(environment)`:
  - Clone `this.membrane`, `this.nucleoid`, `this.ribosomes` arrays using `Polymer.clone()`
  - Create new Prokaryote passing arrays directly (confirm constructor signature: likely positional `new Prokaryote(membrane, nucleoid, ribosomes)` — verify before calling)
  - Set daughter `generation = this.generation + 1`
  - Set daughter `cytoplasm.atp = this.divisionThreshold * 0.3` (directional: ~45 ATP)
  - Set daughter position: parent position + random-angle offset (50–80 units using `Math.random() * 2 * Math.PI`)
  - **Remove the lump ATP deduction** (`divisionThreshold * 0.7`): tick-by-tick synthesis consumption is the full cost. Do not keep both.
  - Call `environment.addProkaryote(daughter)` to register the daughter
  - Reset parent: `this.replicationProgress = 0`, `this.replicationStage = 'idle'`, `this.divisionCooldown = this.divisionCooldownMax`
- Also update `die()` to reset `replicationProgress = 0` and `replicationStage = 'idle'` for serialization correctness.

**Patterns to follow:**
- Existing `_divide()` stub in `src/entities/prokaryote.js` for `addProkaryote` call pattern
- `updateMolecules()` snapshotting pattern in `src/core/environment.js` if one exists; otherwise use `Array.from()`

**Test scenarios:**
- Happy path: After `_divide()`, environment contains one additional Prokaryote
- Happy path: Daughter has `membrane.length === parent.membrane.length`, same for nucleoid and ribosomes
- Happy path: Daughter polymer objects have different `id` values from parent polymers (they are copies, not shared references)
- Happy path: Parent's `replicationProgress === 0` and `replicationStage === 'idle'` after division
- Happy path: Parent's `divisionCooldown === divisionCooldownMax` after division
- Edge case: Daughter spawns at a position different from the parent (not overlapping)
- Edge case: Parent retains its original polymer arrays (not emptied by division)

**Verification:**
- `environment.prokaryotes.size` increments by 1 after division
- Daughter is structurally valid: `daughter.isValid() === true`
- Parent retains its polymer components and resets replication state

---

- [ ] **Unit 5: Add synthesis visual tint to `prokaryote.render()`**

**Goal:** During the `synthesizing` state, shift the prokaryote's background gradient from its normal green toward a warm amber color as `replicationProgress` increases from 0 to 1.

**Requirements:** R7

**Dependencies:** Unit 1 (requires `replicationStage` and `replicationProgress` to exist)

**Files:**
- Modify: `src/entities/prokaryote.js`
- Modify: `index.html` (sync bundle)

**Approach:**
- In `render()`, before the `gradient.addColorStop` calls, check `this.replicationStage === 'synthesizing'`
- Interpolate gradient color stops between normal green (`rgba(200,230,200,0.7)` / `rgba(100,150,100,0.3)`) and warm amber (`rgba(255,200,100,0.7)` / `rgba(200,130,50,0.3)`) using `this.replicationProgress` as the blend factor
- **Important**: `replicationStage` must already be defined on the class (Unit 1) before this render branch is added — confirmed by Unit 1's constructor additions. Do not add the render branch before Unit 1 is complete.
- No `console.*` calls in this code path — use `Debug.log('cell', ...)` if any debugging is needed during development

**Patterns to follow:**
- Existing `render()` ATP bar color logic in `src/entities/prokaryote.js` — pattern for reading entity state to drive color

**Test scenarios:**
- Happy path: Prokaryote in `'idle'` state renders with its normal green gradient (no warm shift)
- Happy path: Prokaryote in `'synthesizing'` state with `replicationProgress = 0.5` shows a visually intermediate color (gradient partially warm)
- Happy path: Prokaryote at `replicationProgress = 1.0` (just before division) shows full amber tint
- Edge case: Tint does not appear if `replicationStage` is `'idle'` even if `replicationProgress` somehow > 0

**Verification:**
- No console errors or warnings from the render path
- Visual inspection: prokaryote with `replicationStage === 'synthesizing'` shows a warm color shift visible against the normal green

---

- [ ] **Unit 6: Playwright test for binary fission**

**Goal:** Automated test confirming that a prokaryote with sufficient ATP and ribosomes progresses through synthesis and produces a daughter cell within a reasonable tick window.

**Requirements:** All

**Dependencies:** Units 1–5

**Files:**
- Create: `tests/scenarios/t08-prokaryote-replication.spec.js`
- Modify: `index.html` (bundle must be rebuilt before running prod tests)

**Approach:**
- Use `page.evaluate` scaffolding to inject a pre-built prokaryote into the environment with: 2–3 ribosome polymers (to achieve ~667 ticks / ~11 seconds per cycle instead of ~33 seconds), `cytoplasm.atp = 200`, and `age = 200`.
- At 2 ribosomes: `replicationProgress` advances 0.001/tick → completes in ~1000 ticks (~17 seconds at 60fps). Set explicit Playwright timeout of 60 seconds for this test.
- Observe: after the simulation runs, `environment.prokaryotes.size` increases from 1 to 2
- Check: the daughter prokaryote's polymer arrays are non-empty
- Check: the parent prokaryote's `replicationProgress` resets to 0 after division
- Must click `#playPauseBtn` to start the simulation (test validity rule)
- Both `dev.html` and `index.html` must pass
- Do NOT test exact daughter position coordinates — use `daughter.position.x !== parent.position.x || daughter.position.y !== parent.position.y`

**Patterns to follow:**
- `tests/scenarios/t01-single-molecule-intent.spec.js` — spawner setup and intent completion detection pattern
- `tests/fixtures/app.js` — shared fixture for page and simulation access
- `tests/scenarios/t04-polymer-intent.spec.js` — polymer pipeline end-to-end pattern

**Test scenarios:**
- Happy path: Prokaryote with ribosomes, ample ATP, and age > 100 produces a second prokaryote within the timeout window
- Integration: Daughter prokaryote passes `isValid()` (has membrane and nucleoid)
- Integration: Parent remains alive after division (not destroyed)
- Edge case: No spurious division occurs for a prokaryote with `ribosomes.length === 0`

**Verification:**
- Test passes on both `dev.html` and `index.html` (rebuild bundle first)
- No regressions on `t01`–`t07` test suite

---

## System-Wide Impact

- **Interaction graph:** `Prokaryote.update()` → `_updateReplication()` → `_synthesize()` → `_divide()` → `environment.addProkaryote()`. The `updateProkaryotes()` loop must iterate a snapshot (`Array.from(this.prokaryotes.values())`) before calling `update()` on each cell — addressed in Unit 4.
- **Error propagation:** If `environment.addProkaryote` is absent or throws, `_divide()` should fail silently (the existing null-guard `if (environment.addProkaryote)` covers this). The parent's state should still reset even if the offspring add fails.
- **State lifecycle risks:** `replicationProgress` must be reset to 0 in all exit paths from `synthesizing` — including the `die()` path. Unit 4 adds this reset to `die()`.
- **ATP cost model resolved**: Tick-by-tick synthesis consumption is the full cost. The lump deduction in `_divide()` is removed in Unit 4. No double-charging.
- **Polymer reference sharing:** After `_divide()`, the daughter's polymer arrays must contain new objects (via `clone()`), not references to the parent's polymers. Shared references would cause dual-ownership bugs.
- **Bundle sync:** Source changes in `src/entities/prokaryote.js`, `src/entities/polymer.js`, and `src/core/environment.js` must be reflected in `index.html` via the build script before production tests run.
- **Unchanged invariants:** The existing `updateMolecules()` / `syncBonds()` / bond storage system is not affected — daughter polymers carry no live atoms and no bonds. The existing `Molecule` / `Bond` / `Atom` layer is untouched by this feature.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `updateProkaryotes()` iterates live Map — daughter updated in same tick it's born | Unit 4 adds `Array.from()` snapshot to `environment.updateProkaryotes()` |
| Monomer invariant violation: `monomerId` not copied in polymer cloning | Unit 3: copy `monomerId` directly from source molecule; do not rely on `_detectMonomerType()` to write it |
| ATP lump deduction kills parent post-division | Unit 4 explicitly removes the lump deduction; tick-by-tick consumption is the full cost |
| Ribosome-less cell enters `synthesizing` and hangs | `canStartSynthesis()` guards `ribosomes.length > 0` (Unit 1) |
| Visual tint render branch reads undefined `replicationStage` | Unit 5 depends on Unit 1; verify property exists before shipping Unit 5 |
| Playwright test timeout at ~33 seconds with 1 ribosome | Unit 6 uses 2-ribosome scaffold (~1000 ticks, ~17 seconds) with explicit 60-second timeout |
| Daughter spawns overlapping parent | Random-angle offset 50–80 units; tests check position ≠ parent, not exact coordinates |

## Documentation / Operational Notes

- After implementation, update `AGENTS.md` "Automated Testing / Scenario Coverage" table to include `t08-prokaryote-replication`
- The `_divide()` stub comment ("For simplicity, create a new prokaryote with empty components") should be removed when replaced
- Run `deno run --allow-read --allow-write --allow-run build.ts` before running `npm test` after any source file change

## Sources & References

- **Origin document:** [docs/brainstorms/2026-02-27-prokaryote-self-replication-brainstorm.md](docs/brainstorms/2026-02-27-prokaryote-self-replication-brainstorm.md)
- Related code: `src/entities/prokaryote.js` — `canDivide()`, `_divide()`, `update()`
- Related code: `src/entities/polymer.js` — `serialize()` (cloning reference)
- Related code: `src/core/environment.js` — `addProkaryote()`, `updateProkaryotes()`
- Institutional: `docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`
- Institutional: `docs/solutions/performance-issues/2026-02-28-code-review-6-findings-hotpath-alloc-style-testaccess.md`
