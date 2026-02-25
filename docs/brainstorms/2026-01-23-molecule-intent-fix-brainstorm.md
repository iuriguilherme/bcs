# Molecule Intent System Fix - Brainstorm

**Date:** 2026-01-23
**Status:** Ready for planning

## What We're Building

A rewritten molecule intent system using a **Rule-Based Priority** architecture. The molecule intent ensures that a molecule described by a blueprint forms inside the intent radius by temporarily overriding normal simulation rules for atoms within its influence.

### Core Concept: Seed Molecule

The intent creates a "seed molecule" - a special molecule that:
- Does NOT decay when unstable
- Does NOT reshape into simpler stable molecules
- Only bonds atoms toward the target blueprint configuration
- Is protected from other intents

### Rule Execution Order (Priority)

Each tick, rules execute in this order:

1. **Repel Irrelevant Atoms** - Atoms not in blueprint get pushed away
2. **Repel Irrelevant Molecules** - Molecules not contributing get pushed away
3. **Claim Free Atoms** - Mark matching free atoms as belonging to this intent
4. **Extract from Unstable Molecules** - If no free atoms, tear apart unstable molecules for useful atoms
5. **Extract from Stable Molecules** - Last resort: break stable molecules (unless protected by polymer intent)
6. **Attract Claimed Atoms** - Pull claimed atoms toward seed molecule
7. **Bond Claimed Atoms** - Attempt to bond atoms according to blueprint geometry
8. **Check Completion** - If stable molecule matching blueprint exists, complete intent

## Why This Approach

**Rule-Based Priority** was chosen because:
- Each rule is independent and testable
- Easy to debug - can log which rule is executing
- Clear ordering prevents conflicts
- Easy to add/modify rules without breaking others
- Declarative: rules describe "what" not "how"

**Rejected alternatives:**
- State Machine: More complex, harder to test individual behaviors
- Minimal Flags: Doesn't address root cause of stuck loops, accumulates debt

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Molecule intents only | Fix foundation before polymer/cell |
| Approach | Rewrite core logic | Current implementation completely broken |
| Architecture | Rule-Based Priority | Testable, independent rules |
| Seed behavior | Exempt from normal physics | Prevents wrong molecules from forming |
| Atom marking | `claimedByIntentId` flag | Prevents other intents from stealing atoms |
| Completion trigger | Stable molecule matches blueprint | Only then does intent disappear |

## Behaviors to Implement

### Atom Behaviors Inside Intent Radius

| Atom Type | Behavior |
|-----------|----------|
| Free atom matching blueprint | Claim for seed, attract to center |
| Free atom NOT matching | Repel from radius |
| Atom in unstable molecule (matching) | Extract when no free atoms available |
| Atom in unstable molecule (not matching) | Repel with molecule |
| Atom in stable molecule | Break as last resort (unless polymer-protected) |
| Claimed atom | Attract to seed, attempt bonding |

### Molecule Behaviors Inside Intent Radius

| Molecule Type | Behavior |
|---------------|----------|
| Seed molecule | No decay, no reshape, bond toward blueprint |
| Unstable (has useful atoms) | Hold until needed, then extract atoms |
| Unstable (no useful atoms) | Repel from radius |
| Stable (not target) | Repel, or break if atoms needed |
| Stable (is target) | Trigger completion |

### Completion Cleanup

When intent completes:
1. Unmark all claimed atoms
2. Seed molecule becomes normal stable molecule
3. All atoms/molecules return to normal behavior
4. Overlapping intents can now claim freed resources

## Resolved Questions

1. **Multiple seeds**: One primary seed + backup candidates
   - One active seed molecule at a time
   - Track backup atom candidates in case primary seed is destroyed
   - If primary is destroyed, promote a backup to become new seed

2. **Atom escape handling**: Pull escaping atoms back
   - Apply strong attraction force to recapture claimed atoms leaving radius
   - Claimed atoms should stay within influence unless external force is overwhelming

3. **Partial completion**: Visual feedback to user
   - Show progress indicator (e.g., "4/6 atoms gathered")
   - User can see what's missing and spawn more atoms if needed
   - Intent keeps trying indefinitely but user has visibility

4. **Overlapping intent priority**: Most progress wins
   - Intent closer to completion gets priority for contested atoms
   - Encourages completing one molecule before starting another
   - Prevents starvation of nearly-complete intents

## Success Criteria

- [ ] Irrelevant atoms/molecules are repelled from intent radius
- [ ] Seed molecule does not decay or reshape incorrectly
- [ ] Target molecule (e.g., C2H4) forms correctly from C and H atoms
- [ ] Intent disappears only when stable target molecule exists
- [ ] After completion, formed molecule behaves normally
- [ ] Overlapping intents don't steal each other's atoms
- [ ] No stuck loops or frozen molecules

## Next Steps

Run `/workflows:plan` to create implementation plan with specific file changes and test scenarios.
