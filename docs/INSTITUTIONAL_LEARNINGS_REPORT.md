# Institutional Learnings Search Results for PR #2

## Search Context
- **Feature/Task**: Fix show monomers in catalogue UI and repair cell formation pipeline
- **Keywords Used**: monomer, isMonomer, catalogue UI, formula, IndexedDB, blueprint instantiation, cell formation
- **Directory Scanned**: C:\Users\iuri\Downloads\Antigravity\cs1\docs\solutions
- **Files Found**: 1 solution document (logic-errors directory) + 2 supplementary planning/brainstorm docs
- **Relevant Matches**: All 3 documents directly applicable to PR #2

---

## Critical Patterns
**No critical-patterns.md file exists yet.** The docs/solutions directory structure is newly established (only one solution document currently exists).

---

## Relevant Learnings

### 1. Five Physics Bugs in Overlapping Molecule Intents (Root Cause Analysis)
- **File**: `C:\Users\iuri\Downloads\Antigravity\cs1\docs\solutions\logic-errors\molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`
- **Module**: Intention System (`intention.js`, `molecule.js`, `environment.js`)
- **Problem Type**: logic_error
- **Severity**: HIGH
- **Status**: RESOLVED (committed to main branch)

#### Relevance to PR #2:
Cell formation depends on monomer → polymer → cell intent pipelines. The solution document provides the complete root-cause analysis of five physics bugs that were preventing this exact pipeline from working. While PR #2 focuses on catalogue UI visibility, understanding these physics fixes is **essential context** for the cell formation part of the PR.

#### Key Insights (Apply These to Cell Formation Testing):

**Root Cause A — Tar-ball mega-molecule formation:**
- Free atoms in intent zones bonded spontaneously via `tryFormBonds` (45% per tick), creating unstable 100+ atom molecules
- Old repulsion only targeted stable molecules, not large unstable ones
- **Fix Applied**: In `environment.js:tryFormBonds`, set `prob = 0` when atom is inside molecule intent zone. Free atoms wait for intent claiming (Rule 3) and bonding (Rule 6).
- **Fix Applied**: In `intention.js:_rule2_repelIrrelevantMolecules`, repel large unstable molecules (`atoms.length > totalNeeded`), applying force per atom (not via `mol.applyForce`)
- **For PR #2 Cell Tests**: Ensure spawner zone doesn't allow free atoms to spontaneously bond before intents claim them.

**Root Cause B — `extractAtom` only broke one bond:**
- `Molecule.extractAtom(symbol)` broke only the first bond, so `updateMolecules` reconnected it same tick
- **Fix Applied**: Copy `bestAtom.bonds` array before breaking, then break ALL bonds: `for (const bond of [...bestAtom.bonds]) bond.break(false)`
- **For PR #2 Cell Tests**: If polymer assembly needs to extract atoms, verify extraction is complete.

**Root Cause C — Seed drift from insufficient anchor force:**
- Anchor force was overwhelmed by tar-ball repulsion; seeds drifted 100-200 units from intent center
- Claimed atoms chased moving targets and never converged
- **Fix Applied**: Increased anchor multiplier from `3.0` to `15.0`. Added velocity correction: `v += dir * max(0, -v·dir) * 0.5` each tick
- **For PR #2 Cell Tests**: If monomers form but don't assemble into polymers, check seed stability (should stay within ~50 units of intent center).

**Root Cause D — Claimed atoms escape intent radius with zero attraction beyond boundary:**
- Attraction formula `(1 - dist/radius)` goes to zero at radius boundary
- Claimed atoms with high velocity escaped the 300-unit radius, then received zero pull-back force
- After 2000+ ticks they froze at 500+ units from seed
- **Fix Applied**: Added minimum force floor in `intention.js:_rule5_attractClaimed`:
  ```javascript
  const forceMag = Math.max(
      this.attractionForce * 2.5 * normalized * atom.mass,
      this.attractionForce * 2.0 * atom.mass  // floor: always pull back
  );
  ```
- **For PR #2 Cell Tests**: If claimed monomer atoms disappear from viewport, they may have escaped the intent radius.

