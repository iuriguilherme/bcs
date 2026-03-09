---
status: complete
priority: p2
issue_id: "044"
tags: [code-review, security, deserialization]
dependencies: []
---

# Atom.deserialize() does not validate numeric fields

## Problem Statement

`Atom.deserialize()` accepts `data.x`, `data.y`, `data.vx`, `data.vy` without `Number.isFinite()` guards. A crafted save file could supply `NaN` or `Infinity`, breaking the spatial grid (`Math.floor(NaN/100)` → key `"NaN,NaN"`) or causing extreme coordinate ranges.

The PR correctly validates `width`, `height`, `temperature` in `Environment.deserialize()` but the per-atom deserialization has the same vulnerability.

## Findings

- **Source: Security Sentinel agent**
- `src/entities/atom.js` lines 350-358: No numeric validation
- `src/core/environment.js` lines 1012-1023: Shows the correct validation pattern

## Proposed Solutions

### Option A: Add Number.isFinite guards with defaults (Recommended)
- **Effort:** Small
- **Risk:** None

```javascript
static deserialize(data) {
    const x = Number.isFinite(data.x) ? data.x : 0;
    const y = Number.isFinite(data.y) ? data.y : 0;
    const atom = new Atom(data.symbol, x, y);
    atom.id = data.id;
    const vx = Number.isFinite(data.vx) ? data.vx : 0;
    const vy = Number.isFinite(data.vy) ? data.vy : 0;
    atom.velocity = new Vector2(vx, vy);
    atom.charge = Number.isFinite(data.charge) ? data.charge : 0;
    // ...
}
```

## Acceptance Criteria

- [ ] All numeric fields in Atom.deserialize validated with Number.isFinite
- [ ] Corrupted atoms default to (0,0) position rather than NaN
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from code review | Security agent found this |
