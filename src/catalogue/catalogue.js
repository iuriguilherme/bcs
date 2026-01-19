/**
 * Catalogue
 * Central storage for blueprints with IndexedDB persistence
 */

class Catalogue {
    constructor() {
        this.molecules = new Map();  // fingerprint -> MoleculeBlueprint
        this.polymers = new Map();   // fingerprint -> PolymerBlueprint
        this.cells = new Map();      // id -> CellBlueprint
        this.organisms = new Map();  // id -> OrganismBlueprint

        // IndexedDB connection
        this.db = null;
        this.dbName = 'CellSimulatorCatalogue';
        this.dbVersion = 1;

        // Auto-discovery settings
        this.autoRegisterStable = true;
        this.knownFingerprints = new Set();

        // Event callbacks
        this.onBlueprintAdded = null;

        // Load pre-defined polymer templates
        this._loadPolymerTemplates();

        // Load monomer blueprints (molecule blueprints for monomers)
        this._loadMonomerBlueprints();
    }

    /**
     * Load pre-defined polymer templates
     */
    _loadPolymerTemplates() {
        if (typeof getAllPolymerTemplates === 'function') {
            const templates = getAllPolymerTemplates();
            for (const template of templates) {
                this.polymers.set(template.fingerprint, template);
            }
            console.log(`Loaded ${templates.length} polymer templates`);
        }
    }

    /**
     * Load monomer blueprints into the molecule catalogue
     * These are pre-defined molecules that can be used as monomers for polymers
     */
    _loadMonomerBlueprints() {
        if (typeof getAllMonomerBlueprints === 'function') {
            const blueprints = getAllMonomerBlueprints();
            for (const blueprint of blueprints) {
                // Don't overwrite if already exists (e.g., from IndexedDB)
                if (!this.molecules.has(blueprint.fingerprint)) {
                    this.molecules.set(blueprint.fingerprint, blueprint);
                    this.knownFingerprints.add(blueprint.fingerprint);
                }
            }
            console.log(`Loaded ${blueprints.length} monomer blueprints`);
        }
    }

    /**
     * Initialize IndexedDB connection
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                this._loadFromDB().then(resolve);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('molecules')) {
                    db.createObjectStore('molecules', { keyPath: 'fingerprint' });
                }
                if (!db.objectStoreNames.contains('cells')) {
                    db.createObjectStore('cells', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('organisms')) {
                    db.createObjectStore('organisms', { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Load all blueprints from IndexedDB
     */
    async _loadFromDB() {
        if (!this.db) return;

        // Load molecules
        const moleculeStore = this.db
            .transaction('molecules', 'readonly')
            .objectStore('molecules');

        return new Promise((resolve) => {
            const request = moleculeStore.getAll();

            request.onsuccess = () => {
                for (const data of request.result) {
                    const blueprint = MoleculeBlueprint.deserialize(data);
                    this.molecules.set(data.fingerprint, blueprint);
                    this.knownFingerprints.add(data.fingerprint);
                }
                console.log(`Loaded ${this.molecules.size} molecule blueprints`);

                // Clean up duplicates and invalid entries
                this._cleanupCatalogue();

                resolve();
            };

            request.onerror = () => {
                console.error('Failed to load molecules:', request.error);
                resolve();
            };
        });
    }

