---
status: complete
priority: p2
issue_id: "043"
tags: [code-review, yagni, dead-code]
dependencies: []
---

# Dead code: getTemperatureAt() and Intention.localTemperature

## Problem Statement

`Thermodynamics.getTemperatureAt(x, y)` is defined but never called. `Intention.localTemperature` is initialized to `null` and never set to any non-null value. This is speculative infrastructure for a feature that doesn't exist yet — textbook YAGNI.

## Findings

- **Source: Simplicity + Pattern + Architecture agents**
- `src/systems/thermodynamics.js` lines 41-56: `getTemperatureAt()` — 0 callers
- `src/entities/intention.js` line 34: `localTemperature = null` — never written
- `tryBreakThermalBonds()` uses `this.temperature` (global), not positional temperature

## Proposed Solutions

### Option A: Remove both (Recommended)
- **Effort:** Small
- **Risk:** None — code has zero consumers
- **Pros:** Reduces dead code, simplifies Thermodynamics class further

### Option B: Keep with YAGNI comment
- **Effort:** Trivial
- **Risk:** Dead code that might mislead developers
- **Pros:** Ready if local temperature zones are needed later

## Acceptance Criteria

- [ ] `getTemperatureAt` removed from Thermodynamics
- [ ] `localTemperature` removed from Intention constructor
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from code review | 3 agents independently flagged this |
