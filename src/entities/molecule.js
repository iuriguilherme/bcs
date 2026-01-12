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

        // Link atoms to this molecule
        this.atoms.forEach(atom => atom.moleculeId = this.id);

        // Calculate properties
        this.updateProperties();

        // State
        this.selected = false;
        this.highlighted = false;
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
     * Update derived properties
     */
    updateProperties() {
        this.formula = this.calculateFormula();
        this.fingerprint = this.calculateFingerprint();
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
     * Check if molecule is stable (all valences satisfied)
     */
    isStable() {
        for (const atom of this.atoms) {
            if (atom.availableValence > 0) {
                return false;
            }
        }
        return true;
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
     */
    update(dt) {
        // Apply bond spring forces
        for (const bond of this.bonds) {
            bond.applySpringForce(0.8);
        }

        // Update atom positions
        for (const atom of this.atoms) {
            atom.update(dt);
        }
    }

    /**
     * Render the molecule at the molecule abstraction level
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} scale - Zoom scale
     * @param {Vector2} offset - Camera offset
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }) {
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
