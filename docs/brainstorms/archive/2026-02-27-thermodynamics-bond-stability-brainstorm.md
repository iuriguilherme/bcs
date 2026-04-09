---
date: 2026-02-27
topic: thermodynamics-bond-stability
---

# Thermodynamics: Simplified Thermal Bond Rating

## What We're Building

A simple thermodynamics layer for BioChemSim that enables chemically accurate molecules
like Carbon Monoxide (CO, triple bond C≡O) to exist in the simulation. Currently, CO was
added to `stable-molecules.js` with a triple bond, but oxygen's `maxBonds = 2` prevents
the triple bond from forming — resulting in an over-bonded oxygen atom showing
`Valence: 3/2` (a bug).

The new system introduces:
1. A **global temperature** parameter (0–600K, default 298K / room temperature)
2. **Bond stability scores** (0–1) derived from real bond energies
3. **Thermal bond formation/breaking** probabilities per tick
4. **Soft valence override**: bonds with very high stability (>0.85) are allowed to exceed
   an atom's base valence, enabling CO triple bond (O contributes 3, exceeding valence 2)

## Why This Approach

**Approach B (Simplified Thermal Bond Rating)** chosen over:
- **Approach A (Boltzmann)**: More physically rigorous but requires careful tuning of `k`
  and energy constants; emergent instability risk.
- **Approach C (Enthalpy Scoring)**: More consistent but expensive (per-bond enthalpy delta
  calculations); complex to validate.

Approach B maps naturally to the simulation's tick-based update loop and adds a
user-visible temperature slider that gives the system expressive range without a full
physics engine.

## Key Decisions

- **Temperature range**: 0–600K; default 298K (room temp). Above 500K: single and double
  bonds break readily; triple bonds (C≡O) remain. Near 0K: all bonding activity freezes.
- **Bond stability scores**: normalized table derived from real kJ/mol bond energies.
  Key values:
  - `C≡O` triple: ~0.95 (very stable — forms at all temps up to ~580K)
  - `C=O` double: ~0.72
  - `C-O` single: ~0.35
  - `O=O` double: ~0.50
  - `H-H` single: ~0.44
- **Over-valence threshold**: `stability > 0.85` allows exceeding `maxBonds`. Only a handful
  of bonds qualify (C≡O, C≡N, N≡N). This list is explicit, not implicit.
- **Formation probability per tick**: `P(form) = stability × (temp / 298)` — stable bonds
  form readily; both formation and breaking scale with temperature so the system reaches
  dynamic equilibrium at 298K (room temp). Below 298K: bonding slows and freezes. Above
  298K: more collisions and more breaking simultaneously.
- **Breaking probability per tick**: `P(break) = (1 - stability) × (temp / 298)` — weak
  bonds break more at high temperature; triple bonds (high stability ≈ 0.95) are very
  resistant to breaking even at 600K.
- **CO immediate fix**: `stable-molecules.js` CO entry already specifies a triple bond;
  the thermodynamics system will unlock this. `canBondWith()` will be updated to accept
  over-valence bonds when the bond meets the stability threshold.
- **Storage location**: New `src/data/bond-energies.js` for the stability table; new
  `src/systems/thermodynamics.js` for the temperature state and helper functions.
- **UI**: Temperature slider added to the toolbar (between play/pause and level controls).
  Displays current temp in Kelvin.

## Key Decisions (continued)

- **Unlisted bond pairs**: Default stability score is `0.30` — conservative single-bond
  baseline. All element pairs not in the explicit table use this value.
- **Intention temperature zones**: Each `Intention` sets a **local temperature** within
  its attraction radius (overriding global temp for atoms inside the zone). The local
  temp is always set to the optimal value for its target molecule's bonds. Atoms outside
  any Intention zone use the global temperature. This preserves blueprint-guided assembly
  while still participating in the thermodynamics system.

## Open Questions

_(none — all resolved)_

## Next Steps

→ Run `/workflows:plan` to get a step-by-step implementation plan.
