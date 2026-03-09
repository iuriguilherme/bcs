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
        this.atoms = new Map();        // id -> Atom
        this.bonds = new Map();        // id -> Bond
        this.molecules = new Map();    // id -> Molecule
        this.seedMolecules = new Map(); // id -> Molecule (seed molecules managed by intentions)
        this.proteins = new Map();     // id -> Protein (polymers)
        this.cells = new Map();        // id -> Cell
        this.prokaryotes = new Map();  // id -> Prokaryote (chemistry-based cells)
        this.organisms = new Map();    // id -> Organism (future)
        this.intentions = new Map();   // id -> Intention (blueprint attraction zones)

        // Spatial partitioning for performance
        this.gridSize = 100;
        this.grid = new Map();  // "x,y" -> Set of entity ids

        // Environment properties
        this.temperature = 300;  // Kelvin
        this.pressure = 1;       // Atmospheres

        // Thermodynamics state
        this._thermalBreakTick = 0;
        this._bondsToBreak = [];   // persistent scratch array; avoids GC on hot ticks
        this.thermodynamics = null;

        this.stats = {
            atomCount: 0,
            moleculeCount: 0,
            proteinCount: 0,
            cellCount: 0,
            prokaryoteCount: 0,
            organismCount: 0,
            intentionCount: 0
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
     * Synchronize bonds between environment.bonds and atom.bonds
     * This is BIDIRECTIONAL:
     * 1. Adds bonds from atom.bonds that aren't in environment.bonds (e.g., from reshaping)
     * 2. Removes bonds from environment.bonds that atoms no longer have
     */
    syncBonds() {
        // Step 1: Discover NEW bonds that exist in atom.bonds but not in environment.bonds
        // This happens when molecules reshape and create new bonds via Bond constructor
        const knownBondIds = new Set(this.bonds.keys());
        for (const atom of this.atoms.values()) {
            for (const bond of atom.bonds) {
                if (!knownBondIds.has(bond.id)) {
                    // This is a new bond - add it to environment.bonds
                    this.bonds.set(bond.id, bond);
                    knownBondIds.add(bond.id);
                }
            }
        }
        
        // Step 2: Remove broken/orphaned bonds from environment.bonds
        const bondsToRemove = [];
        for (const [bondId, bond] of this.bonds) {
            // Check if bond is orphaned (atoms don't exist in environment)
            const atom1Exists = bond.atom1 && this.atoms.has(bond.atom1.id);
            const atom2Exists = bond.atom2 && this.atoms.has(bond.atom2.id);
            
            if (!atom1Exists || !atom2Exists) {
                bondsToRemove.push(bondId);
                continue;
            }
            
            // Check if bond has been broken (atoms don't have it in their bonds array)
            const atom1HasBond = bond.atom1.bonds.includes(bond);
            const atom2HasBond = bond.atom2.bonds.includes(bond);
            
            if (!atom1HasBond || !atom2HasBond) {
                bondsToRemove.push(bondId);
            }
        }
        
        for (const bondId of bondsToRemove) {
            this.bonds.delete(bondId);
        }
        
        // Step 3: Ensure atom.bonds arrays are consistent with environment.bonds
        // Rebuild atom.bonds from environment.bonds to ensure both sides match
        for (const atom of this.atoms.values()) {
            atom.bonds = [];
        }
        
        for (const bond of this.bonds.values()) {
            if (bond.atom1 && bond.atom2) {
                bond.atom1.bonds.push(bond);
                bond.atom2.bonds.push(bond);
            }
        }
    }

    /**
     * Register a molecule
     * @param {Molecule} molecule - Molecule to register
     */
    addMolecule(molecule) {
        this.molecules.set(molecule.id, molecule);
        // Assign moleculeId to all atoms in the molecule
        for (const atom of molecule.atoms) {
            atom.moleculeId = molecule.id;
        }
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

    // --- Prokaryote Methods ---

    /**
     * Add a prokaryote to the environment
     * @param {Prokaryote} prokaryote - Prokaryote to add
     */
    addProkaryote(prokaryote) {
        this.prokaryotes.set(prokaryote.id, prokaryote);
        this.stats.prokaryoteCount = this.prokaryotes.size;
    }

    /**
     * Remove a prokaryote from the environment
     * @param {string} prokaryoteId - Prokaryote ID to remove
     */
    removeProkaryote(prokaryoteId) {
        this.prokaryotes.delete(prokaryoteId);
        this.stats.prokaryoteCount = this.prokaryotes.size;
    }

    /**
     * Get all prokaryotes as array
     */
    getAllProkaryotes() {
        return Array.from(this.prokaryotes.values());
    }

    /**
     * Update all prokaryotes
     * @param {number} dt - Delta time
     */
    updateProkaryotes(dt) {
        for (const prokaryote of this.prokaryotes.values()) {
            if (prokaryote.isAlive) {
                prokaryote.update(dt, this);
            }
        }

        // Remove dead prokaryotes
        for (const [id, prokaryote] of this.prokaryotes) {
            if (!prokaryote.isAlive) {
                this.prokaryotes.delete(id);
            }
        }

        this.stats.prokaryoteCount = this.prokaryotes.size;
    }

    /**
     * Alias for proteins Map (polymers) - used by prokaryote factory
     */
    get polymers() {
        return this.proteins;
    }

    /**
     * Remove a polymer from the environment
     * @param {string} polymerId - Polymer ID to remove
     */
    removePolymer(polymerId) {
        this.removeProtein(polymerId);
    }

    /**
     * Add an intention to the environment
     * @param {Intention} intention - Intention zone to add
     * @param {Catalogue} catalogue - Optional catalogue to ensure monomer blueprints exist
     */
    addIntention(intention, catalogue = null) {
        this.intentions.set(intention.id, intention);
        this.stats.intentionCount = this.intentions.size;

        // Initialize exclusion list to ignore molecules that existed before this intention
        // This prevents immediate fulfillment from pre-existing molecules
        if (intention.initializeExclusions) {
            intention.initializeExclusions(this);
        }

        // For polymer intentions, ensure the monomer blueprint exists in the catalogue
        if (intention.type === 'polymer' && intention.blueprint) {
            const cat = catalogue || window.cellApp?.catalogue || null;
            if (cat && typeof cat.ensureMonomerForPolymer === 'function') {
                const monomerBlueprint = cat.ensureMonomerForPolymer(intention.blueprint);
                if (monomerBlueprint) {
                    console.log(`Polymer intention: Monomer blueprint '${monomerBlueprint.name}' ready`);
                } else {
                    console.warn(`Polymer intention: Could not find/create monomer for '${intention.blueprint.name}'`);
                }
            }
        }
    }

    /**
     * Remove an intention from the environment.
     * For molecule intents, cleans up the seed molecule and all atom claims.
     * @param {string} intentionId - Intention ID to remove
     */
    removeIntention(intentionId) {
        const intention = this.intentions.get(intentionId);
        if (intention && intention.type === 'molecule') {
            // Clean up seed molecule and atom claims before removing
            if (typeof intention._resetSeed === 'function') {
                intention._resetSeed(this);
            }
        }
        this.intentions.delete(intentionId);
        this.stats.intentionCount = this.intentions.size;
    }

    /**
     * Get all intentions as array
     */
    getAllIntentions() {
        return Array.from(this.intentions.values());
    }

    /**
     * Get the molecule intention that an atom is inside (if any)
     * @param {Atom} atom - The atom to check
     * @returns {Intention|null} - The intention the atom is inside, or null
     */
    getIntentionForAtom(atom) {
        for (const intention of this.intentions.values()) {
            if (intention.type !== 'molecule') continue;
            if (intention.fulfilled) continue;
            
            const dist = atom.position.distanceTo(intention.position);
            if (dist < intention.radius) {
                return intention;
            }
        }
        return null;
    }

    /**
     * Update all intentions - attract components and check completion
     * @param {number} dt - Delta time
     */
    updateIntentions(dt) {
        const fulfilledIds = [];

        for (const intention of this.intentions.values()) {
            intention.update(this, dt);

            if (intention.fulfilled) {
                fulfilledIds.push(intention.id);
            }
        }

        // Remove fulfilled intentions
        for (const id of fulfilledIds) {
            this.removeIntention(id);
        }
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
            // Get molecules that can polymerize (must have free valence to chain)
            // Stable/inert molecules (like H2) are excluded - they have no free bonds
            const freeMolecules = this.getAllMolecules().filter(m =>
                !m.proteinId && m.canPolymerize && m.canPolymerize()
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

                const atom1Isolated = atom1.isPhysicsIsolated;
                const atom2Isolated = atom2.isPhysicsIsolated;
                const atom1FullyFree = !atom1Isolated && !atom1.moleculeId;
                const atom2FullyFree = !atom2Isolated && !atom2.moleculeId;
                // Skip inter-particle forces between a claimed atom and a fully free atom.
                // Claimed atoms are being attracted by intentions; free atoms should not repel them.
                if ((atom1Isolated && atom2FullyFree) || (atom2Isolated && atom1FullyFree)) continue;

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
                // Molecule repulsion: push atoms away from molecules they were released from
                else if (atom2.moleculeId && atom1.isRepelledFrom(atom2.moleculeId)) {
                    // Strong repulsion force away from the molecule's atoms
                    const repelRadius = 150;
                    if (dist < repelRadius) {
                        const factor = 1 - dist / repelRadius;
                        const force = delta.normalize().mul(repulsionStrength * factor * 1.5);
                        atom1.applyForce(force);
                    }
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

        // Per-tick formation factor cache — temperature is constant per tick,
        // so each unique element pair is computed at most once.
        const formationCache = this._formationCache || (this._formationCache = new Map());
        formationCache.clear();

        for (const atom1 of atoms) {
            if (atom1.availableValence === 0) continue;
            // Skip atoms in seed molecules - bonding is controlled by intentions
            if (this._isInSeedMolecule(atom1)) continue;
            // Skip claimed atoms - their bonding is controlled exclusively by Rule 6
            if (atom1.claimedByIntentId) continue;

            const nearby = this.getAtomsNear(
                atom1.position.x,
                atom1.position.y,
                bondingRadius
            );

            // Hoist intention check outside inner loop — one call per atom1 iteration
            const intention1 = this.getIntentionForAtom(atom1);

            for (const atom2 of nearby) {
                if (atom1 === atom2) continue;
                if (atom1.isBondedTo(atom2)) continue;
                if (atom2.availableValence === 0) continue;
                // Skip seed molecule atoms
                if (this._isInSeedMolecule(atom2)) continue;
                // Skip claimed atoms - Rule 6 handles their bonding
                if (atom2.claimedByIntentId) continue;

                // Check for active repulsion (used by molecule decay to prevent rebonding)
                // Repulsion map stores molecule IDs that released this atom
                if (atom1.repulsions && atom2.moleculeId && atom1.repulsions.has(atom2.moleculeId)) continue;
                if (atom2.repulsions && atom1.moleculeId && atom2.repulsions.has(atom1.moleculeId)) continue;

                const dist = atom1.position.distanceTo(atom2.position);
                const bondDist = (atom1.radius + atom2.radius) * 1.5;

                if (dist < bondDist) {
                    // Base probability increases as atoms get closer
                    let prob = 1 - (dist / bondDist);

                    // If either atom is inside a molecule intent zone, block spontaneous bonding.
                    // Free unclaimed atoms in intent zones must wait to be claimed by Rule 3
                    // and bonded by Rule 6. Allowing spontaneous bonding here causes all
                    // unclaimed atoms to merge into a tar-ball mega-molecule, preventing
                    // the intent from claiming individual atoms.
                    if (intention1) {
                        prob = 0;
                    } else {
                        const intention2 = this.getIntentionForAtom(atom2);
                        if (intention2) prob = 0;
                    }

                    const sym1 = atom1.symbol;
                    const sym2 = atom2.symbol;
                    let thermalFactor;
                    if (this.thermodynamics) {
                        const pairKey = sym1 < sym2 ? sym1 + sym2 : sym2 + sym1;
                        thermalFactor = formationCache.get(pairKey);
                        if (thermalFactor === undefined) {
                            thermalFactor = this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature);
                            formationCache.set(pairKey, thermalFactor);
                        }
                    } else {
                        thermalFactor = 0.3;
                    }
                    if (Math.random() < prob * thermalFactor) {
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
     * Check if an atom belongs to a seed molecule (managed by an intention)
     * Seed atoms are excluded from normal molecule formation logic.
     * @param {Atom} atom
     * @returns {boolean}
     */
    _isInSeedMolecule(atom) {
        return atom.moleculeId !== null && this.seedMolecules.has(atom.moleculeId);
    }

    /**
     * Detect and register new molecules, merge connected groups
     * Simple logic: Find bond-connected groups, each group = one molecule
     */
    updateMolecules() {
        // Collect seed molecule atom IDs - these are managed separately by intentions
        // and must not be touched by the normal molecule formation logic
        const seedAtomIds = new Set();
        for (const seedMol of this.seedMolecules.values()) {
            for (const atom of seedMol.atoms) {
                seedAtomIds.add(atom.id);
            }
        }

        // Step 1: Get all atoms that have at least one bond (excluding seed molecule atoms)
        const bondedAtoms = Array.from(this.atoms.values())
            .filter(a => a.bonds.length > 0 && !seedAtomIds.has(a.id));

        if (bondedAtoms.length === 0) {
            // Clear all molecules and reset assignments (skip seed atoms)
            for (const atom of this.atoms.values()) {
                if (!seedAtomIds.has(atom.id)) {
                    atom.moleculeId = null;
                }
            }
            this.molecules.clear();
            this.stats.moleculeCount = 0;
            return;
        }

        // Step 2: Find all connected groups using BFS via bonds
        const groups = this._findAllConnectedGroups(bondedAtoms);

        // Step 3: Build a fingerprint for each group (sorted atom IDs)
        const groupFingerprints = new Map(); // fingerprint -> group
        for (const group of groups) {
            if (group.length < 2) continue;
            const fingerprint = group.map(a => a.id).sort().join(',');
            groupFingerprints.set(fingerprint, group);
        }

        // Step 4: Find existing molecules that match groups (same atoms)
        const existingMoleculesByFingerprint = new Map();
        for (const molecule of this.molecules.values()) {
            const fingerprint = molecule.atoms.map(a => a.id).sort().join(',');
            existingMoleculesByFingerprint.set(fingerprint, molecule);
        }

        // Step 5: Build new molecules map, preserving existing molecules
        const newMolecules = new Map();
        const atomsToUpdate = new Set();

        for (const [fingerprint, group] of groupFingerprints) {
            const existingMolecule = existingMoleculesByFingerprint.get(fingerprint);

            if (existingMolecule) {
                // Molecule still exists with same atoms - preserve it
                // Update the atoms array to ensure it matches the current group
                existingMolecule.atoms = group;
                newMolecules.set(existingMolecule.id, existingMolecule);
                // Ensure atom references are up to date
                for (const atom of group) {
                    atom.moleculeId = existingMolecule.id;
                }
            } else {
                // New group - create new molecule
                const molecule = new Molecule(group);
                newMolecules.set(molecule.id, molecule);
                for (const atom of group) {
                    atom.moleculeId = molecule.id;
                    atomsToUpdate.add(atom.id);
                }
            }
        }

        // Step 6: Clear molecule ID from atoms not in any molecule
        // Also clear atoms that claim a moleculeId but aren't in that molecule's atom list
        // Skip seed molecule atoms - they are managed by the intention system
        for (const atom of this.atoms.values()) {
            if (seedAtomIds.has(atom.id)) continue; // Skip seed atoms
            if (atom.bonds.length === 0) {
                atom.moleculeId = null;
            } else if (atom.moleculeId) {
                // Verify the atom is actually in the molecule it claims
                const molecule = newMolecules.get(atom.moleculeId);
                if (!molecule || !molecule.atoms.includes(atom)) {
                    atom.moleculeId = null;
                }
            }
        }

        // Step 7: Replace molecules map
        this.molecules = newMolecules;
        this.stats.moleculeCount = this.molecules.size;
        
        // Step 8: Final validation - ensure all atoms in each molecule have correct moleculeId
        for (const molecule of this.molecules.values()) {
            for (const atom of molecule.atoms) {
                if (atom.moleculeId !== molecule.id) {
                    atom.moleculeId = molecule.id;
                }
            }
        }
    }

    /**
     * Find all connected groups of atoms using BFS
     * @param {Atom[]} atoms - Atoms to group
     */
    _findAllConnectedGroups(atoms) {
        const _atomSet = new Set(atoms);
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
     * Thermal bond breaking sweep — runs every 6 ticks
     * Uses simple kinetics: P(break) = (1-stability) × min(1, temp/298)
     */
    tryBreakThermalBonds() {
        this._thermalBreakTick++;
        if (this._thermalBreakTick % 6 !== 0) return;

        const temp = this.temperature;
        this._bondsToBreak.length = 0;

        for (const bond of this.bonds.values()) {
            if (bond.atom1.isSealed || bond.atom2.isSealed) continue;
            if (bond.shouldBreakThermal(temp)) {
                this._bondsToBreak.push(bond);
            }
        }

        for (const bond of this._bondsToBreak) {
            bond.break(false);  // suppress kinetic impulse — thermal breakage is gradual, not explosive
            this.bonds.delete(bond.id);
        }
    }

    /**
     * Update all entities
     * @param {number} dt - Delta time
     */
    update(dt) {
        // Synchronize bonds first - clean up any broken/stale bonds
        this.syncBonds();

        // Thermal bond breaking (every 6 ticks)
        this.tryBreakThermalBonds();

        // Apply forces
        this.applyBoundaries();
        this.applyAtomicForces();

        // Update intention zones (attract components toward blueprints)
        this.updateIntentions(dt);

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

        // Update molecules (handles decay for unstable molecules)
        for (const molecule of this.molecules.values()) {
            molecule.update(dt, this);
        }

        // Update molecule registry (detects new molecules, cleans broken ones)
        this.updateMolecules();

        // Try to form polymers from nearby stable molecules
        this.updatePolymers();

        // Update cells
        this.updateCells();

        // Update prokaryotes (chemistry-based cells)
        this.updateProkaryotes(dt);
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
     * Get all seed molecules (in-progress intention assemblies) as array
     */
    getAllSeedMolecules() {
        return Array.from(this.seedMolecules.values());
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
        this.seedMolecules.clear();
        this.proteins.clear();
        this.cells.clear();
        this.prokaryotes.clear();
        this.organisms.clear();
        this.intentions.clear();
        this.grid.clear();
        this._thermalBreakTick = 0;
        this._bondsToBreak = [];
        this.stats = {
            atomCount: 0,
            moleculeCount: 0,
            proteinCount: 0,
            cellCount: 0,
            prokaryoteCount: 0,
            organismCount: 0,
            intentionCount: 0
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

        // Validate width/height — Infinity/NaN causes spatial grid infinite loops
        const rawWidth = data.width;
        const rawHeight = data.height;
        this.width = (Number.isFinite(rawWidth) && rawWidth > 0 && rawWidth <= 10000) ? rawWidth : 2000;
        this.height = (Number.isFinite(rawHeight) && rawHeight > 0 && rawHeight <= 10000) ? rawHeight : 2000;

        // Validate temperature — prevents corrupted saves from breaking thermal math
        const rawTemp = data.temperature;
        if (Number.isFinite(rawTemp) && rawTemp >= 1 && rawTemp <= 600) {
            this.temperature = rawTemp;
        } else {
            this.temperature = 300;
        }

        const rawPressure = data.pressure;
        this.pressure = (Number.isFinite(rawPressure) && rawPressure > 0 && rawPressure <= 100) ? rawPressure : 1;

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

