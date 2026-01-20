# BioChemSim

A hierarchical life simulation from atoms to social organisms. This is a browser-based interactive simulation where particles follow chemistry rules to form molecules, polymers, and eventually living cells.

## Overview

BioChemSim models emergent biological complexity through 6 hierarchical levels:

1. **Atoms** (Level 0) - Individual chemical elements with valence-based bonding
2. **Molecules** (Level 1) - Bonded atoms forming stable structures
3. **Polymers** (Level 2) - Chains of molecules (proteins, lipids, nucleic acids)
4. **Cells** (Level 3) - Living units with neural network-based behavior
5. **Organisms** (Level 4) - Multi-cellular entities (future)
6. **Populations** (Level 5) - Social structures (future)

## Running the Application

### GitHub Pages (Live Demo)
This project is designed to run directly on GitHub Pages. Simply enable GitHub Pages in your repository settings:
1. Go to **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Choose your branch (e.g., `main`) and root folder (`/`)
4. Click **Save**

The site will be available at `https://<username>.github.io/<repository-name>/`

### Local Development Mode
Open `dev.html` directly in a browser. This loads individual script files for easier debugging.

### Production Mode (Single File)
Open `index.html` which is the bundled file containing all CSS and JavaScript inline. This is what GitHub Pages serves.

### Building the Bundle
To rebuild `index.html` from source files:
```bash
deno run --allow-read --allow-write build.ts
```

**Important**: Changes to source files in `src/` do NOT automatically update `index.html`. You must run the build script.

## Project Structure

```
cs1/
├── index.html          # Production bundle (served by GitHub Pages)
├── dev.html            # Development entry point (loads separate scripts)
├── index.css           # Main stylesheet
├── build.ts            # Deno build script to generate index.html
├── src/
│   ├── main.js         # Application entry point
│   ├── core/
│   │   ├── environment.js  # Entity container with spatial management
│   │   ├── simulation.js   # Main update loop and timing
│   │   └── utils.js        # Helper functions, Vector2, etc.
│   ├── data/
│   │   └── periodic-table.js  # Element definitions with valence/mass/color
│   ├── entities/
│   │   ├── atom.js       # Fundamental particle with valence bonding
│   │   ├── bond.js       # Chemical bonds with spring physics
│   │   ├── molecule.js   # Bonded atom groups
│   │   ├── polymer.js    # Molecule chains (proteins, lipids, etc.)
│   │   ├── protein.js    # Legacy protein entity
│   │   ├── cell.js       # Living cell with neural network brain
│   │   ├── cell-memory.js # Cell memory system
│   │   └── intention.js  # Blueprint attraction zones
│   ├── catalogue/
│   │   ├── blueprint.js       # Blueprint base classes
│   │   ├── catalogue.js       # IndexedDB-backed blueprint storage
│   │   └── polymer-blueprints.js # Polymer template definitions
│   └── viewer/
│       ├── viewer.js       # Multi-level rendering
│       ├── controls.js     # Input handling (mouse, keyboard)
│       └── catalogue-ui.js # Right panel UI for catalogue
```

## Core Concepts

### Valence-Based Chemistry
Atoms bond based on their valence (available bonding slots):
- **Hydrogen (H)**: valence 1
- **Carbon (C)**: valence 4  
- **Nitrogen (N)**: valence 3
- **Oxygen (O)**: valence 2
- **And more...** (see `periodic-table.js`)

Bonds form automatically when atoms with available valence are close together.

### Molecule Formation
Molecules are detected when atoms form connected bonded groups. The `Environment.updateMolecules()` function:
1. Finds all atoms with at least one bond
2. Traverses bonds to find connected groups
3. Creates `Molecule` objects for connected groups

**Critical Rule**: Only atoms with actual chemical bonds are part of molecules. Proximity alone does NOT create molecules.

### Stability
A molecule is **stable** when all constituent atoms have their valences fully satisfied:
- `H2` is stable (2 H atoms each using their 1 valence)
- `CH4` is stable (C uses all 4 valence slots with 4 H atoms)
- `CH3` is NOT stable (C has unsatisfied valence)

### Polymers
Polymers are chains of molecules. They form from molecules that:
1. Have **free valence** (not fully stable)
2. Are close enough spatially
3. Can form new bonds

**Critical Rule**: Fully stable molecules (like H2, O2, CH4) CANNOT polymerize because they have no available valence for forming polymer bonds.

## Available Elements

The following elements are available in the atom palette:

| Symbol | Name | Valence | Category |
|--------|------|---------|----------|
| H | Hydrogen | 1 | Nonmetal |
| C | Carbon | 4 | Nonmetal |
| N | Nitrogen | 3 | Nonmetal |
| O | Oxygen | 2 | Nonmetal |
| P | Phosphorus | 5 | Nonmetal |
| S | Sulfur | 2 | Nonmetal |
| Cl | Chlorine | 1 | Halogen |
| Na | Sodium | 1 | Alkali Metal |
| K | Potassium | 1 | Alkali Metal |
| Ca | Calcium | 2 | Alkaline Earth |
| Fe | Iron | 2 | Transition Metal |

## User Interface

### Left Panel (Tools)
- **Actions**: Select, Place, Delete tools
- **Entity Palette**: Context-aware based on level
  - Level 0: Individual atoms
  - Level 1: Catalogued molecules
  - Level 2: Polymer templates
  - Level 3+: Cells

### Right Panel (Catalogue & Inspector)
- **Catalogue Tab**: Discovered blueprints that can be placed
- **Inspector Tab**: Details of selected entity

### Controls
- **Click**: Place or select depending on active tool
- **Drag**: Pan the view
- **Mouse Wheel**: Zoom
- **ESC**: Cancel current action

## Technical Notes

### Building the Bundle

The project uses a Deno build script to generate `cell-simulator.html` from source files:

```bash
# Build the bundle
deno run --allow-read --allow-write build.ts
```

This concatenates all JavaScript from `src/` and inlines CSS into a single HTML file.

**Note**: The bundle still references `assets/css/all.min.css` for Font Awesome icons. For complete offline usage, include the `assets/` folder alongside the bundle.

### Project Files

| File | Purpose |
|------|---------|
| `index.html` | Development entry - loads individual scripts |
| `cell-simulator.html` | Production bundle - generated by build.ts |
| `build.ts` | Deno build script |
| `bundle.js` | Legacy bundle (not used) |


## License

MIT License - See LICENSE file for details.

### Third-Party Licenses

**Font Awesome Free** (https://fontawesome.com)  
Icons used throughout the UI are from Font Awesome Free.  
See [`assets/LICENSE.txt`](assets/LICENSE.txt) for full license details, or:
- Icons: [CC BY 4.0 License](https://creativecommons.org/licenses/by/4.0/)
- Fonts: [SIL OFL 1.1 License](https://scripts.sil.org/OFL)
- Code: [MIT License](https://opensource.org/licenses/MIT)
