/**
 * Polymer / Biomolecule
 * Chains of molecules with functional properties
 * Level 3 in the abstraction hierarchy
 * 
 * Polymer Types:
 * - LIPID: Fatty acid chains (membranes)
 * - CARBOHYDRATE: Sugar chains (energy)
 * - PROTEIN: Amino acid chains (structure/enzymes)
 * - NUCLEIC_ACID: Nucleotide chains (DNA/RNA)
 */

// Polymer type constants
const PolymerType = {
    GENERIC: 'generic',
    LIPID: 'lipid',
    CARBOHYDRATE: 'carbohydrate',
    PROTEIN: 'protein',
    NUCLEIC_ACID: 'nucleic_acid'
};

// Type colors for visualization
const PolymerColors = {
    generic: { primary: '#8b5cf6', secondary: '#a78bfa' },     // Purple
    lipid: { primary: '#eab308', secondary: '#fde047' },       // Yellow/Gold
    carbohydrate: { primary: '#22c55e', secondary: '#86efac' }, // Green
    protein: { primary: '#3b82f6', secondary: '#93c5fd' },     // Blue
    nucleic_acid: { primary: '#ef4444', secondary: '#fca5a5' }  // Red
};

// Type labels for display
const PolymerLabels = {
    generic: 'Polymer',
    lipid: 'Lipid',
    carbohydrate: 'Carbohydrate',
    protein: 'Protein',
    nucleic_acid: 'Nucleic Acid'
};

class Polymer {
    /**
     * Create a polymer from molecules
     * @param {Molecule[]} molecules - Array of molecules forming the chain
     * @param {string} type - Polymer type (from PolymerType)
     * @param {string} name - Optional name for this polymer
     */
    constructor(molecules = [], type = null, name = null) {
        this.id = Utils.generateId();
        this.molecules = molecules;
        this.name = name;

        // Auto-detect type if not specified
        this.type = type || this._detectType();

        // Link molecules to this polymer
        for (const mol of molecules) {
            mol.proteinId = this.id;  // Using proteinId for backward compatibility
            mol.polymerId = this.id;
        }

        // Polymer properties
        this.activeSites = [];  // Functional regions
        this.folded = false;
        this.foldPattern = null;  // 2D shape after folding

        // Stability and bonding
        this.isSealed = false;        // When true, internal atoms can't bond externally
        this.bondedPolymers = [];     // Polymer-polymer connections
        this.chainLevel = 1;          // How many polymers in this chain
        this.cellRole = null;         // Role in cell: 'membrane', 'structure', 'genetics', etc.

        // Selection state
        this.selected = false;
        this.highlighted = false;

        // Calculate derived properties
        this._updateProperties();
    }

    /**
     * Detect polymer type based on molecule composition
     */
    _detectType() {
        if (this.molecules.length === 0) return PolymerType.GENERIC;

        // Count elements across all molecules
        const elementCounts = { C: 0, H: 0, O: 0, N: 0, P: 0, S: 0 };
        let totalAtoms = 0;

        for (const mol of this.molecules) {
            for (const atom of mol.atoms) {
                const symbol = atom.symbol;
                if (elementCounts[symbol] !== undefined) {
                    elementCounts[symbol]++;
                }
                totalAtoms++;
            }
        }

        // Calculate ratios
        const C = elementCounts.C || 0;
        const H = elementCounts.H || 0;
        const O = elementCounts.O || 0;
        const N = elementCounts.N || 0;
        const P = elementCounts.P || 0;

        // Classification heuristics

        // Nucleic Acid: Has phosphorus and nitrogen (DNA/RNA backbone)
        if (P > 0 && N > 0) {
            return PolymerType.NUCLEIC_ACID;
        }

        // Protein/Amino Acid: Has nitrogen but no phosphorus
        if (N > 0 && P === 0) {
            return PolymerType.PROTEIN;
        }

        // Carbohydrate: C:H:O ratio approximately 1:2:1
        if (C > 0 && H > 0 && O > 0 && N === 0 && P === 0) {
            const hToC = H / C;
            const oToC = O / C;
            if (hToC >= 1.5 && hToC <= 2.5 && oToC >= 0.5 && oToC <= 1.5) {
                return PolymerType.CARBOHYDRATE;
            }
        }

        // Lipid: High C:H ratio, low O, no N (fatty acids)
        if (C > 0 && H > 0 && N === 0 && P === 0) {
            const hToC = H / C;
            const oToC = O / (C || 1);
            if (hToC >= 1.8 && oToC < 0.5) {
                return PolymerType.LIPID;
            }
        }

        return PolymerType.GENERIC;
    }

    /**
     * Seal the polymer - internal atoms can no longer bond externally
     * This prevents the polymer from breaking apart or merging improperly
     */
    seal() {
        this.isSealed = true;

        // Mark all internal atoms as sealed
        for (const mol of this.molecules) {
            for (const atom of mol.atoms) {
                atom.isSealed = true;
            }
        }

        // Set cell role based on type
        this._assignCellRole();

        console.log(`Polymer ${this.name || this.type} sealed`);
    }

