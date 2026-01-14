/**
 * Polymer Blueprints
 * Pre-defined templates for cell-essential polymers
 * and the PolymerBlueprint class for storing/instantiating polymers
 */

// Essential polymer templates for cell formation
const CELL_ESSENTIAL_POLYMERS = {
    // Membrane Components (Lipids)
    PHOSPHOLIPID: {
        id: 'phospholipid',
        name: 'Phospholipid',
        type: 'lipid',
        description: 'Forms the cell membrane bilayer',
        minMolecules: 3,
        requiredElements: ['C', 'H', 'O', 'P'],
        elementRatios: { C: 0.4, H: 0.5, O: 0.08, P: 0.02 },
        essential: true,
        cellRole: 'membrane'
    },
    FATTY_ACID: {
        id: 'fatty_acid',
        name: 'Fatty Acid',
        type: 'lipid',
        description: 'Building block for lipids and energy storage',
        minMolecules: 2,
        requiredElements: ['C', 'H', 'O'],
        elementRatios: { C: 0.5, H: 0.45, O: 0.05 },
        essential: false,
        cellRole: 'membrane'
    },

    // Structural Components (Proteins)
    STRUCTURAL_PROTEIN: {
        id: 'structural_protein',
        name: 'Structural Protein',
        type: 'protein',
        description: 'Provides cell structure and support',
        minMolecules: 4,
        requiredElements: ['C', 'H', 'O', 'N'],
        elementRatios: { C: 0.35, H: 0.35, O: 0.15, N: 0.15 },
        essential: true,
        cellRole: 'structure'
    },
    ENZYME: {
        id: 'enzyme',
        name: 'Enzyme',
        type: 'protein',
        description: 'Catalyzes chemical reactions',
        minMolecules: 3,
        requiredElements: ['C', 'H', 'O', 'N'],
        elementRatios: { C: 0.35, H: 0.35, O: 0.15, N: 0.15 },
        essential: false,
        cellRole: 'metabolism'
    },
    TRANSPORT_PROTEIN: {
        id: 'transport_protein',
        name: 'Transport Protein',
        type: 'protein',
        description: 'Moves molecules across membrane',
        minMolecules: 3,
        requiredElements: ['C', 'H', 'O', 'N'],
        elementRatios: { C: 0.35, H: 0.35, O: 0.15, N: 0.15 },
        essential: false,
        cellRole: 'transport'
    },

    // Genetic Material (Nucleic Acids)
    DNA_STRAND: {
        id: 'dna_strand',
        name: 'DNA Strand',
        type: 'nucleic_acid',
        description: 'Stores genetic information',
        minMolecules: 4,
        requiredElements: ['C', 'H', 'O', 'N', 'P'],
        elementRatios: { C: 0.30, H: 0.30, O: 0.20, N: 0.15, P: 0.05 },
        essential: true,
        cellRole: 'genetics'
    },
    RNA_STRAND: {
        id: 'rna_strand',
        name: 'RNA Strand',
        type: 'nucleic_acid',
        description: 'Carries genetic messages for protein synthesis',
        minMolecules: 3,
        requiredElements: ['C', 'H', 'O', 'N', 'P'],
        elementRatios: { C: 0.30, H: 0.30, O: 0.22, N: 0.13, P: 0.05 },
        essential: false,
        cellRole: 'genetics'
    },

    // Energy Storage (Carbohydrates)
    GLYCOGEN: {
        id: 'glycogen',
        name: 'Glycogen',
        type: 'carbohydrate',
        description: 'Energy storage molecule',
        minMolecules: 3,
        requiredElements: ['C', 'H', 'O'],
        elementRatios: { C: 0.40, H: 0.53, O: 0.07 },
        essential: false,
        cellRole: 'energy'
    },
    CELLULOSE: {
        id: 'cellulose',
        name: 'Cellulose',
        type: 'carbohydrate',
        description: 'Structural carbohydrate (cell wall)',
        minMolecules: 4,
        requiredElements: ['C', 'H', 'O'],
        elementRatios: { C: 0.44, H: 0.49, O: 0.07 },
        essential: false,
        cellRole: 'structure'
    }
};

