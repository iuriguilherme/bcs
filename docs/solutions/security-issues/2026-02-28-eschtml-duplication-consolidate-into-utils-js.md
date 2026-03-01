---
title: "escHtml() duplicated across 3 files with a divergent 4-replacement variant in main.js missing single-quote escape"
date: 2026-02-28
category: security-issues
tags:
  - xss
  - escaping
  - escHtml
  - utils
  - duplication
  - tech-debt
  - main.js
  - controls.js
  - catalogue-ui.js
  - single-quote
  - html-injection
  - consolidation
module: src/core/utils.js (target) / src/main.js + src/viewer/controls.js + src/viewer/catalogue-ui.js (sources)
symptom: "escHtml() defined independently in three files; main.js variant has only 4 character replacements (missing single-quote escape), while controls.js and catalogue-ui.js have all 5 — creating a latent XSS gap for blueprint data rendered via main.js"
root_cause: "Each viewer-layer file was written as a standalone module. When HTML escaping was first needed in main.js, it was defined locally (4-replacement). When escaping was added to catalogue-ui.js and controls.js on later branches, the function was copied with the correct 5-replacement definition — but the divergence was never noticed because the functions are not shared."
---

# `escHtml()` Duplicated Across 3 Files with a Divergent 4-Replacement Variant in `main.js`

## Discovery

Found during a 5th `/compound` analysis pass comparing all three definitions of `escHtml()` across the codebase. The XSS solution document (`docs/solutions/security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md`) already flagged the three-file duplication as Priority-1 technical debt but did not compare the definitions. The comparison reveals they are **not identical**.

---

## The Divergence

### `src/viewer/controls.js` (line 6) — **5 replacements** ✅

```javascript
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');   // ← single-quote escaped
}
```

### `src/viewer/catalogue-ui.js` (line 6) — **5 replacements** ✅

```javascript
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');   // ← single-quote escaped
}
```

### `src/main.js` (line 6) — **4 replacements** ⚠️

```javascript
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    // ← single-quote NOT escaped
}
```

The `main.js` definition is missing `.replace(/'/g, '&#39;')`. This means any user-supplied value containing a single quote that reaches `main.js`'s 7 call sites is not fully sanitised.

---

## Call Site Inventory

| File | Definition | Call sites | Paths at risk |
|---|---|---|---|
| `src/main.js` | 4-replacement (**weaker**) | 7 | Blueprint palette (molecules, cells): `bp.name`, `bp.formula`, `bp.species`, `blueprint.description` |
| `src/viewer/controls.js` | 5-replacement (correct) | 17 | Intention inspector: all `reqDetails` branches, `intention.type`, `reqCount` |
| `src/viewer/catalogue-ui.js` | 5-replacement (correct) | 2 | Blueprint inspector: `blueprint.name`, `blueprint.formula` |

**Total: 26 call sites across 3 files. `src/core/utils.js` — no `escHtml` definition (confirmed absent).**

### What `main.js` renders (the 7 sites)

```javascript
// _renderMoleculePalette (lines 407, 408):
<div class="bp-name">${escHtml(bp.name || bp.formula)}</div>
<div class="bp-formula">${escHtml(bp.formula)}</div>

// _renderCellPalette (lines 561, 562):
<div class="bp-name">${escHtml(bp.name)}</div>
<div class="bp-species">${escHtml(bp.species)}</div>

// _showCellBlueprintInspector (lines 621, 622, 623):
<h3>${escHtml(blueprint.name)}</h3>
<p>${escHtml(blueprint.species)}</p>
<p>${escHtml(blueprint.description)}</p>
```

Blueprint data originates in IndexedDB and is populated by user-supplied text input (name/species/description prompts) or by the catalogue's JSON import feature. A blueprint with a single quote in a name would render that single quote unescaped into the palette's `innerHTML`. In an HTML attribute context (e.g., `onclick="action('${bp.name}')"`) an unescaped single quote would be exploitable.

**Current risk level**: Low-to-medium. The 7 `main.js` sites render into element content (not attribute values), so the immediate XSS risk from an unescaped `'` in that context is low. However the divergence creates a correctness violation of the intended escaping contract and creates future risk if any of these sites are refactored into an attribute context.

---

## Resolution Plan

All six steps must be executed together in a single commit.

### Step 1 — Add `Utils.escHtml` to `src/core/utils.js`

Use the **full 5-replacement variant**. Add it as a method on the `Utils` object immediately before the closing `};`:

```javascript
/**
 * Escape a string for safe insertion into HTML content or attributes.
 * Prevents XSS from untrusted data (blueprint names, species, descriptions,
 * formula strings, element symbols, role names) rendered via innerHTML.
 * @param {*} str - Value to escape (non-string values are stringified)
 * @returns {string}
 */
escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
},
```

`utils.js` is position 1 in the build order (`build.ts`) and exports `window.Utils = Utils`. All subsequent files see `Utils.escHtml` as a global.

### Step 2 — Update `src/main.js` (7 call sites)

