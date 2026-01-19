/**
 * Stable Molecule Registry
 * Defines known stable molecules with their correct geometric configurations.
 * Used to reshape unstable molecules that match these formulas into their
 * natural stable forms.
 */

const STABLE_MOLECULES = {
    'H2': {
        name: 'Hydrogen',
        formula: 'H2',
        atoms: [
            { symbol: 'H', relX: -15, relY: 0 },
            { symbol: 'H', relX: 15, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 }
        ],
        description: 'Diatomic hydrogen - single bond'
    },
    'O2': {
        name: 'Oxygen',
        formula: 'O2',
        atoms: [
            { symbol: 'O', relX: -20, relY: 0 },
            { symbol: 'O', relX: 20, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 }
        ],
        description: 'Diatomic oxygen - double bond'
    },
    'N2': {
        name: 'Nitrogen',
        formula: 'N2',
        atoms: [
            { symbol: 'N', relX: -18, relY: 0 },
            { symbol: 'N', relX: 18, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 3 }
        ],
        description: 'Diatomic nitrogen - triple bond'
    },
    'H2O': {
        name: 'Water',
        formula: 'H2O',
        atoms: [
            { symbol: 'O', relX: 0, relY: 0 },          // Central oxygen
            { symbol: 'H', relX: -24, relY: 19 },       // 104.5° bond angle
            { symbol: 'H', relX: 24, relY: 19 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 }
        ],
        description: 'Water - bent shape, 104.5° bond angle'
    },
    'CO2': {
        name: 'Carbon Dioxide',
        formula: 'CO2',
        atoms: [
            { symbol: 'C', relX: 0, relY: 0 },          // Central carbon
            { symbol: 'O', relX: -35, relY: 0 },        // Linear: 180°
            { symbol: 'O', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },           // Double bond
            { atom1: 0, atom2: 2, order: 2 }            // Double bond
        ],
        description: 'Carbon dioxide - linear, double bonds'
    },
    'CH4': {
        name: 'Methane',
        formula: 'CH4',
        atoms: [
            { symbol: 'C', relX: 0, relY: 0 },          // Central carbon
            { symbol: 'H', relX: 0, relY: -25 },        // Tetrahedral (2D projection)
            { symbol: 'H', relX: 23, relY: 12 },
            { symbol: 'H', relX: -23, relY: 12 },
            { symbol: 'H', relX: 0, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 }
        ],
        description: 'Methane - tetrahedral geometry'
    },
    'NH3': {
        name: 'Ammonia',
        formula: 'NH3',
        atoms: [
            { symbol: 'N', relX: 0, relY: 0 },          // Central nitrogen
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 19, relY: 11 },
            { symbol: 'H', relX: -19, relY: 11 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 }
        ],
        description: 'Ammonia - trigonal pyramidal'
    },
    'HCl': {
        name: 'Hydrogen Chloride',
        formula: 'ClH',
        atoms: [
            { symbol: 'Cl', relX: -17, relY: 0 },
            { symbol: 'H', relX: 17, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 }
        ],
        description: 'Hydrogen chloride - polar covalent'
    },
    'CO': {
        name: 'Carbon Monoxide',
        formula: 'CO',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'O', relX: 15, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 3 }
        ],
        description: 'Carbon monoxide - triple bond'
    },
    'H2S': {
        name: 'Hydrogen Sulfide',
        formula: 'H2S',
        atoms: [
            { symbol: 'S', relX: 0, relY: 0 },          // Central sulfur
            { symbol: 'H', relX: -22, relY: 16 },       // ~92° bond angle
            { symbol: 'H', relX: 22, relY: 16 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 }
        ],
        description: 'Hydrogen sulfide - bent shape'
    },

    // ===== MONOMER MOLECULES (for polymer formation) =====

    'C2H4': {
        name: 'Ethylene',
        formula: 'C2H4',
        isMonomer: true,
        polymerName: 'Polyethylene',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'C', relX: 15, relY: 0 },
            { symbol: 'H', relX: -30, relY: -15 },
            { symbol: 'H', relX: -30, relY: 15 },
            { symbol: 'H', relX: 30, relY: -15 },
            { symbol: 'H', relX: 30, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },  // C=C double bond
            { atom1: 0, atom2: 2, order: 1 },  // C-H
            { atom1: 0, atom2: 3, order: 1 },  // C-H
            { atom1: 1, atom2: 4, order: 1 },  // C-H
            { atom1: 1, atom2: 5, order: 1 }   // C-H
        ],
        description: 'Ethylene - simplest alkene with C=C double bond'
    },
    'C2H5NO2': {
        name: 'Glycine',
        formula: 'C2H5NO2',
        isMonomer: true,
        polymerName: 'Protein',
        atoms: [
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
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // N-C
            { atom1: 1, atom2: 2, order: 1 },  // C-C
            { atom1: 2, atom2: 3, order: 2 },  // C=O
            { atom1: 2, atom2: 4, order: 1 },  // C-O
            { atom1: 0, atom2: 5, order: 1 },  // N-H
            { atom1: 0, atom2: 6, order: 1 },  // N-H
            { atom1: 1, atom2: 7, order: 1 },  // C-H
            { atom1: 1, atom2: 8, order: 1 },  // C-H
            { atom1: 4, atom2: 9, order: 1 }   // O-H
        ],
        description: 'Glycine - simplest amino acid (H2N-CH2-COOH)'
    },
    'C4H8O2': {
        name: 'Butyric Acid (Fatty Acid)',
        formula: 'C4H8O2',
        isMonomer: true,
        polymerName: 'Lipid Chain',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },   // Methyl C
            { symbol: 'C', relX: -15, relY: 0 },   // CH2
            { symbol: 'C', relX: 15, relY: 0 },    // CH2
            { symbol: 'C', relX: 45, relY: 0 },    // Carboxyl C
            { symbol: 'O', relX: 60, relY: -15 },  // C=O
            { symbol: 'O', relX: 60, relY: 15 },   // C-OH
            { symbol: 'H', relX: -55, relY: -12 },
            { symbol: 'H', relX: -55, relY: 12 },
            { symbol: 'H', relX: -55, relY: 0 },   // CH3 H
            { symbol: 'H', relX: -15, relY: -15 },
            { symbol: 'H', relX: -15, relY: 15 },
            { symbol: 'H', relX: 15, relY: -15 },
            { symbol: 'H', relX: 15, relY: 15 },
            { symbol: 'H', relX: 75, relY: 20 }    // OH hydrogen
        ],
        bonds: [
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
        ],
        description: 'Butyric acid - short chain fatty acid (CH3-CH2-CH2-COOH)'
    }
};

