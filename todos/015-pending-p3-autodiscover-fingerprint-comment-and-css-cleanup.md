---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, simplicity, documentation, css, autodiscover]
---

# P3: `autoDiscover()` fingerprint comment missing; `white-space: nowrap` on `.monomer-badge` has no effect

## Problem Statement

Two minor cleanups from the code-simplicity and architecture reviewers:

### 1. `autoDiscover()` fingerprint format mismatch — undocumented

`catalogue.js:autoDiscover()` uses `this.molecules.has(molecule.fingerprint)` as an O(1)
early-exit guard. This guard works correctly for previously auto-discovered stable
molecules (which use JSON atom/bond-count fingerprints). However, monomer blueprints use
a different fingerprint format (`'monomer:<id>:<formula>'`) — so the guard never fires
for any monomer-formula molecule. Every monomer-formula live molecule calls `isStable()`
every tick.

The plan document explicitly acknowledges this ("Fingerprint format confirmed different")
but there is no code comment at the guard site. A future developer may incorrectly assume
the guard skips ALL registered molecules including monomers.

### 2. `white-space: nowrap` on `.monomer-badge` has no visual effect

The `.monomer-badge` CSS rule added in PR #2 includes `white-space: nowrap`. The badge
text "MONOMER" is a single word with no whitespace, so `nowrap` cannot affect rendering.
It is a no-op property for this specific content.

## Findings

**File:** `src/catalogue/catalogue.js:477`

```javascript
if (this.molecules.has(molecule.fingerprint)) continue; // already registered
```

Missing comment: this guard only fires for stable-molecule fingerprints (JSON format).
Monomer blueprints use `'monomer:id:formula'` format — no live molecule ever has that
fingerprint, so monomer-formula molecules always proceed to `isStable()`.

**File:** `src/viewer/catalogue-ui.js` — injected CSS block, `.monomer-badge` rule:

```css
.monomer-badge {
    ...
    white-space: nowrap;   /* ← no effect; "MONOMER" has no whitespace */
}
```

## Proposed Solutions

### For the comment (Recommended: add it)

```javascript
// this.molecules.has() fires only for stable-molecule JSON fingerprints.
// Monomer blueprints use 'monomer:id:formula' format — live monomer molecules
// always proceed to isStable() (no perf gain for monomer-formula molecules).
if (this.molecules.has(molecule.fingerprint)) continue;
```

**Effort:** Trivial. **Risk:** None.

### For the CSS (Recommended: remove the no-op property)

```css
/* Remove: */
white-space: nowrap;
```

**Effort:** Trivial. **Risk:** None — property has no visual effect.

## Recommended Action

Apply both fixes together in a single tiny cleanup commit.

## Technical Details

- **Affected file:** `src/catalogue/catalogue.js:477` — add comment
- **Affected file:** `src/viewer/catalogue-ui.js` — CSS block, remove `white-space: nowrap` from `.monomer-badge`

## Acceptance Criteria

- [ ] Comment at `catalogue.js:477` explains the fingerprint format mismatch
- [ ] `.monomer-badge` CSS does not include `white-space: nowrap`
- [ ] Badge visual appearance unchanged

## Work Log

- 2026-02-26: Identified by architecture-strategist (fingerprint comment) and code-simplicity-reviewer (CSS cleanup) during code review of PR #2
