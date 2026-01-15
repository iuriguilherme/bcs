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

---

## 🧪 Chemistry Rules to Preserve

### Valence System
- Each atom has a `maxBonds` (valence) from `periodic-table.js`
- `availableValence = maxBonds - currentBondCount`
- Atoms can only bond if both have `availableValence > 0`

### Molecule Stability
A molecule is stable when:
1. It has at least 2 atoms
2. It has at least 1 bond
3. ALL atoms have `availableValence === 0`

```javascript
isStable() {
    if (this.atoms.length < 2) return false;
    if (this.bonds.length < 1) return false;
    for (const atom of this.atoms) {
        if (atom.availableValence > 0) return false;
    }
    return true;
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

1. [ ] Place H atoms → they bond to form H2
2. [ ] H2 molecules do NOT form polymers (they're stable)
3. [ ] Place Fe atoms near each other → they remain as individual atoms (no bonds form between Fe-Fe)
4. [ ] Inspector shows correct bond count for selected molecules
5. [ ] Transition to Level 2 shows only valid molecules (with bonds)

---

## 📝 Code Style

- ES6 classes with JSDoc comments
- Global `window.ClassName = ClassName` exports
- No module bundler - script order matters in `index.html`
- CSS uses custom properties (variables) in `:root`

---

## 🚫 Common Mistakes to Avoid

1. **Forgetting the bundle**: Always update `cell-simulator.html` when changing source files
2. **Proximity-based molecules**: Never group atoms into molecules without bond validation
3. **Ignoring valence**: Always check `availableValence` before forming bonds
4. **Breaking isStable()**: This method gates polymerization - it must correctly identify satisfied valences
5. **Breaking canPolymerize()**: Must return `false` for stable molecules
6. **Hardcoded element lists**: Multiple locations need updating when adding elements

---

## 🔄 Synchronization Workflow

When making changes:

1. Make the change in the source file under `src/`
2. Find the equivalent code in `cell-simulator.html`
3. Apply the same change to the bundle
4. Verify both `index.html` and `cell-simulator.html` work correctly