**Root Cause E — Atomic gas repulsion displaces claimed atoms:**
- With 150-200+ unclaimed free atoms (from tar-ball blocking), atom-atom repulsion (500) was ~230x stronger than claimed-atom attraction (~2)
- H atoms (mass=1) got knocked 16+ units/tick by collisions
- **Fix Applied**: Skip physics interactions between claimed atoms and free unclaimed atoms in `environment.js:applyAtomicForces`:
  ```javascript
  const atom1Claimed = !!atom1.claimedByIntentId;
  const atom2Free = !atom2.claimedByIntentId && !atom2.moleculeId;
  if ((atom1Claimed && atom2Free) || (atom2Claimed && atom1Free)) continue;
  ```
- **For PR #2 Cell Tests**: Claimed atoms should NOT be pushed around by free atoms.

#### Verified Test Pattern (End-to-End):
```javascript
env.clear();
spawner.active = true;
spawner.atomPool = ['C','H','N','O','P'];  // Include P for nucleotides
spawner.tickInterval = 8;
spawner.zone = { x: 800, y: 800, width: 400, height: 400 };

// Multiple molecule intents for monomers
for (const pos of [{x:900,y:940},{x:1100,y:940},{x:1000,y:1100}]) {
    const i = new Intention('molecule', blueprintForMonomer, pos.x, pos.y);
    env.addIntention(i);
    i.initializeExclusions(env);
}

// Polymer intent
const p = new Intention('polymer', polymerBlueprint, 1000, 1000);
env.addIntention(p);
p.initializeExclusions(env);

// Run 6000-8000 ticks
// Success: "Polymer [name] sealed" in console
```

#### Files Modified (All Already in Main):
- `src/entities/intention.js` — Rules 1-7 with physics fixes A-E
- `src/entities/molecule.js` — `extractAtom()` fix
- `src/core/environment.js` — tar-ball guard, atomic gas skip logic, seed protection

---

### 2. Monomer Catalogue UI Visibility Fix (Direct PR #2 Implementation)
- **File**: `C:\Users\iuri\Downloads\Antigravity\cs1\docs\plans\2026-02-26-fix-show-monomers-in-catalogue-ui-plan.md`
- **Module**: Catalogue UI + Catalogue Discovery
- **Problem Type**: developer_experience
- **Severity**: HIGH (blocks cell formation entirely)

#### Problem:
- `catalogue.js:_loadMonomerBlueprints()` pre-loads all 4 biological monomers (Glycine, Fatty Acid, Glucose, Adenine Nucleotide) into `catalogue.molecules` at startup
- `catalogue-ui.js:116` filter uses `isBlueprintStable(bp)`, which returns `false` for every monomer (they have free valence by design)
- Result: All monomers are silently hidden; users cannot place them
- **Impact**: DNA strand and other polymer intents cannot find monomers to attract → cell formation is impossible

#### Implementation Changes (Two Files, Additive):

**Change 1 — `src/viewer/catalogue-ui.js:116`**
```javascript
// Before
const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp));

// After
const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp) || bp.isMonomer);
```
- Purely additive: `||` only adds monomers; existing stable molecules unaffected
- `isMonomer` flag is already set correctly by `createMonomerBlueprint()` in `monomer-templates.js:377`

**Change 2 — `src/viewer/catalogue-ui.js:_renderItem()` status div**
```javascript
// Before
<div class="catalogue-item-status">
    ${blueprint.isStable ? '&#10003;' : '!'}
</div>

// After
<div class="catalogue-item-status">
    ${blueprint.isMonomer
        ? '<span class="monomer-badge">Monomer</span>'
        : blueprint.isStable ? '&#10003;' : '!'}
</div>
```
- Monomer badge distinguishes monomers visually from unstable non-monomers

**Change 3 — `src/viewer/catalogue-ui.js` injected style block (add this CSS)**
```css
.monomer-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--success);
    background: color-mix(in srgb, var(--success) 12%, transparent);
    padding: 2px 5px;
    border-radius: 8px;
    border: 1px solid var(--success);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}
```
- Uses existing `--success` CSS variable from `index.css:857`
- Styles go in the injected `<style>` block (same location as other `.catalogue-item-*` styles)

**Change 4 — `src/catalogue/catalogue.js:autoDiscover()` (Minor Optimization)**
```javascript
// Before
autoDiscover(molecules) {
    if (!this.autoRegisterStable) return;
    for (const molecule of molecules) {
        if (molecule.isStable() && !this.hasMolecule(molecule.fingerprint)) {
            this.registerMolecule(molecule);
        }
    }
}

// After
autoDiscover(molecules) {
    if (!this.autoRegisterStable) return;
    for (const molecule of molecules) {
        if (this.molecules.has(molecule.fingerprint)) continue;  // O(1) check
        if (molecule.isStable()) {  // O(atoms) only if needed
            this.registerMolecule(molecule);
        }
    }
}
```
- Runs every 60 ticks from `main.js:64`
- No functional change — only evaluation order; already-registered molecules skip the O(atoms) stability check entirely