    /**
     * Clean up the catalogue - remove duplicates and invalid entries
     */
    async _cleanupCatalogue() {
        const seenFormulas = new Map(); // formula -> fingerprint
        const toRemove = [];

        for (const [fingerprint, blueprint] of this.molecules) {
            // Check if this is a valid stable molecule
            const isValid = this._isBlueprintValid(blueprint);

            if (!isValid) {
                toRemove.push(fingerprint);
                console.log(`Removing invalid blueprint: ${blueprint.formula}`);
                continue;
            }

            // Check for duplicates (same formula, different fingerprint)
            if (seenFormulas.has(blueprint.formula)) {
                // Keep the newer one (higher createdAt)
                const existingFp = seenFormulas.get(blueprint.formula);
                const existing = this.molecules.get(existingFp);
                if (existing && blueprint.createdAt > existing.createdAt) {
                    toRemove.push(existingFp);
                    seenFormulas.set(blueprint.formula, fingerprint);
                } else {
                    toRemove.push(fingerprint);
                }
                console.log(`Removing duplicate blueprint: ${blueprint.formula}`);
            } else {
                seenFormulas.set(blueprint.formula, fingerprint);
            }
        }

        // Remove invalid/duplicate entries
        for (const fp of toRemove) {
            this.molecules.delete(fp);
            this.knownFingerprints.delete(fp);
            this._deleteMoleculeFromDB(fp);
        }

        if (toRemove.length > 0) {
            console.log(`Cleaned up ${toRemove.length} invalid/duplicate blueprints`);
        }
    }

    /**
     * Check if a blueprint is valid (stable molecule with proper structure)
     */
    _isBlueprintValid(bp) {
        if (!bp.atomData || bp.atomData.length < 2) return false;
        if (!bp.bondData || bp.bondData.length < 1) return false;

        // Calculate valence usage for each atom
        const atomValences = {};
        for (const atom of bp.atomData) {
            const element = getElement(atom.symbol);
            if (!element) return false;
            atomValences[atom.index] = { max: element.valence, used: 0 };
        }

        // Count bonds for each atom
        for (const bond of bp.bondData) {
            const order = bond.order || 1;
            if (atomValences[bond.atom1Index]) {
                atomValences[bond.atom1Index].used += order;
            }
            if (atomValences[bond.atom2Index]) {
                atomValences[bond.atom2Index].used += order;
            }
        }

        // Check all atoms have filled valence
        for (const idx in atomValences) {
            const v = atomValences[idx];
            if (v.used !== v.max) return false;
        }
        return true;
    }

    /**
     * Delete a molecule from IndexedDB
     */
    async _deleteMoleculeFromDB(fingerprint) {
        if (!this.db) return;

        try {
            const transaction = this.db.transaction('molecules', 'readwrite');
            const store = transaction.objectStore('molecules');
            store.delete(fingerprint);
        } catch (e) {
            console.error('Failed to delete molecule from DB:', e);
        }
    }

