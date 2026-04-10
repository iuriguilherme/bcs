---
title: "Prokaryote Binary Fission: Complete Implementation Pattern"
date: 2026-04-10
category: docs/solutions/best-practices
module: Prokaryote / Polymer / Environment
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - "Implementing cell replication systems in molecular simulations"
  - "Designing multi-tick state machines for biological processes"
  - "Cloning entity structures without copying live simulation state"
  - "Managing entity spawning safely during iteration"
related_components:
  - Polymer
  - Environment
tags:
  [
    binary-fission,
    state-machine,
    prokaryote,
    polymer-cloning,
    atp-metabolism,
    synthesis-progress,
    ribosome-guard,
    map-snapshot,
    entity-spawning,
  ]
---

# Prokaryote Binary Fission: Complete Implementation Pattern

## Context

The `Prokaryote` class had a stub `_divide()` method that did nothing, and no synthesis
phase whatsoever. Cells with sufficient ATP would be checked by `canDivide()` but no
division ever occurred, and the concept of "replication takes time" was entirely absent.
Building binary fission required a coordinated multi-unit implementation spanning three
files and introducing five tightly-coupled concepts:

1. Replication state machine (`idle` → `synthesizing` → `idle`)
2. ATP-gated progress advancement driven by ribosome count
3. Structural polymer cloning (no live atoms)
4. Daughter spawning with correct spatial offset
5. Safe environment iteration during spawn

All five must be correct together — any single gap silently breaks replication.

## Guidance

### 1. Replication State Machine

Add to the `Prokaryote` constructor:

```javascript
// Replication state machine
this.replicationProgress = 0;           // 0 → 1 during synthesis
this.replicationStage = 'idle';         // 'idle' | 'synthesizing'
this.synthesisRatePerRibosome = 0.0005; // progress per ribosome per tick
this.synthesisAtpCostPerTick = 0.05;    // ATP consumed per tick during synthesis
this.synthesisMinAtp = 10;              // pause synthesis below this ATP level
```

Drive the machine from `update()`:

```javascript
update(dt, environment) {
    // ... existing ATP and nutrient logic ...
    this._updateReplication(dt, environment);
}

_updateReplication(dt, environment) {
    if (this.replicationStage === 'idle') {
        if (this.canStartSynthesis()) {
            this.replicationStage = 'synthesizing';
        }
    } else if (this.replicationStage === 'synthesizing') {
        this._synthesize(dt, environment);
    }
}
```

### 2. Guard Function: canStartSynthesis()

Replaces the old `canDivide()` with an extra critical guard:

```javascript
canStartSynthesis() {
    return this.isAlive &&
        this.replicationStage === 'idle' &&
        this.ribosomes.length > 0 &&            // KEY: cells with no ribosomes cannot synthesize
        this.cytoplasm.atp >= this.divisionThreshold &&
        this.divisionCooldown === 0 &&
        this.age > 100;
}
```

**The ribosome guard is critical.** Without it, a cell with no ribosomes enters `synthesizing`,
where `_synthesize()` advances progress at `0 * rate = 0` per tick but still drains ATP.
The cell slowly starves and dies, permanently stuck in `synthesizing`. Add the guard.

### 3. Synthesis Progress: Pause, Don't Reset

```javascript
_synthesize(dt, environment) {
    // Pause when ATP is critically low — do NOT reset progress
    if (this.cytoplasm.atp < this.synthesisMinAtp) return;

    this.cytoplasm.atp -= this.synthesisAtpCostPerTick * dt;
    this.replicationProgress += this.ribosomes.length * this.synthesisRatePerRibosome * dt;
    this.replicationProgress = Math.min(1.0, this.replicationProgress);

    if (this.replicationProgress >= 1.0) {
        this._divide(environment);
        // _divide() is responsible for resetting replicationProgress and replicationStage
    }
}
```

**Pause semantics matter**: returning early (frozen progress) is biologically correct —
a starving cell pauses protein synthesis and resumes when fed. Resetting would mean a cell
that briefly runs low on ATP must restart from 0 every time, which is both unrealistic and
a playability problem (cells could never complete division in low-nutrient environments).

### 4. Polymer Cloning: Structural Metadata Only

Add `clone()` to `Polymer`. The constructor signature is positional:
`new Polymer(monomers, monomerTemplate, name)` — **not an object literal**.

```javascript
clone() {
    const clonedMolecules = this.molecules.map(mol => ({
        id: Utils.generateId(),
        formula: mol.formula || '',
        mass: mol.mass || 0,
        fingerprint: mol.fingerprint || '',
        atoms: [],                              // CRITICAL: no live atoms
        bonds: [],
        isMonomer: mol.isMonomer || false,
        monomerTemplate: mol.monomerTemplate || null,
        monomerId: mol.monomerId || null,       // CRITICAL: copy directly — see note below
        proteinId: null,
        polymerId: null,
        getCenter() { return new Vector2(0, 0); },
        update() {},                             // no-op: stubs have no atoms to simulate
        isStable() { return true; }             // stubs are considered stable
    }));

    // Positional constructor — NOT an object literal
    const cloned = new Polymer(clonedMolecules, this.monomerTemplate, this.name);

    // Polymer constructor infers type from monomerTemplate.polymerCategory — only set
    // type manually if no template provides it
    if (!this.monomerTemplate || !this.monomerTemplate.polymerCategory) {
        cloned.type = this.type;
    }
    cloned.cellRole = this.cellRole;
    return cloned;
}
```