#### Key Technical Notes:
- **Fingerprint format difference**: Blueprint fingerprints use `'monomer:id:formula'` format. Live molecule fingerprints use JSON atom/bond-count format. They never match, so `knownFingerprints` lookup would be no-op. The correct optimization is the Map-lookup reorder above.
- **`isMonomer` propagation**: When a molecule is placed from a monomer blueprint via `blueprint.instantiate(x, y)`, the instantiated molecule gets `isMonomer: true` via `findMonomerByFormula()`. No additional propagation needed.
- **No upstream changes needed**: The data layer is complete. Only the UI filter is wrong.

#### Acceptance Criteria for PR #2 (Catalogue Part):
1. Glycine, Fatty Acid, Glucose, Adenine Nucleotide all appear in Molecules section with "Monomer" badge
2. Stable molecules (H₂, H₂O, CH₄) still appear with `✓` status, no Monomer badge
3. Selecting a monomer and clicking canvas places it as a molecule
4. Placed molecules have `isMonomer: true` (check: `window.cellApp.environment.molecules` → last molecule → `.isMonomer`)
5. Polymer intents can find and attract placed monomer molecules
6. Build command works: `deno run --allow-read --allow-write --allow-run build.ts`

---

### 3. Phosphorus Spawning (Already Available — No Change Needed)
- **File**: `C:\Users\iuri\Downloads\Antigravity\cs1\docs\brainstorms\2026-02-26-essential-monomer-seeding-brainstorm.md`
- **Module**: Atom Spawner UI

#### Finding:
Research confirmed that **Phosphorus (P) is already available in the spawner UI** (`main.js:795`).
- Users can toggle P on in the spawner modal
- No spawner code changes are needed for PR #2
- For end-to-end cell formation testing, enable P in the spawner modal (opt-in, not default)

---

## Recommendations for PR #2

### Before Implementation
- Review the molecule intent physics fixes (Root Causes A-E) to understand cell formation dependencies
- Verify all five physics fixes are present in main (they are; all committed)
- Confirm `monomer-templates.js:377` sets `isMonomer: true` (it does)

### Implementation Order
1. **Apply Change 1** (catalogue-ui.js line 116 filter) — reveals all monomers
2. **Apply Changes 2-3** (badge rendering + CSS) — polishes the UI
3. **Apply Change 4** (catalogue.js autoDiscover reorder) — minor optimization
4. **Build**: `deno run --allow-read --allow-write --allow-run build.ts`
5. **Test**: End-to-end cell formation with monomers visible

### Cell Formation Testing Checklist
- Spawner: Enable P (checkbox in modal)
- Intents: Place overlapping molecule intents for all required monomers, polymer intents, and cell intent
- Expected: After 6000-8000 ticks, cell formation completes
- Success indicator: "Cell formed" in console; no physics errors

### Watch for These Physics Gotchas
- **Atoms bonding spontaneously** → Check `environment.js:tryFormBonds` guard (Root Cause A)
- **Seeds drifting away** → Check `intention.js:_rule5_attractClaimed` multiplier = 15.0 (Root Cause C)
- **Claimed atoms flying away** → Check `environment.js:applyAtomicForces` skips claimed vs. free (Root Cause E)
- **Atoms not bonding to seed** → Check `intention.js:_rule7_bondClaimed` (Root Cause B)

---

## Files Impacted by PR #2

| File | Change Type | Risk |
|------|-------------|------|
| `src/viewer/catalogue-ui.js` | Filter addition + badge rendering + CSS | LOW (purely additive) |
| `src/catalogue/catalogue.js` | Condition reorder in autoDiscover() | LOW (optimization only) |
| `index.html` | Regenerated bundle | NONE (automatic) |

---

## Summary

All necessary physics fixes for the cell formation pipeline **are already committed to main**. PR #2 only needs to:
1. Expose monomers in the catalogue UI (filter change + badge)
2. Optimize catalogue discovery (reorder O(1) before O(atoms) checks)
3. Let the existing physics handle monomer → polymer → cell assembly

The catalogue UI changes are orthogonal to the physics system. No gaps remain in the physics pipeline.
