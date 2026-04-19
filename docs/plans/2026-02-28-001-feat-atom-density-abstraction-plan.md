---
title: feat: Implement Atom Density Abstraction Layer
type: feat
status: active
date: 2026-02-28
origin: docs/brainstorms/2026-02-28-atom-density-abstraction-brainstorm.md
---

# Atom Density Abstraction Layer Implementation Plan

## Overview

Implement a density grid abstraction layer that replaces individual atom simulation with sector-based density values to significantly reduce memory and CPU usage at cell-level complexity where individual atom trajectories are no longer meaningful.

## Problem Frame

At cell-level simulation complexity, simulating thousands of individual atoms with per-tick Verlet integration, spatial grid lookups, and bond spring forces becomes the dominant performance bottleneck. Most atoms are "background soup" - free hydrogen, oxygen, carbon floating around that matter as a resource pool but whose individual trajectories don't significantly impact higher-level behaviors.

## Requirements Trace

- R1. Manual button triggers conversion between atom-level and density-grid simulation modes
- R2. Existing molecules convert to rigid-body entities with virtual atoms (preserving formula/fingerprint identity)
- R3. Density grid is active - diffusion spreads atoms between sectors and molecules/cells consume from local densities
- R4. Atom spawner adds to sector densities instead of creating Atom objects
- R5. Reversible conversion: can convert back by spawning real atoms from density data

## Scope Boundaries

- NOT abstracting the molecule layer (deferred to future work)
- NOT making the switch automatic (manual button for now)
- NOT changing cell/prokaryote behavior - they continue as-is
- NOT modifying the intention system fundamentally - it just reads from density grid in abstract mode

## Context & Research

### Relevant Code and Patterns
- Environment.updateMolecules() - handles molecule formation/grouping
- AtomSpawner - creates new atoms in the simulation
- Molecule class - represents bonded atom groups
- Spatial grid system - existing 100x100 grid that will map to 20x20 sectors

### Institutional Learnings
- From Bug #12: Bonds Lost After Reshaping - learned importance of bidirectional bond synchronization
- From Bug #6: Intention System Failures - learned about proper attraction/repulsion logic
- Performance patterns from existing codebase showing grid-based optimizations work well

## Key Technical Decisions

- **Grid Resolution**: 100x100 world units mapped to 20x20 sectors (5x5 units per sector) matching existing spatial grid
- **Molecule Physics**: In abstract mode, molecules become single physics entities with center-of-mass position/velocity/mass, bonds preserved as metadata only
- **Reconstruction**: Random placement within sector when converting back to atom-level simulation
- **Density Evolution**: Each tick applies diffusion (concentration-gradient flow) and consumption (intention/cell requests)
- **Spawner Integration**: In abstract mode, atom spawner increments density values rather than creating Atom objects

## Open Questions

### Resolved During Planning
- Grid size: Matched existing spatial grid for consistency and simplicity
- Molecule representation: VirtualAtom records store lightweight atom data for reconstruction
- Density consumption: Returns actual consumed count (may be less than requested if depleted)

### Deferred to Implementation
- Exact diffusion rate: Will tune based on performance testing and visual fidelity
- Heatmap color scheme: Will implement basic transparent→blue→green→yellow→red progression
- Button placement/UI: Will integrate with existing control panel patterns

## Implementation Units

- [ ] **Unit 1: DensityGrid Data Structure**

  **Goal:** Create the core density grid data structure that tracks atom concentrations by element per sector
  
  **Requirements:** R1, R2, R3, R4, R5
  
  **Dependencies:** None
  
  **Files:**
  - Create: `src/core/densityGrid.js`
  - Modify: `src/core/environment.js`
  - Test: `tests/unit/densityGrid.test.js`
  
  **Approach:**
  - Implement DensityGrid class with Map storage keyed by "cellX,cellY"
  - Each sector stores elements object (H, C, N, O, etc. counts) and cached total
  - Provide methods for get, set, increment, consume, and diffuse operations
  - Integrate with Environment class to hold densityGrid instance
  
  **Execution note:** Implement test-first - write failing tests for core density operations before implementation
  
  **Patterns to follow:** Existing Environment class patterns for data structures and methods
  
  **Test scenarios:**
  - Happy path: Creating grid, setting/getting sector densities, consuming atoms
  - Edge cases: Consuming from empty sector, consuming more than available
  - Error paths: Invalid sector coordinates, negative consumption requests
  - Integration: Grid updates properly interface with Environment update loop
  
  **Verification:** DensityGrid correctly tracks atom counts, supports consumption with proper limits, and integrates with Environment without breaking existing functionality

