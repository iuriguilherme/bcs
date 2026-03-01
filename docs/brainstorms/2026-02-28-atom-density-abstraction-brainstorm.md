# Atom Density Abstraction Layer

**Date**: 2026-02-28
**Status**: Brainstorm complete
**Author**: Claude + User

## What We're Building

A mode switch that replaces individual atom simulation with a **density grid** — a 20x20 grid of sectors (matching the existing 100x100 spatial grid), where each sector stores scalar values representing atom concentrations by element. This dramatically reduces memory and CPU when the simulation reaches cell-level complexity where individual atoms are no longer meaningful.

**Key behaviors:**
- Manual button triggers the conversion (automatic trigger deferred to later)
- Pause simulation, scan all free atoms, aggregate into density grid per sector
- Existing molecules convert to **rigid-body entities** with virtual atoms (stored as metadata, center-of-mass physics only)
- Density grid is **active** — diffusion spreads atoms between sectors, and molecules/cells can consume from local densities
- Atom spawner adds to sector densities instead of creating Atom objects
- Reversible: can convert back by spawning real atoms from density data (random placement within sectors)

## Why This Approach

At cell level, simulating thousands of individual atoms with per-tick Verlet integration, spatial grid lookups, and bond spring forces becomes the dominant performance bottleneck. Most of these atoms are "background soup" — free hydrogen, oxygen, carbon floating around. They matter as a resource pool but their individual trajectories don't.

The density grid captures **what matters** (element availability per region) while discarding **what doesn't** (exact positions and velocities of free atoms). Molecules that have already formed keep their identity but switch to cheaper rigid-body physics.

## Key Decisions

### 1. Grid Resolution: 100x100 world units (20x20 sectors)
Matches the existing spatial grid. 400 sectors total, each storing a small object of element counts. Minimal memory overhead.

### 2. Molecule Physics: Center-of-mass rigid body
In abstract mode, molecules become single physics entities with position, velocity, and mass. No per-atom forces or spring calculations. Bonds are preserved as metadata for formula/fingerprint identity but don't exert forces.

### 3. Reconstruction: Random placement within sector
When converting back, atoms spawn at random positions within their density sector. Physics naturally settles them. No need for sophisticated placement algorithms.

### 4. Density Evolution: Diffusion + Consumption
The density grid is not a frozen snapshot. Each tick:
- **Diffusion**: Small fractions of atoms flow to neighboring sectors based on concentration gradients (high → low)
- **Consumption**: Intentions and cells request atoms from their local sector via `densityGrid.consume(sectorKey, symbol, count)` — returns the number actually consumed (may be less than requested if sector is depleted). This replaces the current atom-attraction forces for intentions in abstract mode.

### 5. Spawner Integration: Adds to densities
In abstract mode, the atom spawner increments density values in its target zone sectors rather than creating Atom objects. Maintains functional equivalence.

## Data Model

### DensityGrid
```
densityGrid: Map<string, SectorDensity>
  key: "cellX,cellY" (same format as existing grid)
  value: {
    elements: { H: 45, C: 12, O: 8, N: 3, ... },  // atom counts per element
    total: 68  // cached sum for quick access
  }
```

### Virtual Molecule (abstract mode)
```
molecule (modified):
  position: { x, y }         // center of mass
  velocity: { x, y }         // inherited from atoms at conversion
  mass: number                // sum of atom masses
  atoms: VirtualAtom[]        // lightweight: { symbol, relativePos } — no physics
  bonds: BondMetadata[]       // { atom1Index, atom2Index, order } — no spring forces
  formula: string             // preserved
  fingerprint: string         // preserved
  isAbstract: true            // flag for renderer/physics to use simplified path
```

## Conversion Flow

### To Abstract Mode (button click)
1. Pause simulation
2. Run `updateMolecules()` one final time to ensure molecule grouping is current
3. For each molecule (including seed molecules from `env.seedMolecules`):
   - Compute center of mass and aggregate velocity
   - Convert atoms to VirtualAtom records (symbol + relative position)
   - Convert bonds to BondMetadata (indices + order)
   - Set `molecule.isAbstract = true`
   - Remove real Atom and Bond objects from environment
4. For each remaining atom (free atoms not in any molecule):
   - Determine its grid sector
   - Increment `densityGrid[sector].elements[atom.symbol]`
   - Remove atom from environment (and any orphan bonds)
5. Remove all remaining bonds from environment
6. Set `environment.abstractMode = true`
7. Resume simulation (now running abstract update loop)

### To Concrete Mode (button click)
1. Pause simulation
2. For each sector in density grid:
   - For each element and its count:
     - Spawn that many real Atom objects at random positions within the sector
3. For each abstract molecule:
   - Recreate real Atom objects at molecule center + relative offsets
   - Recreate real Bond objects between atom pairs (atoms must exist first)
   - Set `molecule.isAbstract = false`
   - Re-link molecule to its polymer if `polymerId` exists
4. Clear density grid
5. Set `environment.abstractMode = false`
6. Run `updateMolecules()` to rebuild molecule grouping from reconstructed atoms/bonds
7. Resume simulation

## Rendering in Abstract Mode

### Level 0 (Atom view)
Instead of individual atoms, render the density grid as a **heatmap overlay**:
- Each sector colored by total atom density (transparent → blue → green → yellow → red)

### Level 1+ (Molecule and above)
Molecules render as before (simplified blobs). They just happen to use center-of-mass position instead of computed-from-atoms position. Visually identical.

## Update Loop in Abstract Mode

```
environment.update(dt):
  if (abstractMode):
    1. diffuseDensityGrid(dt)      // spread atoms between sectors
    2. updateAbstractMolecules(dt)  // rigid-body: boundary forces, molecule-molecule repulsion, intention attraction
    3. updateIntentions(dt)         // intentions consume from density grid
    4. updatePolymers()             // polymer detection (uses molecule identity, not atoms)
    5. updateCells()                // cell behavior (unchanged)
    6. updateProkaryotes(dt)        // prokaryote behavior (unchanged)
  else:
    ... existing update loop ...
```

## Open Questions

*None — all questions resolved during brainstorm.*

## Scope Boundaries (What We're NOT Doing)

- **NOT** abstracting the molecule layer (deferred to future)
- **NOT** making the switch automatic (manual button for now)
- **NOT** changing cell/prokaryote behavior — they continue as-is
- **NOT** modifying the intention system fundamentally — it just reads from density grid instead of attracting real atoms when in abstract mode
- **NOT** changing polymer identity model — polymers still reference molecules by ID, but molecule internals become virtual
- **NOT** optimizing rendering beyond basic heatmap — fancy visualizations can come later

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Molecule identity lost during conversion | Preserve formula, fingerprint, bond metadata as VirtualAtom records |
| Diffusion parameters hard to tune | Start with small diffusion rate (1-2% per tick), expose as parameter |
| Intention system breaks in abstract mode | Intentions check `abstractMode` and pull from density grid instead of attracting atoms |
| Back-conversion produces unnatural atom distributions | Random placement + letting physics settle for a few ticks handles this |
| Bond reconstruction creates invalid chemistry | Store exact bond topology in metadata, reconstruct deterministically |