// Minimum requirements for a viable cell
const CELL_REQUIREMENTS = {
    membrane: { count: 1, polymers: ['PHOSPHOLIPID', 'FATTY_ACID'] },
    structure: { count: 1, polymers: ['STRUCTURAL_PROTEIN', 'CELLULOSE'] },
    genetics: { count: 1, polymers: ['DNA_STRAND', 'RNA_STRAND'] },
    metabolism: { count: 0, polymers: ['ENZYME'] },  // Optional but helpful
    energy: { count: 0, polymers: ['GLYCOGEN'] },    // Optional
    transport: { count: 0, polymers: ['TRANSPORT_PROTEIN'] }  // Optional
};

/**
 * PolymerBlueprint - Template for creating polymers
 */
class PolymerBlueprint {
    constructor(template, molecules = null) {
        this.id = template.id;
        this.name = template.name;
        this.type = template.type;
        this.description = template.description;
        this.minMolecules = template.minMolecules;
        this.requiredElements = template.requiredElements;
        this.elementRatios = template.elementRatios;
        this.essential = template.essential;
        this.cellRole = template.cellRole;

        // If based on actual molecules, store their data
        this.moleculeData = molecules ? molecules.map(m => ({
            formula: m.formula,
            fingerprint: m.fingerprint,
            atomData: m.atoms.map(a => ({
                symbol: a.symbol,
                relativeX: a.position.x - m.getCenter().x,
                relativeY: a.position.y - m.getCenter().y
            }))
        })) : null;

        // Generate fingerprint for this blueprint
        this.fingerprint = this._generateFingerprint();

        // Track discovery
        this.discovered = false;
        this.discoveredAt = null;
    }

    /**
     * Generate unique fingerprint for this blueprint
     */
    _generateFingerprint() {
        const parts = [
            this.type,
            this.requiredElements.sort().join(''),
            this.minMolecules
        ];
        return JSON.stringify({
            type: this.type,
            elements: this.requiredElements.sort(),
            minMol: this.minMolecules
        });
    }