/**
 * Get a stable molecule template by formula
 * @param {string} formula - Molecular formula (e.g., 'H2O', 'CO2')
 * @returns {Object|null} Template object or null if not found
 */
function getStableMoleculeTemplate(formula) {
    return STABLE_MOLECULES[formula] || null;
}

/**
 * Check if a molecule's atoms match a known stable template
 * Returns the template if matched, null otherwise
 * @param {Molecule} molecule - The molecule to check
 * @returns {Object|null} Matching template or null
 */
function matchesStableTemplate(molecule) {
    if (!molecule || !molecule.formula) return null;

    const template = STABLE_MOLECULES[molecule.formula];
    if (!template) return null;

    // Verify atom counts match
    const moleculeAtomCounts = {};
    for (const atom of molecule.atoms) {
        moleculeAtomCounts[atom.symbol] = (moleculeAtomCounts[atom.symbol] || 0) + 1;
    }

    const templateAtomCounts = {};
    for (const atomData of template.atoms) {
        templateAtomCounts[atomData.symbol] = (templateAtomCounts[atomData.symbol] || 0) + 1;
    }

    // Check if counts match
    const moleculeSymbols = Object.keys(moleculeAtomCounts).sort();
    const templateSymbols = Object.keys(templateAtomCounts).sort();

    if (moleculeSymbols.length !== templateSymbols.length) return null;

    for (let i = 0; i < moleculeSymbols.length; i++) {
        if (moleculeSymbols[i] !== templateSymbols[i]) return null;
        if (moleculeAtomCounts[moleculeSymbols[i]] !== templateAtomCounts[templateSymbols[i]]) return null;
    }

    return template;
}

/**
 * Calculate the target positions for a molecule's atoms based on a template
 * This maps the molecule's atoms to the template atoms by element type
 * @param {Molecule} molecule - The molecule to reshape
 * @param {Object} template - The stable template
 * @returns {Map<Atom, Vector2>} Map of atom -> target position
 */
