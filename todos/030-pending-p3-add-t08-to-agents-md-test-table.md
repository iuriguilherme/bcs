---
status: pending
priority: p3
issue_id: "030"
tags: [code-review, documentation, test, institutional]
---

# Add T08 to AGENTS.md test table

## Problem Statement

AGENTS.md contains a test table listing all Playwright scenarios with their status and purpose. This table is used by future agents to know which tests to run when modifying specific parts of the codebase, and to understand current test coverage. T08 (added in PR #3) is not listed.

Without a T08 entry, agents modifying Rule 1 or Rule 2 of the molecule-intent pipeline will not know to run T08, potentially missing a regression on the wrong-element expulsion behaviour.

The agent-native-reviewer also recommended updating Bug #11 to note the `isSurplus` intentional exception (see todo 026).

## Findings

- **Reporter**: agent-native-reviewer, PR #3
- **File**: `AGENTS.md`, test table section (search for `t07` or `T07` to find the end of the table)
- **Missing entry**: `t08-intention-wrong-composition-expulsion`

## Proposed Solution

Add T08 row to the test table in AGENTS.md:

```markdown
| `t08-intention-wrong-composition-expulsion` | ✅ Pass | O atoms expelled from C₂H₄ intent zone; validates Rule 1 expulsion at repulsionForce=200 |
```

Also update Bug #11 entry (if present in AGENTS.md) to note the `isSurplus` exception from todo 026.

**Effort**: Trivial — 1–2 line addition

## Acceptance Criteria

- [ ] T08 appears in AGENTS.md test table with correct status and description
- [ ] If Bug #11 is documented in AGENTS.md, it references the `isSurplus` intentional exception
- [ ] No bundle rebuild needed (docs-only change)

## Work Log

- 2026-03-01: Identified by agent-native-reviewer during PR #3 review of fix/intention-zone-crowding
