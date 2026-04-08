---
title: "PR #5 Thermodynamics: Physics Calibration Issues & Dead Code"
date: 2026-03-19
tags: [thermodynamics, physics-calibration, dead-code, serialization, testing, monte-carlo]
symptoms:
  - "CO triple bond forms correctly but all other bonds dissolve instantly at room temperature"
  - "Temperature slider exists in UI but position resets on save/load"
  - "placeCOIntent test helper defined inline rather than in shared fixtures"
  - "pressure field loaded without validation unlike temperature/width/height"
components: [bond.js, environment.js, intention.js]
category: physics-issues
pr: "5"
status: documented
---

# PR #5 Thermodynamics: Physics Calibration Issues & Dead Code

## Problem Symptoms

PR #5 added temperature-dependent bond stability — a `Thermodynamics` class, a `shouldBreakThermal()` method on bonds, and a temperature slider UI. The feature works for its test (CO triple bond formation at high stability), but ships with a cluster of related issues:

1. **Room-temperature dissolution**: At 298 K (default), C-H bonds have a 61.5% break probability per 6-tick sweep — CH₄ would dissolve in ~0.16 s at room temperature.
2. **Dead code**: `Thermodynamics.getTemperatureAt(x, y)` and `Intention.localTemperature` implement a local temperature zone system that is never called anywhere.
3. **Missing clamp**: `bond.stabilityScore` returns `this.strength / MAX_BOND_ENERGY` without `Math.min(1, ...)`, unlike its counterpart `Thermodynamics.getStabilityScore()`.
4. **Duplicated constants**: The value `298` (room temperature K) appears in both `bond.js` and `thermodynamics.js`; `0.85` (overvalence stability threshold) appears twice in `intention.js`.
5. **Serialization gap**: `pressure` is loaded raw (`this.pressure = data.pressure`) while `temperature`, `width`, and `height` all have `Number.isFinite` guards.
6. **UI sync**: The temperature slider position is not restored from saved state — `environment.temperature` is loaded but the slider thumb stays at its default visual position.
7. **Test coverage**: T09 exercises CO triple bond formation (overvalence path) but never calls `tryBreakThermalBonds()` or tests the effect of a non-default temperature on any bond.
8. **Fixture organisation**: `placeCOIntent` is defined inline in `t09-thermo-co-triple-bond.spec.js` instead of `tests/fixtures/app.js` where the analogous `placeEthyleneIntent` lives.

---

## Root Cause Analysis

### Physics calibration (issue 037)

The break formula `P(break) = (1 - stability) × min(1, temp/298)` is linear with no floor. At exactly 298 K the factor `min(1, 298/298) = 1.0`, so the probability equals `(1 - stability)` — for C-H (stability = 0.385) that is 0.615 per check.

`tryBreakThermalBonds()` runs every 6 ticks. At 60 fps that is 10 checks per second. Expected bond lifetime = `1 / (0.615 × 10) ≈ 0.16 s`.

Real chemistry uses activation energy — an Arrhenius / Boltzmann model (`exp(-Ea/kT)`) produces near-zero break rates for strong bonds at room temperature. The linear model has no concept of an activation barrier.

### Dead code (issue 032)

`Thermodynamics.getTemperatureAt(x, y)` returns a localised temperature influenced by heat sources / sinks, and `Intention.localTemperature` was meant to hold this value for molecules in a zone. Neither is wired up: `getTemperatureAt` has zero call sites in the codebase. The temperature field is added to `Intention` objects but is never written or read by any physics code.

### Missing stabilityScore clamp (issue 033)

```js
// bond.js — missing clamp
get stabilityScore() { return this.strength / MAX_BOND_ENERGY; }

// thermodynamics.js — correct
static getStabilityScore(bondEnergy) { return Math.min(1, bondEnergy / MAX_BOND_ENERGY); }
```

If `bond.strength` ever exceeds `MAX_BOND_ENERGY` (e.g. after a future bond-reinforcement mechanic), `stabilityScore > 1` would cause `shouldBreakThermal` to return a negative probability — `Math.random()` would never satisfy it, making the bond permanently immune even when it shouldn't be.

### Serialization gap (issue 039)

`environment.deserialize()` is defensive for `temperature`, `width`, and `height`:

```js
const rawTemp = data.temperature;
if (Number.isFinite(rawTemp) && rawTemp >= 1 && rawTemp <= 600) {
    this.temperature = rawTemp;
} else {
    this.temperature = 300;
}
```

