/**
 * Molecule Entity
 * A collection of bonded atoms forming a stable structure
 */

class Molecule {
    /**
     * Create a new molecule from a set of atoms
     * @param {Atom[]} atoms - Array of bonded atoms
     */
    constructor(atoms = []) {
        this.id = Utils.generateId();
        this.atoms = atoms;
        this.name = null;  // Set when catalogued
        this.formula = null;

        // Link atoms to this molecule immediately
        // This ensures atoms have correct moleculeId right after creation
        for (const atom of this.atoms) {
            atom.moleculeId = this.id;
        }

        // Calculate properties
        this.updateProperties();

        // State
        this.selected = false;
        this.highlighted = false;

        // Polymer membership
        this.polymerId = null;

        // Monomer properties - for proper biological polymerization
        this.isMonomer = false;         // Is this molecule a known monomer type?
        this.monomerTemplate = null;    // Reference to the monomer template this matches

        // Abstraction state - stable molecules can be abstracted for performance
        this.abstracted = false;
        this.blueprintRef = null; // Reference to blueprint for reconstruction

        // Decay timer for unstable molecules (in simulation ticks)
        // Unstable molecules decay after 500-1500 ticks, releasing atoms
        this.decayTimer = null;
        this.decayRate = 0; // How fast decay progresses per tick

        // Reshaping state - for transitioning to stable configuration
        this.reshapingTimer = null;        // Countdown timer (in ticks)
        this.reshapingDuration = 200;      // Total ticks to reshape
        this.targetTemplate = null;        // The stable template to reshape towards
        this.isReshaping = false;          // Currently reshaping flag
        this.targetPositions = null;       // Cached target positions for atoms
        this.reshapingProgress = 0;        // 0 to 1 progress
        this.geometryVerified = false;     // Set true after reshaping completes successfully

        // Auto-detect if this matches a monomer template
        this._detectMonomerType();

        // Check for stable template match and initiate reshaping if needed
        this._checkForStableTemplate();
    }

    /**
     * Get all bonds in this molecule
     */
    get bonds() {
        const bondSet = new Set();
        for (const atom of this.atoms) {
            for (const bond of atom.bonds) {
                // Only include bonds where both atoms are in this molecule
                if (this.atoms.includes(bond.atom1) && this.atoms.includes(bond.atom2)) {
                    bondSet.add(bond);
                }
            }
        }
        return Array.from(bondSet);
    }

    /**
     * Calculate center of mass
     */
    get centerOfMass() {
        if (this.atoms.length === 0) return new Vector2(0, 0);

        let totalMass = 0;
        let weightedPos = new Vector2(0, 0);

        for (const atom of this.atoms) {
            totalMass += atom.mass;
            weightedPos = weightedPos.add(atom.position.mul(atom.mass));
        }

        return weightedPos.div(totalMass);
    }

    /**
     * Calculate total mass
     */
    get mass() {
        return this.atoms.reduce((sum, atom) => sum + atom.mass, 0);
    }

    /**
     * Get center position (alias for centerOfMass for compatibility)
     */
    getCenter() {
        return this.centerOfMass;
    }

    /**
     * Update derived properties
     */
    updateProperties() {
        const oldFormula = this.formula;
        this.formula = this.calculateFormula();
        this.fingerprint = this.calculateFingerprint();
        
        // If formula changed, geometry needs re-verification
        if (oldFormula && oldFormula !== this.formula) {
            this.geometryVerified = false;
        }
    }

    /**
     * Calculate molecular formula (e.g., "H2O", "CH4")
     */
    calculateFormula() {
        const counts = {};

        for (const atom of this.atoms) {
            counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
        }

        // Standard ordering: C, H, then alphabetical
        const order = ['C', 'H'];
        const symbols = Object.keys(counts).sort((a, b) => {
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return a.localeCompare(b);
        });

        let formula = '';
        for (const symbol of symbols) {
            formula += symbol;
            if (counts[symbol] > 1) {
                formula += counts[symbol];
            }
        }

        return formula;
    }

    /**
     * Calculate a fingerprint for identifying equivalent structures
     */
    calculateFingerprint() {
        // Create a canonical representation
        const atomCounts = {};
        const bondCounts = {};

        for (const atom of this.atoms) {
            atomCounts[atom.symbol] = (atomCounts[atom.symbol] || 0) + 1;
        }

        for (const bond of this.bonds) {
            const symbols = [bond.atom1.symbol, bond.atom2.symbol].sort();
            const key = `${symbols[0]}-${symbols[1]}-${bond.order}`;
            bondCounts[key] = (bondCounts[key] || 0) + 1;
        }

        return JSON.stringify({ atoms: atomCounts, bonds: bondCounts });
    }

