---
date: 2026-02-26
topic: essential-monomer-seeding
---

# Adenine Nucleotide Visibility & Phosphorus Spawning

## What We're Building

Fixing two related gaps that together prevent DNA strand polymer assembly and therefore
block all cell formation:

1. **Monomers are invisible in the catalogue UI.** `Catalogue._loadMonomerBlueprints()` already
   loads all 4 biological monomers (Glycine, Fatty Acid, Glucose, Adenine Nucleotide) into
   `catalogue.molecules` at startup. However, `catalogue-ui.js:116` applies a
   `isBlueprintStable(bp)` filter before rendering — and since monomers are intentionally
   NOT fully stable (they need free valence for polymerization), they are silently excluded
   from the Molecules section. Users cannot see or place them.

2. **Phosphorus (P) is absent from the atom spawner.** Even if monomers were visible,
   Adenine Nucleotide (C10H14N5O6P) requires P, which is not in the default atom pool
   `['H', 'C', 'N', 'O']`. Natural formation of this molecule is therefore impossible.

## Why This Approach

The data pipeline is already correct — the pre-seeding logic works. The two targeted fixes
required are:

- **Add a "Monomers" section to the catalogue UI** that renders monomer blueprints
  separately from stable molecules, bypassing the stability filter. This reveals all 4
  biological monomers for user placement without changing the stable-molecules section.

- **Register P in the spawner's available pool (opt-in, not default-active).** This
  lets users who want natural nucleotide formation enable P spawning in the spawner UI
  without it interfering with simpler atom-only experiments.

Alternative approaches considered:
- **Fix the stability filter to include monomers**: Risks showing partially-bonded fragments
  as monomers; more invasive.
- **Separate pre-seeding step**: Unnecessary — data is already loaded correctly.
- **Default-active P in spawner**: Too disruptive for simulations that don't need it.

## Key Decisions

- **Monomers appear in the Molecules section with a "Monomer" badge**: A monomer is a
  molecule — the term only acknowledges it can chain into a polymer. No separate level or
  section needed. The stability filter becomes `isBlueprintStable(bp) || bp.isMonomer`.
- **All 4 biological monomers shown** (Glycine, Fatty Acid, Glucose, Adenine Nucleotide):
  Consistent treatment; all are pre-loaded and all were previously invisible.
- **No UI badge distinction** between pre-seeded and discovered molecules: Simpler; all
  monomers look and behave identically in the catalogue.
- **P is in pool but not default-active**: Phosphorus is biologically rare and opt-in only.
- **`autoDiscover()` fast-path guard**: Add a `knownFingerprints` check at the start of
  the loop to skip already-registered blueprints without processing them fully.

## Scope

Files to change:
- `src/viewer/catalogue-ui.js` — change the Molecules section filter from
  `isBlueprintStable(bp)` to `isBlueprintStable(bp) || bp.isMonomer`, and render
  monomers with a "Monomer" tag badge to distinguish them visually.
- `src/systems/atom-spawner.js` (or spawner UI in `controls.js`) — add P to the list of
  available pool atoms in the UI palette, but not to `this.atomPool` default.
- `src/catalogue/catalogue.js` — add fast-path guard in `autoDiscover()`.

## Resolved Questions

- **UI badge for pre-seeded molecules?** → No. All monomers are treated identically.
- **`autoDiscover()` guard for known molecules?** → Yes. Use `knownFingerprints` Set as
  a fast-path check at the top of the loop.

## Next Steps

→ `/workflows:plan` for implementation details
