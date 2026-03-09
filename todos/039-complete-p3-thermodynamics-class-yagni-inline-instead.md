---
status: complete
priority: p3
issue_id: "039"
tags: [code-review, thermodynamics, simplicity, architecture]
dependencies: []
---

# `Thermodynamics` class is YAGNI — 3 arithmetic methods can be inlined (saves ~35 LOC + 1 new file)

## Problem Statement

The plan creates a new `Thermodynamics` class with 3 utility methods, `serialize()`/`deserialize()`, `this.id`, and `this.active` — following the `AtomSpawner` pattern. But `AtomSpawner` is stateful (15+ properties, `update()` loop, visual rendering). `Thermodynamics` is stateless utility. The class wraps simple arithmetic expressions, persists a single boolean that has no use case, and generates an ID for an object that no Map ever indexes. All three methods can be inlined at their two call sites.

## Findings

- **`getStabilityScore(sym1, sym2, order)`**: `getBondEnergy(s1, s2, o) / MAX_BOND_ENERGY` — one line of arithmetic
- **`getFormationFactor(sym1, sym2, temp)`**: `Math.min(1, getStabilityScore(s1,s2,1) * (temp/298))` — two lines
- **`getTemperatureAt(x, y)`**: 3-line for loop over intentions — used only in `tryBreakThermalBonds()` and `tryFormBonds()`
- **`this.id`**: `Utils.generateId()` — nothing indexes `Thermodynamics` by ID (confirmed: no Map in codebase stores it)
- **`this.active`**: The only consumer is `getFormationFactor()` which returns `0.3` if `!this.active`. No UI to set `active = false`. No test. No use case. Phase 6 already has a null-guard `this.thermodynamics ? ... : 0.3` that achieves the same fallback.
- **`serialize()` / `deserialize()`**: Persists only `{ active: this.active }`. The `active` flag has no use case (see above). Persisting it is YAGNI.
- **Code cost of the class**: new file, `<script>` tag in dev.html, entry in build.ts, double-wiring in main.js, serialize/deserialize maintenance. ~35 LOC total overhead for 3 arithmetic expressions.

## Proposed Solutions

### Option 1: Delete `Thermodynamics` class; inline the 3 methods (Recommended)

Replace the class with inline logic:

In `environment.js` / `tryFormBonds()` (replaces `getFormationFactor`):
```javascript
// Inline stability + thermal factor
const stability = Math.min(1, getBondEnergy(sym1, sym2, 1) / MAX_BOND_ENERGY);
const thermalFactor = Math.min(1, stability * (this.temperature / 298));
if (Math.random() < prob * thermalFactor) { ... }
```

In `environment.js` / `tryBreakThermalBonds()` (replaces `getTemperatureAt` + break check):
```javascript
// Local temperature: check intention zones directly (3 lines)
let temp = this.temperature;
for (const intention of this.intentions.values()) {
    if (intention.localTemperature == null || intention.fulfilled) continue;
    if (!Number.isFinite(intention.localTemperature)) continue;
    const dx = x - intention.position.x;
    // ... squared distance check
}
```

**LOC saved:** ~35 lines, 1 file, 1 `<script>` tag, 1 build.ts entry, 2 lines in main.js

**Pros:** Fewer files, no new indirection, no YAGNI serialize/deserialize
**Cons:** `tryBreakThermalBonds()` gets slightly longer; extraction is less reusable if the pattern recurs
**Effort:** 30 minutes
**Risk:** Low

---

### Option 2: Keep the class but remove YAGNI elements

Remove: `this.id`, `this.active`, `serialize()`, `deserialize()`. Keep: the 3 methods and the class structure.

**Pros:** Class structure is preserved for future expansion; methods are named and documented
**Cons:** Still adds a file/script/build entry for 3 arithmetic methods; `App.this.thermodynamics` still a dangling reference
**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

This is a judgment call. The plan's "Simplicity Note" already acknowledges both options as valid. Either approach satisfies the acceptance criteria. **Recommend Option 2 as minimum** (remove `this.id`, `this.active`, serialize/deserialize) if the team prefers keeping the class. **Option 1 if minimalism is the priority.**

The non-negotiable removals regardless of choice:
- `this.id = Utils.generateId()` — remove
- `this.active` — remove
- `serialize()`/`deserialize()` — remove
- `App.this.thermodynamics` reference in main.js — replace with single `environment.thermodynamics = new Thermodynamics(environment)`

## Technical Details

**Files this avoids creating (Option 1):**
- `src/systems/thermodynamics.js` (new file, ~35 LOC)

**Files reduced (both options):**
- `dev.html` — remove 1 `<script>` tag
- `build.ts` — remove 1 entry
- `src/main.js` — remove 2 lines of wiring (replace with 1)

## Acceptance Criteria

- [ ] `this.id` removed from `Thermodynamics` (if class kept) or class deleted entirely
- [ ] `this.active` and `serialize()`/`deserialize()` removed
- [ ] `App.this.thermodynamics` dangling reference removed
- [ ] Thermal formation factor and local temperature still work correctly

## Work Log

### 2026-03-01 - Identified by Code Simplicity Reviewer + Pattern Recognition Specialist + Architecture Strategist

**By:** Code review agents (technical_review workflow)

---

### 2026-03-01 - Resolved (Option 2: keep class, remove YAGNI)

**By:** Claude Code

**Actions:**
- Removed `this.id = Utils.generateId()` from constructor
- Removed `this.active = true` from constructor
- Removed `if (!this.active) return 0.3` guard from `getFormationFactor()`
- Removed `serialize()` and `deserialize()` methods entirely
- Replaced "Follow the AtomSpawner pattern exactly" with accurate description of stateless utility
- Added YAGNI cleanup note explaining why each removal was made
- Class structure kept for named method semantics (Option 2)

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 5, Phase 10
- **Brainstorm Simplicity Note:** Already acknowledged as valid option
