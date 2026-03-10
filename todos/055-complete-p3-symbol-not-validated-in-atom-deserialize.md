---
status: complete
priority: p3
issue_id: "055"
tags: [code-review, security, deserialization]
dependencies: []
---

# atom.symbol not validated against known elements in Atom.deserialize()

## Problem Statement

`Atom.deserialize()` validates numeric fields (`x`, `y`, `vx`, `vy`, `charge`) but does not validate `data.symbol`:

```javascript
static deserialize(data) {
    const x = Number.isFinite(data.x) ? data.x : 0;
    const y = Number.isFinite(data.y) ? data.y : 0;
    const atom = new Atom(data.symbol, x, y);  // ← symbol not validated
    ...
}
```

`new Atom(symbol, x, y)` passes `symbol` directly to `ELEMENTS[symbol]` lookup. If `symbol` is unknown (e.g., `"Xx"`, `null`, or `"<script>"`), `ELEMENTS[symbol]` returns `undefined`, which causes downstream code reading `atom.element.number`, `atom.element.name`, etc. to throw `TypeError: Cannot read properties of undefined`.

In practice this is a low-risk issue (save files come from IndexedDB, not external sources), but it is inconsistent with the numeric validation just added to the same method.

**Impact:** Corrupted/crafted save file → silent atom creation with `undefined` element → `TypeError` somewhere in the render loop → simulation crashes. The `Atom` constructor itself does not guard against unknown symbols.

## Findings

- **Source: Independent analysis (security sentinel hit rate limit)**
- `src/entities/atom.js` line 351: `new Atom(data.symbol, x, y)` — symbol passed without validation
- `src/data/periodic-table.js`: `ELEMENTS` object defines valid symbols
- `window.ELEMENTS` is accessible — could be used for validation

## Proposed Solutions

### Option A: Validate symbol against ELEMENTS table (Recommended)
```javascript
static deserialize(data) {
    const symbol = (typeof data.symbol === 'string' && window.ELEMENTS?.[data.symbol])
        ? data.symbol : 'H';  // fallback to hydrogen on invalid symbol
    const x = Number.isFinite(data.x) ? data.x : 0;
    const y = Number.isFinite(data.y) ? data.y : 0;
    const atom = new Atom(symbol, x, y);
    ...
}
```
- **Effort:** Small (2-line change)
- **Pros:** Consistent with numeric validation; prevents TypeError on bad data
- **Cons:** Silent fallback to H may be surprising

### Option B: Guard in Atom constructor
```javascript
constructor(symbol, x, y) {
    this.element = ELEMENTS[symbol];
    if (!this.element) throw new Error(`Unknown element symbol: ${symbol}`);
    ...
}
```
- **Pros:** Fails fast at construction; catches all creation paths
- **Cons:** Breaking change for existing code that may create atoms with dynamic symbols

### Option C: Leave as-is (low real-world risk)
- Save files come from `environment.serialize()` which only writes valid symbols
- **Cons:** Inconsistent with validation just added; bad data still crashes renderer

## Acceptance Criteria

- [ ] `Atom.deserialize()` with an unknown symbol does not throw TypeError
- [ ] Invalid symbols either fallback or produce a clear error message
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review (independent analysis) | Consistent with the pr2 deserialization validation theme |
