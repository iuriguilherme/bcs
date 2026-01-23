# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**Project**: BioChemSim - A hierarchical life simulation from atoms to social organisms  
**Tech Stack**: Vanilla JavaScript, HTML5 Canvas, Deno (for build tooling), IndexedDB (for persistence)  
**Build Command**: `deno run --allow-read --allow-write --allow-run build.ts`  
**Development**: Open `dev.html` in browser. Production: `index.html` (do not edit directly)  
**Levels**: 0=Atoms → 1=Molecules → 2=Polymers → 3+=Cells

---

## Critical: The Bundle Problem

**This project has TWO separate code bases that must stay synchronized:**

1. **Source Files** - `src/` directory, `index.css`, `dev.html` (what you edit)
2. **Bundled File** - `index.html` (auto-generated, DO NOT EDIT)

### ⚠️ NEVER edit `index.html` directly
It is auto-generated from source files and will be overwritten on rebuild. Always:
1. Edit source files in `src/`
2. Run `deno run --allow-read --allow-write --allow-run build.ts` to regenerate `index.html`
3. Then commit both source files AND the regenerated `index.html`

**Why?** GitHub Pages serves `index.html`, which must contain the latest bundled code. CI/CD workflows or other tools depend on the bundle being current.

---

## Project Architecture

### High-Level Data Flow

```
User Input (Canvas/UI)
    ↓
Controls (mouse/keyboard handlers)
    ↓
Environment (entity container + spatial grid + physics simulation)
    ├── Atoms (valence-based bonding)
    ├── Bonds (chemical connections)
    ├── Molecules (bonded atom groups)
    ├── Polymers (molecule chains)
    ├── Cells (neural network-based behavior)
    ├── Intentions (blueprint attraction zones)
    └── Physics (forces, collisions)
    ↓
Simulation (main update loop)
    ↓
Viewer (Canvas rendering at current level)
```

### Key Modules

**Core** (`src/core/`)
- `environment.js` - Entity container with spatial grid, molecule/polymer formation, physics
- `simulation.js` - Main update loop with timing control
- `utils.js` - Helpers (Vector2, random functions, etc.)

**Entities** (`src/entities/`)
- `atom.js` - Individual particles with valence-based bonding
- `bond.js` - Chemical bonds connecting atoms (spring physics)
- `molecule.js` - Groups of bonded atoms; detects when atoms satisfy valence
- `polymer.js` - Chains of molecules (proteins, lipids, nucleic acids)
- `cell.js` - Living units with neural network behavior
- `intention.js` - Blueprint attraction zones that guide polymer/cell formation
- `cell-memory.js` - Memory system for cell behavior
- `prokaryote.js` - Prokaryotic cell (uses memory + neural network)
- `prokaryote-factory.js` - Blueprint factory for prokaryotes

**Data** (`src/data/`)
- `periodic-table.js` - Element definitions (valence, mass, color)
- `stable-molecules.js` - Pre-defined stable molecule patterns

**Catalogue** (`src/catalogue/`)
- `blueprint.js` - Base classes for blueprints (MoleculeBlueprint, PolymerBlueprint, CellBlueprint)
- `catalogue.js` - IndexedDB-backed discovery and storage
- `monomer-templates.js` - Essential monomer definitions
- `polymer-blueprints.js` - Essential polymer templates (lipids, proteins, nucleic acids)
- `cell-blueprints.js` - Cell type definitions

**Viewer** (`src/viewer/`)
- `viewer.js` - Multi-level rendering engine (draws atoms/molecules/cells at appropriate detail)
- `controls.js` - Input handling and tool management
- `catalogue-ui.js` - Right-panel UI for blueprint discovery
- `tutorial.js` - Interactive tutorial system

**Systems** (`src/systems/`)
- `atom-spawner.js` - Continuous atom spawning with configurable pool and weights
- `neural-network.js` - Neural network for cell behavior