    /**
     * Save a molecule blueprint to IndexedDB
     */
    async _saveMolecule(blueprint) {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db.transaction('molecules', 'readwrite');
            const store = transaction.objectStore('molecules');

            const data = {
                ...blueprint.serialize(),
                fingerprint: blueprint.fingerprint
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error('Failed to save molecule:', request.error);
                resolve(false);
            };
        });
    }

    /**
     * Register a new molecule blueprint
     * @param {Molecule} molecule - The molecule to register
     * @param {string} name - Optional custom name
     * @returns {MoleculeBlueprint|null} The created blueprint or null if already exists
     */
    registerMolecule(molecule, name = null) {
        if (this.hasMolecule(molecule.fingerprint)) {
            return null;  // Already registered
        }

        const blueprint = new MoleculeBlueprint(molecule, name);
        this.molecules.set(blueprint.fingerprint, blueprint);
        this.knownFingerprints.add(blueprint.fingerprint);

        // Persist
        this._saveMolecule(blueprint);

        // Callback
        if (this.onBlueprintAdded) {
            this.onBlueprintAdded(blueprint);
        }

        console.log(`Registered new molecule: ${blueprint.name}`);
        return blueprint;
    }

    /**
     * Check if molecule fingerprint is already registered
     */
    hasMolecule(fingerprint) {
        return this.molecules.has(fingerprint);
    }

    /**
     * Get molecule blueprint by fingerprint
     */
    getMolecule(fingerprint) {
        return this.molecules.get(fingerprint) || null;
    }

    /**
     * Get all molecule blueprints
     */
    getAllMolecules() {
        return Array.from(this.molecules.values());
    }

    /**
     * Get a monomer blueprint by monomer ID
     * If not already loaded, creates it from the monomer template
     * @param {string} monomerId - The monomer template ID (e.g., 'ETHYLENE', 'GLYCINE')
     * @returns {Object|null} The monomer blueprint or null
     */
    getMonomerById(monomerId) {
        if (!monomerId) return null;

        // Check if already in catalogue by looking for fingerprint pattern
        const expectedFingerprint = `monomer:${monomerId.toLowerCase()}:`;
        for (const [fp, blueprint] of this.molecules) {
            if (fp.startsWith(expectedFingerprint) || blueprint.monomerId === monomerId.toLowerCase()) {
                return blueprint;
            }
        }

        // Not found - try to create from template
        if (typeof getMonomerBlueprint === 'function') {
            const blueprint = getMonomerBlueprint(monomerId);
            if (blueprint) {
                this.molecules.set(blueprint.fingerprint, blueprint);
                this.knownFingerprints.add(blueprint.fingerprint);
                console.log(`Created monomer blueprint on-demand: ${blueprint.name}`);
                return blueprint;
            }
        }

        return null;
    }

    /**
     * Ensure a monomer blueprint exists for a polymer blueprint
     * Call this when placing a polymer intention to make sure the monomer is available
     * @param {Object} polymerBlueprint - The polymer blueprint
     * @returns {Object|null} The monomer blueprint or null
     */
    ensureMonomerForPolymer(polymerBlueprint) {
        if (!polymerBlueprint) return null;

        const monomerId = polymerBlueprint.monomerId;
        if (!monomerId) {
            console.warn('Polymer blueprint has no monomerId:', polymerBlueprint.name);
            return null;
        }

        return this.getMonomerById(monomerId);
    }

    // ============ Polymer Methods ============

    /**
     * Register a discovered polymer blueprint
     * @param {Polymer} polymer - The polymer to register
     * @param {string} name - Optional custom name
     * @returns {PolymerBlueprint|null}
     */
    registerPolymer(polymer, name = null) {
        // Check if polymer is useful
        const usefulness = isPolymerUseful(polymer);

        // Create a template from the polymer
        const template = {
            id: polymer.id,
            name: name || polymer.name || usefulness.template || `Polymer-${polymer.molecules.length}`,
            type: polymer.type,
            description: usefulness.useful ? `Useful for ${usefulness.role}` : 'Unknown function',
            minMolecules: polymer.molecules.length,
            requiredElements: [...new Set(polymer.getAllAtoms().map(a => a.symbol))],
            elementRatios: {},
            essential: usefulness.essential,
            cellRole: usefulness.role
        };

        const blueprint = new PolymerBlueprint(template, polymer.molecules);
        blueprint.discovered = true;
        blueprint.discoveredAt = Date.now();

        // Check if already registered
        if (this.polymers.has(blueprint.fingerprint)) {
            return null;
        }

        this.polymers.set(blueprint.fingerprint, blueprint);
        console.log(`Registered polymer: ${blueprint.name} (${blueprint.type})`);

        if (this.onBlueprintAdded) {
            this.onBlueprintAdded('polymer', blueprint);
        }

        return blueprint;
    }

    /**
     * Check if polymer fingerprint is already registered
     */
    hasPolymer(fingerprint) {
        return this.polymers.has(fingerprint);
    }

    /**
     * Get polymer blueprint by fingerprint
     */
    getPolymer(fingerprint) {
        return this.polymers.get(fingerprint) || null;
    }

    /**
     * Get all polymer blueprints
     */
    getAllPolymers() {
        return Array.from(this.polymers.values());
    }

    /**
     * Get only essential polymer templates (needed for cells)
     */
    getEssentialPolymers() {
        return this.getAllPolymers().filter(p => p.essential);
    }

    /**
     * Get polymers by type
     */
    getPolymersByType(type) {
        return this.getAllPolymers().filter(p => p.type === type);
    }

    /**
     * Get polymers by cell role
     */
    getPolymersByRole(role) {
        return this.getAllPolymers().filter(p => p.cellRole === role);
    }

    /**
     * Instantiate a polymer at a position
     * @param {string} fingerprint - Blueprint fingerprint
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Polymer|null}
     */
    instantiatePolymer(fingerprint, x, y) {
        const blueprint = this.getPolymer(fingerprint);
        if (!blueprint) return null;
        return blueprint.instantiate(x, y, this);
    }

    /**
     * Search blueprints by name/formula
     * @param {string} query - Search query
     * @returns {Blueprint[]} Matching blueprints
     */
    search(query) {
        const q = query.toLowerCase();
        const results = [];

        for (const blueprint of this.molecules.values()) {
            if (blueprint.name.toLowerCase().includes(q) ||
                blueprint.formula.toLowerCase().includes(q)) {
                results.push(blueprint);
            }
        }

        return results;
    }

    /**
     * Auto-discover and register stable molecules
     * @param {Molecule[]} molecules - Molecules to check
     */
    autoDiscover(molecules) {
        if (!this.autoRegisterStable) return;

        for (const molecule of molecules) {
            if (molecule.isStable() && !this.hasMolecule(molecule.fingerprint)) {
                this.registerMolecule(molecule);
            }
        }
    }

    /**
     * Instantiate a blueprint at a position
     * @param {string} fingerprint - Blueprint fingerprint
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Molecule|null}
     */
    instantiateMolecule(fingerprint, x, y) {
        const blueprint = this.molecules.get(fingerprint);
        if (!blueprint) return null;

        return blueprint.instantiate(x, y);
    }

    /**
     * Delete a molecule blueprint
     * @param {string} fingerprint - Blueprint fingerprint
     */
    async deleteMolecule(fingerprint) {
        if (!this.molecules.has(fingerprint)) return;

        this.molecules.delete(fingerprint);
        this.knownFingerprints.delete(fingerprint);

        if (this.db) {
            const transaction = this.db.transaction('molecules', 'readwrite');
            const store = transaction.objectStore('molecules');
            store.delete(fingerprint);
        }
    }

    /**
     * Export catalogue to JSON
     */
    export() {
        return JSON.stringify({
            molecules: Array.from(this.molecules.values()).map(b => b.serialize()),
            cells: Array.from(this.cells.values()).map(b => b.serialize()),
            organisms: Array.from(this.organisms.values()).map(b => b.serialize())
        }, null, 2);
    }

    /**
     * Import catalogue from JSON
     * @param {string} json - JSON string
     */
    import(json) {
        const data = JSON.parse(json);

        if (data.molecules) {
            for (const molData of data.molecules) {
                const blueprint = MoleculeBlueprint.deserialize(molData);
                if (!this.molecules.has(blueprint.fingerprint)) {
                    this.molecules.set(blueprint.fingerprint, blueprint);
                    this.knownFingerprints.add(blueprint.fingerprint);
                    this._saveMolecule(blueprint);
                }
            }
        }

        console.log(`Imported ${data.molecules?.length || 0} molecules`);
    }

    /**
     * Clear all blueprints
     */
    async clear() {
        this.molecules.clear();
        this.polymers.clear();
        this.cells.clear();
        this.organisms.clear();
        this.knownFingerprints.clear();

        // Reload polymer templates
        this._loadPolymerTemplates();

        if (this.db) {
            const transaction = this.db.transaction(
                ['molecules', 'cells', 'organisms'],
                'readwrite'
            );
            transaction.objectStore('molecules').clear();
            transaction.objectStore('cells').clear();
            transaction.objectStore('organisms').clear();
        }
    }
}

// Make available globally
window.Catalogue = Catalogue;
