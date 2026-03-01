---
date: 2026-02-27
topic: prokaryote-self-replication
---

# Prokaryote Self-Replication

## What We're Building

Prokaryotes (unicellular organisms with a nucleoid/DNA strand) should be able to **self-replicate via binary fission**. The organism accumulates enough internal resources to build a second copy of itself, then divides — each daughter cell retaining a complete set of components (membrane, nucleoid, ribosomes).

This is distinct from the neural-network reproduction already present on the `Cell` class (which is being phased out of unicellular organisms in favour of a more biological model).

The growth phase is driven by **ribosome synthesis**: ribosomes consume ATP each tick to advance a `replicationProgress` counter (0→1). When progress reaches 1, the cell has "built" enough material and divides. Division programmatically clones the parent's polymer structures, creates a new `Prokaryote`, and resets the parent.

## Why This Approach (Approach A: Synthesis Progress + Polymer Cloning)

Three approaches were considered:

- **Approach A (chosen):** Synthesis progress counter (0→1) driven by ribosomes + ATP consumption. Polymer structures are cloned programmatically at the moment of division.
- **Approach B:** Physical polymer objects are built as real Polymer instances inside the cell boundary during synthesis. Most emergent but high complexity — requires isolating pending polymers from the factory detection system.
- **Approach C:** Instant ATP-threshold split with no synthesis phase. Simplest but doesn't model the "resources built inside the cell" requirement.

Approach A is chosen because it captures the biological spirit of resource accumulation over time, maps cleanly onto the existing ATP system, and introduces a meaningful state machine without overhauling the polymer infrastructure.

## Key Decisions

- **Target entity:** `Prokaryote` (not `Cell`). The `Cell` class's neural-network system is being moved to complex multicellular organisms.
- **Growth model:** Ribosome synthesis — ribosomes consume ATP each tick during the synthesis phase, advancing `replicationProgress` at ~0.0005/tick (= 2000 ticks per full cycle).
- **Division trigger:** `replicationProgress >= 1.0` (synthesis can only begin when ATP ≥ divisionThreshold AND age > 100).
- **ATP during synthesis:** If ATP drops below a minimum while synthesizing, synthesis **pauses** (progress freezes). It resumes when ATP recovers. Progress is never reset by starvation.
- **Daughter components:** Programmatic cloning of parent's polymer structures at the instant of division. Daughter polymers are new objects with identical sequences. No mutation in this iteration.
- **Parent state after division:** Parent retains original polymer components; `replicationProgress` resets to 0; `divisionCooldown` resets.
- **Daughter spawn position:** Offset from parent (~50–80 units) to allow spatial separation.

## Division State Machine

```
idle
  └─(ATP ≥ divisionThreshold AND age > 100)──► synthesizing
                                                    │ (ribosomes consume ATP per tick,
                                                    │  replicationProgress += 0.0005)
                                                    │ [pauses if ATP drops below min]
                                                    │
                                              (replicationProgress ≥ 1.0)
                                                    │
                                                    ▼
                                           [instant: clone polymers,
                                            addProkaryote at offset,
                                            reset progress + cooldown]
                                                    │
                                                    ▼
                                                  idle
```

## Affected Files (Preliminary)

| File | Change |
|------|--------|
| `src/entities/prokaryote.js` | Add `replicationProgress`, `replicationStage`, `_synthesize(dt)`, replace `_divide()` stub |
| `src/viewer/viewer.js` | Colour tint on prokaryote during synthesizing state (warm shift as `replicationProgress` increases) |

## Open Questions

*(All resolved — see below)*

## Resolved Questions

- **Which organism:** Prokaryote. `Cell` neural-network reproduction is a separate concern.
- **Replication mechanism:** Approach A — synthesis progress + programmatic polymer cloning.
- **Growth model:** Ribosome synthesis using ATP reserves.
- **DNA mutation:** Not in scope for this iteration.
- **Neural network removal scope:** Separate task — not part of this story.
- **Visual indicator:** Yes — colour tint. The prokaryote shifts to a warmer/brighter colour as `replicationProgress` increases.
- **Synthesis rate:** Slow — ~2000 ticks (~33 seconds per division cycle). Each division is a significant observable event.
- **ATP synthesis cost:** ~0.05 ATP/tick over 2000 ticks ≈ 100 ATP total (~2/3 of divisionThreshold). Synthesis pauses (does not reset) if ATP drops below a minimum mid-cycle.

## Next Steps

→ `/workflows:plan` for implementation details
