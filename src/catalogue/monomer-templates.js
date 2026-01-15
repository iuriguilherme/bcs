/**
 * Monomer Templates
 * Pre-defined molecules that can polymerize into polymers
 * 
 * A monomer is a stable molecule that can chain with identical copies
 * to form a polymer. This matches real chemistry:
 * - Ethylene (C2H4) → Polyethylene
 * - Glucose (C6H12O6) → Starch/Cellulose
 * - Amino acids → Proteins
 * - Nucleotides → DNA/RNA
 */

// Polymerization types
const PolymerizationType = {
    ADDITION: 'addition',       // Double bond opens, monomers link (e.g., polyethylene)
    CONDENSATION: 'condensation' // Functional groups react, small molecule released (e.g., proteins)
};

/**
 * Monomer Template definitions
 * Each template defines a molecule that can be used to form polymers
 */
const MONOMER_TEMPLATES = {
    // ===== SIMPLE SYNTHETIC POLYMERS =====

    ETHYLENE: {
        id: 'ethylene',
        name: 'Ethylene',
        formula: 'C2H4',
        polymerizationType: PolymerizationType.ADDITION,
        polymerName: 'Polyethylene',
        polymerCategory: 'generic',
        description: 'Simplest alkene, forms polyethylene plastic',
        minMonomersForPolymer: 3,
        // Atom layout for blueprint (relative positions)
        atomLayout: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'C', relX: 15, relY: 0 },
            { symbol: 'H', relX: -30, relY: -15 },
            { symbol: 'H', relX: -30, relY: 15 },
            { symbol: 'H', relX: 30, relY: -15 },
            { symbol: 'H', relX: 30, relY: 15 }
        ],
        // Bond layout (indices into atomLayout)
        bondLayout: [
            { atom1: 0, atom2: 1, order: 2 },  // C=C double bond
            { atom1: 0, atom2: 2, order: 1 },  // C-H
            { atom1: 0, atom2: 3, order: 1 },  // C-H
            { atom1: 1, atom2: 4, order: 1 },  // C-H
            { atom1: 1, atom2: 5, order: 1 }   // C-H
        ]
    },

    // ===== BIOLOGICAL MONOMERS - CARBOHYDRATES =====

    GLUCOSE: {
        id: 'glucose',
        name: 'Glucose',
        formula: 'C6H12O6',
        polymerizationType: PolymerizationType.CONDENSATION,
        polymerName: 'Polysaccharide',
        polymerCategory: 'carbohydrate',
        description: 'Sugar monomer, forms starch and cellulose',
        minMonomersForPolymer: 2,
        condensationByproduct: 'H2O',
        cellRole: 'energy',
        // Simplified ring structure
        atomLayout: [
            // Ring carbons
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'C', relX: 20, relY: -10 },
            { symbol: 'C', relX: 40, relY: 0 },
            { symbol: 'C', relX: 40, relY: 20 },
            { symbol: 'C', relX: 20, relY: 30 },
            { symbol: 'O', relX: 0, relY: 20 },  // Ring oxygen
            // CH2OH group
            { symbol: 'C', relX: -20, relY: -10 },
            { symbol: 'O', relX: -35, relY: -20 },
            { symbol: 'H', relX: -45, relY: -30 },
            // OH groups (simplified)
            { symbol: 'O', relX: 20, relY: -25 },
            { symbol: 'O', relX: 55, relY: 0 },
            { symbol: 'O', relX: 55, relY: 20 },
            // Hydrogens
            { symbol: 'H', relX: 25, relY: -35 },
            { symbol: 'H', relX: 65, relY: 0 },
            { symbol: 'H', relX: 65, relY: 20 },
            { symbol: 'H', relX: -25, relY: 0 },
            { symbol: 'H', relX: 25, relY: 40 },
            { symbol: 'H', relX: -10, relY: -20 }
        ],
        bondLayout: [
            // Ring bonds
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 1 },
            { atom1: 5, atom2: 0, order: 1 },
            // CH2OH
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 6, atom2: 7, order: 1 },
            { atom1: 7, atom2: 8, order: 1 },
            // OH groups
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 },
            // H bonds
            { atom1: 9, atom2: 12, order: 1 },
            { atom1: 10, atom2: 13, order: 1 },
            { atom1: 11, atom2: 14, order: 1 },
            { atom1: 6, atom2: 15, order: 1 },
            { atom1: 4, atom2: 16, order: 1 },
            { atom1: 6, atom2: 17, order: 1 }
        ]
    },

    // ===== BIOLOGICAL MONOMERS - AMINO ACIDS =====

    GLYCINE: {
        id: 'glycine',
        name: 'Glycine',
        formula: 'C2H5NO2',
        polymerizationType: PolymerizationType.CONDENSATION,
        polymerName: 'Protein',
        polymerCategory: 'protein',
        description: 'Simplest amino acid, forms proteins via peptide bonds',
        minMonomersForPolymer: 2,
        condensationByproduct: 'H2O',
        cellRole: 'structure',
        // H2N-CH2-COOH structure
        atomLayout: [
            { symbol: 'N', relX: -30, relY: 0 },    // Amino nitrogen
            { symbol: 'C', relX: 0, relY: 0 },      // Alpha carbon
            { symbol: 'C', relX: 30, relY: 0 },     // Carboxyl carbon
            { symbol: 'O', relX: 45, relY: -15 },   // Carboxyl O (double bond)
            { symbol: 'O', relX: 45, relY: 15 },    // Carboxyl OH
            { symbol: 'H', relX: -45, relY: -10 },  // NH2 hydrogen
            { symbol: 'H', relX: -45, relY: 10 },   // NH2 hydrogen
            { symbol: 'H', relX: 0, relY: -20 },    // CH2 hydrogen
            { symbol: 'H', relX: 0, relY: 20 },     // CH2 hydrogen
            { symbol: 'H', relX: 60, relY: 20 }     // OH hydrogen
        ],
        bondLayout: [
            { atom1: 0, atom2: 1, order: 1 },  // N-C
            { atom1: 1, atom2: 2, order: 1 },  // C-C
            { atom1: 2, atom2: 3, order: 2 },  // C=O
            { atom1: 2, atom2: 4, order: 1 },  // C-O
            { atom1: 0, atom2: 5, order: 1 },  // N-H
            { atom1: 0, atom2: 6, order: 1 },  // N-H
            { atom1: 1, atom2: 7, order: 1 },  // C-H
            { atom1: 1, atom2: 8, order: 1 },  // C-H
            { atom1: 4, atom2: 9, order: 1 }   // O-H
        ]
    },

    // ===== BIOLOGICAL MONOMERS - NUCLEOTIDES =====

    ADENINE_NUCLEOTIDE: {
        id: 'adenine_nucleotide',
        name: 'Adenine Nucleotide',
        formula: 'C10H14N5O6P',  // Simplified AMP
        polymerizationType: PolymerizationType.CONDENSATION,
        polymerName: 'Nucleic Acid',
        polymerCategory: 'nucleic_acid',
        description: 'DNA/RNA building block with adenine base',
        minMonomersForPolymer: 2,
        condensationByproduct: 'H2O',
        cellRole: 'genetics',
        // Simplified structure (base + sugar + phosphate)
        atomLayout: [
            // Phosphate group
            { symbol: 'P', relX: -40, relY: 0 },
            { symbol: 'O', relX: -55, relY: -15 },
            { symbol: 'O', relX: -55, relY: 15 },
            { symbol: 'O', relX: -40, relY: -25 },
            { symbol: 'O', relX: -25, relY: 0 },
            // Ribose sugar (simplified)
            { symbol: 'C', relX: -5, relY: 0 },
            { symbol: 'C', relX: 10, relY: -15 },
            { symbol: 'C', relX: 25, relY: -5 },
            { symbol: 'O', relX: 15, relY: 10 },
            // Adenine base (simplified)
            { symbol: 'N', relX: 40, relY: -10 },
            { symbol: 'C', relX: 55, relY: -20 },
            { symbol: 'N', relX: 70, relY: -10 },
            { symbol: 'C', relX: 70, relY: 10 },
            { symbol: 'C', relX: 55, relY: 20 },
            { symbol: 'N', relX: 40, relY: 10 },
            // Hydrogens (representative)
            { symbol: 'H', relX: -60, relY: -25 },
            { symbol: 'H', relX: -60, relY: 25 },
            { symbol: 'H', relX: 55, relY: -35 },
            { symbol: 'H', relX: 85, relY: -15 },
            { symbol: 'H', relX: 55, relY: 35 }
        ],
        bondLayout: [
            // Phosphate
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            // Phosphate to sugar
            { atom1: 4, atom2: 5, order: 1 },
            // Sugar ring
            { atom1: 5, atom2: 6, order: 1 },
            { atom1: 6, atom2: 7, order: 1 },
            { atom1: 7, atom2: 8, order: 1 },
            { atom1: 8, atom2: 5, order: 1 },
            // Sugar to base
            { atom1: 7, atom2: 9, order: 1 },
            // Adenine base
            { atom1: 9, atom2: 10, order: 1 },
            { atom1: 10, atom2: 11, order: 2 },
            { atom1: 11, atom2: 12, order: 1 },
            { atom1: 12, atom2: 13, order: 2 },
            { atom1: 13, atom2: 14, order: 1 },
            { atom1: 14, atom2: 9, order: 1 },
            // Hydrogens
            { atom1: 1, atom2: 15, order: 1 },
            { atom1: 2, atom2: 16, order: 1 },
            { atom1: 10, atom2: 17, order: 1 },
            { atom1: 11, atom2: 18, order: 1 },
            { atom1: 13, atom2: 19, order: 1 }
        ]
    },

    // ===== BIOLOGICAL MONOMERS - LIPIDS =====

    FATTY_ACID: {
        id: 'fatty_acid',
        name: 'Fatty Acid',
        formula: 'C4H8O2',  // Butyric acid (simplified)
        polymerizationType: PolymerizationType.CONDENSATION,
        polymerName: 'Lipid Chain',
        polymerCategory: 'lipid',
        description: 'Short-chain fatty acid, forms lipid membranes',
        minMonomersForPolymer: 2,
        condensationByproduct: 'H2O',
        cellRole: 'membrane',
        // CH3-CH2-CH2-COOH structure
        atomLayout: [
            { symbol: 'C', relX: -45, relY: 0 },   // Methyl C
            { symbol: 'C', relX: -15, relY: 0 },   // CH2
            { symbol: 'C', relX: 15, relY: 0 },    // CH2
            { symbol: 'C', relX: 45, relY: 0 },    // Carboxyl C
            { symbol: 'O', relX: 60, relY: -15 },  // C=O
            { symbol: 'O', relX: 60, relY: 15 },   // C-OH
            { symbol: 'H', relX: -55, relY: -12 },
            { symbol: 'H', relX: -55, relY: 12 },
            { symbol: 'H', relX: -55, relY: 0 },   // Extra H for CH3
            { symbol: 'H', relX: -15, relY: -15 },
            { symbol: 'H', relX: -15, relY: 15 },
            { symbol: 'H', relX: 15, relY: -15 },
            { symbol: 'H', relX: 15, relY: 15 },
            { symbol: 'H', relX: 75, relY: 20 }    // OH hydrogen
        ],
        bondLayout: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 2 },
            { atom1: 3, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 0, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 1, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 2, atom2: 12, order: 1 },
            { atom1: 5, atom2: 13, order: 1 }
        ]
    }
};

