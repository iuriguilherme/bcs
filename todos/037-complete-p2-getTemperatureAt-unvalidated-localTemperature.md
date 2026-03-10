---
status: complete
priority: p2
issue_id: "037"
tags: [code-review, thermodynamics, security, architecture]
dependencies: []
---

# `getTemperatureAt()` returns unvalidated `localTemperature` from deserialized blueprints — NaN/Infinity propagates silently

## Problem Statement

The plan's `Thermodynamics.getTemperatureAt()` returns `intention.localTemperature` without validating it's a finite number. Blueprints are deserialized from IndexedDB via `Object.assign()` with no field validation. A crafted save file or catalogue import can set `localTemperature` to `Infinity`, `NaN`, `-1`, or any value. `Math.exp(-stability / NaN)` returns `NaN`, which propagates silently through all thermal calculations that tick, disabling the entire thermal system without any error.

## Findings

- `getTemperatureAt()` plan code: returns `intention.localTemperature` with only `== null` and `intention.fulfilled` guards — no numeric validation
- Blueprint deserialization in `src/catalogue/blueprint.js:157`: `Object.assign(Object.create(MoleculeBlueprint.prototype), data)` — bulk assign, no field validation
- `Catalogue.import()` at `catalogue.js:506`: `JSON.parse` of user-provided file → `MoleculeBlueprint.deserialize()` — user-controlled data
- If `localTemperature = Infinity`: `temp / 298 = Infinity`, `Math.min(1, stability × Infinity) = 1`, formation factor = 1 for all bonds (maxed out)
- If `localTemperature = NaN`: `Math.exp(-E / NaN) = NaN`, which propagates to `pBreak = NaN`, `Math.random() < NaN = false` — bonds never break (thermal system silently disabled)
- If `localTemperature = -1`: negative temperature produces `Math.min(1, -1/298) = -0.003`, negative probability — `Math.random() < -0.003` always false

## Proposed Solutions

### Option 1: Validate in `getTemperatureAt()` before returning (Recommended)

```javascript
getTemperatureAt(x, y) {
    for (const intention of this.environment.intentions.values()) {
        if (intention.localTemperature == null) continue;
        if (intention.fulfilled) continue;
        // Validate before using: must be a finite number in valid range
        const localTemp = intention.localTemperature;
        if (!Number.isFinite(localTemp) || localTemp < 1 || localTemp > 600) continue;
        const dx = x - intention.position.x;
        const dy = y - intention.position.y;
        if (dx * dx + dy * dy <= intention.radius * intention.radius) {
            return localTemp;
        }
    }
    return this.environment.temperature;
}
```

**Pros:** Single validation point; minimal change; falls back to global temp on invalid data
**Cons:** Silently skips invalid temperatures (no error logging in hot path per project rules)
**Effort:** 15 minutes
**Risk:** Low

---

### Option 2: Validate when `localTemperature` is set, not when read

Add a setter or validation in `Intention` constructor/when blueprints assign local temperature.

**Pros:** Fails fast at assignment time rather than silently skipping
**Cons:** More invasive; `localTemperature` is set in multiple places; doesn't protect against existing IndexedDB data
**Effort:** 45 minutes
**Risk:** Medium

## Recommended Action

Option 1 — add the range guard in `getTemperatureAt()`. Update Phase 5 in the plan to include the validation. This is a small, targeted fix.

## Technical Details

**Affected files:**
- `src/systems/thermodynamics.js` — `getTemperatureAt()` (Phase 5)
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 5 code example

## Acceptance Criteria

- [ ] `getTemperatureAt()` validates `localTemperature` is `Number.isFinite(v) && v >= 1 && v <= 600`
- [ ] Invalid `localTemperature` falls back to `environment.temperature` (not `null`, not `NaN`)
- [ ] Confirmed no `console.warn` or `console.log` in the validation (hot path constraint)

## Work Log

### 2026-03-01 - Identified by Security Sentinel

**By:** Security Sentinel review agent

---

### 2026-03-01 - Resolved

**By:** Claude Code

**Actions:**
- Added `Number.isFinite(localTemp) && localTemp >= 1 && localTemp <= 600` guard to `getTemperatureAt()` in Phase 5
- Invalid `localTemperature` values (NaN, Infinity, negative) are silently skipped — falls back to global temperature
- No console.warn in hot path (per project performance rules)

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 5
- **Source:** `src/catalogue/blueprint.js:157` — `Object.assign` deserialization
- **Source:** `src/catalogue/catalogue.js:506` — `Catalogue.import()`
