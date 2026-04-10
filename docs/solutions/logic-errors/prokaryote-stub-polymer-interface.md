---
title: Prokaryote Stub Polymer Interface Gaps
date: 2026-04-10
tags: [prokaryote, polymer, clone, stub, interface]
---

# Prokaryote Stub Polymer Interface Gaps

## Problem

`Polymer.clone()` creates lightweight molecule stubs (plain JS objects, no live atoms) for
daughter cell polymers. These stubs did not implement the Molecule interface methods called
during `Polymer.update()` and `Polymer.isStable()`, causing TypeErrors on the daughter's
first update tick.

Additionally, `Prokaryote._updatePhysicalProperties()` overwrites the cell's position using
`polymer.getCenter()` for each membrane polymer. Since stub polymers return `(0,0)` from
`getCenter()`, daughter cells' spawn offsets were silently reset to the origin on the first
update tick.

## Root Causes

1. `Polymer.update(dt)` calls `mol.update(dt)` on every molecule — stubs had no `update()`.
2. `Polymer.isStable()` calls `mol.isStable()` — stubs had no `isStable()`.
3. `Prokaryote._updatePhysicalProperties()` unconditionally recalculates position from
   `polymer.getCenter()` — stubs return `(0,0)` from their mock `getCenter()`.
4. Stub molecules had no `id` property — `removeMolecule()` silently fails on `m.id === moleculeId`.

## Fix

1. **Stub interface** — added to each stub object in `Polymer.clone()`:
   ```javascript
   id: Utils.generateId(),
   bonds: [],
   update() {},
   isStable() { return true; }
   ```

2. **Position guard** — `_updatePhysicalProperties()` only recalculates position when at
   least one membrane polymer has live atoms:
   ```javascript
   const hasLiveAtoms = this.membrane.some(p =>
       p.molecules && p.molecules.some(m => m.atoms && m.atoms.length > 0)
   );
   if (hasLiveAtoms) { /* recalculate position */ }
   ```

## Rule

Any plain-object stub used as a drop-in for a Molecule inside a Polymer must implement
the full Molecule interface: `id`, `formula`, `mass`, `fingerprint`, `atoms`, `bonds`,
`isMonomer`, `getCenter()`, `update()`, `isStable()`. Future features adding Molecule
method calls to Polymer's hot path must audit stub compatibility.