---

## Chemistry Rules (Critical for Correctness)

### Valence-Based Bonding
Atoms have "available bonding slots" (valence):
- **H**: valence 1 (can form 1 bond)
- **C**: valence 4 (can form up to 4 bonds)
- **O**: valence 2
- **N**: valence 3

Bonds form automatically when atoms with available valence are close. Multiple bonds can exist between the same two atoms (e.g., C=O, C≡C).

### Molecule Formation
A **Molecule** is a connected group of atoms where:
1. All atoms have **at least one bond** (not just proximity)
2. All atoms are connected via bonds (graph traversal)
3. Each molecule is detected by `Environment.updateMolecules()` using BFS through bonds

**Critical**: Proximity alone does NOT create molecules. Only **bonded atoms** form molecules.

### Stability
A molecule is **stable** when all atoms have their valences **fully satisfied**:
- ✅ H₂ is stable (each H uses its 1 valence slot)
- ✅ CH₄ is stable (C uses all 4 slots with 4 H atoms)
- ❌ CH₃ is NOT stable (C has unsatisfied valence)

### Polymers and Monomers
**Monomers** (like amino acids) have:
- 2+ atoms
- 1+ bonds
- **Free valence** (not fully stable) - this is intentional for chain formation

**Polymers** are chains of monomers that:
1. Have free valence in their constituent monomers
2. Form new bonds between monomers
3. Grow linearly

**Critical Rule**: Fully stable molecules (H₂, O₂, CH₄, H₂O) **CANNOT polymerize** because they have no available valence. The `canPolymerize()` check must return `false` for stable molecules.

### Intentions (Blueprints)
An **Intention** is a blueprint zone that attracts atoms/molecules toward a specific molecular pattern. Multiple intentions can exist simultaneously, each seeking to construct its assigned molecule/cell pattern.

---

## Known Bugs - Do Not Reintroduce

See `AGENTS.md` for detailed documentation of fixed bugs. Key ones:

1. **Molecules without bonds** - Atoms placed near each other were grouped as molecules even without actual bonds
   - Fix: Filter atoms to only those with `bonds.length > 0` in `Molecule` constructor

2. **Stable molecules forming polymers** - H₂, O₂, CH₄ could incorrectly polymerize
   - Fix: `Molecule.canPolymerize()` must check `if (this.isStable()) return false`

3. **Bond count mismatch** - `atom.bonds` cache could be out of sync with `environment.bonds`
   - Fix: Call `environment.syncBonds()` at start of `environment.update()`

4. **MoleculeId inconsistency** - Atoms in same molecule had different moleculeId values
   - Fix: Validate all atoms in molecules have correct moleculeId after `updateMolecules()`

---

## Molecule Formation System (`environment.updateMolecules()`)

This is the core logic for grouping bonded atoms into molecules. Current implementation:

```
1. Get all atoms with at least one bond (filtration)
2. Clear all current molecule assignments (clean slate)
3. Find connected groups using BFS through bonds only
4. Create one Molecule object per connected group
5. Validate all atoms in molecules have correct moleculeId
6. Clear orphaned moleculeIds
```

**Key Principle**: Clean slate each update. Don't try to extend/merge existing molecules - rebuild from scratch each tick. This prevents inconsistencies.

---

## UI Structure

**Left Panel**
- Level buttons (0-3+)
- Tool buttons (Select, Place, Delete)
- Entity palette (atoms/molecules/polymers/cells depending on level)

**Right Panel**
- Catalogue tab: Discovered blueprints
- Inspector tab: Details of selected entity

**Canvas**
- Dragging: Pan camera
- Mouse wheel: Zoom
- Clicks: Place/select depending on tool
- ESC: Cancel current action

---

## Data Serialization

The `Environment` class has `serialize()` and `deserialize()` methods for saving/loading state. Key:
- All atoms, bonds, molecules, polymers, cells, intentions are serialized
- Indices/references are preserved using IDs
- The `Catalogue` has separate export/import for blueprint discovery

