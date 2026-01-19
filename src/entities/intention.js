/**
 * Intention Entity
 * Represents a blueprint intention zone that attracts required components
 * to form molecules, polymers, or cells organically
 */

class Intention {
    /**
     * Create a new intention zone
     * @param {string} type - 'molecule', 'polymer', or 'cell'
     * @param {Object} blueprint - The blueprint to fulfill
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    constructor(type, blueprint, x, y) {
        this.id = Utils.generateId();
        this.type = type;
        this.blueprint = blueprint;
        this.position = new Vector2(x, y);

        // Attraction properties
        this.radius = this._getRadiusByType();
        this.attractionForce = 3.0; // Strong attraction force

        // Progress tracking
        this.progress = 0;
        this.gatheredComponents = new Set();
        this.fulfilled = false;
        this.createdEntity = null;

        // Timing
        this.age = 0;
        this.maxAge = 10000; // Timeout after 10000 ticks if not fulfilled
        this.createdAt = Date.now(); // Timestamp for when intention was created

        // Exclusion list: molecules that existed before this intention was placed
        // These should be ignored when checking for completion
        this.excludedMoleculeIds = new Set();
        this.exclusionInitialized = false;

        // Visual state
        this.pulsePhase = 0;
        this.selected = false;
    }

    /**
     * Initialize the exclusion list with currently existing molecules
     * Call this once after adding the intention to the environment
     * @param {Environment} environment - The environment to scan
     */
    initializeExclusions(environment) {
        if (this.exclusionInitialized) return;

        // Record all existing molecules that would match our requirements
        if (this.type === 'molecule') {
            const requirements = this.getRequirements();
            if (requirements && requirements.type === 'atoms' && requirements.count) {
                for (const mol of environment.molecules.values()) {
                    // Exclude all molecules that match our atom count requirement
                    if (mol.atoms.length === requirements.count) {
                        this.excludedMoleculeIds.add(mol.id);
                    }
                }
            }
        }

        this.exclusionInitialized = true;
        console.log(`Intention ${this.id.substring(0, 8)} initialized with ${this.excludedMoleculeIds.size} excluded molecules`);
    }

    /**
     * Get appropriate radius based on intention type
     * This is the attraction range - entities within this distance will be pulled
     */
    _getRadiusByType() {
        switch (this.type) {
            case 'molecule': return 300;  // Large range to attract atoms
            case 'polymer': return 400;   // Even larger for molecules
            case 'cell': return 500;      // Largest for polymers
            default: return 300;
        }
    }

    /**
     * Get the target element composition for molecule intentions
     * @returns {Object} - Map of element symbol to count, e.g., { C: 2, H: 4 }
     */
    getTargetComposition() {
        if (this.type !== 'molecule') return null;
        
        const composition = {};
        
        if (this.blueprint.atomData) {
            for (const atom of this.blueprint.atomData) {
                composition[atom.symbol] = (composition[atom.symbol] || 0) + 1;
            }
        }
        
        return composition;
    }

    /**
     * Get the element composition for polymer intentions (from monomer template)
     * @returns {Set} - Set of element symbols needed for the monomer
     */
    getMonomerElements() {
        if (this.type !== 'polymer') return null;
        
        const requirements = this.getRequirements();
        const elements = new Set();
        
        // Get elements from monomer template's atomLayout
        if (requirements.monomerTemplate && requirements.monomerTemplate.atomLayout) {
            for (const atom of requirements.monomerTemplate.atomLayout) {
                elements.add(atom.symbol);
            }
        }
        
        // Fallback to requiredElements if no atomLayout
        if (elements.size === 0 && requirements.requiredElements) {
            for (const el of requirements.requiredElements) {
                elements.add(el);
            }
        }
        
        return elements;
    }

