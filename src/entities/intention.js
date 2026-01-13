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

        // Visual state
        this.pulsePhase = 0;
        this.selected = false;
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
     * Get required components based on blueprint
     */
    getRequirements() {
        if (this.type === 'molecule') {
            // For molecules, we need specific atoms
            return {
                type: 'atoms',
                elements: this.blueprint.requiredElements || ['C', 'H', 'O'],
                count: this.blueprint.atomData?.length || 4
            };
        } else if (this.type === 'polymer') {
            // For polymers, we need molecules
            return {
                type: 'molecules',
                count: this.blueprint.minMolecules || 3,
                requiredElements: this.blueprint.requiredElements
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

        // Check for timeout
        if (this.age > this.maxAge) {
            this.fulfilled = true; // Mark for removal
            return;
        }

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
                    const force = direction.mul(this.attractionForce * (1 - dist / this.radius));
                    atom.applyForce(force);

                    // Track gathered atoms
                    if (dist < this.radius * 0.3) {
                        this.gatheredComponents.add(atom.id);
                    }
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

                    // Track gathered molecules
                    if (dist < this.radius * 0.4) {
                        this.gatheredComponents.add(mol.id);
                    }
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

                    if (dist < this.radius * 0.5) {
                        this.gatheredComponents.add(polymer.id);
                    }
                }
            }
        }

        // Update progress based on atoms in/near the zone
        const requirements2 = this.getRequirements();
        if (requirements2.type === 'atoms' && requirements2.count) {
            // Count all atoms in zone (both free and in small molecules)
            let atomsInZone = 0;
            for (const atom of environment.atoms.values()) {
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    atomsInZone++;
                }
            }
            this.progress = Math.min(1, atomsInZone / requirements2.count);
        } else if (requirements2.count) {
            this.progress = Math.min(1, this.gatheredComponents.size / requirements2.count);
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
            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    // Check if molecule matches our blueprint requirements
                    if (mol.atoms.length === requirements.count) {
                        // Mark intention as fulfilled - molecule already formed naturally!
                        this.createdEntity = mol;
                        this.fulfilled = true;
                        console.log(`Intention fulfilled: Found matching molecule ${mol.formula}`);
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

        // Create molecule
        const molecule = new Molecule(atoms);
        environment.addMolecule(molecule);

        this.createdEntity = molecule;
        this.fulfilled = true;

        console.log(`Intention fulfilled: Created molecule ${molecule.formula}`);
    }

    /**
     * Form a polymer from gathered molecules
     */
    _formPolymer(environment, molecules) {
        // Mark molecules as part of polymer
        molecules.forEach(mol => mol.polymerId = Utils.generateId());

        // Create polymer
        const polymer = new Polymer(molecules, this.blueprint.type, this.blueprint.name);
        polymer.seal(); // Seal the polymer so internal atoms can't bond externally
        environment.addProtein(polymer);

        this.createdEntity = polymer;
        this.fulfilled = true;

        console.log(`Intention fulfilled: Created polymer ${polymer.name || polymer.type}`);
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
     * Check if point is inside intention zone
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        const dx = x - screenX;
        const dy = y - screenY;
        return (dx * dx + dy * dy) <= (screenRadius * screenRadius);
    }
}

// Make available globally
window.Intention = Intention;
