/**
 * Environment
 * The container for all simulation entities with spatial management
 */

class Environment {
    /**
     * Create a new environment
     * @param {number} width - World width
     * @param {number} height - World height
     */
    constructor(width = 2000, height = 2000) {
        this.width = width;
        this.height = height;

        // Entity storage
        this.atoms = new Map();      // id -> Atom
        this.bonds = new Map();      // id -> Bond
        this.molecules = new Map();  // id -> Molecule
        this.proteins = new Map();   // id -> Protein
        this.cells = new Map();      // id -> Cell (future)
        this.organisms = new Map();  // id -> Organism (future)

        // Spatial partitioning for performance
        this.gridSize = 100;
        this.grid = new Map();  // "x,y" -> Set of entity ids

        // Environment properties
        this.temperature = 300;  // Kelvin
        this.pressure = 1;       // Atmospheres

        // Statistics
        this.stats = {
            atomCount: 0,
            moleculeCount: 0,
            proteinCount: 0,
            cellCount: 0,
            organismCount: 0
        };
    }

    /**
     * Add an atom to the environment
     * @param {Atom} atom - Atom to add
     */
    addAtom(atom) {
        this.atoms.set(atom.id, atom);
        this.updateGridPosition(atom);
        this.stats.atomCount = this.atoms.size;
    }

    /**
     * Remove an atom from the environment
     * @param {string} atomId - Atom ID to remove
     */
    removeAtom(atomId) {
        const atom = this.atoms.get(atomId);
        if (atom) {
            // Remove all bonds
            const bonds = [...atom.bonds];
            bonds.forEach(bond => this.removeBond(bond.id));

            // Remove from grid
            this.removeFromGrid(atom);

            // Remove from storage
            this.atoms.delete(atomId);
            this.stats.atomCount = this.atoms.size;
        }
    }

    /**
     * Add a bond to the environment
     * @param {Bond} bond - Bond to add
     */
    addBond(bond) {
        this.bonds.set(bond.id, bond);
    }

    /**
     * Remove a bond from the environment
     * @param {string} bondId - Bond ID to remove
     */
    removeBond(bondId) {
        const bond = this.bonds.get(bondId);
        if (bond) {
            bond.break();
            this.bonds.delete(bondId);
        }
    }

    /**
     * Register a molecule
     * @param {Molecule} molecule - Molecule to register
     */
    addMolecule(molecule) {
        this.molecules.set(molecule.id, molecule);
        this.stats.moleculeCount = this.molecules.size;
    }

    /**
     * Remove a molecule (doesn't remove atoms)
     * @param {string} moleculeId - Molecule ID
     */
    removeMolecule(moleculeId) {
        const molecule = this.molecules.get(moleculeId);
        if (molecule) {
            molecule.atoms.forEach(atom => atom.moleculeId = null);
            this.molecules.delete(moleculeId);
            this.stats.moleculeCount = this.molecules.size;
        }
    }

    /**
     * Register a protein
     * @param {Protein} protein - Protein to register
     */
    addProtein(protein) {
        this.proteins.set(protein.id, protein);
        this.stats.proteinCount = this.proteins.size;
    }

    /**
     * Remove a protein
     * @param {string} proteinId - Protein ID
     */
    removeProtein(proteinId) {
        const protein = this.proteins.get(proteinId);
        if (protein) {
            protein.molecules.forEach(mol => mol.proteinId = null);
            this.proteins.delete(proteinId);
            this.stats.proteinCount = this.proteins.size;
        }
    }

    /**
     * Add a cell to the environment
     * @param {Cell} cell - Cell to add
     */
    addCell(cell) {
        this.cells.set(cell.id, cell);
        this.stats.cellCount = this.cells.size;
    }

    /**
     * Remove a cell from the environment
     * @param {string} cellId - Cell ID to remove
     */
    removeCell(cellId) {
        this.cells.delete(cellId);
        this.stats.cellCount = this.cells.size;
    }

    /**
     * Get all cells as array
     */
    getAllCells() {
        return Array.from(this.cells.values());
    }