    /**
     * Check if molecule has valid valence (all valences satisfied)
     * This is a prerequisite for stability but not sufficient alone.
     */
    hasValidValence() {
        // Need at least 2 atoms to be a molecule
        if (this.atoms.length < 2) return false;

        // Need at least 1 bond
        if (this.bonds.length < 1) return false;

        // All atoms must have their valences satisfied
        for (const atom of this.atoms) {
            if (atom.availableValence > 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if molecule is stable (valences satisfied AND geometry matches known template if applicable)
     * A molecule needs at least 2 atoms, at least 1 bond, and must match its template geometry.
     * If currently reshaping, the molecule is NOT considered stable until reshaping completes.
     */
    isStable() {
        // Basic valence check first
        if (!this.hasValidValence()) {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('molecules', this)) {
                Debug.logMolecule('molecules', 'isStable=FALSE (invalid valence)', this, {
                    atoms: this.atoms.map(a => `${a.symbol}:${a.bondCount}/${a.maxBonds}`)
                });
            }
            return false;
        }

        // If currently reshaping, NOT stable yet - wait for completion
        if (this.isReshaping) return false;

        // If geometry was already verified (after reshaping), skip re-check
        if (this.geometryVerified) return true;

        // Check if this formula matches a known stable template
        if (typeof matchesStableTemplate === 'function') {
            const template = matchesStableTemplate(this);
            if (template) {
                // This molecule matches a known formula - check geometry
                if (typeof needsReshaping === 'function' && needsReshaping(this, template)) {
                    // Geometry doesn't match template - NOT stable
                    if (typeof Debug !== 'undefined' && Debug.shouldLog('reshape', this)) {
                        Debug.logMolecule('reshape', 'isStable=FALSE (needs reshaping)', this, {
                            template: template.name,
                            geometryVerified: this.geometryVerified
                        });
                    }
                    // Start reshaping if not already
                    if (!this.isReshaping) {
                        this.startReshaping(template);
                    }
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if molecule can participate in polymer formation
     * NEW: Only molecules that are known monomers can polymerize.
     * Random stable molecules cannot chain together - that's not how polymers work.
     */
    canPolymerize() {
        // Must have at least 2 atoms to be a molecule
        if (this.atoms.length < 2) return false;

        // Must be stable - unstable molecules can't form polymers
        if (!this.isStable()) return false;

        // NEW: Must be a known monomer type
        // Only molecules that match a monomer template can polymerize
        return this.isMonomer;
    }

    /**
     * Detect if this molecule matches a known monomer template
     * Called automatically when formula is calculated
     */
    _detectMonomerType() {
        // Check if findMonomerByFormula function exists (from monomer-templates.js)
        if (typeof findMonomerByFormula === 'function' && this.formula) {
            const template = findMonomerByFormula(this.formula);
            if (template) {
                this.isMonomer = true;
                this.monomerTemplate = template;
                console.log(`Molecule ${this.formula} detected as monomer: ${template.name}`);
            }
        }
    }

    /**
     * Check if this molecule matches a known stable template
     * If so, initiate reshaping to the stable configuration
     */
    _checkForStableTemplate() {
        // Only check if we're not already reshaping
        if (this.isReshaping) return;

        // Check if matchesStableTemplate function exists (from stable-molecules.js)
        if (typeof matchesStableTemplate !== 'function') return;

        const template = matchesStableTemplate(this);
        if (template && typeof needsReshaping === 'function' && needsReshaping(this, template)) {
            this.startReshaping(template);
        }
    }

    /**
     * Start the reshaping process toward a stable configuration
     * @param {Object} template - The stable molecule template
     */
    startReshaping(template) {
        if (!template) return;

        this.targetTemplate = template;
        this.reshapingTimer = this.reshapingDuration;
        this.isReshaping = true;
        this.reshapingProgress = 0;
        this.geometryVerified = false;  // Clear until reshaping completes

        // Calculate target positions and atom-to-template mapping
        if (typeof getTargetConfiguration === 'function') {
            const config = getTargetConfiguration(this, template);
            this.targetPositions = config.targetPositions;
            this.atomToTemplateIndex = config.atomToTemplateIndex;  // Store mapping for bond restructuring
        }

        if (typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', `START → ${template.name}`, this, {
                mappingSize: this.atomToTemplateIndex?.size,
                templateBonds: template.bonds?.length
            });
        }
    }

    /**
     * Cancel the reshaping process (e.g., when molecule composition changes)
     */
    cancelReshaping() {
        if (this.isReshaping && typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', 'CANCELLED', this);
        }
        this.targetTemplate = null;
        this.reshapingTimer = null;
        this.isReshaping = false;
        this.reshapingProgress = 0;
        this.targetPositions = null;
        this.atomToTemplateIndex = null;  // Clear the mapping
        this.geometryVerified = false;  // Needs re-verification
    }

    /**
     * Update the reshaping animation
     * @param {number} dt - Delta time
     * @returns {boolean} True if reshaping completed this tick
     */
    updateReshaping(dt) {
        if (!this.isReshaping || !this.targetPositions) return false;

        // Progress the timer
        this.reshapingTimer -= 1;
        this.reshapingProgress = 1 - (this.reshapingTimer / this.reshapingDuration);

        // Apply forces to move atoms toward target positions
        const lerpFactor = 0.05 + (this.reshapingProgress * 0.1); // Accelerate as we progress

        for (const [atom, targetPos] of this.targetPositions) {
            const direction = targetPos.sub(atom.position);
            const distance = direction.length();

            if (distance > 1) {
                // Apply a spring-like force toward target
                const force = direction.normalize().mul(distance * lerpFactor * 2);
                atom.applyForce(force);

                // Also directly lerp position for smoother animation
                atom.position = atom.position.add(direction.mul(lerpFactor));
            }
        }

        // Check if reshaping is complete
        if (this.reshapingTimer <= 0) {
            this.applyStableConfiguration();
            return true;
        }

        return false;
    }

    /**
     * Apply the final stable configuration
     * Snaps atoms to target positions and restructures bonds per template
     */
    applyStableConfiguration() {
        if (!this.targetTemplate || !this.targetPositions) {
            this.cancelReshaping();
            return;
        }

        if (typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', `COMPLETING → ${this.targetTemplate.name}`, this, {
                atomCount: this.atoms.length,
                currentBonds: this.bonds.length,
                templateBonds: this.targetTemplate.bonds?.length
            });
        }

        // Snap atoms to final positions
        for (const [atom, targetPos] of this.targetPositions) {
            atom.position = targetPos;
            atom.velocity = new Vector2(0, 0); // Stop movement
        }

        // Restructure bonds to match template (break wrong bonds, create correct ones)
        this._restructureBonds();

        // Clear reshaping state
        this.isReshaping = false;
        this.reshapingProgress = 1;
        this.reshapingTimer = null;
        this.geometryVerified = true;  // Mark geometry as verified to prevent re-check loop

        // Update properties now that we're stable
        this.updateProperties();

        // Set the name from template
        if (this.targetTemplate.name) {
            this.name = this.targetTemplate.name;
        }

        // Copy monomer flag from template if present
        if (this.targetTemplate.isMonomer) {
            this.isMonomer = true;
        }

        // Final state log
        if (typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', 'FINISHED - Now stable', this, {
                finalBonds: this.bonds.length,
                isStableNow: this.hasValidValence(),
                geometryVerified: this.geometryVerified,
                atomValences: this.atoms.map(a => `${a.symbol}:${a.bondCount}/${a.maxBonds}`)
            });
        }
    }

