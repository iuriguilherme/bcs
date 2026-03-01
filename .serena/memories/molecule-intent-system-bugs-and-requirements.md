# Molecule Intent System - Complete Specification & Fix Plan

## Problem Statement
The molecule intent system is NOT WORKING. Molecules marked for the intent eventually stabilize into unrelated, simpler molecules (O2, H2O, CH4, C2H2, etc.) instead of the target molecule. This defeats the entire purpose.

---

## Core Concepts

### Molecule Blueprint
Contains information about:
- Which atoms are needed (composition)
- Where atoms should bond (structure)
- Geometrical shape when stable (template)

### Molecule Intent
Simulates environment changes to force formation of a desired molecule. It "bends the rules" of regular simulation temporarily within its influence radius.

### Hierarchy of Intents
1. **Cell Intent** - needs polymers
2. **Polymer Intent** - needs molecules (monomers)
3. **Molecule Intent** - needs atoms

Test scenario: User places cell intent → polymer intents → molecule intents → atom spawner (overlapping).
Expected: atoms → molecules → polymers → cells.

---

## Required Behavior

### 1. Seed Molecule Selection and Protection (CRITICAL)
- Find free atoms inside radius to be the seed
- Mark that atom as belonging to the intent's special molecule
- **The seed molecule MUST NOT behave like a regular molecule**:
  - NO decaying when unstable
  - NO reshaping into stable molecules (CH4, C2H2, etc.)
  - ONLY reshape to the target blueprint configuration
  - Protection continues until blueprint is fully formed

### 2. Atom Marking System
- Atoms found for the intent are MARKED as belonging to that intent
- Marked atoms should NOT freely bond with other atoms (via regular `tryFormBonds()`)
- They should ONLY bond according to the intent's direct control
- Marking prevents conflicts with overlapping intents and regular simulation

### 3. Atom Gathering
- After seed is established, search for more candidate atoms
- Mark them so they're not free anymore
- Attract them to the seed molecule
- Seed molecule bonds with assigned atoms toward the blueprint configuration

### 4. Irrelevant Atoms MUST Be Repelled
- Atoms NOT in the blueprint's atom list must be slowly repelled from the zone
- This applies to ALL atoms: existing, placed, spawned, or drifted in
- Must work continuously as long as the intent exists

### 5. Unstable Molecules in Zone
- Should decay differently than normal:
  - Prioritize releasing atoms NEEDED by the blueprint
  - Released atoms are immediately MARKED for use in seed molecule
  - Atoms NOT needed by blueprint should be released and REPELLED

### 6. Stable Molecules in Zone
- Only break apart when no free atoms or unstable molecules have needed atoms
- **EXCEPTION**: Monomers protected by polymer intents should NOT be broken

### 7. Atom Escape Handling
- Atoms being dealt with by seed can escape or be affected by unrelated actions
- Intent must handle this by using other atoms or starting a new seed if needed

### 8. Zone Entry/Exit
- Atoms entering zone are subject to intent rules
- Atoms leaving zone return to regular simulation rules

---

## ROOT CAUSE ANALYSIS (Traced January 2026)

### The Bug Flow: Why CH4 Forms Inside C2H4 Intent

#### Step 1: Race Condition in environment.update()
```
environment.update() sequence:
1. syncBonds()
2. applyBoundaries()
3. applyAtomicForces()
4. updateIntentions(dt)     ← Intentions claim atoms
5. [bond spring forces]
6. [update atoms]
7. tryFormBonds()           ← BUG: Atoms bond BEFORE molecule detection
8. [update molecules]
9. updateMolecules()        ← Too late! Wrong molecules already formed
```

**Problem:** `tryFormBonds()` runs BEFORE `updateMolecules()`. Atoms that haven't been grouped into molecules yet can form wrong bonds.

#### Step 2: Early Template Lock in Molecule Constructor
```javascript
// molecule.js constructor calls:
this._checkForStableTemplate();  // BEFORE protection flags set!

// This finds CH4 is a stable template and starts reshaping immediately
```