**`monomerId` must be copied directly.** `_detectMonomerType()` scans live atoms to classify
molecules. Cloned stubs have `atoms = []`. If code relied on re-detection instead of direct
copy, `monomerId` would always be null — breaking catalogue linkage and IndexedDB deserialization
on the next save cycle.

### 5. Division: Clone, Spawn, Reset (and Remove Old Lump Deduction)

```javascript
_divide(environment) {
    const clonedMembrane = this.membrane.map(p => p.clone());
    const clonedNucleoid = this.nucleoid.map(p => p.clone());
    const clonedRibosomes = this.ribosomes.map(p => p.clone());

    const daughter = new Prokaryote({
        membrane: clonedMembrane,
        nucleoid: clonedNucleoid,
        ribosomes: clonedRibosomes
    });

    daughter.generation = this.generation + 1;
    daughter.cytoplasm.atp = this.divisionThreshold * 0.3; // ~45 ATP — alive but must feed to re-divide

    // Spawn at random angle offset from parent (not on top)
    const angle = Math.random() * 2 * Math.PI;
    const spawnDistance = this.radius + 60;
    daughter.position = new Vector2(
        this.position.x + Math.cos(angle) * spawnDistance,
        this.position.y + Math.sin(angle) * spawnDistance
    );

    if (environment && environment.addProkaryote) {
        environment.addProkaryote(daughter);
    }

    // Reset parent
    this.replicationProgress = 0;
    this.replicationStage = 'idle';
    this.divisionCooldown = this.divisionCooldownMax;

    // NOTE: Do NOT add a lump ATP deduction here.
    // Tick-by-tick synthesis cost (synthesisAtpCostPerTick × ~2000 ticks ≈ 100 ATP)
    // IS the full ATP cost. A lump deduction on top of it double-charges and kills the parent.
}
```

### 6. Map Snapshot in updateProkaryotes()

In `environment.js`, the `updateProkaryotes()` loop must snapshot before iterating:

```javascript
updateProkaryotes(dt) {
    // Snapshot BEFORE iterating — daughters added by _divide() must not be
    // visited in the same tick they are born (they would get update() at age 0
    // within the parent's tick, violating the one-tick-per-cell invariant).
    const snapshot = Array.from(this.prokaryotes.values());
    for (const prokaryote of snapshot) {
        if (prokaryote.isAlive) {
            prokaryote.update(dt, this);
        }
    }
    // Cleanup also snapshots (safe to delete while iterating own copy):
    for (const [id, p] of Array.from(this.prokaryotes)) {
        if (!p.isAlive) this.prokaryotes.delete(id);
    }
    this.stats.prokaryoteCount = this.prokaryotes.size;
}
```

### 7. Visual Feedback During Synthesis

Tint the cell warm amber as `replicationProgress` increases (no `console.*` in render):

```javascript
// In render():
const synthT = this.replicationStage === 'synthesizing' ? this.replicationProgress : 0;
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

gradient.addColorStop(0, `rgba(${lerp(200,255,synthT)},${lerp(230,165,synthT)},${lerp(200,0,synthT)},0.7)`);
gradient.addColorStop(0.7, `rgba(${lerp(150,210,synthT)},${lerp(200,100,synthT)},${lerp(150,0,synthT)},0.5)`);
gradient.addColorStop(1, `rgba(${lerp(100,160,synthT)},${lerp(150,60,synthT)},${lerp(100,0,synthT)},0.3)`);

// Progress bar (below the ATP bar):
if (this.replicationStage === 'synthesizing') {
    const repBarY = barY - (5 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(barX, repBarY, barWidth, barHeight);
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(barX, repBarY, barWidth * this.replicationProgress, barHeight);
}
```

### 8. Serialize Transient State

Include replication state in `serialize()` / `deserialize()`:

```javascript
serialize() {
    return {
        // ... existing fields ...
        replicationProgress: this.replicationProgress,
        replicationStage: this.replicationStage,
        divisionCooldown: this.divisionCooldown,  // CRITICAL: prevents immediate re-division on load
    };
}

static deserialize(data, polymers) {
    // ...
    prokaryote.replicationProgress = data.replicationProgress || 0;
    prokaryote.replicationStage = data.replicationStage || 'idle';
    prokaryote.divisionCooldown = data.divisionCooldown || 0;
}
```

## Why This Matters