---

## Rendering

The `Viewer` class handles multi-level rendering:
- **Level 0**: Render individual atoms and bonds
- **Level 1**: Render molecules
- **Level 2**: Render polymers
- **Level 3+**: Render cells

Each level hides lower-level detail. For example, at Level 1, atoms are not drawn individually; instead, molecules are drawn as geometric shapes.

---

## Debugging

**Console Commands** (open F12):

```javascript
// Enable/disable debug logging by category
Debug.enable('molecules')   // Show molecule formation logs
Debug.enable('intentions')  // Show blueprint attraction logs
Debug.disable('atoms')      // Reduce clutter

// Check enabled categories
Debug.enabledCategories     // View current state
```

**Browser DevTools**:
- Inspect `window.cellApp` to access global app state
- `window.cellApp.environment.atoms` - all atoms
- `window.cellApp.environment.molecules` - all molecules
- `window.cellApp.viewer.selectedMolecule` - currently selected molecule

---

## Performance Considerations

- **Spatial Grid**: Environment maintains grid for fast proximity queries (`getAtomsNear()`)
- **Update Frequency**: Molecule detection runs every tick (~60/sec), but can be optimized
- **Canvas Rendering**: Multi-level rendering means less to draw at higher levels
- **Intention System**: Atomic attractions to intentions can be expensive with many intentions - profile before optimizing

---

## Adding New Features

### New Entity Type
1. Create class in `src/entities/`
2. Add add/remove methods to `Environment`
3. Add update method if needed (called from `Environment.update()`)
4. Add rendering in `Viewer`
5. Update statistics in `Simulation.getStats()`

### New Catalogue System
1. Create blueprint class extending `Blueprint` in `src/catalogue/blueprint.js`
2. Implement `instantiate()` and serialization
3. Add storage/retrieval to `Catalogue`
4. Create UI in `src/viewer/catalogue-ui.js`

### New Simulation Rule
Add to `Environment.update()` method. **Important**: Keep molecule updates last, after all entity changes, to catch new bonding.

---

## Testing

No automated test framework is set up. Manual testing in browser:
1. Open `dev.html` for development mode (loads individual scripts)
2. Open `index.html` for production mode (bundled)
3. Use browser console to inspect state and verify behavior

Before committing:
- Test at each level (0, 1, 2, 3)
- Test blueprint discovery and placement
- Test serialization/deserialization if modified persistence code
- Verify bundle regenerates correctly

---

## File Modification Checklist

When editing source files, remember:

- [ ] Editing `src/**/*.js`? Run build after changes
- [ ] Editing `index.css` or `dev.html`? Run build to update `index.html`
- [ ] Editing molecule/polymer formation logic? Re-check against chemistry rules
- [ ] Added new class? Ensure it's included in `build.ts` script order
- [ ] Modified entity add/remove? Update `Catalogue` if discoverable
- [ ] Regenerated `index.html`? Commit both source AND bundle

---

## Script Loading Order

The build script concatenates JavaScript in this specific order (see `build.ts`):

1. `utils.js` - Foundational helpers
2. `periodic-table.js` - Element data
3. `stable-molecules.js` - Stable patterns
4. **Entities** (atom → bond → molecule → polymer → intention → spawner → neural → cell-memory → cell → prokaryote → factories)
5. **Core** (environment → simulation)
6. **Catalogue** (blueprint → templates → catalogues)
7. **Viewer** (viewer → controls → UI → tutorial)
8. `main.js` - App initialization

**Critical**: Dependencies must load before dependents. If reordering, verify no undefined references.

---

## Versioning

The build script extracts version from:
1. Command-line argument: `deno run ... build.ts v1.2.3`
2. Git tags: `git describe --tags --always`

The version appears in the bundled `index.html` and is accessible as `window.APP_VERSION`.