But pressure is loaded raw:

```js
this.pressure = data.pressure; // undefined, NaN, Infinity, "1 atm" all silently accepted
```

---

## Working Solutions

### Fix 1: Recalibrate shouldBreakThermal (issue 037 — P2)

**Option A — Stability floor** (simplest, recommended for now):
```js
// bond.js
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    if (stability >= 0.5) return false;   // stable bonds immune at room temp
    const pBreak = (1 - stability * 2) * Math.min(1, temperature / 298);
    return Math.random() < pBreak;
}
```

**Option B — Temperature-threshold formula** (more physically realistic):
```js
shouldBreakThermal(temperature) {
    const stability = this.stabilityScore;
    const breakTemp = stability * 600;     // CO breaks at 600 K, O-O at ~82 K
    if (temperature < breakTemp) return false;
    const pBreak = (1 - stability) * Math.min(1, (temperature - breakTemp) / 300);
    return Math.random() < pBreak;
}
```

**Option C — Rate constant multiplier** (trivial, keeps formula shape):
```js
const THERMAL_BREAK_RATE = 0.001;
const pBreak = THERMAL_BREAK_RATE * (1 - stability) * Math.min(1, temperature / 298);
```

### Fix 2: Clamp stabilityScore (issue 033 — P2)

```js
// bond.js
get stabilityScore() {
    return Math.min(1, this.strength / MAX_BOND_ENERGY);
}
```

### Fix 3: Add pressure deserialization guard (issue 039 — P3)

```js
// environment.js — deserialize()
const rawPressure = data.pressure;
this.pressure = (Number.isFinite(rawPressure) && rawPressure > 0 && rawPressure <= 100)
    ? rawPressure
    : 1;
```

### Fix 4: Extract duplicated constants (issues 034, 036 — P3)

```js
// periodic-table.js (or a new constants.js)
export const ROOM_TEMPERATURE_K = 298;
export const OVERVALENCE_STABILITY_THRESHOLD = 0.85;
```

Replace all `298` references in `bond.js` and `thermodynamics.js`, and both `> 0.85` checks in `_rule6_bondClaimed`.

### Fix 5: Move placeCOIntent to fixtures (issue 040 — P3)

```js
// tests/fixtures/app.js
// Test scaffolding analogous to setting atomSpawner.zone — places a CO
// molecule intention at world coordinates without going through the UI.
export async function placeCOIntent(page, worldX, worldY) {
    await page.evaluate(([wx, wy]) => {
        const blueprint = { /* existing implementation */ };
        const intent = new window.Intention(blueprint);
        window.cellApp.environment.addIntention(intent, wx, wy);
    }, [worldX, worldY]);
}
```

Then import it in `t09-thermo-co-triple-bond.spec.js`.

### Fix 6: Sync temperature slider on state load (issue 035 — P3)

After `environment.deserialize()` sets `this.temperature`, dispatch a synthetic input event or call the slider update function so the visual thumb position matches:

```js
// ui/controls.js (or wherever the slider listener lives)
function syncTemperatureSlider(value) {
    const slider = document.querySelector('#temperatureSlider');
    if (slider) {
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
    }
}
// Call after deserialize:
syncTemperatureSlider(environment.temperature);
```

### Fix 7: Add thermal breaking test (issue 038 — P2)

Create `tests/scenarios/t10-thermo-thermal-breaking.spec.js`:

1. Spawn O and O atoms (O-O stability = 0.136 — lowest common bond)
2. Click play, wait for O₂ formation
3. Set temperature to 500 K via slider
4. Assert bond count decreases within a timeout
5. Verify `window.cellApp.environment.temperature === 500` (slider ↔ physics sync)
6. Lower to 298 K, assert bond stability returns

### Address dead code (issue 032 — P2)

Either:
- **Remove** `getTemperatureAt()` and `Intention.localTemperature` (clean slate)
- **Wire up** the local temperature system: assign `intent.localTemperature = this.thermodynamics.getTemperatureAt(intent.x, intent.y)` in `tryFormBonds()` and use it instead of `this.temperature` in bond stability calculations

---

## Todo References

Each finding has a corresponding todo file in `todos/`:

