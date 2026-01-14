/**
 * Blueprint Classes
 * Templates for spawning entities from the catalogue
 */

/**
 * Base Blueprint class
 */
class Blueprint {
    constructor(type, name) {
        this.id = Utils.generateId();
        this.type = type;
        this.name = name;
        this.createdAt = Date.now();
        this.description = '';
        this.tags = [];
    }

    /**
     * Generate a preview rendering
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Preview size
     */
    renderPreview(ctx, x, y, size) {
        // Override in subclasses
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    /**
     * Serialize to plain object
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            createdAt: this.createdAt,
            description: this.description,
            tags: this.tags
        };
    }
}

/**
 * Molecule Blueprint
 */
class MoleculeBlueprint extends Blueprint {
    /**
     * Create from an existing molecule
     * @param {Molecule} molecule - Source molecule
     * @param {string} name - Blueprint name
     */
    constructor(molecule, name = null) {
        super('molecule', name || molecule.formula);

        this.formula = molecule.formula;
        this.fingerprint = molecule.fingerprint;

        // Store relative positions from center of mass
        const center = molecule.centerOfMass;
        this.atomData = molecule.atoms.map((atom, index) => ({
            index,
            symbol: atom.symbol,
            relX: atom.position.x - center.x,
            relY: atom.position.y - center.y
        }));

        // Store bonds by atom indices
        this.bondData = molecule.bonds.map(bond => ({
            atom1Index: molecule.atoms.indexOf(bond.atom1),
            atom2Index: molecule.atoms.indexOf(bond.atom2),
            order: bond.order
        }));

        this.mass = molecule.mass;
        this.isStable = molecule.isStable();
    }

    /**
     * Instantiate this blueprint at a position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Molecule} New molecule instance
     */
    instantiate(x, y) {
        // Create atoms at relative positions (preserves molecule shape)
        const atoms = this.atomData.map(data =>
            new Atom(data.symbol, x + data.relX, y + data.relY)
        );

        // Create bonds
        for (const bondData of this.bondData) {
            const atom1 = atoms[bondData.atom1Index];
            const atom2 = atoms[bondData.atom2Index];
            new Bond(atom1, atom2, bondData.order);
        }

        // Create molecule with blueprint reference for reconstruction
        const molecule = new Molecule(atoms);
        molecule.name = this.name;
        molecule.blueprintRef = this; // Link to blueprint for shape reconstruction
        molecule.abstracted = true;   // Start as abstracted since shape is from blueprint

        return molecule;
    }

    /**
     * Render preview
     */
    renderPreview(ctx, x, y, size) {
        const scale = size / 100;

        // Draw bonds
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;

        for (const bondData of this.bondData) {
            const a1 = this.atomData[bondData.atom1Index];
            const a2 = this.atomData[bondData.atom2Index];

            ctx.beginPath();
            ctx.moveTo(x + a1.relX * scale, y + a1.relY * scale);
            ctx.lineTo(x + a2.relX * scale, y + a2.relY * scale);
            ctx.stroke();
        }

        // Draw atoms
        for (const atomData of this.atomData) {
            const element = getElement(atomData.symbol);
            const ax = x + atomData.relX * scale;
            const ay = y + atomData.relY * scale;
            const radius = Math.max(4, element.radius * scale * 0.3);

            ctx.beginPath();
            ctx.arc(ax, ay, radius, 0, Math.PI * 2);
            ctx.fillStyle = element.color;
            ctx.fill();
        }
    }

    serialize() {
        return {
            ...super.serialize(),
            formula: this.formula,
            fingerprint: this.fingerprint,
            atomData: this.atomData,
            bondData: this.bondData,
            mass: this.mass,
            isStable: this.isStable
        };
    }

    static deserialize(data) {
        const blueprint = Object.assign(
            Object.create(MoleculeBlueprint.prototype),
            data
        );
        return blueprint;
    }
}

/**
 * Protein Blueprint
 */
class ProteinBlueprint extends Blueprint {
    /**
     * Create from an existing protein
     * @param {Protein} protein - Source protein
     * @param {string} name - Blueprint name
     */
    constructor(protein, name = null) {
        super('protein', name || `Protein-${protein.molecules.length}`);

        this.sequence = protein.sequence;
        this.fingerprint = protein.fingerprint;
        this.moleculeCount = protein.molecules.length;

        // Store molecule blueprints
        this.moleculeBlueprints = protein.molecules.map(mol =>
            new MoleculeBlueprint(mol)
        );

        // Store relative positions
        const center = protein.getCenter();
        this.moleculePositions = protein.molecules.map(mol => {
            const molCenter = mol.getCenter();
            return {
                relX: molCenter.x - center.x,
                relY: molCenter.y - center.y
            };
        });

        this.activeSites = protein.activeSites;
        this.mass = protein.mass;
        this.isStable = protein.isStable();
    }

    /**
     * Instantiate this blueprint at a position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Protein} New protein instance
     */
    instantiate(x, y) {
        const molecules = [];

        for (let i = 0; i < this.moleculeBlueprints.length; i++) {
            const bp = this.moleculeBlueprints[i];
            const pos = this.moleculePositions[i];
            const mol = bp.instantiate(x + pos.relX, y + pos.relY);
            molecules.push(mol);
        }

        const protein = new Protein(molecules, this.name);

        // Restore active sites
        for (const site of this.activeSites) {
            protein.addActiveSite(site);
        }

        return protein;
    }

    /**
     * Render preview
     */
    renderPreview(ctx, x, y, size) {
        const scale = size / 150;

        // Draw chain connections
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < this.moleculePositions.length - 1; i++) {
            const p1 = this.moleculePositions[i];
            const p2 = this.moleculePositions[i + 1];
            ctx.moveTo(x + p1.relX * scale, y + p1.relY * scale);
            ctx.lineTo(x + p2.relX * scale, y + p2.relY * scale);
        }
        ctx.stroke();

        // Draw molecule blobs
        for (const pos of this.moleculePositions) {
            ctx.beginPath();
            ctx.arc(x + pos.relX * scale, y + pos.relY * scale, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#a78bfa';
            ctx.fill();
        }
    }

    serialize() {
        return {
            ...super.serialize(),
            sequence: this.sequence,
            fingerprint: this.fingerprint,
            moleculeCount: this.moleculeCount,
            moleculeBlueprints: this.moleculeBlueprints.map(bp => bp.serialize()),
            moleculePositions: this.moleculePositions,
            activeSites: this.activeSites,
            mass: this.mass,
            isStable: this.isStable
        };
    }

    static deserialize(data) {
        const blueprint = Object.assign(
            Object.create(ProteinBlueprint.prototype),
            data
        );
        blueprint.moleculeBlueprints = data.moleculeBlueprints.map(d =>
            MoleculeBlueprint.deserialize(d)
        );
        return blueprint;
    }
}

/**
 * Cell Blueprint (placeholder for Phase 2)
 */
class CellBlueprint extends Blueprint {
    constructor(name) {
        super('cell', name);
        this.molecules = [];
        this.proteins = [];  // Can also contain proteins
        this.behavior = null;
        this.genome = null;
    }

    instantiate(x, y) {
        // TODO: Implement in Phase 2
        console.warn('CellBlueprint.instantiate not yet implemented');
        return null;
    }
}

/**
 * Organism Blueprint (placeholder for Phase 3)
 */
class OrganismBlueprint extends Blueprint {
    constructor(name) {
        super('organism', name);
        this.cells = [];
        this.genome = null;
        this.phenotype = null;
    }

    instantiate(x, y) {
        // TODO: Implement in Phase 3
        console.warn('OrganismBlueprint.instantiate not yet implemented');
        return null;
    }
}

// Make available globally
window.Blueprint = Blueprint;
window.MoleculeBlueprint = MoleculeBlueprint;
window.ProteinBlueprint = ProteinBlueprint;
window.CellBlueprint = CellBlueprint;
window.OrganismBlueprint = OrganismBlueprint;