    /**
     * Assign cell role based on polymer type
     */
    _assignCellRole() {
        switch (this.type) {
            case PolymerType.LIPID:
                this.cellRole = 'membrane';
                break;
            case PolymerType.PROTEIN:
                this.cellRole = 'structure';
                break;
            case PolymerType.NUCLEIC_ACID:
                this.cellRole = 'genetics';
                break;
            case PolymerType.CARBOHYDRATE:
                this.cellRole = 'energy';
                break;
            default:
                this.cellRole = null;
        }
    }

    /**
     * Check if this polymer can bond with another polymer
     * Same-type polymers can chain, complementary types can combine for cells
     */
    canBondWithPolymer(other) {
        if (!other || other === this) return false;
        if (!this.isSealed || !other.isSealed) return false;

        // Same type polymers can chain
        if (this.type === other.type) return true;

        // Complementary types for cell formation
        return this.isComplementary(other);
    }

    /**
     * Check if another polymer type is complementary for cell formation
     */
    isComplementary(other) {
        const complementaryPairs = [
            [PolymerType.LIPID, PolymerType.PROTEIN],
            [PolymerType.PROTEIN, PolymerType.NUCLEIC_ACID],
            [PolymerType.LIPID, PolymerType.NUCLEIC_ACID]
        ];

        for (const [a, b] of complementaryPairs) {
            if ((this.type === a && other.type === b) ||
                (this.type === b && other.type === a)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Bond this polymer with another polymer
     */
    bondWithPolymer(other) {
        if (!this.canBondWithPolymer(other)) return false;

        if (!this.bondedPolymers.includes(other)) {
            this.bondedPolymers.push(other);
            other.bondedPolymers.push(this);

            // Update chain level
            this.chainLevel += other.chainLevel;
            other.chainLevel = this.chainLevel;

            console.log(`Polymer chain formed: ${this.name || this.type} + ${other.name || other.type} (chain level: ${this.chainLevel})`);
        }
        return true;
    }

    /**
     * Check if polymer chain is ready to form a cell
     * Requires membrane, structure, and genetics
     */
    canFormCell() {
        if (this.chainLevel < 3) return false;

        const roles = new Set([this.cellRole]);
        for (const bonded of this.bondedPolymers) {
            roles.add(bonded.cellRole);
        }

        return roles.has('membrane') && roles.has('structure') && roles.has('genetics');
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
     * Generate unique fingerprint for this polymer
     */
    _generateFingerprint() {
        const typePrefix = this.type.toUpperCase().substring(0, 3);
        const parts = this.molecules.map(m => m.fingerprint).sort();
        return `${typePrefix}:${parts.join('|')}`;
    }

    /**
     * Get the display color for this polymer's type
     */
    getColor() {
        return PolymerColors[this.type] || PolymerColors.generic;
    }

    /**
     * Get the display label for this polymer's type
     */
    getLabel() {
        return PolymerLabels[this.type] || 'Polymer';
    }

    /**
     * Add a molecule to the chain
     * @param {Molecule} molecule - Molecule to add
     */
    addMolecule(molecule) {
        molecule.proteinId = this.id;
        this.molecules.push(molecule);
        this._updateProperties();
        // Re-detect type with new molecule
        this.type = this._detectType();
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
     * Define an active site on this polymer
     * @param {object} site - Active site definition
     */
    addActiveSite(site) {
        this.activeSites.push({
            id: Utils.generateId(),
            moleculeIndices: site.moleculeIndices || [],
            type: site.type || 'catalytic',
            specificity: site.specificity || [],
            strength: site.strength || 1.0
        });
    }

    /**
     * Fold the polymer into a 2D shape
     */
    fold() {
        if (this.molecules.length < 2) return;

        this.folded = true;
        const center = this.getCenter();
        const numMols = this.molecules.length;
        const spacing = 50;

        this.foldPattern = [];

        for (let i = 0; i < numMols; i++) {
            const angle = i * 0.8;
            const radius = spacing * (1 + i * 0.3);

            this.foldPattern.push({
                moleculeId: this.molecules[i].id,
                relativeX: Math.cos(angle) * radius,
                relativeY: Math.sin(angle) * radius
            });
        }
    }

    /**
     * Unfold the polymer (linearize)
     */
    unfold() {
        this.folded = false;
        this.foldPattern = null;
    }

    /**
     * Get the center position of the polymer
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
     * Check if the polymer is stable
     */
    isStable() {
        if (this.molecules.length < 2) return false;
        return this.molecules.every(m => m.isStable());
    }

    /**
     * Check if this polymer can catalyze a reaction
     */
    canCatalyze(substrates) {
        for (const site of this.activeSites) {
            if (site.type === 'catalytic') {
                const matches = substrates.filter(s =>
                    site.specificity.includes(s.formula) ||
                    site.specificity.includes('*')
                );
                if (matches.length > 0) return true;
            }
        }
        return false;
    }

    /**
     * Apply forces to maintain structure
     */
    applyForces(dt) {
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const mol1 = this.molecules[i];
            const mol2 = this.molecules[i + 1];

            const center1 = mol1.getCenter();
            const center2 = mol2.getCenter();

            const dx = center2.x - center1.x;
            const dy = center2.y - center1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const targetDist = 80;
            const stiffness = 0.05;

            if (dist > 0) {
                const forceMag = (dist - targetDist) * stiffness;
                const fx = (dx / dist) * forceMag;
                const fy = (dy / dist) * forceMag;

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
     * Update all molecules
     */
    update(dt) {
        this.applyForces(dt);
        for (const mol of this.molecules) {
            mol.update(dt);
        }
    }

    /**
     * Render the polymer
     */
    render(ctx, level, camera) {
        if (this.molecules.length === 0) return;

        const colors = this.getColor();

        if (level <= 1) {
            this._renderChainConnections(ctx, camera, colors);
            for (const mol of this.molecules) {
                mol.render(ctx, level, camera);
            }
        } else if (level === 2) {
            this._renderAsPolymer(ctx, camera, colors);
        } else {
            this._renderAsBlob(ctx, camera, colors);
        }
    }

    /**
     * Render chain connections between molecules
     */
    _renderChainConnections(ctx, camera, colors) {
        if (this.molecules.length < 2) return;

        ctx.save();
        ctx.strokeStyle = this.selected ? '#f59e0b' : colors.primary;
        ctx.lineWidth = 3 / camera.zoom;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const center1 = this.molecules[i].getCenter();
            const center2 = this.molecules[i + 1].getCenter();

            ctx.moveTo((center1.x - camera.x) * camera.zoom, (center1.y - camera.y) * camera.zoom);
            ctx.lineTo((center2.x - camera.x) * camera.zoom, (center2.y - camera.y) * camera.zoom);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Render as polymer structure
     */
    _renderAsPolymer(ctx, camera, colors) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;

        ctx.save();

        // Draw connections
        ctx.strokeStyle = colors.primary;
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
            ctx.fillStyle = this.highlighted ? colors.secondary + 'aa' : colors.primary + '66';
            ctx.fill();
            ctx.strokeStyle = this.selected ? '#f59e0b' : colors.primary;
            ctx.stroke();
        }

        // Draw label with type
        const label = this.name || `${this.getLabel()} (${this.molecules.length})`;
        ctx.fillStyle = '#e8e8f0';
        ctx.font = `${12 * camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, screenX, screenY + 40 * camera.zoom);

        ctx.restore();
    }

    /**
     * Render as simplified blob
     */
    _renderAsBlob(ctx, camera, colors) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;
        const radius = (15 + this.molecules.length * 5) * camera.zoom;

        ctx.save();

        // Outer glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        gradient.addColorStop(0, colors.primary + 'cc');
        gradient.addColorStop(0.7, colors.primary + '4d');
        gradient.addColorStop(1, colors.primary + '00');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = this.highlighted ? colors.secondary : colors.primary;
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
     * Serialize polymer for storage
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            moleculeIds: this.molecules.map(m => m.id),
            activeSites: this.activeSites,
            folded: this.folded,
            fingerprint: this.fingerprint
        };
    }

    /**
     * Get all atoms in this polymer
     */
    getAllAtoms() {
        const atoms = [];
        for (const mol of this.molecules) {
            atoms.push(...mol.atoms);
        }
        return atoms;
    }

    /**
     * Get all bonds in this polymer
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
 * Create polymers from nearby molecules
 * @param {Molecule[]} molecules - All molecules
 * @param {number} maxDistance - Max distance for molecules to form a polymer
 * @returns {Polymer[]} New polymers found
 */
function findPotentialPolymers(molecules, maxDistance = 100) {
    const polymers = [];
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

            // Defensive check for getCenter method
            if (!current || typeof current.getCenter !== 'function') break;

            const currentCenter = current.getCenter();

            for (const other of molecules) {
                if (assigned.has(other.id) || other.proteinId) continue;
                if (!other.isStable || !other.isStable()) continue;
                if (typeof other.getCenter !== 'function') continue;

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

        // Only create polymer if we have a chain of 2+ molecules
        if (chain.length >= 2) {
            polymers.push(new Polymer(chain));
        }
    }

    return polymers;
}

// Backward compatibility aliases
const Protein = Polymer;
const findPotentialProteins = findPotentialPolymers;

// Make available globally
window.PolymerType = PolymerType;
window.PolymerColors = PolymerColors;
window.PolymerLabels = PolymerLabels;
window.Polymer = Polymer;
window.Protein = Protein;  // Backward compatibility
window.findPotentialPolymers = findPotentialPolymers;
window.findPotentialProteins = findPotentialProteins;  // Backward compatibility
