---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, security, xss]
dependencies: []
---

# Missing `escHtml` in `main.js` blueprint name rendering — stored XSS via prompt()

## Problem Statement

`src/main.js` renders blueprint names, formulas, species, and descriptions into `innerHTML` without HTML escaping. The concrete attack path: a user naming a molecule via `prompt()` with text containing `<script>` or `<img onerror>` HTML — that name is stored in IndexedDB and rendered unescaped each time the palette loads.

While this is a single-user local simulation (low exploitability in practice), the `escHtml` helper already exists in `controls.js` and `catalogue-ui.js`. The gap in `main.js` is an inconsistency that should be aligned — especially since a previous review (todo 008) already fixed an XSS in the inspector.

## Findings

`escHtml` is defined and used in `src/viewer/controls.js` and `src/viewer/catalogue-ui.js`. It is NOT imported/defined in `src/main.js`.

**Unescaped interpolations in `src/main.js`:**

- Line ~399: `<span class="formula">${bp.name || bp.formula}</span>` in `_renderMoleculePalette`
- Line ~400: `<span class="info">${bp.formula} &bull; ...</span>` in `_renderMoleculePalette`
- Line ~553: `${bp.name}` in `_renderCellPalette`
- Line ~554: `${bp.species}` in `_renderCellPalette`
- Line ~613: `${blueprint.name}` in `_showCellBlueprintInspector`
- Line ~614: `${blueprint.species}` in `_showCellBlueprintInspector`
- Line ~615: `${blueprint.description}` in `_showCellBlueprintInspector`

**The concrete input path:**
`registerMolecule()` at line ~714 calls `prompt('Enter a name for this molecule:', ...)`. The return value goes into `catalogue.registerMolecule(mol, name)`. If `name` is `<img src=x onerror="alert(1)">`, it is stored in IndexedDB and rendered unescaped next time the palette loads.

**Previously fixed:** todo 008 fixed XSS in the inspector (controls.js). main.js was not updated in that pass.

## Proposed Solutions

### Option A: Add `escHtml` helper to main.js (Recommended)
**Pros**: Consistent with existing pattern. No external imports needed (vanilla JS).
**Cons**: Slight code duplication (same helper in 3 files), but acceptable in vanilla JS architecture.
**Effort**: Small
**Risk**: None

Add at top of the relevant render methods in `main.js`:
```javascript
const escHtml = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
```

Then wrap all interpolations:
```javascript
// Before:
`<span class="formula">${bp.name || bp.formula}</span>`

// After:
`<span class="formula">${escHtml(bp.name || bp.formula)}</span>`
```

Apply to all 7 unescaped locations listed above.

### Option B: Extract to utils.js (Better long-term)
**Pros**: Single source of truth. All files use one `escHtml`.
**Cons**: Requires checking utils.js doesn't already define it; also check build script ordering.
**Effort**: Medium
**Risk**: Low

Add `escHtml` to `src/core/utils.js` (loaded first in build order), remove duplicates from controls.js and catalogue-ui.js.

## Recommended Action

Option A (quick fix, consistent with existing pattern). Option B is a good follow-up refactor.

## Technical Details

**Affected file:** `src/main.js`

**Why low-severity but worth fixing:**
- This is a single-user game; the attacker is the user themselves
- However, the `escHtml` infrastructure already exists project-wide — the gap is just oversight
- A previous todo (008) already fixed one XSS path; this completes the fix

**After changes, rebuild:** `deno run --allow-read --allow-write --allow-run build.ts`

## Acceptance Criteria

- [ ] `_renderMoleculePalette` in main.js escapes `bp.name`, `bp.formula`
- [ ] `_renderCellPalette` in main.js escapes `bp.name`, `bp.species`
- [ ] `_showCellBlueprintInspector` in main.js escapes `blueprint.name`, `.species`, `.description`
- [ ] `escHtml` helper is defined in main.js (or extracted to utils.js)
- [ ] Manual test: name a molecule `<b>test</b>` via prompt → palette shows `&lt;b&gt;test&lt;/b&gt;`, not bold text
- [ ] `npm test` passes

## Work Log

- 2026-02-26: Identified by security-sentinel review agent. Related to completed todo 008. Filed as P2.
