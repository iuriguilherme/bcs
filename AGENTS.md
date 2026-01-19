# AGENTS.md - AI Assistant Guidelines for Cell Simulator

This document provides critical information for AI coding assistants working on this project. **Read this entire document before making any changes.**

## ⚠️ CRITICAL: The Bundle Problem

This project has **TWO code bases** that must stay synchronized:

1. **Source Files** (`src/` directory) - Individual JavaScript files loaded by `index.html`
2. **Bundled File** (`cell-simulator.html`) - Single file with all CSS/JS inlined

> [!CAUTION]
> **Changes to source files do NOT automatically update the bundle.** When fixing bugs or adding features, you MUST update BOTH the source files AND the corresponding code in `cell-simulator.html`.

The user typically runs `cell-simulator.html` (production mode), so changes only to `src/` files will appear to have no effect.

### Finding Code in the Bundle

The bundle is ~8600 lines. Key locations (approximate):
- **Molecule class**: ~line 1744
- **Environment.updateMolecules**: ~line 4781
- **_populateAtomPalette**: ~line 8177
- **_renderAtomPalette**: ~line 8263

Use grep or search to find exact locations as line numbers shift with edits.

---

## 🚨 FIXED BUGS - DO NOT REINTRODUCE

### Bug #1: Molecules Forming Without Bonds

**Problem**: Atoms placed near each other were being grouped into "molecules" even without chemical bonds between them. The inspector would show "Bonds: 0" for molecules like "Fe3" or "FeNO".

**Root Cause**: The `Molecule` constructor blindly assigned `moleculeId` to all atoms passed to it, and molecule creation didn't validate that atoms had actual interconnecting bonds.

**Fix Applied** (in BOTH source files AND bundle):

1. **Molecule constructor** - Only assign `moleculeId` to atoms with `bonds.length > 0`:
```javascript
// CORRECT:
this.atoms.forEach(atom => {
    if (atom.bonds.length > 0) {
        atom.moleculeId = this.id;
    }
});

// WRONG (causes bug):
this.atoms.forEach(atom => atom.moleculeId = this.id);
```

2. **Environment.updateMolecules** - Filter atoms to ensure they have interconnecting bonds within the group before creating molecules.

### Bug #2: Stable Molecules Forming Polymers

**Problem**: Fully stable molecules like H2 (which have no available valence) were incorrectly forming "polymer" chains.

**Root Cause**: The `canPolymerize()` check was too permissive.

**Fix Applied**:

`Molecule.canPolymerize()` must return `false` for stable molecules:
```javascript
canPolymerize() {
    if (this.atoms.length < 2) return false;
    if (this.isStable()) return false;  // ← CRITICAL: Stable = no free valence
    if (this.bonds.length < 1) return false;
    return true;
}
```

**Chemistry Rule**: Only molecules with FREE VALENCE (unsatisfied bonds) can polymerize. H2, O2, CH4, H2O are all stable and CANNOT polymerize.

### Bug #3: Molecule Formation System Rewrite

**Problem**: The original molecule formation logic had accumulated patches that made it increasingly broken. Atoms were being grouped incorrectly, molecules showed wrong bond counts, and the code was overly complex.

**Root Cause**: Incremental patches to handle edge cases (extend, merge, filter) made the logic fragile and hard to reason about.

**Fix Applied**: Complete rewrite of `Environment.updateMolecules()` with simple, clear logic:

```javascript
updateMolecules() {
    // Step 1: Get all atoms that have at least one bond
    const bondedAtoms = Array.from(this.atoms.values())
        .filter(a => a.bonds.length > 0);

    // Step 2: Clear all current molecule assignments
    for (const atom of this.atoms.values()) {
        atom.moleculeId = null;
    }

    // Step 3: Clear existing molecules
    this.molecules.clear();

    if (bondedAtoms.length === 0) {
        this.stats.moleculeCount = 0;
        return;
    }

    // Step 4: Find all connected groups using BFS via bonds
    const groups = this._findAllConnectedGroups(bondedAtoms);

    // Step 5: Create one molecule for each connected group
    for (const group of groups) {
        if (group.length < 2) continue;
        
        const molecule = new Molecule(group);
        
        for (const atom of group) {
            atom.moleculeId = molecule.id;
        }
        
        this.molecules.set(molecule.id, molecule);
    }

    this.stats.moleculeCount = this.molecules.size;
}
```