    /**
     * Update all cells
     */
    updateCells() {
        for (const cell of this.cells.values()) {
            if (cell.isAlive) {
                cell.update(this);
            }
        }

        // Remove dead cells
        for (const [id, cell] of this.cells) {
            if (!cell.isAlive) {
                this.cells.delete(id);
            }
        }

        this.stats.cellCount = this.cells.size;
    }

    /**
     * Detect and register new polymers from nearby molecules
     */
    updatePolymers() {
        // Only check occasionally for performance
        if (!this._polymerCheckTick) this._polymerCheckTick = 0;
        this._polymerCheckTick++;
        if (this._polymerCheckTick % 30 !== 0) return;

        try {
            // Get molecules that can polymerize (either stable or canPolymerize)
            const freeMolecules = this.getAllMolecules().filter(m =>
                !m.proteinId && (m.isStable() || (m.canPolymerize && m.canPolymerize()))
            );

            if (freeMolecules.length < 2) return;

            // Find potential polymer chains
            const newPolymers = findPotentialPolymers(freeMolecules, 120);

            // Register new polymers
            for (const polymer of newPolymers) {
                this.addProtein(polymer);
            }
        } catch (e) {
            console.error('Error in updatePolymers:', e);
        }
    }

    /**
     * Update spatial grid position for an entity
     * @param {Atom} atom - Atom to update
     */
    updateGridPosition(atom) {
        // Remove from old position
        this.removeFromGrid(atom);

        // Add to new position
        const cellX = Math.floor(atom.position.x / this.gridSize);
        const cellY = Math.floor(atom.position.y / this.gridSize);
        const key = `${cellX},${cellY}`;

        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }
        this.grid.get(key).add(atom.id);
        atom._gridKey = key;
    }

    /**
     * Remove entity from grid
     * @param {Atom} atom - Atom to remove
     */
    removeFromGrid(atom) {
        if (atom._gridKey && this.grid.has(atom._gridKey)) {
            this.grid.get(atom._gridKey).delete(atom.id);
        }
    }

    /**
     * Get atoms near a position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} radius - Search radius
     * @returns {Atom[]}
     */
    getAtomsNear(x, y, radius) {
        const results = [];
        const radiusSq = radius * radius;

        // Check surrounding grid cells
        const minCellX = Math.floor((x - radius) / this.gridSize);
        const maxCellX = Math.floor((x + radius) / this.gridSize);
        const minCellY = Math.floor((y - radius) / this.gridSize);
        const maxCellY = Math.floor((y + radius) / this.gridSize);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const key = `${cx},${cy}`;
                const cell = this.grid.get(key);
                if (!cell) continue;

                for (const atomId of cell) {
                    const atom = this.atoms.get(atomId);
                    if (!atom) continue;

                    const dx = atom.position.x - x;
                    const dy = atom.position.y - y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        results.push(atom);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get atom at a screen position
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @param {number} scale - Current zoom
     * @param {Vector2} offset - Camera offset
     */
    getAtomAtPosition(screenX, screenY, scale, offset) {
        for (const atom of this.atoms.values()) {
            if (atom.containsPoint(screenX, screenY, scale, offset)) {
                return atom;
            }
        }
        return null;
    }

    /**
     * Apply forces between nearby atoms (repulsion/attraction)
     */
    applyAtomicForces() {
        const atoms = Array.from(this.atoms.values());
        const repulsionStrength = 500;
        const attractionRadius = 80;
        const attractionStrength = 20;

        for (let i = 0; i < atoms.length; i++) {
            const atom1 = atoms[i];

            // Get nearby atoms from grid
            const nearby = this.getAtomsNear(
                atom1.position.x,
                atom1.position.y,
                100
            );

            for (const atom2 of nearby) {
                if (atom1 === atom2) continue;

                const delta = atom1.position.sub(atom2.position);
                const distSq = delta.lengthSquared();
                const minDist = atom1.radius + atom2.radius;
                const minDistSq = minDist * minDist;

                if (distSq === 0) continue;
                const dist = Math.sqrt(distSq);

                // Repulsion when overlapping
                if (distSq < minDistSq) {
                    const overlap = minDist - dist;
                    const force = delta.normalize().mul(repulsionStrength * overlap);
                    atom1.applyForce(force);
                }
                // Slight attraction for non-bonded atoms with available valence
                else if (dist < attractionRadius &&
                    !atom1.isBondedTo(atom2) &&
                    atom1.availableValence > 0 &&
                    atom2.availableValence > 0) {
                    const factor = 1 - dist / attractionRadius;
                    const force = delta.normalize().mul(-attractionStrength * factor);
                    atom1.applyForce(force);
                }
            }
        }
    }

    /**
     * Try to form bonds between nearby eligible atoms
     */
    tryFormBonds() {
        const bondingRadius = 40;
        const atoms = Array.from(this.atoms.values());

        for (const atom1 of atoms) {
            if (atom1.availableValence === 0) continue;

            const nearby = this.getAtomsNear(
                atom1.position.x,
                atom1.position.y,
                bondingRadius
            );

            for (const atom2 of nearby) {
                if (atom1 === atom2) continue;
                if (atom1.isBondedTo(atom2)) continue;
                if (atom2.availableValence === 0) continue;

                const dist = atom1.position.distanceTo(atom2.position);
                const bondDist = (atom1.radius + atom2.radius) * 1.5;

                if (dist < bondDist) {
                    // Probability increases as atoms get closer
                    const prob = 1 - (dist / bondDist);
                    if (Math.random() < prob * 0.3) {
                        const bond = tryFormBond(atom1, atom2, 1);
                        if (bond) {
                            this.addBond(bond);
                        }
                    }
                }
            }
        }
    }

    /**
     * Detect and register new molecules, merge connected groups
     */
    updateMolecules() {
        // Get all bonded atoms
        const bondedAtoms = Array.from(this.atoms.values())
            .filter(a => a.bonds.length > 0);

        if (bondedAtoms.length === 0) return;

        // Find all connected groups of bonded atoms
        const groups = this._findAllConnectedGroups(bondedAtoms);

        // Track which molecules need to be removed (merged)
        const moleculesToRemove = new Set();

        for (const group of groups) {
            if (group.length === 0) continue;

            // Find all existing molecules that have atoms in this group
            const existingMolIds = new Set();
            for (const atom of group) {
                if (atom.moleculeId && this.molecules.has(atom.moleculeId)) {
                    existingMolIds.add(atom.moleculeId);
                }
            }

            if (existingMolIds.size === 0) {
                // No existing molecules - create new one
                const molecule = new Molecule(group);
                this.addMolecule(molecule);
            } else if (existingMolIds.size === 1) {
                // One existing molecule - extend it with any new atoms
                const molId = existingMolIds.values().next().value;
                const molecule = this.molecules.get(molId);

                for (const atom of group) {
                    if (!molecule.atoms.includes(atom)) {
                        molecule.atoms.push(atom);
                        atom.moleculeId = molecule.id;
                    }
                }
                molecule.updateProperties();
            } else {
                // Multiple molecules need to be merged
                const molIds = Array.from(existingMolIds);
                const primaryMol = this.molecules.get(molIds[0]);

                // Merge all atoms into primary molecule
                for (const atom of group) {
                    if (!primaryMol.atoms.includes(atom)) {
                        primaryMol.atoms.push(atom);
                    }
                    atom.moleculeId = primaryMol.id;
                }

                // Mark other molecules for removal
                for (let i = 1; i < molIds.length; i++) {
                    moleculesToRemove.add(molIds[i]);
                }

                primaryMol.updateProperties();
            }
        }

        // Remove merged molecules
        for (const molId of moleculesToRemove) {
            this.molecules.delete(molId);
        }

        this.stats.moleculeCount = this.molecules.size;
    }

    /**
     * Find all connected groups of atoms using BFS
     * @param {Atom[]} atoms - Atoms to group
     */
    _findAllConnectedGroups(atoms) {
        const atomSet = new Set(atoms);
        const visited = new Set();
        const groups = [];

        for (const startAtom of atoms) {
            if (visited.has(startAtom.id)) continue;

            const group = [];
            const queue = [startAtom];

            while (queue.length > 0) {
                const atom = queue.shift();
                if (visited.has(atom.id)) continue;

                visited.add(atom.id);
                group.push(atom);

                // Follow all bonds to connected atoms
                for (const bond of atom.bonds) {
                    const other = bond.getOther(atom);
                    if (!visited.has(other.id)) {
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
     * Apply boundary constraints
     */
    applyBoundaries() {
        const padding = 50;
        const bounceForce = 100;

        for (const atom of this.atoms.values()) {
            const pos = atom.position;

            if (pos.x < padding) {
                atom.applyForce(new Vector2(bounceForce, 0));
            }
            if (pos.x > this.width - padding) {
                atom.applyForce(new Vector2(-bounceForce, 0));
            }
            if (pos.y < padding) {
                atom.applyForce(new Vector2(0, bounceForce));
            }
            if (pos.y > this.height - padding) {
                atom.applyForce(new Vector2(0, -bounceForce));
            }
        }
    }

    /**
     * Update all entities
     * @param {number} dt - Delta time
     */
    update(dt) {
        // Apply forces
        this.applyBoundaries();
        this.applyAtomicForces();

        // Apply bond spring forces
        for (const bond of this.bonds.values()) {
            bond.applySpringForce(0.6);
        }

        // Update atoms
        for (const atom of this.atoms.values()) {
            const oldKey = atom._gridKey;
            atom.update(dt);

            // Update grid if moved significantly
            const newCellX = Math.floor(atom.position.x / this.gridSize);
            const newCellY = Math.floor(atom.position.y / this.gridSize);
            const newKey = `${newCellX},${newCellY}`;

            if (oldKey !== newKey) {
                this.updateGridPosition(atom);
            }
        }

        // Try to form new bonds
        this.tryFormBonds();

        // Update molecule registry
        this.updateMolecules();

        // Try to form polymers from nearby stable molecules
        this.updatePolymers();

        // Update cells
        this.updateCells();
    }

    /**
     * Get all atoms as array
     */
    getAllAtoms() {
        return Array.from(this.atoms.values());
    }

    /**
     * Get all bonds as array
     */
    getAllBonds() {
        return Array.from(this.bonds.values());
    }

    /**
     * Get all molecules as array
     */
    getAllMolecules() {
        return Array.from(this.molecules.values());
    }

    /**
     * Get all proteins as array
     */
    getAllProteins() {
        return Array.from(this.proteins.values());
    }

    /**
     * Clear the environment
     */
    clear() {
        this.atoms.clear();
        this.bonds.clear();
        this.molecules.clear();
        this.proteins.clear();
        this.cells.clear();
        this.organisms.clear();
        this.grid.clear();
        this.stats = {
            atomCount: 0,
            moleculeCount: 0,
            proteinCount: 0,
            cellCount: 0,
            organismCount: 0
        };
    }

    /**
     * Serialize environment state
     */
    serialize() {
        return {
            width: this.width,
            height: this.height,
            temperature: this.temperature,
            pressure: this.pressure,
            atoms: Array.from(this.atoms.values()).map(a => a.serialize()),
            bonds: Array.from(this.bonds.values()).map(b => b.serialize()),
            molecules: Array.from(this.molecules.values()).map(m => ({
                id: m.id,
                name: m.name,
                atomIds: m.atoms.map(a => a.id)
            }))
        };
    }

    /**
     * Load environment from serialized data
     */
    deserialize(data) {
        this.clear();

        this.width = data.width;
        this.height = data.height;
        this.temperature = data.temperature;
        this.pressure = data.pressure;

        // Load atoms
        const atomMap = new Map();
        for (const atomData of data.atoms) {
            const atom = Atom.deserialize(atomData);
            atomMap.set(atom.id, atom);
            this.addAtom(atom);
        }

        // Load bonds
        for (const bondData of data.bonds) {
            const bond = Bond.deserialize(bondData, atomMap);
            this.addBond(bond);
        }

        // Load molecules
        for (const molData of data.molecules) {
            const atoms = molData.atomIds.map(id => atomMap.get(id));
            const molecule = new Molecule(atoms);
            molecule.id = molData.id;
            molecule.name = molData.name;
            this.addMolecule(molecule);
        }
    }
}

// Make available globally
window.Environment = Environment;