- [ ] **Unit 2: Atom-to-Density Conversion System**

  **Goal:** Implement the bidirectional conversion system between atom-level and density-grid simulation modes
  
  **Requirements:** R1, R2, R3, R4, R5
  
  **Dependencies:** Unit 1 (DensityGrid)
  
  **Files:**
  - Modify: `src/core/environment.js`
  - Modify: `src/entities/atom.js`
  - Modify: `src/entities/molecule.js`
  - Modify: `src/main.js` (for UI button)
  - Test: `tests/integration/conversion.test.js`
  
  **Approach:**
  - Implement `convertToAbstractMode()` in Environment: pause sim, final updateMolecules(), convert molecules to rigid-body, free atoms to density grid
  - Implement `convertToConcreteMode()` in Environment: spawn atoms from density, recreate molecules from virtual data, clear grid
  - Modify AtomSpawner to increment densities instead of creating atoms when in abstract mode
  - Add UI toggle button to trigger conversion
  
  **Patterns to follow:** Existing pause/resume patterns in simulation.js, molecule conversion patterns in updateMolecules()
  
  **Test scenarios:**
  - Happy path: Successful conversion both ways with proper molecule/virtual atom preservation
  - Edge cases: Converting with zero atoms/molecules, converting with only free atoms
  - Error paths: Attempting conversion while simulation not paused
  - Integration: Full conversion cycle maintains chemical properties and visual consistency
  
  **Verification:** Conversion preserves molecule identity (formula/fingerprint), correctly transfers atom data to/from density grid, and maintains simulation continuity

- [ ] **Unit 3: Abstract Mode Update Loop**

  **Goal:** Implement the specialized update loop for density-grid simulation mode
  
  **Requirements:** R1, R2, R3
  
  **Dependencies:** Unit 1, Unit 2
  
  **Files:**
  - Modify: `src/core/environment.js`
  - Modify: `src/core/simulation.js`
  - Test: `tests/integration/abstractModeUpdate.test.js`
  
  **Approach:**
  - Modify Environment.update() to branch based on abstractMode flag
  - In abstract mode: diffuse density grid, update abstract molecules (rigid-body physics), update intentions (consume from grid), update polymers/cells/prokaryotes
  - Implement diffuseDensityGrid() method that flows atoms between sectors based on concentration gradients
  - Modify intention system to consume from density grid instead of attracting real atoms in abstract mode
  
  **Patterns to follow:** Existing update loop structure in Environment.js, rigid-body physics patterns from molecule.js
  
  **Test scenarios:**
  - Happy path: Abstract mode update loop runs without errors, diffusion spreads atoms correctly
  - Edge cases: Zero density grid, maximum density sectors
  - Error paths: Invalid diffusion parameters
  - Integration: Intentions properly consume from grid, molecules maintain proper physics in abstract mode
  
  **Verification:** Abstract mode update loop executes all required systems correctly, maintains conservation of atoms, and provides performance improvement over atom-level simulation

- [ ] **Unit 4: Abstract Mode Rendering**

  **Goal:** Implement density grid visualization as heatmap overlay in atom view level
  
  **Requirements:** R3
  
  **Dependencies:** Unit 1, Unit 2
  
  **Files:**
  - Modify: `src/viewer/viewer.js`
  - Modify: `src/viewer/controls.js` (for level switching logic)
  - Test: `tests/integration/abstractModeRendering.test.js`
  
  **Approach:**
  - In viewer.js, when in abstract mode and level 0, render density grid as colored sectors
  - Implement sector-to-screen coordinate mapping using existing grid system
  - Create heatmap coloring: transparent (low) → blue → green → yellow → red (high density)
  - Ensure molecules/cells/prokaryotes still render correctly in levels 1+ using center-of-mass position
  
  **Patterns to follow:** Existing rendering patterns in viewer.js, color usage from periodic-table.js
  
  **Test scenarios:**
  - Happy path: Heatmap renders correctly with proper color scaling
  - Edge cases: Empty grid (all transparent), full grid (all red)
  - Error paths: Rendering with invalid density values
  - Integration: Heatmap aligns properly with grid sectors and updates in real-time
  
  **Verification:** Density grid visualization appears as accurate heatmap overlay, doesn't interfere with higher-level rendering, and responds correctly to density changes

## System-Wide Impact

- **Interaction graph:** Environment.update() branching affects all entity update systems (molecules, intentions, polymers, cells, prokaryotes)
- **Error propagation:** Density grid operations must handle edge cases (empty sectors, overflow) gracefully
- **State lifecycle risks:** Conversion must properly clean up/restore all entity references to prevent memory leaks
- **API surface parity:** Internal DensityGrid API must be consistent for read/write operations
- **Integration coverage:** Full conversion cycles must be tested to ensure no state corruption
- **Unchanged invariants:** Molecule identity (formula/fingerprint), intention fulfillment logic, cell/prokaryote behavior remain unchanged

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Diffusion parameters hard to tune | Start with small diffusion rate (1-2% per tick), expose as tunable parameter |
| Intention system breaks in abstract mode | Intentions check abstractMode and pull from density grid instead of attracting atoms |
| Back-conversion produces unnatural atom distributions | Random placement + letting physics settle for a few ticks handles this |
| Bond reconstruction creates invalid chemistry | Store exact bond topology in metadata, reconstruct deterministically |
| Performance regression from abstraction overhead | Benchmark atom-level vs abstract mode to ensure net performance gain |
| UI confusion with new mode toggle | Clear labeling and consistent placement with existing controls |

## Documentation / Operational Notes

- Update README.md to mention density abstraction feature and manual toggle button
- Add inline comments explaining abstract mode behavior in modified files
- Ensure build process (build.ts) includes new densityGrid.js file

## Sources & References

- **Origin document:** docs/brainstorms/2026-02-28-atom-density-abstraction-brainstorm.md
- Related code: src/core/environment.js, src/entities/molecule.js, src/main.js
- Related PRs/issues: None (new feature)