| Todo ID | Priority | Description |
|---------|----------|-------------|
| 032 | P2 | `localTemperature` zones not wired into physics |
| 033 | P2 | `bond.stabilityScore` missing `Math.min(1, ...)` clamp |
| 034 | P3 | Magic `298` room-temperature constant duplicated |
| 035 | P3 | Temperature slider UI not synced on state load |
| 036 | P3 | Overvalence threshold `0.85` duplicated in `_rule6_bondClaimed` |
| 037 | P2 | `shouldBreakThermal` break probability too high at room temp |
| 038 | P2 | T09 never tests thermal bond breaking |
| 039 | P3 | `pressure` field missing deserialization validation |
| 040 | P3 | `placeCOIntent` should be in `tests/fixtures/app.js` |

---

## Prevention Strategies

### 1. Preventing feature scaffolds from shipping without wiring

Every new method or property introduced in a PR must appear in at least one of: a call site in production code, a test assertion that exercises it end-to-end, or an explicit `// NOT YET WIRED: tracked in #issue` comment. Undocumented dead code is not acceptable.

PR authors must include a **wiring audit** section in the PR description: list every new public method/property and where it is called. Reviewers should reject PRs where this section is absent or where listed call sites do not exist.

For partial implementations, use a `TODO_UNWIRED` comment convention that CI can grep for. Any `TODO_UNWIRED` present in the diff must be paired with a linked issue in the PR description. Feature flags are preferable to silent dead code — if a feature cannot be fully wired in one PR, gate it with a flag that is off by default and tested in its off state.

**Test that would have caught the dead code in PR #5:**

```js
// T_TEMP_ZONE: localTemperature override is actually applied
test('intention zone overrides global temperature', async ({ devPage }) => {
  // Place an intention zone with localTemperature set
  // Verify getTemperatureAt() returns the zone value, not the global
  // Verify bond-breaking probability differs from the global-temp baseline
});
```

### 2. Physics formula calibration checklist

**Root cause:** `shouldBreakThermal` produces break probabilities of 61–86% per check at 298K. Tests passed because they checked structure, not magnitude.

Before merging any physics formula:

- State the physical meaning of every term and constant in a comment adjacent to the formula.
- State the expected output range at gameplay-relevant input values. For thermodynamics: *"at 298K with a standard C-C bond, break probability per tick must be < 1%."*
- Include a unit-level test that asserts output **magnitude** at known inputs, not just structural correctness.
- For probability-generating formulas, assert both the floor (should not be negative) and ceiling (should not approach 1.0 at benign conditions).
- Document the sweep interval alongside the formula — `P(break per tick)` is sweep-frequency-sensitive. If `tryBreakThermalBonds()` is ever moved to a different tick interval, calibrated probabilities silently become wrong.

**Calibration test template:**

```js
test('shouldBreakThermal: break rate is negligible at room temperature for stable bonds', () => {
  const stableScore = 1.0;
  const roomTemp = 298; // K
  const trials = 10000;
  let breaks = 0;
  for (let i = 0; i < trials; i++) {
    if (shouldBreakThermal(stableScore, roomTemp)) breaks++;
  }
  expect(breaks / trials).toBeLessThan(0.01); // < 1% per check at 298K
});

test('shouldBreakThermal: break rate is substantial at extreme heat for weak bonds', () => {
  const weakScore = 0.1;
  const extremeTemp = 500; // K
  const rate = /* run trials */;
  expect(rate).toBeGreaterThan(0.05);
  expect(rate).toBeLessThan(0.95);
});
```

### 3. Maintaining consistent defensive patterns

When introducing validation or clamping for one property (e.g. `temperature`), immediately audit all sibling properties of the same type and apply equivalent guards. Document the decision if a sibling intentionally omits the guard.

Clamp and validate at the boundary where data enters the system (construction or setter), not deep in consumers. When a helper function applies defensive logic (e.g. `getStabilityScore()` clamps), do not allow callers to bypass it by reading the underlying property directly — either make the raw property private or document that direct access is unsafe.

Include a **cross-property consistency review** in the PR checklist: *"For every new validated/clamped property, list all parallel properties and confirm their guard status."*

Consider extracting a helper to make the pattern impossible to omit:

```js
// utils.js
export function deserializeNumeric(value, min, max, fallback) {
    return (Number.isFinite(value) && value >= min && value <= max) ? value : fallback;
}
```

### 4. Naming conventions for physics constants

All numeric literals with physical meaning must be named constants, defined at the module level in a dedicated constants block or file — not inline.