    /**
     * Restructure bonds to match the target template
     * This breaks all existing bonds and creates new ones per the template
     * Uses the atomToTemplateIndex mapping computed when reshaping started
     */
    _restructureBonds() {
        if (!this.targetTemplate || !this.targetTemplate.bonds) return;

        const templateBonds = this.targetTemplate.bonds;

        // Use the stored mapping from startReshaping() - this is the SAME mapping
        // that was used to calculate target positions, ensuring consistency
        if (!this.atomToTemplateIndex || this.atomToTemplateIndex.size === 0) {
            if (typeof Debug !== 'undefined') {
                Debug.logMolecule('reshape', 'ERROR: No atom-to-template mapping', this);
            }
            return;
        }

        // Build reverse mapping: template index -> atom
        const templateIndexToAtom = new Map();
        for (const [atom, templateIndex] of this.atomToTemplateIndex) {
            templateIndexToAtom.set(templateIndex, atom);
        }

        if (typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', 'Restructuring bonds', this, {
                mappedAtoms: this.atomToTemplateIndex.size,
                templateAtoms: this.targetTemplate.atoms?.length
            });
        }

        // Step 1: Break ALL existing bonds in this molecule
        // Use break(false) to not add repulsion energy - we're restructuring, not decaying
        const bondsToBreak = [...this.bonds]; // Copy since we're modifying
        for (const bond of bondsToBreak) {
            if (typeof Debug !== 'undefined') {
                Debug.logBond('BREAK (restructure)', bond, this);
            }
            bond.break(false);  // No energy release during restructure
        }

        // Step 2: Create new bonds exactly per template
        for (const tBond of templateBonds) {
            const atom1 = templateIndexToAtom.get(tBond.atom1);
            const atom2 = templateIndexToAtom.get(tBond.atom2);
            const order = tBond.order || 1;

            if (atom1 && atom2) {
                // Create new bond with correct order
                const bond = new Bond(atom1, atom2, order);
                
                if (typeof Debug !== 'undefined') {
                    Debug.logBond(`CREATE order:${order}`, bond, this);
                }

                // Note: Bond constructor automatically adds itself to atoms
                // and the Environment will pick it up via syncBonds
            } else {
                if (typeof Debug !== 'undefined') {
                    Debug.logMolecule('reshape', `ERROR: Could not create bond indices ${tBond.atom1}-${tBond.atom2}`, this, {
                        hasAtom1: !!atom1,
                        hasAtom2: !!atom2
                    });
                }
            }
        }

        // Step 3: Verify the new bonds are correct
        const newBonds = this.bonds;
        if (typeof Debug !== 'undefined') {
            Debug.logMolecule('reshape', 'RESTRUCTURE COMPLETE', this, {
                newBondCount: newBonds.length,
                templateBondCount: templateBonds.length,
                match: newBonds.length === templateBonds.length
            });
        }
    }

    /**
     * Get the monomer template this molecule matches, if any
     * @returns {Object|null} Monomer template or null
     */
    getMonomerTemplate() {
        return this.monomerTemplate;
    }

    /**
     * Check if two molecules have the same structure
     * @param {Molecule} other - Other molecule to compare
     */
    isEquivalentTo(other) {
        return this.fingerprint === other.fingerprint;
    }

    /**
     * Apply a force to the entire molecule (distributed by mass)
     * @param {Vector2} force - Force vector
     */
    applyForce(force) {
        const totalMass = this.mass;
        for (const atom of this.atoms) {
            const fraction = atom.mass / totalMass;
            atom.applyForce(force.mul(fraction));
        }
    }

    /**
     * Update all atoms in the molecule
     * @param {number} dt - Delta time
     * @param {Environment} environment - The environment (optional, for intention-aware decay)
     * @returns {object|null} - Returns decay info if atom was released, null otherwise
     */
    update(dt, environment = null) {
        // If molecule is stable and abstracted, skip individual atom physics
        if (this.abstracted && this.isStable()) {
            // Just update center position based on velocity if moving
            return null;
        }

        // Handle reshaping animation (takes priority over decay)
        if (this.isReshaping) {
            const completed = this.updateReshaping(dt);
            if (completed) {
                // Reshaping complete - molecule should now be stable
                return { type: 'reshaped', molecule: this };
            }
            // Don't decay while reshaping
        } else if (!this.isStable()) {
            // isStable() automatically starts reshaping if template match found
            // If we're here and not reshaping, molecule is truly unstable

            // Handle decay for unstable molecules (only if not reshaping)
            if (!this.isReshaping) {
                // Initialize decay timer if not set
                if (this.decayTimer === null) {
                    // Decay time: 100-400 ticks depending on stability (faster decay)
                    const stabilityRatio = this._calculateStabilityRatio();
                    this.decayTimer = 100 + Math.floor(stabilityRatio * 300);
                    this.decayRate = 1;
                }

                // Progress decay
                this.decayTimer -= this.decayRate;

                // Check if it's time to release an atom
                if (this.decayTimer <= 0) {
                    const releasedAtom = this._releaseWeakestAtom(environment);
                    if (releasedAtom) {
                        // Reset timer for next potential decay (faster)
                        this.decayTimer = 80 + Math.floor(Math.random() * 120);
                        return { type: 'decay', atom: releasedAtom };
                    }
                }
            }
        } else {
            // Molecule is truly stable - reset decay timer
            this.decayTimer = null;

            // Auto-abstract stable molecules in polymers for performance
            if (this.polymerId && !this.abstracted) {
                this.abstracted = true;
            }
        }

        // Apply bond spring forces
        for (const bond of this.bonds) {
            bond.applySpringForce(0.8);
        }

        // Update atom positions
        for (const atom of this.atoms) {
            atom.update(dt);
        }

        return null;
    }

    /**
     * Calculate how stable the molecule is (0 = very unstable, 1 = almost stable)
     */
    _calculateStabilityRatio() {
        let filledValences = 0;
        let totalValences = 0;
        for (const atom of this.atoms) {
            totalValences += atom.maxBonds;
            filledValences += atom.bondCount;
        }
        return totalValences > 0 ? filledValences / totalValences : 0;
    }

    /**
     * Release the atom with the weakest bond (most unsatisfied valence)
     * If inside an intention zone, prioritize releasing atoms that are in EXCESS of the target composition
     * @param {Environment} environment - The environment (optional)
     * @returns {Atom|null} - The released atom, or null if none released
     */
    _releaseWeakestAtom(environment = null) {
        // Check if we're inside an intention zone and get composition delta
        let insideIntention = false;
        let excessElements = null;  // Elements we have too many of
        let neededElements = null;  // Elements we need more of or should keep
        
        if (environment) {
            const center = this.centerOfMass;
            for (const intention of environment.intentions.values()) {
                if (intention.type !== 'molecule') continue;
                if (intention.fulfilled) continue;
                
                const dist = center.distanceTo(intention.position);
                if (dist < intention.radius) {
                    insideIntention = true;
                    // Get what we need to add/remove to match target
                    const delta = intention.getCompositionDelta(this);
                    if (delta) {
                        if (Object.keys(delta.excess).length > 0) {
                            excessElements = new Set(Object.keys(delta.excess));
                        }
                        // Get target composition to know which elements to KEEP
                        const targetComp = intention.getTargetComposition();
                        if (targetComp) {
                            neededElements = new Set(Object.keys(targetComp));
                        }
                    }
                    break;
                }
            }
        }
        
        // If inside intention and NO excess elements, don't release anything!
        // Let the molecule try to stabilize with the atoms it has
        if (insideIntention && !excessElements) {
            return null;  // Hold onto all atoms - they're all needed
        }
        
        // Find atom to release
        // Priority 1: Atoms that are in EXCESS of target composition (if inside intention)
        // Priority 2: Weakest bonded atom that is NOT needed (if inside intention)
        // Priority 3: Weakest bonded atom (only if NOT inside intention)
        let weakestAtom = null;
        let lowestSatisfaction = 1;
        let bestExcessAtom = null;
        let lowestExcessSatisfaction = 1;
        let weakestUnneededAtom = null;
        let lowestUnneededSatisfaction = 1;

        for (const atom of this.atoms) {
            if (atom.bonds.length === 0) continue; // Skip already free atoms
            const satisfaction = atom.bondCount / atom.maxBonds;
            
            // Track best excess atom (atoms we have too many of)
            if (excessElements && excessElements.has(atom.symbol)) {
                if (satisfaction < lowestExcessSatisfaction) {
                    lowestExcessSatisfaction = satisfaction;
                    bestExcessAtom = atom;
                }
            }
            
            // Track weakest atom that is NOT needed by the intention
            if (insideIntention && neededElements && !neededElements.has(atom.symbol)) {
                if (satisfaction < lowestUnneededSatisfaction) {
                    lowestUnneededSatisfaction = satisfaction;
                    weakestUnneededAtom = atom;
                }
            }
            
            // Also track overall weakest (only used outside intentions)
            if (satisfaction < lowestSatisfaction) {
                lowestSatisfaction = satisfaction;
                weakestAtom = atom;
            }
        }
        
        // Choose which atom to release based on priority
        let atomToRelease = null;
        if (bestExcessAtom) {
            // First priority: release excess atoms
            atomToRelease = bestExcessAtom;
        } else if (insideIntention && weakestUnneededAtom) {
            // Second priority (inside intention): release unneeded atoms
            atomToRelease = weakestUnneededAtom;
        } else if (!insideIntention && weakestAtom) {
            // Third priority (outside intention only): release weakest
            atomToRelease = weakestAtom;
        }
        // If inside intention and all atoms are needed, atomToRelease stays null

        if (atomToRelease && atomToRelease.bonds.length > 0) {
            // Break the weakest bond
            const bondToBreak = atomToRelease.bonds[0];
            bondToBreak.break();

            // Give atom strong velocity away from molecule center
            const center = this.centerOfMass;
            const direction = atomToRelease.position.sub(center).normalize();
            atomToRelease.velocity = direction.mul(15);  // Much stronger push away

            // Mark the atom as repelled from this molecule to prevent immediate re-bonding
            atomToRelease.addRepulsion(this.id, 500);  // Repelled for 500 ticks (longer)

            // Clear molecule reference
            atomToRelease.moleculeId = null;

            return atomToRelease;
        }

        return null;
    }

    /**
     * Restore molecule shape from blueprint reference
     * Repositions atoms to match the original blueprint layout
     * Used for replication and visual consistency of abstracted molecules
     */
    restoreShape() {
        if (!this.blueprintRef || !this.blueprintRef.atomData) return false;

        const center = this.centerOfMass;
        const atomData = this.blueprintRef.atomData;

        // Only restore if we have matching atom count
        if (atomData.length !== this.atoms.length) return false;

        // Reposition atoms to match blueprint relative positions
        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const data = atomData[i];
            if (atom && data) {
                atom.position.x = center.x + data.relX;
                atom.position.y = center.y + data.relY;
                atom.velocity = new Vector2(0, 0); // Reset velocity
            }
        }

        return true;
    }

    /**
     * Create a copy of this molecule using its blueprint
     * @param {number} x - X position for copy
     * @param {number} y - Y position for copy
     * @returns {Molecule|null} - New molecule instance or null if no blueprint
     */
    replicate(x, y) {
        if (!this.blueprintRef) return null;
        return this.blueprintRef.instantiate(x, y);
    }

    /**
     * Render the molecule at the molecule abstraction level
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} scale - Zoom scale
     * @param {Vector2} offset - Camera offset
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }) {
        // Draw reshaping indicator if molecule is transitioning
        if (this.isReshaping) {
            this._renderReshapingIndicator(ctx, scale, offset);
        }

        // Draw bonds first (behind atoms)
        for (const bond of this.bonds) {
            bond.render(ctx, scale, offset);
        }

        // Draw atoms
        for (const atom of this.atoms) {
            atom.render(ctx, scale, offset);
        }

        // Draw molecule highlight/selection
        if (this.selected || this.highlighted) {
            this.renderBoundingBox(ctx, scale, offset);
        }
    }

    /**
     * Render visual indicator for reshaping molecules
     */
    _renderReshapingIndicator(ctx, scale, offset) {
        const center = this.centerOfMass;
        const screenX = (center.x + offset.x) * scale;
        const screenY = (center.y + offset.y) * scale;

        // Calculate bounding radius
        let maxDist = 0;
        for (const atom of this.atoms) {
            const dist = atom.position.distanceTo(center) + atom.radius;
            maxDist = Math.max(maxDist, dist);
        }
        const screenRadius = Math.max(30, (maxDist + 10) * scale);

        // Pulsing effect based on progress
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;

        // Draw reshaping glow
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, screenRadius
        );
        gradient.addColorStop(0, `rgba(34, 197, 94, ${0.4 * pulse})`);  // Green glow
        gradient.addColorStop(0.5, `rgba(34, 197, 94, ${0.2 * pulse})`);
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw progress arc
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius * 0.9,
            -Math.PI / 2,
            -Math.PI / 2 + (this.reshapingProgress * Math.PI * 2));
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw "Reshaping" label
        ctx.fillStyle = '#4ade80';
        ctx.font = `${10 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Reshaping...', screenX, screenY - screenRadius - 5);
    }

    /**
     * Render at molecule level (simplified view)
     */
    renderSimplified(ctx, scale = 1, offset = { x: 0, y: 0 }) {
        const center = this.centerOfMass;
        const screenX = (center.x + offset.x) * scale;
        const screenY = (center.y + offset.y) * scale;

        // Calculate bounding radius
        let maxDist = 0;
        for (const atom of this.atoms) {
            const dist = atom.position.distanceTo(center) + atom.radius;
            maxDist = Math.max(maxDist, dist);
        }
        const screenRadius = Math.max(20, maxDist * scale);

        // Draw molecule blob
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(
            screenX - screenRadius * 0.3,
            screenY - screenRadius * 0.3,
            0,
            screenX,
            screenY,
            screenRadius
        );
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');

        ctx.fillStyle = gradient;
        ctx.fill();

        if (this.selected) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();

        // Draw formula label
        if (screenRadius > 15) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${Math.max(10, screenRadius * 0.4)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.formula, screenX, screenY);
        }
    }

    /**
     * Render bounding box for selection
     */
    renderBoundingBox(ctx, scale, offset) {
        const bounds = this.getBounds();
        const padding = 10;

        const x = (bounds.minX + offset.x) * scale - padding;
        const y = (bounds.minY + offset.y) * scale - padding;
        const w = (bounds.maxX - bounds.minX) * scale + padding * 2;
        const h = (bounds.maxY - bounds.minY) * scale + padding * 2;

        ctx.strokeStyle = this.selected ? '#6366f1' : '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    }

    /**
     * Get bounding box
     */
    getBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const atom of this.atoms) {
            minX = Math.min(minX, atom.position.x - atom.radius);
            minY = Math.min(minY, atom.position.y - atom.radius);
            maxX = Math.max(maxX, atom.position.x + atom.radius);
            maxY = Math.max(maxY, atom.position.y + atom.radius);
        }

        return { minX, minY, maxX, maxY };
    }

    /**
     * Check if point is inside molecule (also checks blob area for level 2+ selection)
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        // Check individual atoms
        for (const atom of this.atoms) {
            if (atom.containsPoint(x, y, scale, offset)) {
                return true;
            }
        }

        // Also check the blob area (for molecule level selection)
        const center = this.centerOfMass;
        const screenX = (center.x + offset.x) * scale;
        const screenY = (center.y + offset.y) * scale;

        // Calculate bounding radius (same as renderSimplified)
        let maxDist = 0;
        for (const atom of this.atoms) {
            const dist = atom.position.distanceTo(center) + atom.radius;
            maxDist = Math.max(maxDist, dist);
        }
        const screenRadius = Math.max(20, maxDist * scale);

        const dx = x - screenX;
        const dy = y - screenY;
        if (dx * dx + dy * dy <= screenRadius * screenRadius) {
            return true;
        }

        return false;
    }

    /**
     * Serialize molecule to plain object
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            formula: this.formula,
            atoms: this.atoms.map(a => a.serialize()),
            bonds: this.bonds.map(b => b.serialize())
        };
    }

    /**
     * Create molecule from serialized data
     */
    static deserialize(data) {
        // Recreate atoms
        const atomMap = new Map();
        const atoms = data.atoms.map(atomData => {
            const atom = Atom.deserialize(atomData);
            atomMap.set(atom.id, atom);
            return atom;
        });

        // Recreate bonds
        data.bonds.forEach(bondData => {
            Bond.deserialize(bondData, atomMap);
        });

        const molecule = new Molecule(atoms);
        molecule.id = data.id;
        molecule.name = data.name;

        return molecule;
    }
}

/**
 * Find connected atom groups using BFS
 * @param {Atom[]} atoms - Array of atoms
 * @returns {Atom[][]} Array of connected groups
 */
function findConnectedGroups(atoms) {
    const visited = new Set();
    const groups = [];

    for (const startAtom of atoms) {
        if (visited.has(startAtom)) continue;

        const group = [];
        const queue = [startAtom];

        while (queue.length > 0) {
            const atom = queue.shift();
            if (visited.has(atom)) continue;

            visited.add(atom);
            group.push(atom);

            for (const bond of atom.bonds) {
                const other = bond.getOther(atom);
                if (!visited.has(other) && atoms.includes(other)) {
                    queue.push(other);
                }
            }
        }

        if (group.length > 0) {
            groups.push(group);
        }
    }

    return groups;
}

/**
 * Create molecules from a set of atoms
 * @param {Atom[]} atoms - Array of atoms
 * @returns {Molecule[]} Array of molecules
 */
function createMoleculesFromAtoms(atoms) {
    const groups = findConnectedGroups(atoms);
    return groups.map(group => new Molecule(group));
}

// Make available globally
window.Molecule = Molecule;
window.findConnectedGroups = findConnectedGroups;
window.createMoleculesFromAtoms = createMoleculesFromAtoms;