    /**
     * Check if a polymer matches this blueprint
     */
    matches(polymer) {
        if (!polymer || !polymer.molecules || polymer.molecules.length < this.minMolecules) {
            return false;
        }

        // Check type
        if (polymer.type !== this.type) {
            return false;
        }

        // Check required elements are present
        const polymerElements = new Set();
        for (const mol of polymer.molecules) {
            if (mol.atoms) {
                for (const atom of mol.atoms) {
                    polymerElements.add(atom.symbol);
                }
            }
        }

        for (const element of this.requiredElements) {
            if (!polymerElements.has(element)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Create a polymer instance at the given position
     */
    instantiate(x, y, catalogue) {
        console.log(`Instantiating polymer: ${this.name} at (${x}, ${y})`);

        // Get molecules needed for this polymer
        const molecules = [];
        const spacing = 80;

        // If we have molecule data from a discovered polymer, use it
        if (this.moleculeData && this.moleculeData.length >= this.minMolecules) {
            for (let i = 0; i < this.minMolecules; i++) {
                const molData = this.moleculeData[i % this.moleculeData.length];
                const offsetX = (i - this.minMolecules / 2) * spacing;

                // Try to instantiate from catalogue
                if (catalogue && catalogue.getMolecule(molData.fingerprint)) {
                    const mol = catalogue.instantiateMolecule(molData.fingerprint, x + offsetX, y);
                    if (mol) molecules.push(mol);
                }
            }
        }

        // If we couldn't get real molecules, create simple molecules based on required elements
        if (molecules.length < this.minMolecules) {
            console.log(`Creating ${this.minMolecules - molecules.length} placeholder molecules`);

            for (let i = molecules.length; i < this.minMolecules; i++) {
                const offsetX = (i - this.minMolecules / 2) * spacing;

                // Create atoms for this molecule
                const atomSpacing = 20;
                const elementsToAdd = this.requiredElements.slice(0, 4); // Max 4 elements
                const atoms = [];

                for (let j = 0; j < elementsToAdd.length; j++) {
                    const element = elementsToAdd[j];
                    const atomX = x + offsetX + (j - elementsToAdd.length / 2) * atomSpacing;
                    const atomY = y + (Math.random() - 0.5) * 10;
                    const atom = new Atom(element, atomX, atomY);
                    atoms.push(atom);
                }

                // Create bonds between adjacent atoms
                for (let j = 0; j < atoms.length - 1; j++) {
                    const atom1 = atoms[j];
                    const atom2 = atoms[j + 1];
                    if (atom1.availableValence > 0 && atom2.availableValence > 0) {
                        new Bond(atom1, atom2);  // Bond constructor links atoms
                    }
                }

                // Only create molecule from atoms that have bonds
                const bondedAtoms = atoms.filter(a => a.bonds.length > 0);
                if (bondedAtoms.length >= 2) {
                    const molecule = new Molecule(bondedAtoms);
                    molecules.push(molecule);
                } else {
                    console.warn(`Polymer instantiation: skipping molecule with ${bondedAtoms.length} bonded atoms`);
                }
            }
        }

        console.log(`Created polymer with ${molecules.length} molecules`);

        // Create polymer from molecules
        const polymer = new Polymer(molecules, this.type, this.name);
        return polymer;
    }

    /**
     * Serialize for storage
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            description: this.description,
            minMolecules: this.minMolecules,
            requiredElements: this.requiredElements,
            elementRatios: this.elementRatios,
            essential: this.essential,
            cellRole: this.cellRole,
            moleculeData: this.moleculeData,
            fingerprint: this.fingerprint,
            discovered: this.discovered,
            discoveredAt: this.discoveredAt
        };
    }

    /**
     * Deserialize from storage
     */
    static deserialize(data) {
        const blueprint = new PolymerBlueprint(data);
        blueprint.moleculeData = data.moleculeData;
        blueprint.fingerprint = data.fingerprint;
        blueprint.discovered = data.discovered;
        blueprint.discoveredAt = data.discoveredAt;
        return blueprint;
    }
}

/**
 * Check if a polymer is useful for cell formation
 */
function isPolymerUseful(polymer) {
    for (const templateKey in CELL_ESSENTIAL_POLYMERS) {
        const template = CELL_ESSENTIAL_POLYMERS[templateKey];
        const blueprint = new PolymerBlueprint(template);
        if (blueprint.matches(polymer)) {
            return {
                useful: true,
                template: templateKey,
                role: template.cellRole,
                essential: template.essential
            };
        }
    }
    return { useful: false, template: null, role: null, essential: false };
}

/**
 * Get all essential polymer templates
 */
function getEssentialPolymerTemplates() {
    return Object.entries(CELL_ESSENTIAL_POLYMERS)
        .filter(([_, t]) => t.essential)
        .map(([key, template]) => new PolymerBlueprint(template));
}

/**
 * Get all polymer templates
 */
function getAllPolymerTemplates() {
    return Object.entries(CELL_ESSENTIAL_POLYMERS)
        .map(([key, template]) => new PolymerBlueprint(template));
}

/**
 * Check if polymers meet cell requirements
 */
function checkCellViability(polymers) {
    const roleCounts = {
        membrane: 0,
        structure: 0,
        genetics: 0,
        metabolism: 0,
        energy: 0,
        transport: 0
    };

    for (const polymer of polymers) {
        const result = isPolymerUseful(polymer);
        if (result.useful && result.role) {
            roleCounts[result.role]++;
        }
    }

    const missing = [];
    for (const [role, req] of Object.entries(CELL_REQUIREMENTS)) {
        if (roleCounts[role] < req.count) {
            missing.push({ role, needed: req.count - roleCounts[role], options: req.polymers });
        }
    }

    return {
        viable: missing.filter(m => CELL_REQUIREMENTS[m.role].count > 0).length === 0,
        roleCounts,
        missing
    };
}

// Make available globally
window.CELL_ESSENTIAL_POLYMERS = CELL_ESSENTIAL_POLYMERS;
window.CELL_REQUIREMENTS = CELL_REQUIREMENTS;
window.PolymerBlueprint = PolymerBlueprint;
window.isPolymerUseful = isPolymerUseful;
window.getEssentialPolymerTemplates = getEssentialPolymerTemplates;
window.getAllPolymerTemplates = getAllPolymerTemplates;
window.checkCellViability = checkCellViability;