Replace `escHtml(` → `Utils.escHtml(` at all 7 call sites. Delete the 4-replacement definition (lines 6–12).

**This also fixes the single-quote gap**: switching from the local 4-replacement definition to `Utils.escHtml` upgrades `main.js` to the correct 5-replacement behaviour.

### Step 3 — Update `src/viewer/controls.js` (17 call sites)

Replace `escHtml(` → `Utils.escHtml(` at all 17 call sites. Delete the 5-replacement definition (lines 6–13).

### Step 4 — Update `src/viewer/catalogue-ui.js` (2 call sites)

Replace `escHtml(` → `Utils.escHtml(` at both call sites. Delete the 5-replacement definition (lines 6–13).

### Step 5 — Rebuild

```bash
deno run --allow-read --allow-write --allow-run build.ts
```

### Step 6 — Verify and test

```bash
# Confirm no remaining local definitions outside utils.js
grep -n "function escHtml" src/main.js src/viewer/controls.js src/viewer/catalogue-ui.js
# Expected: no output

# Confirm Utils.escHtml is present in utils.js
grep -n "escHtml" src/core/utils.js
# Expected: definition and the escHtml key on Utils

# Run full test suite
npm test
# Expected: all tests pass (dev + prod)
```

---

## Why the Divergence Happened

The function was independently written three times because there was no established shared location for DOM/string helpers when each file was written. The `Utils` object existed but its description ("helper functions used throughout the simulation") emphasised math and data utilities, not UI/DOM helpers. Each developer writing a viewer file added the function locally rather than searching `utils.js` first.

The 4-replacement `main.js` version predates the 5-replacement versions in `controls.js` and `catalogue-ui.js`. When the function was copied for the later files, the author added the `'` replacement (likely following a more thorough reference), but the `main.js` original was never updated to match.

---

## Prevention Strategies

### 1. Establish `Utils` as the canonical home for shared DOM helpers

Add a comment at the top of `src/core/utils.js` naming it explicitly as the home for HTML/DOM helpers, not just math/data utilities:

```javascript
/**
 * src/core/utils.js — Shared utility functions
 * ─────────────────────────────────────────────
 * Home for: string/DOM helpers (escHtml, CSS validation),
 *           math helpers (clamp, lerp, Vector2),
 *           general data helpers (debounce, random, formatNumber).
 *
 * Any helper needed in 2+ files belongs here.
 */
```

### 2. The "two-file rule" for PR review

When a PR defines a free-standing `function` at file scope (outside any class) in a viewer or entity file, the reviewer must ask: "Is this needed in more than one place?" If yes, move to `Utils`. The red-flag pattern is:

```javascript
// Top of file, bare function, no class context — red flag
function somethingUseful(x) {
    // ...
}
```

### 3. Use `Utils.` prefix as the visibility convention

All shared utilities use the `Utils.` prefix. Any developer who has used `Utils.debounce` or `Utils.random` in one file already knows to look in `Utils` for the next helper they need. Using the namespace consistently creates discoverability.

### 4. Verify correctness when duplicating security-sensitive functions

When copying a function that is security-relevant (escaping, validation, encoding), always verify the copy against an authoritative reference (OWASP, MDN) rather than the original — the original may already be incomplete.

**For HTML escaping, the five characters that must be escaped:**

| Character | Entity | Why |
|---|---|---|
| `&` | `&amp;` | Starts all entities; must be first |
| `<` | `&lt;` | Starts tags |
| `>` | `&gt;` | Ends tags |
| `"` | `&quot;` | Terminates double-quoted attributes |
| `'` | `&#39;` | Terminates single-quoted attributes |

A 4-replacement definition that omits `'` is incomplete. The single-quote is required for safe interpolation into `onclick="action('${val}')"` and any similar attribute pattern.

### 5. Code review checklist for `innerHTML` template changes

For any PR that adds or modifies `innerHTML` template literals:

- [ ] Every `${...}` interpolation is covered by one of: `Utils.escHtml()`, `Number() || 0`, or a CSS allow-list regex
- [ ] No new file-local `function escHtml` is introduced
- [ ] If a new shared helper is needed, it is added to `Utils` not to the file

---

## Related Documentation

- **[`docs/solutions/security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md`](2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md)** — The XSS fix that swept `controls.js`. Priority 1 action in its prevention table was consolidating `escHtml()` into `utils.js`. This document is the follow-up to that action item. Contains the canonical `escHtml()` definition, CSS allow-list regex pattern, and the rule "escape at the sink, not the source."

- **[`docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`](../test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md)** — P2 finding first defined `escHtml()` in `main.js` and noted the per-file duplication as "intentional tech debt pointing toward a future `utils.js` consolidation."

- **[`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`](../logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md)** — First application of `escHtml()` to `catalogue-ui.js`. The 5-replacement definition was introduced here.

- **`src/core/utils.js`** — Target file for consolidation. Build order position 1 (first script). All viewer and entity files load after it, so `Utils.escHtml` is available globally by the time any call site is evaluated.