function getTargetConfiguration(molecule, template) {
    const center = molecule.centerOfMass;
    const targetPositions = new Map();

    // Group molecule atoms by symbol
    const atomsBySymbol = {};
    for (const atom of molecule.atoms) {
        if (!atomsBySymbol[atom.symbol]) {
            atomsBySymbol[atom.symbol] = [];
        }
        atomsBySymbol[atom.symbol].push(atom);
    }

    // Group template atoms by symbol
    const templateAtomsBySymbol = {};
    for (let i = 0; i < template.atoms.length; i++) {
        const atomData = template.atoms[i];
        if (!templateAtomsBySymbol[atomData.symbol]) {
            templateAtomsBySymbol[atomData.symbol] = [];
        }
        templateAtomsBySymbol[atomData.symbol].push({
            ...atomData,
            index: i
        });
    }

    // Match atoms to template positions
    // For each symbol, assign molecule atoms to template positions
    // Use a simple greedy assignment based on current proximity
    for (const symbol of Object.keys(atomsBySymbol)) {
        const atoms = atomsBySymbol[symbol];
        const templatePositions = templateAtomsBySymbol[symbol];

        if (!templatePositions || atoms.length !== templatePositions.length) {
            continue;
        }

        // For each atom, find the closest available template position
        const usedTemplateIndices = new Set();

        for (const atom of atoms) {
            let bestIndex = -1;
            let bestDistance = Infinity;

            for (let i = 0; i < templatePositions.length; i++) {
                if (usedTemplateIndices.has(i)) continue;

                const tPos = templatePositions[i];
                const targetX = center.x + tPos.relX;
                const targetY = center.y + tPos.relY;
                const dist = atom.position.distanceTo(new Vector2(targetX, targetY));

                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestIndex = i;
                }
            }

            if (bestIndex !== -1) {
                usedTemplateIndices.add(bestIndex);
                const tPos = templatePositions[bestIndex];
                targetPositions.set(atom, new Vector2(
                    center.x + tPos.relX,
                    center.y + tPos.relY
                ));
            }
        }
    }

    return targetPositions;
}

/**
 * Get the target bond configuration for a template
 * Returns an array of { atom1Index, atom2Index, order } objects
 * @param {Object} template - The stable template
 * @returns {Array} Bond configuration array
 */
function getTemplateBonds(template) {
    return template.bonds || [];
}

/**
 * Check if a molecule needs reshaping (has wrong geometry or bond orders)
 * @param {Molecule} molecule - The molecule to check
 * @param {Object} template - The stable template
 * @returns {boolean} True if reshaping is needed
 */
function needsReshaping(molecule, template) {
    if (!molecule || !template) return false;

    // Check if bond orders match template
    const templateBonds = template.bonds;
    const moleculeBonds = molecule.bonds;

    // If bond count doesn't match, definitely needs reshaping
    if (moleculeBonds.length !== templateBonds.length) {
        return true;
    }

    // Check bond orders
    for (const bond of moleculeBonds) {
        // Find matching template bond (by atom symbols)
        const symbols = [bond.atom1.symbol, bond.atom2.symbol].sort();
        let foundMatch = false;

        for (const tBond of templateBonds) {
            const tSymbols = [
                template.atoms[tBond.atom1].symbol,
                template.atoms[tBond.atom2].symbol
            ].sort();

            if (symbols[0] === tSymbols[0] && symbols[1] === tSymbols[1]) {
                if (bond.order !== tBond.order) {
                    return true; // Bond order mismatch
                }
                foundMatch = true;
                break;
            }
        }

        if (!foundMatch) {
            return true; // Bond not found in template
        }
    }

    // Check if atom positions are significantly different from template
    const targetPositions = getTargetConfiguration(molecule, template);
    const threshold = 15; // Pixels - if any atom is more than this far from target

    for (const [atom, targetPos] of targetPositions) {
        const dist = atom.position.distanceTo(targetPos);
        if (dist > threshold) {
            return true;
        }
    }

    return false;
}

// Make available globally
window.STABLE_MOLECULES = STABLE_MOLECULES;
window.getStableMoleculeTemplate = getStableMoleculeTemplate;
window.matchesStableTemplate = matchesStableTemplate;
window.getTargetConfiguration = getTargetConfiguration;
window.getTemplateBonds = getTemplateBonds;
window.needsReshaping = needsReshaping;
