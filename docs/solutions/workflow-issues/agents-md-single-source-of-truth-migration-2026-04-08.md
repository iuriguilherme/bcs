---
title: "AGENTS.md is the single source of truth — CLAUDE.md and GEMINI.md are @-shims"
date: 2026-04-08
category: docs/solutions/workflow-issues/
module: agent-infrastructure
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Adding or changing testing rules, run commands, or validity requirements"
  - "Updating scenario coverage after adding, renaming, or removing test files"
  - "Adding new agent guidelines and deciding which file to edit"
  - "Multiple AI tool-specific instruction files exist and risk diverging"
tags:
  - agents-md
  - claude-md
  - single-source-of-truth
  - shim
  - agent-guidelines
  - testing-requirements
  - documentation-maintenance
---

# AGENTS.md is the single source of truth — CLAUDE.md and GEMINI.md are @-shims

## Context

The project uses three AI agent instruction files: `AGENTS.md` (generic agents / Aider), `CLAUDE.md`
(Claude Code), and `GEMINI.md` (Gemini CLI). Over time, `CLAUDE.md` accumulated the full testing
requirements (mandatory evidence rules, run commands, validity rules, test annotations, output
interpretation, and the scenario table) while `AGENTS.md` was reduced to a stub testing section
that said _"See CLAUDE.md for full rules"_ with only the three most-used run commands.

`AGENTS.md`'s scenario table also drifted — it listed informal short names (`single-ethylene`,
`concurrent-intents`) that predated the `tNN-descriptive-name` naming convention, pointing to
tests that no longer existed by those names.

`GEMINI.md` was already a one-line `@AGENTS.md` shim. `CLAUDE.md` was not.

The divergence meant agents reading `AGENTS.md` operated on incomplete testing guidance, any
update to testing rules had to go into `CLAUDE.md`, and there was no clear answer to "which file
do I edit when I need to change agent guidelines?"

## Guidance

`AGENTS.md` is the single source of truth for all AI agent guidelines in this project.

`CLAUDE.md` and `GEMINI.md` are **shims** — each contains exactly one line: `@AGENTS.md`.
A shim satisfies the tool's filename lookup (Claude Code looks for `CLAUDE.md`; Gemini CLI looks
for `GEMINI.md`) while ensuring all agents read the same content.

**What belongs in `AGENTS.md`:**
- The bundle problem and build instructions
- All Playwright testing requirements (mandatory evidence, run commands, validity rules,
  annotations, output interpretation, scenario coverage table, infrastructure/scenarios table)
- Institutional knowledge pointers (`docs/solutions/`)
- Manual testing checklist, code style, common mistakes, sync workflow
- Any other guidelines that apply to agents working on the codebase

**What belongs in the shims (`CLAUDE.md`, `GEMINI.md`):**
- Nothing except `@AGENTS.md`

**Scenario table maintenance:** The `### Scenario Coverage` table under `## 🤖 Automated Testing`
in `AGENTS.md` uses exact filename prefixes (e.g., `t07-intention-display`) so agents can map
entries to actual files in `tests/scenarios/`. Update this table whenever a test file is added,
renamed, or its `test.fail()` annotation changes.

## Why This Matters

When guidelines fragment across multiple files:

1. **Incomplete guidance**: Agents reading `AGENTS.md` miss rules that only exist in `CLAUDE.md`.
   In practice, the entire mandatory-evidence requirement and all validity rules were invisible to
   non-Claude agents.
2. **Stale cross-references**: "See CLAUDE.md for full rules" only works as long as someone
   manually keeps both files aligned. Agents do not enforce this.
3. **Stale scenario table**: A table that names test scenarios incorrectly causes agents to
   reference non-existent tests when reasoning about coverage.
4. **Ambiguous ownership**: When adding a new guideline, fragmentation means deciding which file
   to update — ambiguity invites further fragmentation.

A single source of truth eliminates all of these: one file to update, one file to read, no
cross-references to go stale.

## When to Apply

**Edit `AGENTS.md`** when:
- Adding or modifying any testing rule, run command, or validity requirement
- Updating the scenario coverage table (test added, renamed, or annotation changed)
- Adding architectural guidance, module descriptions, or institutional knowledge pointers
- Adding or changing any step agents must follow before marking work complete

**Do NOT edit `CLAUDE.md` or `GEMINI.md` for content.** Their only valid contents is `@AGENTS.md`.
If content-only changes accidentally end up there, restore them to the one-line shim.

## Examples

**Before — fragmented state**

`CLAUDE.md` (~60 lines, full testing section):
```markdown
## Testing Requirements (Mandatory)

### Before Marking Any Task Done
Agents MUST run Playwright tests before marking any fix or feature complete.
**Required evidence:**
1. Test file path (committed to tests/scenarios/)
...
```

`AGENTS.md` testing section (stub, stale scenario table):
```markdown
## 🤖 Automated Testing (Playwright)

Playwright tests are **mandatory** before marking any fix complete.
See `CLAUDE.md` Testing Requirements section for full rules.

| Scenario | Status | What it covers |
|----------|--------|----------------|
| `t01-molecule-formation`     | ✅ Pass | C2H4 forms from spawned atoms               |
| `t03-polymer-formation`      | ✅ Pass | Polyethylene from overlapping molecule intents |
| `t08-intention-wrong-...`    | ✅ Pass | Wrong-element O atoms expelled ...          |
```

Note the stale names (`t01-molecule-formation`, `t03-polymer-formation`) and a `t08` entry that
no longer exists.

**After — single source of truth**

`CLAUDE.md`:
```
@AGENTS.md
```

`GEMINI.md` (unchanged):
```
@AGENTS.md
```

`AGENTS.md` contains the full testing section (verbatim from old `CLAUDE.md`) with the scenario
table corrected to match actual files:

```markdown
| `t01-single-molecule-intent`      | ✅ Pass          | Single C2H4 intent completes from spawned atoms            |
| `t02-concurrent-molecule-intents` | ⚠️ test.fail()   | Two simultaneous intents — anti-cannibalization (known bug) |
| `t03-inspector-state`             | ✅ Pass          | Inspector reflects intent state correctly                  |
| `t04-polymer-intent`              | ✅ Pass          | Polymer intent drives full monomer→polymer pipeline        |
| `t05-cell-formation`              | ⚠️ test.fail()   | Full E2E cell formation (known bug — atoms get cramped)    |
| `t06-view-consistency`            | ✅ Pass          | View consistency across zoom levels                        |
| `t07-intention-display`           | ✅ Pass          | Gathered counter and Level 2 seed-atom visibility          |
```

## Related

- `AGENTS.md` — the canonical file; `## 🤖 Automated Testing` section is the primary area to maintain
- `docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md` —
  references `CLAUDE.md` for testing requirements (line 384); that reference now points to AGENTS.md
- `docs/solutions/build-errors/git-rebase-index-html-bundle-conflicts.md` —
  references `CLAUDE.md "Critical: The Bundle Problem"` (lines 241–242); this section was always
  in AGENTS.md, never in CLAUDE.md — this is a pre-existing stale reference
- `docs/solutions/logic-errors/getAtomsNear-grid-removal-and-progress-regression.md` and
  `docs/solutions/physics-issues/wrong-element-atoms-crowding-intention-zones.md` — both correctly
  reference `AGENTS.md` directly, demonstrating the post-migration convention
