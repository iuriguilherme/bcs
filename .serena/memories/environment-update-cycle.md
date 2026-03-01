# Environment Update Cycle

## Overview
The `Environment` class manages all entities (atoms, bonds, molecules, polymers, cells, intentions) and orchestrates the simulation update loop.

## Key File
`src/core/environment.js`

## Update Order (Critical)

In `environment.update(dt)`:
```javascript
update(dt) {
    // 1. SYNC: Ensure atom.bonds matches environment.bonds
    this.syncBonds();
    
    // 2. BOUNDARIES: Keep entities in bounds
    this.applyBoundaries();
    
    // 3. ATOMIC FORCES: Repulsion between atoms
    this.applyAtomicForces();
    
    // 4. INTENTIONS: Process all intentions (claims atoms, sets protection)
    this.updateIntentions(dt);
    
    // 5. BOND SPRING FORCES: Pull bonded atoms together
    for (const bond of this.bonds.values()) {
        bond.applySpringForce();
    }
    
    // 6. UPDATE ATOMS: Apply forces to positions
    for (const atom of this.atoms.values()) {
        atom.update(dt);
    }
    
    // 7. TRY FORM BONDS: Natural bonding between close atoms
    // BUG: This runs AFTER intentions but BEFORE updateMolecules
    this.tryFormBonds();
    
    // 8. UPDATE MOLECULES: Detect groups, handle reshaping/decay
    for (const molecule of this.molecules.values()) {
        molecule.update(dt);
    }
    
    // 9. REBUILD MOLECULES: Group bonded atoms, restore protection
    this.updateMolecules();
    
    // 10. MONOMER ATTRACTION: Monomers attract for polymerization
    this._updateMonomerAttraction();
    
    // 11. POLYMER BONDS: Try to form polymer chains
    this._tryFormPolymerBonds();
    
    // 12. UPDATE POLYMERS: Process polymer entities
    this.updatePolymers();
    
    // 13. STATS
    this._updateStats();
}
```

## Bond Management

### Two Storage Systems
1. `environment.bonds` - Map of all bonds (source of truth)
2. `atom.bonds` - Array on each atom (convenience cache)

### syncBonds()
Keeps the two systems synchronized:
```javascript
syncBonds() {
    // Step 1: Discover new bonds (created by reshaping, intentions, etc.)
    const knownBondIds = new Set(this.bonds.keys());
    for (const atom of this.atoms.values()) {
        for (const bond of atom.bonds) {
            if (!knownBondIds.has(bond.id)) {
                this.bonds.set(bond.id, bond);
            }
        }
    }
    
    // Step 2: Remove broken/orphaned bonds
    for (const [bondId, bond] of this.bonds) {
        if (!bond.atom1 || !bond.atom2) {
            this.bonds.delete(bondId);
        }
    }
    
    // Step 3: Rebuild atom.bonds from environment.bonds
    for (const atom of this.atoms.values()) {
        atom.bonds = [];
    }
    for (const bond of this.bonds.values()) {
        bond.atom1.bonds.push(bond);
        bond.atom2.bonds.push(bond);
    }
}
```

### tryFormBonds()
Natural bonding between atoms:
```javascript
tryFormBonds() {
    // For each atom pair within bonding distance:
    for each (atom1, atom2) close enough {
        // Check valence availability
        if (atom1.availableValence <= 0) continue;
        if (atom2.availableValence <= 0) continue;
        
        // INTENT PROTECTION CHECK
        const claim1 = atom1.claimedByIntentId || atom1.intentBlockedUntil;
        const claim2 = atom2.claimedByIntentId || atom2.intentBlockedUntil;
        if (claim1 || claim2) continue;  // Skip if either is protected
        
        // Create bond
        const bond = new Bond(atom1, atom2, 1);
        this.addBond(bond);
    }
}
```

## Molecule Detection (updateMolecules)

### Algorithm
1. **Backup** intent protection data from existing molecules
2. **Clear** all moleculeIds and molecules
3. **Find groups** of bonded atoms using BFS
4. **Create** new Molecule for each group
5. **Restore** intent protection to new molecules

### BFS Grouping
```javascript
_findAllConnectedGroups(bondedAtoms) {
    const visited = new Set();
    const groups = [];
    
    for (const startAtom of bondedAtoms) {
        if (visited.has(startAtom.id)) continue;
        
        const group = [];
        const queue = [startAtom];
        
        while (queue.length > 0) {
            const atom = queue.shift();
            if (visited.has(atom.id)) continue;
            visited.add(atom.id);
            group.push(atom);
            
            // Add bonded neighbors to queue
            for (const bond of atom.bonds) {
                const other = bond.atom1 === atom ? bond.atom2 : bond.atom1;
                if (!visited.has(other.id)) {
                    queue.push(other);
                }
            }
        }
        
        if (group.length >= 2) {
            groups.push(group);
        }
    }
    
    return groups;
}
```

### Protection Restoration
```javascript
// Before clearing molecules:
const atomIntentBackup = new Map();
for (const molecule of this.molecules.values()) {
    if (molecule.formingInIntentId) {
        const data = {
            formingInIntentId: molecule.formingInIntentId,
            intentTargetTemplate: molecule.intentTargetTemplate,
            isReshaping: molecule.isReshaping,
            // ... other state
        };
        for (const atom of molecule.atoms) {
            atomIntentBackup.set(atom.id, data);
        }
    }
}

// After creating new molecule:
for (const atom of group) {
    if (atomIntentBackup.has(atom.id)) {
        const data = atomIntentBackup.get(atom.id);
        // Validate all atoms are relevant to intent
        if (allAtomsRelevant) {
            molecule.formingInIntentId = data.formingInIntentId;
            molecule.intentTargetTemplate = data.intentTargetTemplate;
            // ... restore other state
        }
    }
}
```

## Race Condition Bug

### The Problem
```
Tick N: Intention claims atoms, sets protection
        tryFormBonds() runs - SHOULD skip protected atoms
        BUT: Atoms at zone edge may not be claimed yet
        Free atoms bond together → wrong molecule starts forming

Tick N+1: updateMolecules() groups the bonded atoms
          NEW Molecule created
          Constructor calls _checkForStableTemplate()
          Finds CH4 template, starts reshaping
          THEN protection is restored - too late!
```

### Fix Needed
Pass protection data to Molecule constructor so it's set BEFORE template check.

See `molecule-intent-system-bugs-and-requirements.md` for complete fix plan.