**Key Principles**:
1. **Clean slate each update**: Clear all moleculeIds and molecules before rebuilding
2. **Simple BFS grouping**: `_findAllConnectedGroups()` traverses via bonds only
3. **One molecule per group**: No complex extend/merge logic needed
4. **Single responsibility**: `updateMolecules()` handles ALL molecule state

### Bug #4: MoleculeId Inconsistency (2026-01)

**Problem**: Atoms within the same molecule had different or missing `moleculeId` values. The Inspector would show some atoms with a moleculeId and others without, even though they were visually bonded together.

**Root Cause**: Multiple code paths could set/clear `moleculeId`:
- Molecule constructor
- `updateMolecules()` extend/merge logic
- `_releaseWeakestAtom()` clearing individual atoms
- Bond breaking/forming

**Failed Approaches**:
1. Just fixing Molecule constructor - didn't work because `updateMolecules` could override
2. Relying on bond filtering - missed edge cases where atoms had bonds but wrong moleculeId

**Fix Applied**: Added validation step at end of `updateMolecules()`:
```javascript
// VALIDATION: Ensure ALL atoms in each molecule have correct moleculeId
for (const molecule of this.molecules.values()) {
    for (const atom of molecule.atoms) {
        if (atom.moleculeId !== molecule.id) {
            atom.moleculeId = molecule.id;
        }
    }
}

// Clear orphaned moleculeIds (atoms claiming non-existent molecules)
for (const atom of this.atoms.values()) {
    if (atom.moleculeId && !this.molecules.has(atom.moleculeId)) {
        atom.moleculeId = null;
    }
}
```

### Bug #5: Bond Count Mismatch (atom.bonds vs environment.bonds)

**Problem**: Inspector showed "Bonds: 0" for atoms that clearly had visual bonds. Visual bonds rendered correctly but `atom.bonds.length` was 0.

**Root Cause**: Two separate bond storage systems existed:
- `atom.bonds` - Array on each Atom object
- `environment.bonds` - Global Map used for rendering

`Environment.addBond()` only added to the global map. While the `Bond` constructor calls `atom.addBond()`, deserialization and other code paths could skip this.

**Fix Applied**: Added `syncBonds()` method called at start of `Environment.update()`:
```javascript
syncBonds() {
    // Clear all atom bond arrays
    for (const atom of this.atoms.values()) {
        atom.bonds = [];
    }
    // Rebuild from environment.bonds (source of truth)
    for (const bond of this.bonds.values()) {
        if (bond.atom1 && bond.atom2) {
            bond.atom1.bonds.push(bond);
            bond.atom2.bonds.push(bond);
        }
    }
}
```

**Key Insight**: `environment.bonds` is the source of truth. `atom.bonds` is a convenience cache that must stay synchronized.

### Bug #6: Intention System Failures (2026-01)

**Problem**: Multiple issues with molecule blueprint intentions:
1. Atoms didn't move toward intentions (only worked inside radius)
2. Intentions disappeared after ~10,000 ticks (timeout)
3. Unrelated molecules forming in zone triggered false fulfillment
4. Progress counters were unreliable

**Root Cause Analysis**:
1. **Attraction limited to radius**: `_attractComponents()` only applied force for `dist < this.radius`
2. **Timeout removal**: `if (this.age > this.maxAge) { this.fulfilled = true }` in `update()`
3. **No formula validation**: `_formMolecule()` set `fulfilled=true` regardless of resulting formula
4. **Wrong atom counting**: Mixed free vs bonded atoms in progress calculation

**Fixes Applied**:

1. **Long-range attraction** in `_attractComponents()`:
```javascript
if (dist < this.radius) {
    // Strong attraction inside radius
    forceMagnitude = this.attractionForce * (1 - dist / this.radius);
} else {
    // Weaker attraction outside radius (inverse-square falloff)
    const outsideFactor = this.radius / dist;
    forceMagnitude = this.attractionForce * 0.5 * (outsideFactor * outsideFactor);
}
forceMagnitude = Math.max(forceMagnitude, 0.1); // Minimum force
```

