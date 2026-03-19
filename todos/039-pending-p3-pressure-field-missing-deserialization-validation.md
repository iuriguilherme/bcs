---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, serialization, defensive-coding, consistency]
---

# `pressure` field missing deserialization validation — inconsistent with temp/width/height

## Problem Statement

`environment.deserialize()` validates `width`, `height`, and `temperature` with explicit guards. But `pressure` is loaded without any validation:

```js
// environment.js:1025
this.pressure = data.pressure;  // raw, unvalidated
```

The three validated fields use the same pattern:
```js
const rawTemp = data.temperature;
if (Number.isFinite(rawTemp) && rawTemp >= 1 && rawTemp <= 600) {
    this.temperature = rawTemp;
} else {
    this.temperature = 300;
}
```

A corrupted save with `"pressure": NaN`, `"pressure": Infinity`, or `"pressure": "1 atm"` would silently assign that value. Currently `pressure` is unused in any physics calculations so the practical impact is zero — but the inconsistency is visually jarring and creates a false sense that the serialization format is fully validated.

## Proposed Solution

Apply the same guard pattern used for temperature:
```js
const rawPressure = data.pressure;
this.pressure = (Number.isFinite(rawPressure) && rawPressure > 0 && rawPressure <= 100)
    ? rawPressure
    : 1;
```

**Effort**: Trivial | **Risk**: None

## Acceptance Criteria

- [ ] `pressure` uses same validation pattern as `temperature` in `deserialize()`
- [ ] All existing tests pass

## Work Log

- 2026-03-19: Identified by security-sentinel and pattern-recognition-specialist during PR #5 review
