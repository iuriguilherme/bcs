/**
 * Polymer Blueprints
 * Pre-defined templates for cell-essential polymers
 * Now linked to specific monomer templates from monomer-templates.js
 */

// Essential polymer templates for cell formation
// NEW: Each polymer now references a specific monomer template
const CELL_ESSENTIAL_POLYMERS = {
    // Membrane Components (Lipids)
    // Monomer: Fatty Acid (C4H8O2) → Lipid Chain
    PHOSPHOLIPID: {
        id: 'phospholipid',
        name: 'Phospholipid Bilayer',
        type: 'lipid',
        description: 'Forms the cell membrane bilayer from fatty acid monomers',
        monomerId: 'FATTY_ACID',        // Reference to MONOMER_TEMPLATES
        minMonomers: 3,                  // Renamed from minMolecules
        essential: true,
        cellRole: 'membrane'
    },
    FATTY_ACID_CHAIN: {
        id: 'fatty_acid_chain',
        name: 'Fatty Acid Chain',
        type: 'lipid',
        description: 'Chain of fatty acid monomers for energy storage',
        monomerId: 'FATTY_ACID',
        minMonomers: 2,
        essential: false,
        cellRole: 'membrane'
    },

    // Structural Components (Proteins)
    // Monomer: Glycine (C2H5NO2) → Protein
    STRUCTURAL_PROTEIN: {
        id: 'structural_protein',
        name: 'Structural Protein',
        type: 'protein',
        description: 'Provides cell structure from glycine amino acid monomers',
        monomerId: 'GLYCINE',
        minMonomers: 4,
        essential: true,
        cellRole: 'structure'
    },
    ENZYME: {
        id: 'enzyme',
        name: 'Enzyme',
        type: 'protein',
        description: 'Catalyzes chemical reactions',
        monomerId: 'GLYCINE',
        minMonomers: 3,
        essential: false,
        cellRole: 'metabolism'
    },
    TRANSPORT_PROTEIN: {
        id: 'transport_protein',
        name: 'Transport Protein',
        type: 'protein',
        description: 'Moves molecules across membrane',
        monomerId: 'GLYCINE',
        minMonomers: 3,
        essential: false,
        cellRole: 'transport'
    },

    // Genetic Material (Nucleic Acids)
    // Monomer: Adenine Nucleotide → DNA/RNA
    DNA_STRAND: {
        id: 'dna_strand',
        name: 'DNA Strand',
        type: 'nucleic_acid',
        description: 'Stores genetic information from nucleotide monomers',
        monomerId: 'ADENINE_NUCLEOTIDE',
        minMonomers: 4,
        essential: true,
        cellRole: 'genetics'
    },
    RNA_STRAND: {
        id: 'rna_strand',
        name: 'RNA Strand',
        type: 'nucleic_acid',
        description: 'Carries genetic messages for protein synthesis',
        monomerId: 'ADENINE_NUCLEOTIDE',
        minMonomers: 3,
        essential: false,
        cellRole: 'genetics'
    },

    // Energy Storage (Carbohydrates)
    // Monomer: Glucose (C6H12O6) → Polysaccharide
    GLYCOGEN: {
        id: 'glycogen',
        name: 'Glycogen',
        type: 'carbohydrate',
        description: 'Energy storage from glucose monomers',
        monomerId: 'GLUCOSE',
        minMonomers: 3,
        essential: false,
        cellRole: 'energy'
    },
    CELLULOSE: {
        id: 'cellulose',
        name: 'Cellulose',
        type: 'carbohydrate',
        description: 'Structural carbohydrate (cell wall) from glucose monomers',
        monomerId: 'GLUCOSE',
        minMonomers: 4,
        essential: false,
        cellRole: 'structure'
    },

    // ===== SIMPLE PROOF-OF-CONCEPT POLYMER =====
    POLYETHYLENE: {
        id: 'polyethylene',
        name: 'Polyethylene',
        type: 'generic',
        description: 'Simple plastic polymer from ethylene monomers',
        monomerId: 'ETHYLENE',
        minMonomers: 3,
        essential: false,
        cellRole: null
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
 * PolymerBlueprint - Template for creating polymers from monomers
 * NEW: Now references monomer templates instead of element ratios
 */
class PolymerBlueprint {
    constructor(template) {
        this.id = template.id;
        this.name = template.name;
        this.type = template.type;
        this.description = template.description;
        this.essential = template.essential || false;
        this.cellRole = template.cellRole;

        // NEW: Monomer-based properties
        this.monomerId = template.monomerId;              // Reference to MONOMER_TEMPLATES key
        this.minMonomers = template.minMonomers || template.minMolecules || 2;

        // Resolve the actual monomer template
        this.monomerTemplate = null;
        if (typeof getMonomerTemplate === 'function' && this.monomerId) {
            this.monomerTemplate = getMonomerTemplate(this.monomerId);
        }

        // Legacy support - generate requiredElements from monomer if not provided
        if (template.requiredElements) {
            this.requiredElements = template.requiredElements;
        } else if (this.monomerTemplate?.atomLayout) {
            const elements = new Set(this.monomerTemplate.atomLayout.map(a => a.symbol));
            this.requiredElements = Array.from(elements);
        } else {
            this.requiredElements = [];
        }

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
        return JSON.stringify({
            type: this.type,
            monomerId: this.monomerId,
            minMonomers: this.minMonomers
        });
    }

    /**
     * Check if a polymer matches this blueprint
     * NEW: Validates that all monomers match the expected formula
     */
    matches(polymer) {
        if (!polymer || !polymer.monomers || polymer.monomers.length < this.minMonomers) {
            return false;
        }

        // Check type
        if (polymer.type !== this.type) {
            return false;
        }

        // NEW: Check that all monomers match our template formula
        if (this.monomerTemplate) {
            const expectedFormula = this.monomerTemplate.formula;
            for (const monomer of polymer.monomers) {
                if (monomer.formula !== expectedFormula) {
                    return false;
                }
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