**Naming pattern:** `UNIT_MEANING` — e.g. `KELVIN_ROOM_TEMPERATURE`, `BOND_STABILITY_BASELINE_FACTOR`. Avoid generic names like `BASE_TEMP` or `FACTOR`.

If a constant appears in more than one location, it must be defined exactly once and imported. Duplication of a magic number is a hard reject.

Separate physics constants from gameplay tuning values:

```js
// Physics constants — do not adjust without recalibrating shouldBreakThermal tests
const KELVIN_ROOM_TEMPERATURE = 298; // Standard ambient, NIST reference

// Tuning constants — adjust for game feel
const OVERVALENCE_STABILITY_THRESHOLD = 0.85; // Bonds above this may exceed valence limits
```

A grep for bare numeric literals in physics modules (excluding `0`, `1`, and array indices) should produce zero results. This can be implemented as a lint rule or a test preamble check.

### 5. Test coverage verification

Test naming must reflect what is actually asserted, not what the feature is called. A test named "thermo" that does not assert thermal break behavior is mislabeled and must be renamed or supplemented.

For every new mechanism introduced in a PR, require a test that directly exercises the mechanism's **primary output** — not a downstream structural check, but a direct assertion on the mechanism. For thermal breaking: assert that bonds actually break at elevated temperature.

Use a **coverage mapping comment** at the top of each spec file:

```js
/**
 * Thermodynamics system coverage map:
 *   getStabilityScore()           — t09-stability
 *   shouldBreakThermal()          — t09-break-rate, t09-room-temp-baseline
 *   getTemperatureAt()            — t09-zone-override   ← MISSING before this PR
 *   integration: bond breaks sim  — t09-e2e-bond-break  ← MISSING before this PR
 */
```

**Specific missing tests for PR #5:**

```js
test('bonds break at high temperature in running simulation', async ({ page }) => {
  // spawn atoms, form a bond, raise temperature, run simulation
  // assert bond count decreases
});

test('bonds are stable at room temperature in running simulation', async ({ page }) => {
  // same setup at 298K — assert bond count remains stable over N ticks
});
```

### 6. Test fixture organisation

Any helper that creates a named molecule or intent (e.g. `placeCOIntent`, `placeEthyleneIntent`) belongs in `tests/fixtures/`. Inline definition is acceptable only for one-off shapes used in exactly one test with no reuse potential — and even then, a comment must state *"not shared by design."*

When a PR adds a new scenario, the reviewer should ask: *"Does this scenario define any helper that a future scenario will likely need?"* If yes, require it to be extracted to fixtures before merge.

**Rule of thumb:** If a helper is named after a real domain object (molecule, bond, intent), it is always a fixture candidate regardless of current usage count.

```js
// ✅ Acceptable — tests/fixtures/app.js
// Test scaffolding analogous to setting atomSpawner.zone
export async function placeCOIntent(page, worldX, worldY) { ... }

// ❌ Not acceptable — inline in t09.spec.js
const placeCOIntent = async (page, worldX, worldY) => { ... };
```

### Minimum PR gates these strategies imply

| Category | Gate |
|---|---|
| Wiring | Every new public symbol has a call site or a `TODO_UNWIRED` + linked issue |
| Physics calibration | Magnitude assertion at known inputs, floor and ceiling checked |
| Defensive patterns | Sibling-property audit table in PR description |
| Constants | Zero bare numeric literals in physics modules (grep/lint enforced) |
| Coverage | Coverage map comment in spec file; primary mechanism has direct test |
| Fixtures | No domain-named helpers defined inline in scenario files |

---

## Related Solutions

- `docs/solutions/logic-errors/dead-code-review-environment-intention-stale-bundle.md` — prior dead code removal patterns from PR #6 review
- `docs/solutions/physics-issues/` — this directory for future thermodynamics calibration issues

---

## Work Log

- **2026-03-09**: Issues 037 (shouldBreakThermal inverted formula) and 033 (stabilityScore missing clamp) resolved in a same-session fix; `src/systems/thermodynamics.js` deleted; logic inlined into `environment.js` and `bond.js`. See `docs/solutions/logic-errors/thermodynamics-shouldBreakThermal-inverted-formula-298K-floor.md` for the detailed fix.
- **2026-03-19**: PR #5 merged. Issues identified by parallel review agents (performance-oracle, security-sentinel, architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer, agent-native-reviewer) during `/workflows:review`. Nine todo items created (032–040). This solution document assembled via `/workflows:compound`.
