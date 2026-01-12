/**
 * Protein
 * Chains of molecules with functional properties
 * Level 3 in the abstraction hierarchy
 */

class Protein {
    /**
     * Create a protein from molecules
     * @param {Molecule[]} molecules - Array of molecules forming the chain
     * @param {string} name - Optional name for this protein
     */
    constructor(molecules = [], name = null) {
        this.id = Utils.generateId();
        this.molecules = molecules;
        this.name = name;

        // Link molecules to this protein
        for (const mol of molecules) {
            mol.proteinId = this.id;
        }

        // Protein properties
        this.activeSites = [];  // Functional regions
        this.folded = false;
        this.foldPattern = null;  // 2D shape after folding

        // Selection state
        this.selected = false;
        this.highlighted = false;

        // Calculate derived properties
        this._updateProperties();
    }

    /**
     * Update derived properties
     */
    _updateProperties() {
        // Calculate total mass
        this.mass = this.molecules.reduce((sum, mol) => sum + mol.mass, 0);

        // Generate sequence (chain of molecule formulas)
        this.sequence = this.molecules.map(m => m.formula).join('-');

        // Generate unique fingerprint
        this.fingerprint = this._generateFingerprint();
    }

    /**
     * Generate unique fingerprint for this protein
     */
    _generateFingerprint() {
        const parts = this.molecules.map(m => m.fingerprint).sort();
        return `PROT:${parts.join('|')}`;
    }

    /**
     * Add a molecule to the chain
     * @param {Molecule} molecule - Molecule to add
     */
    addMolecule(molecule) {
        molecule.proteinId = this.id;
        this.molecules.push(molecule);
        this._updateProperties();
    }

    /**
     * Remove a molecule from the chain
     * @param {string} moleculeId - ID of molecule to remove
     */
    removeMolecule(moleculeId) {
        const index = this.molecules.findIndex(m => m.id === moleculeId);
        if (index !== -1) {
            this.molecules[index].proteinId = null;
            this.molecules.splice(index, 1);
            this._updateProperties();
        }
    }

    /**
     * Define an active site on this protein
     * @param {object} site - Active site definition
     */
    addActiveSite(site) {
        this.activeSites.push({
            id: Utils.generateId(),
            moleculeIndices: site.moleculeIndices || [],  // Which molecules form this site
            type: site.type || 'catalytic',  // 'catalytic', 'binding', 'regulatory'
            specificity: site.specificity || [],  // What molecules it can interact with
            strength: site.strength || 1.0
        });
    }

    /**
     * Fold the protein into a 2D shape
     * In this simplified model, folding arranges molecules in a compact pattern
     */
    fold() {
        if (this.molecules.length < 2) return;

        this.folded = true;

        // Simple folding: arrange molecules in a spiral pattern
        const center = this.getCenter();
        const numMols = this.molecules.length;
        const spacing = 50;  // Distance between molecules

        this.foldPattern = [];

        for (let i = 0; i < numMols; i++) {
            // Spiral layout
            const angle = i * 0.8;  // Angle increment
            const radius = spacing * (1 + i * 0.3);

            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;

            this.foldPattern.push({
                moleculeId: this.molecules[i].id,
                relativeX: offsetX,
                relativeY: offsetY
            });
        }
    }

    /**
     * Unfold the protein (linearize)
     */
    unfold() {
        this.folded = false;
        this.foldPattern = null;
    }

    /**
     * Get the center position of the protein
     */
    getCenter() {
        if (this.molecules.length === 0) {
            return new Vector2(0, 0);
        }

        let sumX = 0, sumY = 0;
        for (const mol of this.molecules) {
            const molCenter = mol.getCenter();
            sumX += molCenter.x;
            sumY += molCenter.y;
        }

        return new Vector2(
            sumX / this.molecules.length,
            sumY / this.molecules.length
        );
    }

    /**
     * Check if the protein is stable
     * A protein is stable if it has multiple molecules and all are stable
     */
    isStable() {
        if (this.molecules.length < 2) return false;
        return this.molecules.every(m => m.isStable());
    }

    /**
     * Check if this protein can catalyze a reaction with given molecules
     * @param {Molecule[]} substrates - Molecules to check
     */
    canCatalyze(substrates) {
        for (const site of this.activeSites) {
            if (site.type === 'catalytic') {
                // Check if substrates match specificity
                const matches = substrates.filter(s =>
                    site.specificity.includes(s.formula) ||
                    site.specificity.includes('*')  // Wildcard
                );
                if (matches.length > 0) return true;
            }
        }
        return false;
    }