| Gap | Consequence |
|-----|------------|
| No ribosome guard in `canStartSynthesis()` | Cell without ribosomes enters `synthesizing` permanently; ATP drains to 0, cell dies stuck |
| Reset instead of pause in `_synthesize()` | Cell that briefly starves restarts from 0; can never complete division in low-ATP zones |
| Live-atom references in cloned polymers | Daughter and parent share Molecule objects; mutations corrupt parent's chemistry |
| `monomerId` not copied directly | Monomer blueprint links lost; IndexedDB deserialization fails silently on next save |
| Lump ATP deduction kept in `_divide()` | Double-charges ATP alongside tick-by-tick synthesis cost; parent dies immediately post-division |
| No Map snapshot in `updateProkaryotes()` | Daughter receives `update()` at age 0 in same tick it is born; one-tick-per-entity invariant violated |
| `divisionCooldown` not serialized | Parent re-divides on next load (cooldown resets to 0) |
| Stub polymers missing Molecule interface | `TypeError: mol.update is not a function` on daughter's first tick |

## When to Apply

- Implementing any **multi-tick autonomous replication** system for entity classes
- Designing **resource-gated progress** that should pause (not reset) on resource shortage
- **Cloning structural metadata** from entities that contain live-simulation objects
- Spawning new entities **inside a collection-iteration loop** (always snapshot first)
- Adding **rate-limiting cooldowns** that must survive save/load cycles

## Examples

**Before:**

```javascript
// Non-functional stub:
_divide(environment) { /* TODO */ }

canDivide() {
    return this.cytoplasm.atp >= this.divisionThreshold && this.age > 100;
}

update(dt, environment) {
    if (this.canDivide()) this._divide(environment);
}

// Live Map iteration in environment.js:
for (const p of this.prokaryotes.values()) { p.update(dt, this); }
```

**After:**

```javascript
// Functional state machine:
_updateReplication(dt, environment) {
    if (this.replicationStage === 'idle') {
        if (this.canStartSynthesis()) this.replicationStage = 'synthesizing';
    } else {
        this._synthesize(dt, environment);
    }
}

canStartSynthesis() {
    return this.isAlive && this.replicationStage === 'idle'
        && this.ribosomes.length > 0               // ← ribosome guard
        && this.cytoplasm.atp >= this.divisionThreshold
        && this.divisionCooldown === 0 && this.age > 100;
}

_synthesize(dt, environment) {
    if (this.cytoplasm.atp < this.synthesisMinAtp) return;  // pause, not reset
    this.cytoplasm.atp -= this.synthesisAtpCostPerTick * dt;
    this.replicationProgress = Math.min(1.0,
        this.replicationProgress + this.ribosomes.length * this.synthesisRatePerRibosome * dt);
    if (this.replicationProgress >= 1.0) this._divide(environment);
}

// Snapshot in environment.js:
const snapshot = Array.from(this.prokaryotes.values());
for (const p of snapshot) { if (p.isAlive) p.update(dt, this); }
```

**Playwright test (T08):**

```javascript
test('T08: prokaryote divides via binary fission when ribosomes and ATP are sufficient', async ({ page }) => {
    const parentId = await page.evaluate(() => {
        const cell = new window.Prokaryote({
            membrane: [makePolymer(window.PolymerType.LIPID, 'membrane')],
            nucleoid: [makePolymer(window.PolymerType.NUCLEIC_ACID, 'genetics')],
            ribosomes: [makePolymer(window.PolymerType.PROTEIN, 'structure'),
                        makePolymer(window.PolymerType.PROTEIN, 'structure')]
        });
        cell.age = 200;
        cell.cytoplasm.atp = 200;
        cell.position = new window.Vector2(500, 400);
        window.cellApp.environment.addProkaryote(cell);
        return cell.id;
    });

    await pressPlay(page);

    // With 2 ribosomes: ~1000 ticks to complete synthesis (~17 seconds at 60fps)
    await page.waitForFunction(
        () => window.cellApp.environment.prokaryotes.size >= 2,
        { timeout: 30_000, polling: 200 }
    );

    // Verify division results
    const result = await page.evaluate((pid) => { /* ... */ }, parentId);
    expect(result.parentReplicationProgress).toBe(0);
    expect(result.parentStage).toBe('idle');
    expect(result.daughterFound).toBe(true);
    expect(result.daughterGeneration).toBe(1);
    expect(result.daughterIsValid).toBe(true);
});
```

## Related

- Bug doc: `docs/solutions/logic-errors/prokaryote-stub-polymer-interface.md` — specific runtime errors from stub interface gaps (TypeError, position overwrite, Map iteration) discovered during implementation
- Plan: `docs/plans/2026-04-09-001-feat-prokaryote-self-replication-plan.md` (status: completed)
- Tests: `tests/scenarios/t08-prokaryote-replication.spec.js` (T08 + T08b, all passing)
- Institutional: `docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md` — monomerId invariant background