**Problem:** When a molecule is created, it immediately checks for stable templates and starts reshaping. This happens BEFORE the intent protection (`formingInIntentId`, `intentTargetTemplate`) is restored in `updateMolecules()`.

#### Step 3: Protection Restored Too Late
```javascript
// In updateMolecules():
const molecule = new Molecule(group);  // Constructor already started reshaping!
// ... then later ...
molecule.formingInIntentId = data.formingInIntentId;  // Too late
molecule.intentTargetTemplate = data.intentTargetTemplate;  // Too late
```

**Problem:** Protection flags are set AFTER the constructor runs. By then, `isReshaping = true` for the wrong template.

#### Step 4: No Undo Mechanism
Once reshaping starts to CH4, it completes. After completion:
- `geometryVerified = true`
- `isStable()` returns `true`
- Molecule is locked as CH4
- Intent can't eject or reshape it

### The Timing Disaster
```
Tick N:   Intention creates C-H bond
Tick N+1: tryFormBonds() creates more C-H bonds → CH4 group forms
          updateMolecules() creates Molecule(CH4 group)
            → Constructor calls _checkForStableTemplate()
            → Finds CH4 template, starts reshaping
            → isReshaping = true BEFORE protection flags set
          Later: protection flags restored but reshaping already started
Tick N+5: Reshaping completes, geometryVerified = true
          Molecule is now locked as stable CH4
```

---

## FIX PLAN

### Fix 1: Pass Protection Data to Molecule Constructor
**File:** `src/core/environment.js`

Pass protection data so it's set BEFORE template check:
```javascript
const protectionData = atomIntentBackup.get(group[0]?.id);
const molecule = new Molecule(group, protectionData);
```

### Fix 2: Guard _checkForStableTemplate
**File:** `src/entities/molecule.js`

Add check for intent protection:
```javascript
_checkForStableTemplate() {
    if (this.isReshaping) return;
    if (this.formingInIntentId) return;  // NEW: Skip if forming for intent
    // ... rest
}
```

### Fix 3: Block ALL Atoms in Zone from Regular Bonding
**File:** `src/entities/intention.js`

Currently only attracting atoms get blocked. ALL atoms in zone should be blocked:
```javascript
if (dist < this.radius) {
    atom.claimedByIntentId = this.id;
    atom.intentBlockedUntil = this.id;  // ADD THIS
}
```

### Fix 4: Add Zone Enforcement Method
**File:** `src/entities/intention.js`

New method `_enforceZoneRules()` to break wrong molecules:
- Find molecules in zone
- If composition incompatible with target, break apart
- Repel freed irrelevant atoms

### Fix 5: Single Seed Enforcement
**File:** `src/entities/intention.js`

Only ONE seed molecule at a time:
```javascript
if (this.seedMoleculeId && environment.molecules.has(this.seedMoleculeId)) {
    this.buildPhase = 'building';
    return;  // Don't create another seed
}
```

### Fix 6: Cleanup on Fulfillment
**File:** `src/entities/intention.js`

When intent fulfills, clear all protection:
```javascript
for (const mol of environment.molecules.values()) {
    if (mol.formingInIntentId === this.id && mol.id !== this.createdEntity?.id) {
        mol.formingInIntentId = null;
        mol.intentTargetTemplate = null;
    }
}
for (const atom of environment.atoms.values()) {
    if (atom.claimedByIntentId === this.id) {
        atom.claimedByIntentId = null;
        atom.intentBlockedUntil = null;
    }
}
```

---

## Files to Modify
1. `src/entities/molecule.js` - Constructor, _checkForStableTemplate
2. `src/entities/intention.js` - Zone enforcement, single seed, cleanup
3. `src/core/environment.js` - Pass protection data to constructor

## Verification Steps
1. Place C2H4 (Ethylene) intent
2. Spawn C and H atoms inside the zone
3. Check: Only C2H4 should form (no CH4/C2H2)
4. Check: C2H4 completes reshaping and becomes stable
5. Check: Intent fulfills and disappears
6. Check: No zombie molecules remain