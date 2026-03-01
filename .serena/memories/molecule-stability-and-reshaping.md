# Molecule Stability and Reshaping System

## Overview
Molecules go through a lifecycle: unstable → reshaping → stable. The system determines when molecules are complete and can be added to the catalogue.

## Key Files
- `src/entities/molecule.js` - Molecule class
- `src/data/stable-molecules.js` - Templates for known molecules (STABLE_MOLECULES object)
- `src/core/environment.js` - `updateMolecules()` manages molecule lifecycle

## Stability Checks

### hasValidValence()
Basic check - all atoms have their valences satisfied:
```javascript
hasValidValence() {
    if (this.atoms.length < 2) return false;
    if (this.bonds.length < 1) return false;
    for (const atom of this.atoms) {
        if (atom.availableValence > 0) return false;
    }
    return true;
}
```

### isStable()
Full stability check including geometry:
```javascript
isStable() {
    // INTENT-AWARE: If forming for intent, special rules apply
    if (this.formingInIntentId && this.intentTargetTemplate) {
        if (!this.hasValidValence()) return false;
        if (this.isReshaping) return false;
        if (this.geometryVerified) return true;
        
        // CRITICAL: Only allow reshaping if formula matches target
        if (this.formula !== this.intentTargetTemplate.formula) {
            return false;  // Don't reshape to wrong template
        }
        
        // Check only against intent's target template
        if (needsReshaping(this, this.intentTargetTemplate)) {
            this.startReshaping(this.intentTargetTemplate);
            return false;
        }
        return true;
    }
    
    // Normal (non-intent) stability check
    if (!this.hasValidValence()) return false;
    if (this.isReshaping) return false;
    if (this.geometryVerified) return true;
    
    // Check against any matching template
    const template = matchesStableTemplate(this);
    if (template && needsReshaping(this, template)) {
        this.startReshaping(template);
        return false;
    }
    return true;
}
```

## Reshaping Process

### startReshaping(template)
Begins the reshaping process:
```javascript
startReshaping(template) {
    const config = getTargetConfiguration(this, template);
    this.targetPositions = config.targetPositions;    // Where atoms should move
    this.atomToTemplateIndex = config.atomToTemplateIndex;  // Mapping for bond restructuring
    this.isReshaping = true;
    this.reshapeProgress = 0;
    this.reshapeTemplate = template;
    this.geometryVerified = false;
}
```

### applyStableConfiguration()
Called each tick during reshaping - moves atoms toward target positions:
```javascript
applyStableConfiguration() {
    if (!this.isReshaping || !this.targetPositions) return;
    
    // Move atoms toward target positions
    for (const [atom, targetPos] of this.targetPositions) {
        const dir = targetPos.sub(atom.position);
        atom.position = atom.position.add(dir.mul(0.1));
        atom.velocity = new Vector2(0, 0);  // Stop movement
    }
    
    // Check if positions are close enough
    let maxDist = 0;
    for (const [atom, targetPos] of this.targetPositions) {
        maxDist = Math.max(maxDist, atom.position.distanceTo(targetPos));
    }
    
    if (maxDist < 2) {  // Close enough
        this._restructureBonds();  // Fix bond structure to match template
        this.isReshaping = false;
        this.geometryVerified = true;  // CRITICAL: Prevents reshape loop
    }
}
```

### _restructureBonds()
After positions are correct, fix bonds to match template:
```javascript
_restructureBonds() {
    // Break all existing bonds
    for (const bond of [...this.bonds]) {
        bond.break(false);  // false = no energy release
    }
    
    // Create bonds according to template
    const templateBonds = getTemplateBonds(this.reshapeTemplate);
    for (const tBond of templateBonds) {
        const atom1 = this.atomToTemplateIndex.get(tBond.from);
        const atom2 = this.atomToTemplateIndex.get(tBond.to);
        if (atom1 && atom2) {
            new Bond(atom1, atom2, tBond.order);
        }
    }
}
```

## Important Flags

### geometryVerified
- Set `true` after reshaping completes successfully
- `isStable()` returns `true` immediately if this is set
- Prevents infinite reshape loops
- Cleared when composition changes (atoms added/removed)

### isReshaping
- `true` while molecule is actively reshaping
- Molecule won't decay while reshaping
- `isStable()` returns `false` while reshaping

## STABLE_MOLECULES Format

Templates are stored in `src/data/stable-molecules.js`:
```javascript
const STABLE_MOLECULES = {
    'C2H4': {
        name: 'Ethylene',
        formula: 'C2H4',
        atoms: [
            { symbol: 'C', x: 0, y: 0 },
            { symbol: 'C', x: 30, y: 0 },
            { symbol: 'H', x: -15, y: -15 },
            { symbol: 'H', x: -15, y: 15 },
            { symbol: 'H', x: 45, y: -15 },
            { symbol: 'H', x: 45, y: 15 }
        ],
        bonds: [
            { from: 0, to: 1, order: 2 },  // C=C double bond
            { from: 0, to: 2, order: 1 },  // C-H
            { from: 0, to: 3, order: 1 },  // C-H
            { from: 1, to: 4, order: 1 },  // C-H
            { from: 1, to: 5, order: 1 }   // C-H
        ]
    },
    // ... more templates
};
```

## Helper Functions (from stable-molecules.js)

### matchesStableTemplate(molecule)
Returns template if molecule's formula matches one in STABLE_MOLECULES.

### getTargetConfiguration(molecule, template)
Calculates where each atom should move and which template index it maps to.

### needsReshaping(molecule, template)
Returns true if molecule's current geometry doesn't match template.

### getTemplateBonds(template)
Returns the bond structure for a template.

## Known Issues

### Reshape Loop Bug (Fixed)
After reshaping, `isStable()` would re-check geometry and start reshaping again.
**Fix:** `geometryVerified` flag prevents re-check.

### Wrong Template Lock Bug (Current)
Molecule constructor calls `_checkForStableTemplate()` before intent protection is set.
**Fix needed:** Guard the method or pass protection to constructor.

See `molecule-intent-system-bugs-and-requirements.md` for full analysis.