2. **Removed timeout** - intentions persist until actually fulfilled or manually deleted

3. **Formula validation** in `_formMolecule()`:
```javascript
if (this.blueprint.formula && molecule.formula === this.blueprint.formula) {
    this.createdEntity = molecule;
    this.fulfilled = true;
} else {
    // Wrong molecule formed - don't fulfill, keep trying
}
```

### Bug #7: Invalid Polymer Formation

**Problem**: Simple molecules like H2, H2O, NH3 were forming polymers when placed near each other.

**Root Cause**: `findPotentialPolymers()` had no validation for which molecules could polymerize together. Any stable molecules within distance formed chains.

**Fix Applied**: Added validation blocklist and minimum size in `findPotentialPolymers()`:
```javascript
// Simple molecules that should NEVER form polymers
const nonPolymerFormulas = new Set([
    'H2', 'O2', 'N2', 'CO', 'CO2', 'H2O', 'NH3', 'CH4',
    'HO', 'HN', 'CN', 'NO', 'H2N', 'H3N', 'HCN', 'H2S',
    'O3', 'N2O', 'NO2', 'SO2', 'H2CO', 'CH3', 'C2H2'
]);

// Skip simple molecules
if (mol.formula && nonPolymerFormulas.has(mol.formula)) continue;

// Molecules must have at least 5 atoms to polymerize
if (mol.atoms.length < 5) continue;
```

**Chemistry Rule**: Only complex molecules (amino acids, nucleotides, etc.) can form polymers. Simple stable molecules cannot.

### Bug #8: Stale Bonds After Molecule Decay (2026-01)

**Problem**: Multiple related issues causing bond/molecule inconsistencies:
1. Atoms appeared to have bonds to multiple molecules simultaneously
2. Stable molecules showed old bonds to previously unstable molecules
3. Atoms belonging to molecules incorrectly showed up in molecule view level
4. Bond.break() didn't remove bonds from environment.bonds Map

**Root Cause Analysis**:
1. **Bond.break() only updates atom.bonds, not environment.bonds**: When molecules decay via `_releaseWeakestAtom()` or restructure bonds via `_restructureBonds()`, they call `bond.break()` which only removes the bond from `atom.bonds` arrays. The bond object remained in `environment.bonds` Map.
2. **No synchronization between bond storage systems**: Two separate storage systems (`environment.bonds` Map and `atom.bonds` arrays) could become desynchronized.
3. **Molecule.atoms array could become stale**: When fingerprints matched existing molecules, old atoms arrays were preserved even if group composition changed.

**Fix Applied**:

1. **Added `syncBonds()` method** to Environment that cleans up broken/stale bonds:
```javascript
syncBonds() {
    // Step 1: Remove broken bonds from environment.bonds
    const bondsToRemove = [];
    for (const [bondId, bond] of this.bonds) {
        const atom1Exists = bond.atom1 && this.atoms.has(bond.atom1.id);
        const atom2Exists = bond.atom2 && this.atoms.has(bond.atom2.id);
        
        if (!atom1Exists || !atom2Exists) {
            bondsToRemove.push(bondId);
            continue;
        }
        
        // Check if bond has been broken (atoms don't have it)
        const atom1HasBond = bond.atom1.bonds.includes(bond);
        const atom2HasBond = bond.atom2.bonds.includes(bond);
        
        if (!atom1HasBond || !atom2HasBond) {
            bondsToRemove.push(bondId);
        }
    }
    
    for (const bondId of bondsToRemove) {
        this.bonds.delete(bondId);
    }
    
    // Step 2: Rebuild atom.bonds from environment.bonds (source of truth)
    for (const atom of this.atoms.values()) {
        atom.bonds = [];
    }
    for (const bond of this.bonds.values()) {
        if (bond.atom1 && bond.atom2) {
            bond.atom1.bonds.push(bond);
            bond.atom2.bonds.push(bond);
        }
    }
}
```