    /**
     * Calculate what changes a molecule needs to become the target molecule
     * @param {Molecule} molecule - The molecule to compare
     * @returns {Object} - { needed: { H: 2 }, excess: { O: 1 }, isMatch: false }
     */
    getCompositionDelta(molecule) {
        if (this.type !== 'molecule') return null;
        
        const target = this.getTargetComposition();
        if (!target) return null;
        
        // Get current molecule composition
        const current = {};
        for (const atom of molecule.atoms) {
            current[atom.symbol] = (current[atom.symbol] || 0) + 1;
        }
        
        const needed = {};  // Atoms we need to add
        const excess = {};  // Atoms we need to remove
        
        // Check what's needed (in target but not enough in current)
        for (const [symbol, count] of Object.entries(target)) {
            const have = current[symbol] || 0;
            if (have < count) {
                needed[symbol] = count - have;
            }
        }
        
        // Check what's in excess (in current but not needed or too many)
        for (const [symbol, count] of Object.entries(current)) {
            const want = target[symbol] || 0;
            if (count > want) {
                excess[symbol] = count - want;
            }
        }
        
        const isMatch = Object.keys(needed).length === 0 && Object.keys(excess).length === 0;
        
        return { needed, excess, isMatch };
    }

    /**
     * Get required components based on blueprint
     */
    getRequirements() {
        if (this.type === 'molecule') {
            // For molecules, we need specific atoms
            // Extract elements from atomData if available
            let elements = this.blueprint.requiredElements;
            if (!elements && this.blueprint.atomData) {
                const elementSet = new Set();
                for (const atom of this.blueprint.atomData) {
                    elementSet.add(atom.symbol);
                }
                elements = Array.from(elementSet);
            }
            return {
                type: 'atoms',
                elements: elements || ['C'],
                count: this.blueprint.atomData?.length || 4
            };
        } else if (this.type === 'polymer') {
            // For polymers, we need specific MONOMERS (identical molecules that chain)
            // NEW: Use monomer template system
            const monomerTemplate = this.blueprint.monomerTemplate || null;
            const monomerId = this.blueprint.monomerId || null;

            // Resolve monomer template if we have an ID but no template yet
            let resolvedTemplate = monomerTemplate;
            if (!resolvedTemplate && monomerId && typeof getMonomerTemplate === 'function') {
                resolvedTemplate = getMonomerTemplate(monomerId);
            }

            return {
                type: 'monomers',
                count: this.blueprint.minMonomers || this.blueprint.minMolecules || 3,
                monomerId: monomerId,
                monomerTemplate: resolvedTemplate,
                monomerFormula: resolvedTemplate?.formula || null,
                monomerName: resolvedTemplate?.name || this.blueprint.name || 'Unknown',
                requiredElements: this.blueprint.requiredElements || resolvedTemplate?.requiredElements || []
            };
        } else if (this.type === 'cell') {
            // For cells, we need polymer chains
            return {
                type: 'polymers',
                roles: ['membrane', 'structure', 'genetics']
            };
        }
        return null;
    }

    /**
     * Update intention state
     * @param {Environment} environment - The environment
     * @param {number} dt - Delta time
     */
    update(environment, dt) {
        this.age++;
        this.pulsePhase += 0.05;

        // NOTE: No timeout - intentions persist until fulfilled or manually deleted
        // (Bug #6 fix from AGENTS.md)

        // Find and attract nearby components
        this._attractComponents(environment);

        // Check if requirements are met
        this._checkCompletion(environment);
    }

