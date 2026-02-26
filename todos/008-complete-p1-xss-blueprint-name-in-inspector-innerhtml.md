---
status: pending
priority: p1
issue_id: "008"
tags: [code-review, security, xss, inspector, catalogue-ui]
---

# P1: XSS — unescaped blueprint name/formula injected into inspector innerHTML

## Problem Statement

`_showBlueprintInspector()` in `catalogue-ui.js` and `_handlePlace()` in `controls.js`
interpolate `blueprint.name` and `blueprint.formula` directly into innerHTML template
strings without HTML-escaping. A blueprint with a crafted name containing `<script>` or
event-handler attributes would execute arbitrary JavaScript when the inspector panel renders.

This is a pre-existing issue. PR #2 widens the attack surface by exposing monomer
blueprint cards in the UI — monomer names and formulas are now rendered in the inspector
panel through this same path. Any blueprint stored in IndexedDB with a malicious name
(e.g. via a tampered export/import) will execute on render.

## Findings

**File:** `src/viewer/catalogue-ui.js:292, 297`

```javascript
// catalogue-ui.js ~line 292-297 (inside _showBlueprintInspector template literal):
<h3>${blueprint.name}</h3>           // ← unescaped
<p>${blueprint.formula}</p>          // ← unescaped
```

**File:** `src/viewer/controls.js:666` (approximate)

```javascript
// controls.js, title attribute on placement widget:
title="${blueprint.name}"           // ← unescaped in attr context
```

All three injection points accept arbitrary strings from blueprint objects that were either:
- Loaded from IndexedDB (user-controlled via import/export)
- Auto-discovered from the simulation (formula is computable; name is auto-generated but editable)
- Monomer blueprints (names are hardcoded in monomer-templates.js today, but could be modified)

## Proposed Solutions

### Option A: Minimal escaping helper (Recommended)

Add a one-liner escape helper and apply it at injection points:

```javascript
// Add to catalogue-ui.js or a shared utils location:
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Usage in template literals:
<h3>${escHtml(blueprint.name)}</h3>
<p>${escHtml(blueprint.formula)}</p>
title="${escHtml(blueprint.name)}"
```

**Pros:** Minimal surface change, correct for all injection contexts (text and attribute).
No new dependencies.
**Cons:** Must be applied at every injection point — easy to miss future additions.
**Effort:** Small. **Risk:** Very low — purely additive wrapper.

### Option B: Use `textContent` / `setAttribute` instead of innerHTML

Build the inspector DOM programmatically instead of with template literals:

```javascript
const h3 = panel.querySelector('h3');
h3.textContent = blueprint.name;     // browser escapes automatically
```

**Pros:** Browser handles escaping automatically; no helper needed.
**Cons:** Requires converting the template-literal rendering approach to DOM manipulation,
which is a larger refactor for the whole inspector section.
**Effort:** Medium. **Risk:** Low (same behavior, different construction path).

### Option C: Accept risk as low (do not fix)

This simulation runs locally with no server. Blueprint names come from user-controlled
data (IndexedDB), but the same user has full DevTools access. In a single-user local app,
the XSS threat model is minimal.

**Pros:** No code change.
**Cons:** Attack surface opens if blueprints are ever shared via export/import files from
untrusted sources. The pattern sets a poor precedent for future contributor additions.
**Effort:** None. **Risk:** Low currently, but escalates if data-sharing is ever added.

## Recommended Action

Option A — add `escHtml()` and apply it at the three known injection points. This is a
small, isolated change that eliminates the XSS surface without restructuring the renderer.

## Technical Details

- **Affected files:**
  - `src/viewer/catalogue-ui.js` — `_showBlueprintInspector()` (~lines 292, 297)
  - `src/viewer/controls.js` — placement widget title attribute (~line 666)
- **All `blueprint.*` string fields in innerHTML contexts** should be escaped: `.name`, `.formula`, `.description`

## Acceptance Criteria

- [ ] `escHtml()` helper exists (either in `catalogue-ui.js` or a shared utility)
- [ ] All three injection sites use `escHtml()` (or equivalent safe DOM API)
- [ ] A blueprint name containing `<img src=x onerror=alert(1)>` does not execute JavaScript when the inspector opens
- [ ] Blueprint names render correctly including real special characters (e.g. subscript HTML entities like `H₂O`)

## Work Log

- 2026-02-26: Identified by security-sentinel agent during code review of PR #2 (fix/show-monomers-in-catalogue-ui). Pre-existing issue; PR widens attack surface to monomer cards.
