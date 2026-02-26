---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, ui, inspector, monomer, correctness, agent-native]
---

# P2: Inspector panel shows "✓ Stable Configuration" for monomer blueprints

## Problem Statement

`_showBlueprintInspector()` in `catalogue-ui.js` renders a hardcoded
`<p style="color: #4ade80;">✓ Stable Configuration</p>` line for every blueprint it
displays. This line is shown unconditionally for monomers as well, which is incorrect —
monomers are intentionally NOT fully stable (they carry free valence required for
polymerization). The message misleads users and agents that read the DOM.

The `_renderItem()` badge was correctly updated in PR #2 to show "Monomer" instead of
the stability checkmark, but `_showBlueprintInspector()` was not updated consistently.

Two agents independently flagged this: architecture-strategist (P3) and agent-native-reviewer
(P2 — specifically because agents reading the inspector DOM to infer stability would receive
incorrect information).

## Findings

**File:** `src/viewer/catalogue-ui.js:301` (approximate)

```javascript
// Inside _showBlueprintInspector() template literal — shown for ALL blueprints:
<p style="color: #4ade80;">✓ Stable Configuration</p>
```

`blueprint.isMonomer` is already available in scope at that point. The fix is a conditional.

The correct status messages:
- Stable molecule (`!bp.isMonomer && bp.isStable`): "✓ Stable Configuration" (current)
- Monomer (`bp.isMonomer`): "Monomer — free valence for polymerization"
- Unstable fragment (`!bp.isMonomer && !bp.isStable`): "⚠ Incomplete (free valence)"

## Proposed Solutions

### Option A: Conditional status line in `_showBlueprintInspector()` (Recommended)

```javascript
// Replace the hardcoded line with:
${blueprint.isMonomer
    ? '<p style="color: #4ade80;">Monomer — free valence for polymerization</p>'
    : '<p style="color: #4ade80;">✓ Stable Configuration</p>'}
```

**Pros:** Consistent with the badge logic already in `_renderItem()`. One-line change.
**Cons:** None.
**Effort:** Trivial. **Risk:** None.

### Option B: Extract status to a shared helper

Create `_blueprintStatusText(blueprint)` returning the appropriate string, used by both
`_renderItem()` (for the badge) and `_showBlueprintInspector()` (for the inspector line).

**Pros:** Single source of truth for status text.
**Cons:** More code for a trivial change; `_renderItem()` renders HTML badge, inspector
renders text — formats differ enough that a shared helper adds complexity without value.
**Effort:** Small. **Risk:** Low.

## Recommended Action

Option A — one conditional in the template literal. Consistent with PR #2's badge fix.

## Technical Details

- **Affected file:** `src/viewer/catalogue-ui.js`
- **Affected method:** `_showBlueprintInspector()` (~line 301)

## Acceptance Criteria

- [ ] Inspector panel for a monomer blueprint displays "Monomer — free valence for polymerization" (or equivalent) instead of "✓ Stable Configuration"
- [ ] Inspector panel for a stable molecule (H₂O, CH₄, etc.) still displays "✓ Stable Configuration"
- [ ] `blueprint.isMonomer` is checked; no hardcoded string for all blueprints

## Work Log

- 2026-02-26: Identified by architecture-strategist (P3) and agent-native-reviewer (P2) during code review of PR #2
