---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, quality, dead-code]
dependencies: []
---

# Dead code from underscore-prefix lint fixes: `_totalNeeded`, `_icons`, `_worldPos`, `_reqType`

## Problem Statement

The lint fix pass renamed several unused variables with underscore prefixes, but in 4 cases the fix was incomplete: the variables should have been **deleted**, not prefixed. Three create dead code; one (`_totalNeeded`) silently reads the wrong property name from a destructured object.

The underscore convention (`_x`) means "I know this is unused." But for **local variables** (not function parameters), "I know this is unused" equals "I should delete this." The correct use of underscore prefix is for function *parameters* you cannot remove because of a required signature.

## Findings

### 1. `_totalNeeded` — reads wrong property name (most important)
**File**: `src/entities/intention.js`, line 544
```javascript
const { targetComp, seedMol, claimed, _totalNeeded } = state;
```
JavaScript destructuring `{ _totalNeeded }` reads the property `_totalNeeded` from `state`, which does not exist (the property is named `totalNeeded`). Result: `_totalNeeded === undefined` always. Since `_totalNeeded` is never used in the function body, this is functionally harmless — but it is semantically wrong and creates a false impression of a guard. The correct fix is to remove it from the destructure entirely.

**Correct destructure:** `const { targetComp, seedMol, claimed } = state;`

### 2. `_icons` — dead object created every render frame
**File**: `src/entities/intention.js`, line 1736
```javascript
const _icons = { molecule: '&#9883;', polymer: '&#128279;', cell: '&#9678;' };
ctx.fillText(this.type === 'molecule' ? 'M' : this.type === 'polymer' ? 'P' : 'C', screenX, screenY);
```
The `_icons` object is built, assigned, and never read. The `fillText` call below uses an inline ternary with no reference to `_icons`. This object is allocated and GC'd on every canvas render call. Delete the line.

### 3. `_worldPos` — wasted `screenToWorld` computation
**File**: `src/viewer/controls.js`, line 419
```javascript
const _worldPos = this.viewer.screenToWorld(screenX, screenY);
const scale = this.viewer.camera.zoom;
const offset = this.viewer.getOffset();
```
`_worldPos` is never used. The `containsPoint` calls below use `screenX, screenY, scale, offset` directly. `screenToWorld` is a mathematical computation (not expensive, but pointless). Delete the line.

### 4. `_reqType` — dead string assignment
**File**: `src/viewer/controls.js`, line 643
```javascript
const reqCount = requirements?.count || '?';
const _reqType = requirements?.type || 'components';
```
`_reqType` is never used. The code below accesses `requirements?.type` directly. Delete the line.

## Proposed Solutions

### Option A: Delete all four items (Recommended)
**Pros**: Correct. Removes dead code entirely. No hiding behind underscore.
**Cons**: None.
**Effort**: Small (4 line edits)
**Risk**: None

Changes:
1. `intention.js:544` → `const { targetComp, seedMol, claimed } = state;`
2. `intention.js:1736` → delete line entirely
3. `controls.js:419` → delete line entirely
4. `controls.js:643` → delete line entirely

### Option B: Keep underscore prefix (Current state)
**Pros**: Lint passes.
**Cons**: Misleading code. `_totalNeeded` reads wrong property. `_icons` allocates every frame.
**Effort**: None

## Recommended Action

Option A — delete all four. Run linter to confirm no regressions.

## Technical Details

**Affected files:**
- `src/entities/intention.js` — lines 544, 1736
- `src/viewer/controls.js` — lines 419, 643

**After changes, rebuild:** `deno run --allow-read --allow-write --allow-run build.ts`

## Acceptance Criteria

- [ ] Line 544 of intention.js: `_totalNeeded` removed from destructure
- [ ] Line 1736 of intention.js: `_icons` assignment deleted
- [ ] Line 419 of controls.js: `_worldPos` assignment deleted
- [ ] Line 643 of controls.js: `_reqType` assignment deleted
- [ ] `deno lint` passes (no new warnings)
- [ ] `npm test` passes (no regressions)

## Work Log

- 2026-02-26: Identified by code-simplicity-reviewer and security-sentinel agents. Filed as P2.