2. **Call `syncBonds()` at start of `update()`** - ensures bonds are clean before any other operations.

3. **Update molecule.atoms when preserving molecules** in `updateMolecules()`:
```javascript
if (existingMolecule) {
    existingMolecule.atoms = group; // Keep atoms array fresh
    newMolecules.set(existingMolecule.id, existingMolecule);
    // ...
}
```

4. **Enhanced moleculeId cleanup** - verify atoms are actually in their claimed molecule:
```javascript
if (atom.moleculeId) {
    const molecule = newMolecules.get(atom.moleculeId);
    if (!molecule || !molecule.atoms.includes(atom)) {
        atom.moleculeId = null;
    }
}
```

**Key Insight**: Bond lifecycle must be synchronized between environment.bonds (source of truth for rendering) and atom.bonds (convenience cache for chemistry). The `syncBonds()` method provides this synchronization.

### Bug #9: Reshape Loop After Stability (2026-01)

**Problem**: Molecules like C2H4 (Ethylene) would complete reshaping, then immediately start reshaping again in an infinite loop. Console showed repeated "completing reshape to Ethylene" followed by "starting reshape to Ethylene".

**Root Cause**: After `applyStableConfiguration()` completed and set `isReshaping = false`, the next call to `isStable()` would re-check geometry with `needsReshaping()`. Due to small floating-point differences or bond restructuring side-effects, this could return true, triggering another reshape cycle.

**Fix Applied**: Added `geometryVerified` flag to track completed reshapes:

```javascript
// In molecule state initialization:
this.geometryVerified = false;  // Set true after reshaping completes

// In isStable():
if (this.geometryVerified) return true;  // Skip re-check after verified

// In applyStableConfiguration():
this.geometryVerified = true;  // Mark as verified when complete

// In startReshaping(), cancelReshaping(), and updateProperties():
this.geometryVerified = false;  // Clear when composition changes
```

**Key Rule**: Once a molecule completes reshaping successfully, don't re-check geometry until composition changes.

### Bug #10: Stability Requires Geometry Match (2026-01)

**Problem**: Molecules like H2 and H2O would become "stable" immediately upon forming (valence satisfied) without going through the reshaping process. This led to multiple catalogue entries for the same molecule with different shapes.

**Root Cause**: `isStable()` only checked valence satisfaction, not geometry. A molecule with satisfied valences was considered stable even if its atoms were positioned incorrectly.

**Fix Applied**: Updated `isStable()` to require geometry match for known templates:

```javascript
hasValidValence() {
    // Original valence-only check (helper method)
    if (this.atoms.length < 2) return false;
    if (this.bonds.length < 1) return false;
    for (const atom of this.atoms) {
        if (atom.availableValence > 0) return false;
    }
    return true;
}

isStable() {
    if (!this.hasValidValence()) return false;
    if (this.isReshaping) return false;
    if (this.geometryVerified) return true;  // Already verified
    
    // Check template geometry for known molecules
    const template = matchesStableTemplate(this);
    if (template && needsReshaping(this, template)) {
        this.startReshaping(template);
        return false;  // Not stable until reshaped
    }
    return true;
}
```

**Key Rule**: Molecules matching known templates (H2, H2O, CH4, etc.) are NOT stable until their geometry matches the template configuration.

### Bug #11: Intention Repulsion Policy (2026-01)

**Problem**: Multiple issues with how intentions handled molecules:
1. Wrong molecules were being actively broken inside intention zones
2. Unstable molecules with useful atoms were being repelled

**Root Cause**: Overly aggressive handling - intentions were breaking molecules and repelling anything that wasn't the exact target.

**Fix Applied**: Simplified repulsion policy:

```javascript
// In _attractComponents() for molecule intents:
// ONLY repel STABLE molecules that don't match target
// Unstable molecules may still transform - leave them alone
if (!mol.isStable()) continue;  // Don't repel unstable
if (mol.formula === targetFormula) continue;  // Don't repel target
// Repel stable unrelated molecules
```

**Key Rules**:
1. **Never break molecules** inside intentions - let chemistry handle transformation
2. **Only repel stable unrelated molecules** - unstable ones may still become the target
3. **Attract needed atoms** - repel atoms not in target composition