    /**
     * Apply forces to maintain protein structure
     * @param {number} dt - Delta time
     */
    applyForces(dt) {
        // Keep molecules together as a chain
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const mol1 = this.molecules[i];
            const mol2 = this.molecules[i + 1];

            const center1 = mol1.getCenter();
            const center2 = mol2.getCenter();

            const dx = center2.x - center1.x;
            const dy = center2.y - center1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const targetDist = 80;  // Desired distance between molecules
            const stiffness = 0.05;

            if (dist > 0) {
                const forceMag = (dist - targetDist) * stiffness;
                const fx = (dx / dist) * forceMag;
                const fy = (dy / dist) * forceMag;

                // Apply to all atoms in each molecule
                for (const atom of mol1.atoms) {
                    atom.velocity.x += fx * dt;
                    atom.velocity.y += fy * dt;
                }
                for (const atom of mol2.atoms) {
                    atom.velocity.x -= fx * dt;
                    atom.velocity.y -= fy * dt;
                }
            }
        }
    }

    /**
     * Update all molecules in this protein
     * @param {number} dt - Delta time
     */
    update(dt) {
        this.applyForces(dt);
        for (const mol of this.molecules) {
            mol.update(dt);
        }
    }

    /**
     * Render the protein
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} level - Abstraction level
     * @param {object} camera - Camera transform
     */
    render(ctx, level, camera) {
        if (this.molecules.length === 0) return;

        if (level <= 1) {
            // At atom/molecule level, just render molecules with connections
            this._renderChainConnections(ctx, camera);
            for (const mol of this.molecules) {
                mol.render(ctx, level, camera);
            }
        } else if (level === 2) {
            // Protein level - show as connected blobs
            this._renderAsProtein(ctx, camera);
        } else {
            // Higher levels - simplified blob
            this._renderAsBlob(ctx, camera);
        }
    }

    /**
     * Render chain connections between molecules
     */
    _renderChainConnections(ctx, camera) {
        if (this.molecules.length < 2) return;

        ctx.save();
        ctx.strokeStyle = this.selected ? '#f59e0b' : '#8b5cf6';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const center1 = this.molecules[i].getCenter();
            const center2 = this.molecules[i + 1].getCenter();

            const x1 = (center1.x - camera.x) * camera.zoom;
            const y1 = (center1.y - camera.y) * camera.zoom;
            const x2 = (center2.x - camera.x) * camera.zoom;
            const y2 = (center2.y - camera.y) * camera.zoom;

            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Render as a protein structure
     */
    _renderAsProtein(ctx, camera) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;

        // Draw molecule chain as connected circles
        ctx.save();

        // Draw connections
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 4 / camera.zoom;
        ctx.beginPath();

        for (let i = 0; i < this.molecules.length - 1; i++) {
            const c1 = this.molecules[i].getCenter();
            const c2 = this.molecules[i + 1].getCenter();
            ctx.moveTo((c1.x - camera.x) * camera.zoom, (c1.y - camera.y) * camera.zoom);
            ctx.lineTo((c2.x - camera.x) * camera.zoom, (c2.y - camera.y) * camera.zoom);
        }
        ctx.stroke();

        // Draw molecule blobs
        for (const mol of this.molecules) {
            const mc = mol.getCenter();
            const mx = (mc.x - camera.x) * camera.zoom;
            const my = (mc.y - camera.y) * camera.zoom;
            const radius = 20 * camera.zoom;

            ctx.beginPath();
            ctx.arc(mx, my, radius, 0, Math.PI * 2);
            ctx.fillStyle = this.highlighted ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.4)';
            ctx.fill();
            ctx.strokeStyle = this.selected ? '#f59e0b' : '#8b5cf6';
            ctx.stroke();
        }

        // Draw active sites
        for (const site of this.activeSites) {
            for (const idx of site.moleculeIndices) {
                if (idx < this.molecules.length) {
                    const mol = this.molecules[idx];
                    const mc = mol.getCenter();
                    const mx = (mc.x - camera.x) * camera.zoom;
                    const my = (mc.y - camera.y) * camera.zoom;

                    // Star marker for active site
                    ctx.fillStyle = '#10b981';
                    ctx.beginPath();
                    ctx.arc(mx, my - 25 * camera.zoom, 5 * camera.zoom, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Draw name/sequence
        ctx.fillStyle = '#e8e8f0';
        ctx.font = `${12 * camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.name || `Protein (${this.molecules.length})`, screenX, screenY + 40 * camera.zoom);

        ctx.restore();
    }

    /**
     * Render as simplified blob for higher levels
     */
    _renderAsBlob(ctx, camera) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;

        // Calculate size based on molecule count
        const radius = (15 + this.molecules.length * 5) * camera.zoom;

        ctx.save();

        // Outer glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
        gradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = this.highlighted ? '#a78bfa' : '#8b5cf6';
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        if (this.selected) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Serialize protein for storage
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            moleculeIds: this.molecules.map(m => m.id),
            activeSites: this.activeSites,
            folded: this.folded,
            fingerprint: this.fingerprint
        };
    }

    /**
     * Get all atoms in this protein
     */
    getAllAtoms() {
        const atoms = [];
        for (const mol of this.molecules) {
            atoms.push(...mol.atoms);
        }
        return atoms;
    }

    /**
     * Get all bonds in this protein
     */
    getAllBonds() {
        const bonds = [];
        for (const mol of this.molecules) {
            bonds.push(...mol.bonds);
        }
        return bonds;
    }
}

/**
 * Create proteins from nearby molecules
 * @param {Molecule[]} molecules - All molecules
 * @param {number} maxDistance - Max distance for molecules to form a protein
 * @returns {Protein[]} New proteins found
 */
function findPotentialProteins(molecules, maxDistance = 100) {
    const proteins = [];
    const assigned = new Set();

    for (const mol of molecules) {
        if (assigned.has(mol.id) || mol.proteinId) continue;
        if (!mol.isStable()) continue;

        // Find nearby molecules that could form a chain
        const chain = [mol];
        assigned.add(mol.id);

        let current = mol;
        let found = true;

        while (found) {
            found = false;
            const currentCenter = current.getCenter();

            for (const other of molecules) {
                if (assigned.has(other.id) || other.proteinId) continue;
                if (!other.isStable()) continue;

                const otherCenter = other.getCenter();
                const dist = Utils.distance(
                    currentCenter.x, currentCenter.y,
                    otherCenter.x, otherCenter.y
                );

                if (dist < maxDistance) {
                    chain.push(other);
                    assigned.add(other.id);
                    current = other;
                    found = true;
                    break;
                }
            }
        }

        // Only create protein if we have a chain of 2+ molecules
        if (chain.length >= 2) {
            proteins.push(new Protein(chain));
        }
    }

    return proteins;
}

// Make available globally
window.Protein = Protein;
window.findPotentialProteins = findPotentialProteins;
