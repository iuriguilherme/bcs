# BioChemSim

[![Conventional Code](https://img.shields.io/badge/code-conventional%20🏭-red?style=for-the-badge)](https://github.com/zwbao/certified-organic-code)

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
deno run --allow-read --allow-write --allow-run build.ts
```

**Important**: Changes to source files in `src/` do NOT automatically update `index.html`. You must run the build script.

## Project Structure

```
cs1/
├── index.html           # Production bundle (served by GitHub Pages)
├── dev.html             # Development entry point (loads individual scripts)
├── index.css            # Main stylesheet
├── build.ts             # Deno build script
├── deno.json            # Deno configuration (lint scope, task aliases)
├── package.json         # npm dependencies (Playwright test runner)
├── playwright.config.js # Playwright test configuration
├── src/
│   ├── main.js          # Application initialization
│   ├── core/
│   │   ├── environment.js   # Entity container, spatial grid, physics
│   │   ├── simulation.js    # Main update loop and timing
│   │   └── utils.js         # Helpers (Vector2, random, Debug)
│   ├── data/
│   │   ├── periodic-table.js   # Element definitions (valence, mass, color)
│   │   └── stable-molecules.js # Pre-defined stable molecule patterns
│   ├── entities/
│   │   ├── atom.js               # Chemical particle with valence bonding
│   │   ├── bond.js               # Chemical bonds (spring physics)
│   │   ├── molecule.js           # Bonded atom groups with stability detection
│   │   ├── polymer.js            # Molecule chains (proteins, lipids, nucleic acids)
│   │   ├── cell.js               # Living unit with neural network behavior
│   │   ├── intention.js          # Blueprint attraction zones
│   │   ├── cell-memory.js        # Memory system for cell behavior
│   │   ├── prokaryote.js         # Prokaryotic cell implementation
│   │   └── prokaryote-factory.js # Blueprint factory for prokaryotes
│   ├── catalogue/
│   │   ├── blueprint.js          # Base blueprint classes
│   │   ├── catalogue.js          # IndexedDB-backed discovery and storage
│   │   ├── monomer-templates.js  # Essential monomer definitions
│   │   ├── polymer-blueprints.js # Polymer templates (lipids, proteins, DNA)
│   │   └── cell-blueprints.js    # Cell type definitions
│   ├── systems/
│   │   ├── atom-spawner.js    # Continuous atom spawning
│   │   └── neural-network.js  # Neural network for cell behavior
│   └── viewer/
│       ├── viewer.js       # Multi-level rendering engine
│       ├── controls.js     # Input handling (mouse, keyboard, tools)
│       ├── catalogue-ui.js # Right-panel blueprint UI
│       └── tutorial.js     # Interactive tutorial system
└── tests/
    ├── fixtures/
    │   └── app.js          # Shared test helpers
    ├── scenarios/          # Playwright test scenarios (t01–t06)
    ├── stub_test.ts        # Deno CI placeholder
    └── README.md           # Test documentation and spawn rate reference
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

### Prokaryotes

Prokaryotes are the simplest living cells, assembled from polymer components (membrane lipids, nucleoid DNA, ribosomes). Once assembled, they are self-sustaining entities that:

1. **Metabolize** — consume ATP continuously to stay alive; absorb nearby carbohydrate polymers as nutrients
2. **Replicate** — when ATP exceeds a threshold and the cell has ribosomes, synthesis begins (progress 0→1, driven by ribosome count); at completion the cell divides via **binary fission**, spawning a daughter cell with cloned polymer structure
3. **Die** — when ATP is exhausted

The replication cycle is: `idle → synthesizing → idle`. A visual tint (green→amber) marks cells mid-synthesis. Daughter cells start with a small ATP reserve and must reach maturity (age > 100 ticks) before they can divide again.

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

```bash
deno run --allow-read --allow-write --allow-run build.ts
```

Concatenates all JavaScript from `src/` and inlines CSS into `index.html`.

### Key Files

| File | Purpose |
|------|---------|
| `dev.html` | Development entry — loads individual scripts for easy debugging |
| `index.html` | Production bundle — auto-generated, served by GitHub Pages |
| `build.ts` | Deno build script (requires `--allow-run` for `git describe`) |
| `deno.json` | Lint scope (`src/`, `build.ts`) and rule exclusions |

### Testing

Playwright automated tests cover core simulation behaviors end-to-end:

```bash
npm install && npx playwright install chromium  # first time only
npm test          # run all scenarios (dev.html + index.html)
npm run test:dev  # dev.html only
```

Tests live in `tests/scenarios/`. Every fix must pass `npm test` before being considered complete — see `CLAUDE.md` Testing Requirements for full rules.


## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of **MERCHANTABILITY** or **FITNESS FOR A PARTICULAR PURPOSE**. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

📄 **[LICENSE](LICENSE)** - Full license text

### Third-Party Licenses

**Font Awesome Free** (https://fontawesome.com)  
Icons used throughout the UI are from Font Awesome Free.  
See [`assets/LICENSE.txt`](assets/LICENSE.txt) for full license details, or:
- Icons: [CC BY 4.0 License](https://creativecommons.org/licenses/by/4.0/)
- Fonts: [SIL OFL 1.1 License](https://scripts.sil.org/OFL)
- Code: [MIT License](https://opensource.org/licenses/MIT)
