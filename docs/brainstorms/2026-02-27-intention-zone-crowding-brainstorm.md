---
date: 2026-02-27
topic: intention-zone-crowding
---

# Intention Zone Crowding — Seed Formation Obstructed by Wrong Particles

## What We're Building

When a molecule intention is trying to assemble its seed molecule, wrong-composition
atoms and small molecules drift into the zone and physically occupy the space where
the seed needs to form. These particles are stuck in limbo: bonding is blocked
(`tryFormBonds` sets `prob=0` for any atom inside an intention zone), but the current
repulsion rules don't clear them either.

The two gaps in the existing repulsion pipeline:

1. **Rule 2 gap** — Rule 2 only repels molecules that are *stable* or *too large*.
   Small unstable wrong-composition molecules (CH, CHO, C2O, GH2O inside a C-only or
   C/H intention) pass through both checks and sit indefinitely inside the zone.

2. **Slow expulsion floor** — The minimum repulsion force floor is 30% of `repulsionForce`
   (currently `8.0 × 0.3 = 2.4`). For heavier atoms near the zone boundary this is too
   weak to overcome thermal/damping forces, so wrong particles creep back in.

The combined result: the seed formation site is physically crowded with wrong particles
that can neither bond nor be expelled, preventing correct atoms from occupying seed positions.

## Why This Approach

Two complementary fixes (A + C):

**A — Extend Rule 2 with composition check:**
Before checking size/stability, check whether the molecule contains *any* element that is
NOT in the target composition. If so, repel it immediately, regardless of size. This
precisely targets the gap (small unstable wrong molecules) without touching valid monomers
or the rest of the pipeline.

**C — Raise repulsion floor:**
Increase `repulsionForce` from `8.0` to a higher value (TBD during planning — likely `12.0`)
and raise the floor multiplier from `0.3` to `0.5`. This ensures atoms near the zone
boundary are pushed out fast enough to not drift back in.

Approach B (inner exclusion zone) was considered but rejected — an inner exclusion zone
would also block correct atoms from reaching the seed, potentially causing a different
assembly failure.

## Key Decisions

- **Composition check in Rule 2 (wrong elements)**: If a molecule contains ANY atom whose
  element is NOT in the target composition → repel immediately. E.g., a CHO molecule inside
  a C2H4 intention zone gets expelled because it contains O.

- **Sufficiency check in Rule 2 (already have enough)**: If a molecule contains ONLY
  correct elements but the intention has already claimed enough of those elements → repel.
  E.g., a CH2 inside a C2H4 zone is fine to keep if the intention still needs C or H, but
  should be expelled if the intention has already claimed 2C + 4H. This prevents zone
  saturation late in assembly.

- **Safe-keep condition**: A molecule is kept (handed to Rule 4) only if it contains
  EXCLUSIVELY elements the intention still needs AND the intention hasn't yet claimed its
  full quota of those elements.

- **Only applies to molecule intentions**: Polymer/cell intentions don't operate at the
  atom level; atoms should not be affected by higher-level intentions.

- **Raise floor to 0.5 (not 1.0)**: A full floor would make edge-zone particles accelerate
  too aggressively and could cause instability. 0.5 is a doubling of the current floor.

- **Increase `repulsionForce` to 12.0**: Proportionally scales all repulsion (not just the
  floor), matching the stronger floor without changing the relative shape of the falloff.

- **Scope**: Only `_rule2_repelIrrelevantMolecules` needs updating. Rule 1 (free atoms)
  already handles wrong-element free atoms; this fix closes the small-molecule gap.

## Open Questions

None — requirements are clear enough to proceed to planning.

## Next Steps

→ `/workflows:plan docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md`
