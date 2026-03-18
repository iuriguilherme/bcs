---
title: "fix: Molecule Intent System Rewrite"
type: fix
date: 2026-01-23
brainstorm: docs/brainstorms/2026-01-23-molecule-intent-fix-brainstorm.md
---

# Molecule Intent System Rewrite

## Overview

Rewrite the molecule intent system using a **Rule-Based Priority** architecture. The current implementation is completely broken - atoms are not properly repelled, seed molecules get stuck in infinite loops, and wrong molecules form instead of the blueprint target.

The new system introduces a "seed molecule" concept that's protected from normal physics (no decay, no wrong reshape) and only bonds atoms toward the target blueprint configuration.

## Problem Statement

**Current bugs (from AGENTS.md):**
1. Atoms not matching blueprint are not repelled effectively
2. Seed molecules stuck in infinite reshape loops
3. Wrong molecules form because bonding isn't controlled
4. Timeout-based completion instead of formula validation (Bug #6)
5. Unstable molecules incorrectly repelled when they may still transform (Bug #11)
6. Bonds lost after reshaping due to one-way syncBonds (Bug #12)
7. Reshape loops due to missing geometryVerified flag (Bug #9/13)

**Root cause:** The current implementation doesn't control which atoms bond together. It attracts atoms and lets chemistry happen naturally, which often produces wrong molecules.

## Proposed Solution

Implement 8 ordered rules that execute each tick, controlling every aspect of molecule formation:

| # | Rule | Purpose |
|---|------|---------|
| 1 | Repel Irrelevant Atoms | Push away atoms not in blueprint composition |
| 2 | Repel Irrelevant Molecules | Push away stable molecules not contributing |
| 3 | Claim Free Atoms | Mark matching free atoms with `claimedByIntentId` |
| 4 | Extract from Unstable | Tear apart unstable molecules for useful atoms |
| 5 | Extract from Stable | Last resort: break stable molecules (if not polymer-protected) |
| 6 | Attract Claimed | Pull claimed atoms toward seed position |
| 7 | Bond Claimed | Attempt bonding according to blueprint geometry |
| 8 | Check Completion | If stable molecule matches blueprint, complete intent |

## Technical Considerations

### Architecture: Seed Molecule

The **seed molecule** is the partially-formed target molecule that's protected from normal simulation rules:

```javascript
// New properties on Molecule class
molecule.isSeedFor = intentId;     // null for normal molecules
molecule.seedBackups = [];          // backup candidate molecule IDs

// Protection behavior in Molecule.update():
if (this.isSeedFor) {
    // Skip decay timer
    // Skip automatic reshaping to simpler forms
    // Only accept bonds from claimed atoms via Rule 7
}
```

**Seed initialization:** When intent is created:
1. Seed starts as `null`
2. When first atom matching blueprint is claimed, it becomes the initial seed
3. When second atom bonds to it, seed molecule is created
4. Subsequent atoms bond to existing seed

### Architecture: Atom Claiming

New property on `Atom` class:

```javascript
// atom.js addition
atom.claimedByIntentId = null;  // Intent ID that has claimed this atom
```

**Claiming rules:**
- Only free atoms (no moleculeId) can be claimed
- Atoms in seed molecule are NOT claimed - they're part of the seed
- When claimed atom bonds to seed, `claimedByIntentId` is cleared
- On intent deletion/completion, all `claimedByIntentId` references are cleared

### Architecture: Rule Execution

```javascript
// intention.js - new structure
update(environment, dt) {
    this.age++;
    this.pulsePhase += 0.05;

    // Execute rules in order (molecule intents only)
    if (this.type === 'molecule') {
        this._rule1_repelIrrelevantAtoms(environment);
        this._rule2_repelIrrelevantMolecules(environment);
        this._rule3_claimFreeAtoms(environment);
        this._rule4_extractFromUnstable(environment);
        this._rule5_extractFromStable(environment);
        this._rule6_attractClaimed(environment);
        this._rule7_bondClaimed(environment);
        this._rule8_checkCompletion(environment);
    } else {
        // Polymer/cell intents use existing logic
        this._attractComponents(environment);
        this._checkCompletion(environment);
    }
}
```

### Integration: Environment.updateMolecules()

**Problem:** Current implementation does "clean slate" each tick, clearing all moleculeIds.

**Solution:** Protect seed molecules during clean slate:

```javascript
// environment.js modification
updateMolecules() {
    // Collect protected molecule IDs from active intents
    const protectedIds = new Set();
    for (const intent of this.intentions.values()) {
        if (intent.seedMoleculeId) {
            protectedIds.add(intent.seedMoleculeId);
        }
    }

    // Step 2: Clear ONLY non-protected assignments
    for (const atom of this.atoms.values()) {
        if (!protectedIds.has(atom.moleculeId)) {
            atom.moleculeId = null;
        }
    }

    // ... rest of logic (BFS, molecule creation)
}
```

### Integration: Bond Formation Control

**Problem:** `tryFormBonds()` in environment.js bonds any close atoms, creating wrong molecules.

**Solution:** Claimed atoms refuse bonds from non-intent sources:

```javascript
// In Environment.tryFormBonds() or Atom bonding logic
canBondWith(other) {
    // If this atom is claimed, only bond via Rule 7
    if (this.claimedByIntentId && !this._bondingViaIntent) {
        return false;
    }
    // ... existing valence checks
}
```

### Key Decisions

| Decision | Answer | Rationale |
|----------|--------|-----------|
| Seed initialization | First matching atom | Simple; seed grows as atoms bond |
| Claiming multi-intent | Single intent only | Prevents contention complexity |
| Overlap priority | Highest progress % | Encourages completion over starting new |
| Extraction limit | 1 atom per tick | Prevents physics instability |
| Protection flag | `isSeedFor` on Molecule | Minimal change, easy to check |
| Bond control | `_bondingViaIntent` flag | Temporary flag during Rule 7 |

## Acceptance Criteria

### Functional Requirements

- [ ] Atoms not matching blueprint composition are repelled from intent radius
- [ ] Seed molecule does NOT decay when unstable
- [ ] Seed molecule does NOT reshape into simpler stable forms
- [ ] Target molecule (e.g., C2H4) forms correctly from C and H atoms
- [ ] Intent disappears ONLY when stable molecule matching blueprint formula exists
- [ ] After completion, formed molecule behaves as normal stable molecule
- [ ] Overlapping intents don't steal each other's claimed atoms
- [ ] No stuck loops or frozen molecules
- [ ] Partial progress displayed visually (e.g., "4/6 atoms gathered")

### Non-Functional Requirements

- [ ] Rule execution completes in <1ms per intent per tick
- [ ] No memory leaks from stale `claimedByIntentId` references
- [ ] Debug logging available via `Debug.enable('intentions')`

### Quality Gates

- [ ] All existing polymer/cell intent tests still pass
- [ ] Manual testing: CH4, H2O, CO2, C2H4 molecule intents work correctly
- [ ] Manual testing: overlapping intents resolve without conflict
- [ ] Manual testing: intent deletion cleans up properly

## Success Metrics

1. **Correctness:** 100% of molecule intents produce the target formula
2. **No loops:** Zero reshape loops detected in 1000-tick test
3. **Performance:** Intent update time <1ms at 100 atoms in radius

## Implementation Phases

### Phase 1: Foundation (Atom & Molecule Properties)

**Files to modify:**
- [atom.js](src/entities/atom.js) - Add `claimedByIntentId` property
- [molecule.js](src/entities/molecule.js) - Add `isSeedFor` property, modify `update()`

**Tasks:**
1. Add `claimedByIntentId` property to Atom class
2. Add `isSeedFor` property to Molecule class
3. Modify `Molecule.update()` to skip decay/reshape when `isSeedFor` is set
4. Add serialization support for new properties

**Test:** Create molecule with `isSeedFor` set, verify it doesn't decay.

### Phase 2: Rule Infrastructure (Intention Class Restructure)

**Files to modify:**
- [intention.js](src/entities/intention.js) - Add rule methods, restructure `update()`

**Tasks:**
1. Add 8 empty rule methods (`_rule1_repelIrrelevantAtoms`, etc.)
2. Modify `update()` to call rules in order for molecule intents
3. Add `seedMoleculeId` and `seedBackups` tracking
4. Keep existing polymer/cell logic untouched

**Test:** Verify polymer/cell intents still work normally.

### Phase 3: Rules 1-3 (Repulsion & Claiming)

**Files to modify:**
- [intention.js](src/entities/intention.js) - Implement Rules 1, 2, 3

**Tasks:**
1. **Rule 1:** Identify atoms not in `targetComposition`, apply strong repulsion
2. **Rule 2:** Identify stable molecules that aren't target formula, apply repulsion
3. **Rule 3:** Find free atoms matching composition, set `claimedByIntentId`
4. Add progress calculation based on claimed + seed atoms

**Test:** Place CH4 intent, verify O atoms are repelled, C/H atoms are claimed.

### Phase 4: Rules 4-5 (Extraction)

**Files to modify:**
- [intention.js](src/entities/intention.js) - Implement Rules 4, 5
- [molecule.js](src/entities/molecule.js) - Add extraction helper method

**Tasks:**
1. **Rule 4:** When no free atoms available, identify unstable molecules with useful atoms
2. Implement `molecule.extractAtom(symbol)` - breaks weakest bond to atom of type
3. **Rule 5:** Same as Rule 4 but for stable molecules, check `polymerId` protection
4. Limit to 1 extraction per tick

**Test:** Place CH4 intent with only CO2 molecules available, verify C is extracted.

### Phase 5: Rules 6-7 (Attraction & Bonding)

**Files to modify:**
- [intention.js](src/entities/intention.js) - Implement Rules 6, 7
- [environment.js](src/core/environment.js) - Add bond formation bypass

**Tasks:**
1. **Rule 6:** Apply strong attraction to claimed atoms toward seed position
2. **Rule 7:** When claimed atom is within bonding radius of seed, create bond
3. Add `_bondingViaIntent` flag to bypass normal bond restrictions
4. After bonding, clear `claimedByIntentId`, update seed molecule

**Test:** Place CH4 intent, verify atoms bond correctly to form CH4.

### Phase 6: Rule 8 & Cleanup (Completion)

**Files to modify:**
- [intention.js](src/entities/intention.js) - Implement Rule 8, cleanup
- [environment.js](src/core/environment.js) - Protect seeds in `updateMolecules()`

**Tasks:**
1. **Rule 8:** Check if seed molecule is stable AND matches blueprint formula
2. On completion: clear `isSeedFor`, clear all `claimedByIntentId`, mark fulfilled
3. Modify `updateMolecules()` to skip protected seed molecules
4. Handle intent deletion: cleanup all claims and seed references

**Test:** Full flow - place CH4 intent, watch it complete, verify molecule is normal afterward.

### Phase 7: Visual Feedback & Polish

**Files to modify:**
- [intention.js](src/entities/intention.js) - Enhanced rendering
- [viewer.js](src/viewer/viewer.js) - Seed/claimed visualization

**Tasks:**
1. Display "X/Y atoms gathered" on intent
2. Add visual indicator for seed molecule (subtle glow)
3. Add visual indicator for claimed atoms (thin line to intent center)
4. Update inspector panel to show seed status

**Test:** Visual verification that progress and status are clear.

## File Changes Summary

| File | Changes |
|------|---------|
| `src/entities/atom.js` | Add `claimedByIntentId` property, serialization |
| `src/entities/molecule.js` | Add `isSeedFor`, modify `update()`, add `extractAtom()` |
| `src/entities/intention.js` | Major rewrite: 8 rule methods, seed tracking |
| `src/core/environment.js` | Protect seeds in `updateMolecules()`, bond bypass |
| `src/viewer/viewer.js` | Seed/claimed visualization |

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking polymer/cell intents | High | Keep existing logic for non-molecule intents, test thoroughly |
| Performance regression | Medium | Profile rule execution, optimize spatial queries |
| Bond sync issues | High | Use bidirectional syncBonds pattern from Bug #12 fix |
| Reshape loops | Medium | Use geometryVerified flag pattern from Bug #9/13 fix |

## Test Scenarios

1. **Happy path:** CH4 intent with abundant C and H atoms
2. **Extraction path:** CH4 intent with only CO2 molecules
3. **Mixed path:** Some free atoms, some in molecules
4. **Overlap:** Two H2O intents with limited H atoms
5. **Deletion:** Delete intent mid-progress
6. **Save/load:** Save with 50% progress, load and verify continuation

## References

### Internal

- [AGENTS.md](AGENTS.md) - Bug documentation (lines 197-509)
- [brainstorm](docs/brainstorms/2026-01-23-molecule-intent-fix-brainstorm.md) - Architecture decisions

### Code Locations

- Intention update: [intention.js:268](src/entities/intention.js#L268)
- Molecule formation: [environment.js updateMolecules()](src/core/environment.js)
- Bond sync: [environment.js syncBonds()](src/core/environment.js)
- Stable templates: [stable-molecules.js](src/data/stable-molecules.js)