---

## 🧪 Chemistry Rules to Preserve

### Valence System
- Each atom has a `maxBonds` (valence) from `periodic-table.js`
- `availableValence = maxBonds - currentBondCount`
- Atoms can only bond if both have `availableValence > 0`

### Molecule Stability (UPDATED)
A molecule is stable when:
1. It has at least 2 atoms
2. It has at least 1 bond
3. ALL atoms have `availableValence === 0` (valence satisfied)
4. If formula matches a known template, geometry must also match
5. NOT currently reshaping

```javascript
isStable() {
    if (!this.hasValidValence()) return false;
    if (this.isReshaping) return false;
    if (this.geometryVerified) return true;
    
    const template = matchesStableTemplate(this);
    if (template && needsReshaping(this, template)) {
        this.startReshaping(template);
        return false;
    }
    return true;
}
```

### Geometry Verification System
- `geometryVerified` flag prevents reshape loops
- Set `true` after `applyStableConfiguration()` completes
- Cleared when: starting reshape, cancelling reshape, formula changes
- `isStable()` returns `true` immediately if `geometryVerified` is set
- `updateProperties()` clears the flag if formula changes (composition changed)

```javascript
updateProperties() {
    const oldFormula = this.formula;
    this.formula = this.calculateFormula();
    this.fingerprint = this.calculateFingerprint();
    
    // If formula changed, geometry needs re-verification
    if (oldFormula && oldFormula !== this.formula) {
        this.geometryVerified = false;
    }
}
```

### Bond Requirements
- Bonds are created explicitly via the `Bond` constructor
- The Bond constructor calls `atom1.addBond(this)` and `atom2.addBond(this)`
- Atoms track their bonds in `atom.bonds[]` array
- Visual proximity does NOT create bonds
- Molecules are groups of atoms connected BY BONDS, not by proximity

---

## 📂 Key Files and Responsibilities

### Entity Layer (`src/entities/`)

| File | Purpose | Critical Methods |
|------|---------|------------------|
| `atom.js` | Fundamental particle | `canBondWith()`, `availableValence` |
| `bond.js` | Chemical bond | Constructor registers with both atoms |
| `molecule.js` | Bonded atom group | `isStable()`, `canPolymerize()`, `bonds` getter |
| `polymer.js` | Molecule chain | `findPotentialPolymers()` |
| `intention.js` | Blueprint zones | `_formMolecule()` - must validate bonds |

### Core Layer (`src/core/`)

| File | Purpose | Critical Methods |
|------|---------|------------------|
| `environment.js` | Entity container | `updateMolecules()`, `_findAllConnectedGroups()` |
| `simulation.js` | Update loop | `update()`, `setSpeed()` |

### Viewer Layer (`src/viewer/`)

| File | Purpose |
|------|---------|
| `viewer.js` | Multi-level rendering |
| `controls.js` | Input handling |
| `catalogue-ui.js` | Right panel UI, atom palette in catalogue |

### Main Entry

| File | Purpose | Critical Methods |
|------|---------|------------------|
| `main.js` | Application setup | `_populateAtomPalette()`, `_renderAtomPalette()` |

---

## 🔧 Element Palettes

The atom palette must be synchronized across multiple locations:

1. **`main.js` `_populateAtomPalette()`** - Initial palette at load
2. **`main.js` `_renderAtomPalette()`** - Level 0 palette render
3. **`catalogue-ui.js`** - Catalogue atoms panel
4. **`cell-simulator.html` (2 locations)** - Both palette functions in bundle

Current elements list: `['H', 'C', 'N', 'O', 'P', 'S', 'Cl', 'Na', 'K', 'Ca', 'Fe']`

When adding elements:
1. Add to `periodic-table.js` with valence, mass, radius, color
2. Add to all palette arrays (4 locations total)

---

## 🧬 Polymer Types

Polymers are classified by elemental composition:

| Type | Detection Logic |
|------|-----------------|
| `NUCLEIC_ACID` | Has P and N |
| `PROTEIN` | Has N but no P |
| `CARBOHYDRATE` | C:H:O ratio ~1:2:1, no N/P |
| `LIPID` | High H:C ratio, low O, no N/P |
| `GENERIC` | Default |

