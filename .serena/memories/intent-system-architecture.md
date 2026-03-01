# Intent System Architecture

## Overview
The intent system allows "bending rules" of the simulation to force specific formations within an influence radius. Three types exist in a hierarchy:

1. **Cell Intent** → needs polymers → creates Prokaryote
2. **Polymer Intent** → needs molecules (monomers) → creates Polymer
3. **Molecule Intent** → needs atoms → creates Molecule

## Key Files
- `src/entities/intention.js` - Main Intention class with all three intent types
- `src/core/environment.js` - Calls `updateIntentions()`, manages molecule/polymer creation
- `src/entities/molecule.js` - Molecule class with intent-aware `isStable()`

## Intention Class Properties

### Common Properties
```javascript
this.id                    // Unique ID
this.type                  // 'molecule', 'polymer', or 'cell'
this.blueprint             // Blueprint defining target
this.position              // Center of influence zone
this.radius                // Influence radius (varies by type)
this.attractionForce       // Force to pull relevant entities
this.repulsionForce        // Force to push irrelevant entities
this.progress              // 0-100% completion
this.fulfilled             // true when target formed
this.createdEntity         // Reference to created entity
```

### Molecule Intent Specific
```javascript
this.seedMoleculeId        // ID of molecule being built
this.buildPhase            // 'finding_seed' | 'building' | 'reshaping' | 'complete'
this.candidateMoleculeId   // Legacy: best candidate molecule
this.gatheredComponents    // Set of gathered atom IDs
this.excludedMoleculeIds   // Molecules that already existed before intent
```

## Atom/Molecule Protection Flags

### On Atoms
```javascript
atom.claimedByIntentId     // Intent that owns this atom (exclusive)
atom.intentBlockedUntil    // Intent blocking this atom from regular bonding
```

### On Molecules
```javascript
molecule.formingInIntentId    // Intent this molecule is being formed for
molecule.intentTargetTemplate // The ONLY template this molecule can reshape to
molecule.isBuildingCandidate  // Legacy flag for candidate protection
```

## Update Flow (Critical Order)

In `environment.update()`:
```
1. syncBonds()
2. updateIntentions(dt)     ← Intentions claim atoms, set protection
3. tryFormBonds()           ← Should respect protection flags
4. updateMolecules()        ← Creates molecules, restores protection
5. updatePolymers()
```

## Key Methods in Intention

### _activelyBuildMolecule(environment)
Main molecule intent logic:
1. `_enforceZoneRules()` - Break wrong molecules, repel irrelevant atoms
2. Gather atoms - Mark them as claimed
3. Check seed molecule - Adopt new molecule if ID changed
4. Finding seed phase - Find first atom, create initial bond
5. Building phase - Attract atoms, bond them to seed one at a time
6. Reshaping phase - Wait for geometry to match template
7. Complete - Set fulfilled, cleanup

### _getTargetComposition()
Returns `{ C: 2, H: 4 }` for C2H4 intent - what atoms are needed.

### _getTargetTemplate()
Returns the STABLE_MOLECULES template for the target formula.

## Protection Restoration in updateMolecules()

When molecules are rebuilt (new IDs), protection must be restored:
```javascript
// Backup before clearing
const atomIntentBackup = new Map();
for (molecule with formingInIntentId) {
    for (atom in molecule) {
        atomIntentBackup.set(atom.id, protectionData);
    }
}

// After creating new molecules
for (atom in newMolecule) {
    if (atomIntentBackup.has(atom.id)) {
        // Restore protection to new molecule
    }
}
```

## Bonding Control

### In tryFormBonds()
```javascript
const claim1 = atom1.claimedByIntentId || atom1.intentBlockedUntil;
const claim2 = atom2.claimedByIntentId || atom2.intentBlockedUntil;
if (claim1 || claim2) continue;  // Skip bonding claimed atoms
```

### In Intention (Direct Bonding)
Intent creates bonds directly when atoms are close enough:
```javascript
const bond = new Bond(bestSeedAtom, closestAtom, 1);
environment.addBond(bond);
```

## Known Issues (as of 2026-01)
See `molecule-intent-system-bugs-and-requirements.md` for complete bug analysis and fix plan.