    /**
     * Attract nearby components toward this intention
     */
    _attractComponents(environment) {
        const requirements = this.getRequirements();
        if (!requirements) return;

        if (requirements.type === 'atoms') {
            const targetComp = this.getTargetComposition();
            const neededElements = targetComp ? new Set(Object.keys(targetComp)) : null;
            
            // Attract free atoms AND atoms in unstable molecules
            for (const atom of environment.atoms.values()) {
                // Check if atom is in a stable molecule - skip those
                if (atom.moleculeId) {
                    const mol = environment.molecules.get(atom.moleculeId);
                    if (mol && mol.isStable()) continue; // Skip atoms in stable molecules
                }

                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius && dist > 5) {
                    const direction = this.position.sub(atom.position).normalize();
                    let forceMagnitude = this.attractionForce * (1 - dist / this.radius);
                    
                    // Smart attraction: attract needed elements, repel unneeded
                    if (neededElements) {
                        if (neededElements.has(atom.symbol)) {
                            // This element is needed - stronger attraction
                            forceMagnitude *= 1.5;
                        } else {
                            // This element is NOT in the target - repel away fast
                            forceMagnitude *= -1.5;  // Negative = strong repulsion
                        }
                    }
                    
                    const force = direction.mul(forceMagnitude);
                    atom.applyForce(force);
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }

            // Also attract unstable molecules as a whole (moves all their atoms)
            for (const mol of environment.molecules.values()) {
                if (mol.isStable()) continue; // Skip stable molecules

                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    // Strong force for unstable molecules - pull them in quickly
                    const force = direction.mul(this.attractionForce * 2.0 * (1 - dist / this.radius));
                    mol.applyForce(force);
                }
            }

            // Repel only fully stable molecules that don't match the target formula
            // Unstable molecules with useful atoms should NOT be repelled - let them transform
            const targetFormula = this.blueprint ? this.blueprint.formula : null;
            for (const mol of environment.molecules.values()) {
                // Skip molecules that are still reshaping (let them finish)
                if (mol.isReshaping) continue;
                
                // If this molecule IS the target formula, don't repel it
                if (targetFormula && mol.formula === targetFormula) continue;
                
                // Only repel STABLE molecules - unstable molecules may still transform
                if (!mol.isStable()) continue;
                
                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    // Strong repulsion for unrelated stable molecules
                    const repelForce = direction.mul(-this.attractionForce * 1.5 * (1 - dist / this.radius));
                    mol.applyForce(repelForce);
                }
            }
        } else if (requirements.type === 'molecules') {
            // Attract molecules (that aren't in polymers)
            for (const mol of environment.molecules.values()) {
                // Skip molecules already in polymers
                if (mol.polymerId) continue;

                const center = mol.getCenter();
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    const force = direction.mul(this.attractionForce * (1 - dist / this.radius));
                    mol.applyForce(force);
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }
        } else if (requirements.type === 'monomers') {
            // Attract only molecules that match the required monomer formula
            const requiredFormula = requirements.monomerFormula;
            const monomerElements = this.getMonomerElements();

            // Repel free atoms that are not part of the monomer formula
            for (const atom of environment.atoms.values()) {
                // Skip atoms in molecules
                if (atom.moleculeId) continue;
                
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius && dist > 5) {
                    const direction = this.position.sub(atom.position).normalize();
                    
                    if (monomerElements && monomerElements.has(atom.symbol)) {
                        // This element is part of the monomer - attract it
                        const force = direction.mul(this.attractionForce * 0.8 * (1 - dist / this.radius));
                        atom.applyForce(force);
                    } else {
                        // This element is NOT part of the monomer - repel it fast
                        const repelForce = direction.mul(-this.attractionForce * 1.5 * (1 - dist / this.radius));
                        atom.applyForce(repelForce);
                    }
                }
            }

            for (const mol of environment.molecules.values()) {
                // Skip molecules already in polymers
                if (mol.polymerId) continue;

                const center = mol.getCenter();
                const dist = center.distanceTo(this.position);
                
                // Check if this is the right monomer type
                const isCorrectMonomer = mol.isMonomer && 
                    (!requiredFormula || mol.formula === requiredFormula);
                
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    
                    if (isCorrectMonomer) {
                        // Attract correct monomers
                        const force = direction.mul(this.attractionForce * (1 - dist / this.radius));
                        mol.applyForce(force);
                    } else if (mol.isStable()) {
                        // Only repel STABLE molecules that are NOT the required monomer
                        // Unstable molecules may still transform into the needed monomer
                        const repelForce = direction.mul(-this.attractionForce * 1.5 * (1 - dist / this.radius));
                        mol.applyForce(repelForce);
                    }
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }
        } else if (requirements.type === 'polymers') {
            // Attract polymers
            for (const polymer of environment.proteins.values()) {
                const center = polymer.getCenter();
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 20) {
                    const direction = this.position.sub(center).normalize();
                    // Polymers move slower
                    for (const mol of polymer.molecules) {
                        mol.applyForce(direction.mul(this.attractionForce * 0.5));
                    }
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }
        }

        // Update progress based on components in/near the zone
        const requirements2 = this.getRequirements();
        if (requirements2.type === 'atoms' && requirements2.count) {
            // Count only RELEVANT atoms in zone (matching target composition)
            const targetComp = this.getTargetComposition();
            const neededElements = targetComp ? new Set(Object.keys(targetComp)) : null;
            
            let relevantAtomsInZone = 0;
            // Clear and rebuild gatheredComponents each frame
            this.gatheredComponents.clear();
            
            for (const atom of environment.atoms.values()) {
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    // Only count atoms that are relevant to the target molecule
                    if (!neededElements || neededElements.has(atom.symbol)) {
                        relevantAtomsInZone++;
                        this.gatheredComponents.add(atom.id);
                    }
                }
            }
            this.progress = Math.min(1, relevantAtomsInZone / requirements2.count);
        } else if (requirements2.type === 'monomers' && requirements2.count) {
            // Count matching monomers in zone
            let monomersInZone = 0;
            const requiredFormula = requirements2.monomerFormula;
            
            // Clear and rebuild gatheredComponents each frame
            this.gatheredComponents.clear();

            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                if (!mol.isMonomer) continue;
                if (requiredFormula && mol.formula !== requiredFormula) continue;

                const dist = mol.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    monomersInZone++;
                    this.gatheredComponents.add(mol.id);
                }
            }
            this.progress = Math.min(1, monomersInZone / requirements2.count);
        } else if (requirements2.count) {
            // For other types, also rebuild gatheredComponents
            this.gatheredComponents.clear();
            // Progress will be updated by the specific type handler
            this.progress = 0;
        }
    }

    /**
     * Check if intention can be fulfilled
     */
    _checkCompletion(environment) {
        const requirements = this.getRequirements();
        if (!requirements) return;

        if (requirements.type === 'atoms' && requirements.count) {
            // Check if there's a matching molecule in the zone
            // OR if we have enough free atoms to form one

            // First check for existing molecules that match our requirements
            // Skip molecules that existed before this intention was placed
            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;

                // IMPORTANT: Skip molecules that existed before this intention was created
                if (this.excludedMoleculeIds.has(mol.id)) continue;

                // CRITICAL: Molecule must be STABLE before we count it as complete
                // This ensures the molecule has finished reshaping and won't become unstable
                if (!mol.isStable()) continue;

                // CRITICAL: Molecule must not be in the middle of reshaping
                // Wait for it to complete its transformation to the stable form
                if (mol.isReshaping) continue;

                // CRITICAL: Verify molecule has correct geometry for known templates
                // If a stable template exists for this formula, ensure molecule matches it
                if (typeof matchesStableTemplate === 'function' && typeof needsReshaping === 'function') {
                    const template = matchesStableTemplate(mol);
                    if (template && needsReshaping(mol, template)) {
                        // Molecule has wrong geometry - trigger reshaping and wait
                        mol.startReshaping(template);
                        continue;
                    }
                }

                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    // CRITICAL: Validate formula matches blueprint, not just atom count
                    // This prevents unrelated molecules from fulfilling the intention
                    const blueprintFormula = this.blueprint.formula;
                    if (blueprintFormula && mol.formula === blueprintFormula) {
                        // Mark intention as fulfilled - correct stable molecule formed!
                        this.createdEntity = mol;
                        this.fulfilled = true;
                        console.log(`Intention fulfilled: Stable molecule ${mol.formula} matches blueprint`);
                        return;
                    }
                    // If no formula in blueprint, fall back to atom count check (legacy)
                    else if (!blueprintFormula && mol.atoms.length === requirements.count) {
                        this.createdEntity = mol;
                        this.fulfilled = true;
                        console.log(`Intention fulfilled: New stable molecule ${mol.formula} formed (atom count match)`);
                        return;
                    }
                }
            }

            // If no matching molecule, check for free atoms
            const nearbyAtoms = [];
            for (const atom of environment.atoms.values()) {
                if (atom.moleculeId) continue;
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius * 0.5) {
                    nearbyAtoms.push(atom);
                }
            }

            if (nearbyAtoms.length >= requirements.count) {
                // Form the molecule!
                this._formMolecule(environment, nearbyAtoms.slice(0, requirements.count));
            }
        } else if (requirements.type === 'molecules' && requirements.count) {
            // Check if we have enough molecules nearby
            const nearbyMolecules = [];
            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                const dist = mol.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.5) {
                    nearbyMolecules.push(mol);
                }
            }

            if (nearbyMolecules.length >= requirements.count) {
                // Form the polymer!
                this._formPolymer(environment, nearbyMolecules.slice(0, requirements.count));
            }
        } else if (requirements.type === 'monomers' && requirements.count) {
            // NEW: Check for matching monomer molecules
            const requiredFormula = requirements.monomerFormula;
            const nearbyMonomers = [];

            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                if (!mol.isMonomer) continue;
                if (requiredFormula && mol.formula !== requiredFormula) continue;

                const dist = mol.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.5) {
                    nearbyMonomers.push(mol);
                }
            }

            if (nearbyMonomers.length >= requirements.count) {
                // Form the polymer from monomers!
                this._formPolymerFromMonomers(environment, nearbyMonomers.slice(0, requirements.count), requirements.monomerTemplate);
            }
        } else if (requirements.type === 'polymers') {
            // Check if we have required polymer types
            const nearbyPolymers = { membrane: null, structure: null, genetics: null };
            for (const polymer of environment.proteins.values()) {
                const dist = polymer.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    const role = polymer.cellRole || polymer.type;
                    if (role === 'membrane' || role === 'lipid') nearbyPolymers.membrane = polymer;
                    if (role === 'structure' || role === 'protein') nearbyPolymers.structure = polymer;
                    if (role === 'genetics' || role === 'nucleic_acid') nearbyPolymers.genetics = polymer;
                }
            }

            if (nearbyPolymers.membrane && nearbyPolymers.structure && nearbyPolymers.genetics) {
                // Form the cell!
                this._formCell(environment, Object.values(nearbyPolymers).filter(p => p));
            }
        }
    }

    /**
     * Form a molecule from gathered atoms
     */
    _formMolecule(environment, atoms) {
        // Sort atoms: heavier atoms (C, N, O) first as potential centers
        atoms.sort((a, b) => b.mass - a.mass);

        // Try to bond atoms intelligently
        // For molecules like CH4, bond all H to the central C
        const centralAtom = atoms[0]; // Heaviest atom as center

        for (let i = 1; i < atoms.length; i++) {
            const atom = atoms[i];

            // First try to bond to central atom
            if (centralAtom.availableValence > 0 && atom.availableValence > 0 && !centralAtom.isBondedTo(atom)) {
                const bond = new Bond(centralAtom, atom);
                environment.addBond(bond);
            } else {
                // If central is full, try to bond to previous atoms
                for (let j = 0; j < i; j++) {
                    const other = atoms[j];
                    if (other.availableValence > 0 && atom.availableValence > 0 && !other.isBondedTo(atom)) {
                        const bond = new Bond(other, atom);
                        environment.addBond(bond);
                        break;
                    }
                }
            }
        }

        // Only create molecule from atoms that actually have bonds
        const bondedAtoms = atoms.filter(a => a.bonds.length > 0);

        if (bondedAtoms.length < 2) {
            console.log('Intention: Not enough bonded atoms to form molecule');
            return; // Don't fulfill - try again next tick
        }

        // Create molecule from bonded atoms only
        const molecule = new Molecule(bondedAtoms);
        environment.addMolecule(molecule);

        // CRITICAL: Validate the formed molecule matches our blueprint formula
        // If wrong molecule formed, don't fulfill - keep trying
        const blueprintFormula = this.blueprint.formula;
        if (blueprintFormula && molecule.formula !== blueprintFormula) {
            console.log(`Intention: Formed ${molecule.formula} but need ${blueprintFormula}, continuing...`);
            return; // Don't fulfill - wrong molecule formed
        }

        // CRITICAL: Do NOT fulfill here!
        // We just created bonds - the molecule may not be stable yet.
        // The _checkCompletion loop above will verify stability and fulfill.
        // Just log that molecule was formed - completion check will handle the rest.
        console.log(`Intention: Created molecule ${molecule.formula}, waiting for stability...`);
    }

    /**
     * Form a polymer from gathered molecules
     */
    _formPolymer(environment, molecules) {
        // Validate molecules can polymerize - they need available valence (open bonds)
        const polymerizableMolecules = molecules.filter(mol => {
            // Check if any atom in the molecule has available valence
            for (const atom of mol.atoms) {
                if (atom.availableValence > 0) {
                    return true; // This molecule can bind
                }
            }
            console.log(`Molecule ${mol.formula} cannot polymerize - no available valence`);
            return false;
        });

        if (polymerizableMolecules.length < 2) {
            console.log('Cannot form polymer: need at least 2 molecules with available valence');
            return; // Don't form polymer
        }

        // Mark molecules as part of polymer
        const polymerId = Utils.generateId();
        polymerizableMolecules.forEach(mol => mol.polymerId = polymerId);

        // Create polymer
        const polymer = new Polymer(polymerizableMolecules, this.blueprint.type, this.blueprint.name);
        polymer.seal(); // Seal the polymer so internal atoms can't bond externally
        environment.addProtein(polymer);

        this.createdEntity = polymer;
        this.fulfilled = true;

        console.log(`Intention fulfilled: Created polymer ${polymer.name || polymer.type}`);
    }

    /**
     * Form a polymer chain from monomer molecules
     * NEW: Uses monomer template system for proper chain creation
     * @param {Environment} environment 
     * @param {Molecule[]} monomers - Identical monomer molecules to chain
     * @param {Object} monomerTemplate - The monomer template defining polymerization
     */
    _formPolymerFromMonomers(environment, monomers, monomerTemplate) {
        if (monomers.length < 2) {
            console.log('Cannot form polymer: need at least 2 monomers');
            return;
        }

        const monomerName = monomerTemplate?.name || monomers[0]?.formula || 'Unknown';
        console.log(`Forming polymer from ${monomers.length} ${monomerName} monomers`);

        // Create polymer with monomer template
        const polymer = new Polymer(monomers, monomerTemplate, this.blueprint.name);

        // Mark molecules as part of polymer
        monomers.forEach(mol => mol.polymerId = polymer.id);

        // Handle polymerization type
        if (monomerTemplate?.polymerizationType === 'condensation') {
            // Condensation polymerization releases water molecules
            const waterCount = monomers.length - 1; // n-1 water released
            console.log(`Condensation polymerization: ${waterCount} H2O molecules released (conceptually)`);
            // Note: Could actually spawn water molecules here if desired
        } else if (monomerTemplate?.polymerizationType === 'addition') {
            console.log('Addition polymerization: double bonds opened to form chain');
        }

        // Seal polymer to prevent external bonding
        polymer.seal();

        // Add to environment
        environment.addProtein(polymer);

        this.createdEntity = polymer;
        this.fulfilled = true;

        console.log(`Polymer created: ${polymer.name || polymer.type} from ${monomers.length} ${monomerName} monomers`);
    }

    /**
     * Form a cell from gathered polymers
     */
    _formCell(environment, polymers) {
        // Create cell at this position
        const cell = new Cell(this.position.x, this.position.y);

        // Add polymers to cell
        for (const polymer of polymers) {
            cell.addPolymer(polymer);
            environment.removeProtein(polymer.id);
        }

        environment.addCell(cell);

        this.createdEntity = cell;
        this.fulfilled = true;

        console.log(`Intention fulfilled: Created cell from ${polymers.length} polymers`);
    }

    /**
     * Render the intention zone
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        // Pulsing effect
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 0.8;

        // Get color based on type
        const colors = this._getColors();

        // Draw attraction radius (dashed circle)
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.setLineDash([10, 5]);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw glow effect
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, screenRadius
        );
        gradient.addColorStop(0, colors.glowInner);
        gradient.addColorStop(0.5, colors.glowMid);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw progress ring
        if (this.progress > 0) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenRadius * 0.9, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
            ctx.strokeStyle = colors.progress;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw center icon/preview
        this._renderPreview(ctx, screenX, screenY, scale, pulse, colors);

        // Draw label
        ctx.fillStyle = colors.text;
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.blueprint.name || this.type, screenX, screenY + screenRadius * 0.6);

        // Draw progress percentage
        ctx.font = `${10 * scale}px sans-serif`;
        ctx.fillText(`${Math.round(this.progress * 100)}%`, screenX, screenY + screenRadius * 0.6 + 15);
    }

    /**
     * Render preview of target entity
     */
    _renderPreview(ctx, screenX, screenY, scale, pulse, colors) {
        const previewRadius = 20 * scale * pulse;

        ctx.beginPath();
        ctx.arc(screenX, screenY, previewRadius, 0, Math.PI * 2);
        ctx.fillStyle = colors.preview;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw icon based on type
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${16 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const icons = { molecule: '&#9883;', polymer: '&#128279;', cell: '&#9678;' };
        ctx.fillText(this.type === 'molecule' ? 'M' : this.type === 'polymer' ? 'P' : 'C', screenX, screenY);
    }

    /**
     * Get colors based on intention type
     */
    _getColors() {
        switch (this.type) {
            case 'molecule':
                return {
                    border: 'rgba(139, 92, 246, 0.6)',
                    glowInner: 'rgba(139, 92, 246, 0.4)',
                    glowMid: 'rgba(139, 92, 246, 0.2)',
                    progress: '#8b5cf6',
                    preview: 'rgba(139, 92, 246, 0.6)',
                    text: '#a78bfa'
                };
            case 'polymer':
                return {
                    border: 'rgba(34, 197, 94, 0.6)',
                    glowInner: 'rgba(34, 197, 94, 0.4)',
                    glowMid: 'rgba(34, 197, 94, 0.2)',
                    progress: '#22c55e',
                    preview: 'rgba(34, 197, 94, 0.6)',
                    text: '#4ade80'
                };
            case 'cell':
                return {
                    border: 'rgba(59, 130, 246, 0.6)',
                    glowInner: 'rgba(59, 130, 246, 0.4)',
                    glowMid: 'rgba(59, 130, 246, 0.2)',
                    progress: '#3b82f6',
                    preview: 'rgba(59, 130, 246, 0.6)',
                    text: '#60a5fa'
                };
            default:
                return {
                    border: 'rgba(255, 255, 255, 0.4)',
                    glowInner: 'rgba(255, 255, 255, 0.2)',
                    glowMid: 'rgba(255, 255, 255, 0.1)',
                    progress: '#ffffff',
                    preview: 'rgba(255, 255, 255, 0.4)',
                    text: '#ffffff'
                };
        }
    }

    /**
     * Check if point is inside intention zone (for selection)
     * Uses small hitbox around center icon, not the full attraction radius
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        // Use small hitbox radius (matches the center icon size) instead of full attraction radius
        const hitboxRadius = 25 * scale;

        const dx = x - screenX;
        const dy = y - screenY;
        return (dx * dx + dy * dy) <= (hitboxRadius * hitboxRadius);
    }
}

// Make available globally
window.Intention = Intention;