/**
 * Get a monomer template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Monomer template
 */
function getMonomerTemplate(id) {
    return MONOMER_TEMPLATES[id.toUpperCase()] || null;
}

/**
 * Get all monomer templates
 * @returns {Object[]} Array of all templates
 */
function getAllMonomerTemplates() {
    return Object.values(MONOMER_TEMPLATES);
}

/**
 * Get monomer templates by polymer category
 * @param {string} category - Polymer category (protein, carbohydrate, etc.)
 * @returns {Object[]} Matching templates
 */
function getMonomersByCategory(category) {
    return Object.values(MONOMER_TEMPLATES).filter(t =>
        t.polymerCategory === category
    );
}

/**
 * Find a monomer template that matches a molecule's formula
 * @param {string} formula - Molecule formula
 * @returns {Object|null} Matching template or null
 */
function findMonomerByFormula(formula) {
    return Object.values(MONOMER_TEMPLATES).find(t =>
        t.formula === formula
    ) || null;
}

/**
 * Check if a formula matches any known monomer
 * @param {string} formula - Molecule formula
 * @returns {boolean}
 */
function isKnownMonomer(formula) {
    return findMonomerByFormula(formula) !== null;
}

// Make available globally
window.PolymerizationType = PolymerizationType;
window.MONOMER_TEMPLATES = MONOMER_TEMPLATES;
window.getMonomerTemplate = getMonomerTemplate;
window.getAllMonomerTemplates = getAllMonomerTemplates;
window.getMonomersByCategory = getMonomersByCategory;
window.findMonomerByFormula = findMonomerByFormula;
window.isKnownMonomer = isKnownMonomer;