---

## ✅ Testing Checklist

Before considering a change complete, verify:

### Basic Molecule Tests
1. [ ] Place H atoms → they bond to form H2
2. [ ] H2 molecules do NOT form polymers (they're stable)
3. [ ] Place Fe atoms near each other → they remain as individual atoms (no bonds form between Fe-Fe)
4. [ ] Inspector shows correct bond count for selected molecules
5. [ ] Transition to Level 2 shows only valid molecules (with bonds)

### MoleculeId Consistency Tests
6. [ ] Select each atom in a molecule → ALL show same Molecule ID in Inspector
7. [ ] Switch between Level 1 and 2 → molecules remain intact, no duplicates
8. [ ] Free atoms (not bonded) show NO Molecule ID

### Intention System Tests
9. [ ] Place CH4 intention, add atoms outside zone → atoms move toward center
10. [ ] Place unrelated molecule (e.g., H2O) inside CH4 intention → intention does NOT fulfill
11. [ ] Intention persists longer than 30+ seconds without disappearing
12. [ ] Progress counter updates correctly as matching atoms enter zone

### Polymer Formation Tests
13. [ ] Place H2 + H2 close together → do NOT form polymer
14. [ ] Place H2O molecules close together → do NOT form polymer
15. [ ] Only molecules with 5+ atoms can potentially polymerize

### Geometry & Reshaping Tests
16. [ ] H2 molecule goes through reshape animation before becoming stable
17. [ ] C2H4 (Ethylene) completes reshaping WITHOUT looping indefinitely
18. [ ] Console does NOT show repeated "completing reshape" followed by "starting reshape"
19. [ ] Stable molecule with `geometryVerified=true` does NOT trigger new reshape


---

## 📝 Code Style

- ES6 classes with JSDoc comments
- Global `window.ClassName = ClassName` exports
- No module bundler - script order matters in `index.html`
- CSS uses custom properties (variables) in `:root`

---

## �️ UI Behaviors to Preserve

### Play/Pause Button
- Shows "▶️ Play" when simulation is paused (initial state)
- Shows "⏸️ Pause" when simulation is running
- Updated in THREE places: `index.html`, `main.js`, `controls.js`- Button has class `play-pause-btn` for wider styling to fit text
- Initial HTML must show "▶️ Play" since simulation starts paused

```javascript
// In main.js _setupUI():
playPauseBtn.textContent = this.simulation.running ? '⏸️ Pause' : '▶️ Play';

// In controls.js _updatePlayButton():
btn.textContent = this.simulation.running ? '⏸️ Pause' : '▶️ Play';
```
### Paused Interaction
- Pan (right-click drag) and zoom (scroll wheel) must work when paused
- Both `_onWheel()` and panning code in `_onMouseMove()` call `this.viewer.render()` to refresh view

```javascript
// In _onWheel():
this.viewer.zoom(delta, x, y);
this.viewer.render();  // CRITICAL: refresh when paused

// In _onMouseMove() panning section:
this.viewer.pan(dx, dy);
this.viewer.render();  // CRITICAL: refresh when paused
```

---

## 🚫 Common Mistakes to Avoid

1. **Forgetting the bundle**: Always update `cell-simulator.html` when changing source files
2. **Proximity-based molecules**: Never group atoms into molecules without bond validation
3. **Ignoring valence**: Always check `availableValence` before forming bonds
4. **Breaking isStable()**: This method gates polymerization AND geometry verification
5. **Breaking canPolymerize()**: Must return `false` for stable molecules
6. **Hardcoded element lists**: Multiple locations need updating when adding elements
7. **Breaking geometryVerified**: This flag prevents reshape loops - don't remove it
8. **Repelling unstable molecules**: Only repel STABLE unrelated molecules in intentions

---

## 🔄 Synchronization Workflow

When making changes:

1. Make the change in the source file under `src/`
2. Find the equivalent code in `cell-simulator.html`
3. Apply the same change to the bundle
4. Verify both `index.html` and `cell-simulator.html` work correctly
