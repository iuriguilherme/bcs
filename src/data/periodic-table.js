/**
 * Periodic Table Data
 * Extensible structure for all chemical elements
 * Currently includes essential elements for biochemistry
 * Can be expanded to full 118 elements without refactoring
 */

const ELEMENTS = {
    // Essential for organic chemistry / life
    H: {
        number: 1,
        symbol: 'H',
        name: 'Hydrogen',
        valence: 1,
        mass: 1.008,
        radius: 25,
        color: '#FFFFFF',
        category: 'nonmetal'
    },
    C: {
        number: 6,
        symbol: 'C',
        name: 'Carbon',
        valence: 4,
        mass: 12.011,
        radius: 35,
        color: '#333333',
        category: 'nonmetal'
    },
    N: {
        number: 7,
        symbol: 'N',
        name: 'Nitrogen',
        valence: 3,
        mass: 14.007,
        radius: 32,
        color: '#3050F8',
        category: 'nonmetal'
    },
    O: {
        number: 8,
        symbol: 'O',
        name: 'Oxygen',
        valence: 2,
        mass: 15.999,
        radius: 30,
        color: '#FF0D0D',
        category: 'nonmetal'
    },
    P: {
        number: 15,
        symbol: 'P',
        name: 'Phosphorus',
        valence: 5,
        mass: 30.974,
        radius: 38,
        color: '#FF8000',
        category: 'nonmetal'
    },
    S: {
        number: 16,
        symbol: 'S',
        name: 'Sulfur',
        valence: 2,  // Can also be 4 or 6, keeping simple
        mass: 32.065,
        radius: 36,
        color: '#FFFF30',
        category: 'nonmetal'
    },

    // Metals important for biology
    Na: {
        number: 11,
        symbol: 'Na',
        name: 'Sodium',
        valence: 1,
        mass: 22.990,
        radius: 40,
        color: '#AB5CF2',
        category: 'alkali-metal'
    },
    K: {
        number: 19,
        symbol: 'K',
        name: 'Potassium',
        valence: 1,
        mass: 39.098,
        radius: 45,
        color: '#8F40D4',
        category: 'alkali-metal'
    },
    Ca: {
        number: 20,
        symbol: 'Ca',
        name: 'Calcium',
        valence: 2,
        mass: 40.078,
        radius: 42,
        color: '#3DFF00',
        category: 'alkaline-earth'
    },
    Fe: {
        number: 26,
        symbol: 'Fe',
        name: 'Iron',
        valence: 2,  // Can also be 3
        mass: 55.845,
        radius: 38,
        color: '#E06633',
        category: 'transition-metal'
    },
    Mg: {
        number: 12,
        symbol: 'Mg',
        name: 'Magnesium',
        valence: 2,
        mass: 24.305,
        radius: 38,
        color: '#8AFF00',
        category: 'alkaline-earth'
    },
    Zn: {
        number: 30,
        symbol: 'Zn',
        name: 'Zinc',
        valence: 2,
        mass: 65.38,
        radius: 37,
        color: '#7D80B0',
        category: 'transition-metal'
    },

    // Halogens
    Cl: {
        number: 17,
        symbol: 'Cl',
        name: 'Chlorine',
        valence: 1,
        mass: 35.453,
        radius: 34,
        color: '#1FF01F',
        category: 'halogen'
    },

    // Noble gases (for future use)
    He: {
        number: 2,
        symbol: 'He',
        name: 'Helium',
        valence: 0,
        mass: 4.003,
        radius: 28,
        color: '#D9FFFF',
        category: 'noble-gas'
    }
};

// Bond energies (simplified, in arbitrary units)
// Higher = stronger bond
const BOND_ENERGIES = {
    'C-C': 83,
    'C=C': 146,
    'C≡C': 200,
    'C-H': 99,
    'C-O': 86,
    'C=O': 177,
    'C-N': 73,
    'C=N': 147,
    'C≡N': 213,
    'O-H': 111,
    'O-O': 35,
    'O=O': 119,
    'N-H': 93,
    'N-N': 39,
    'N=N': 100,
    'N≡N': 226,
    'P-O': 90,
    'S-H': 82,
    'S-S': 54,
    'DEFAULT': 60
};

// Electronegativity values (Pauling scale)
const ELECTRONEGATIVITY = {
    H: 2.20,
    C: 2.55,
    N: 3.04,
    O: 3.44,
    P: 2.19,
    S: 2.58,
    Na: 0.93,
    K: 0.82,
    Ca: 1.00,
    Fe: 1.83,
    Mg: 1.31,
    Zn: 1.65,
    Cl: 3.16,
    He: 0
};

// Common molecules templates (can be expanded)
const MOLECULE_TEMPLATES = {
    water: {
        formula: 'H2O',
        atoms: ['O', 'H', 'H'],
        bonds: [[0, 1], [0, 2]]
    },
    carbonDioxide: {
        formula: 'CO2',
        atoms: ['C', 'O', 'O'],
        bonds: [[0, 1, 2], [0, 2, 2]]  // double bonds
    },
    methane: {
        formula: 'CH4',
        atoms: ['C', 'H', 'H', 'H', 'H'],
        bonds: [[0, 1], [0, 2], [0, 3], [0, 4]]
    },
    ammonia: {
        formula: 'NH3',
        atoms: ['N', 'H', 'H', 'H'],
        bonds: [[0, 1], [0, 2], [0, 3]]
    },
    oxygen: {
        formula: 'O2',
        atoms: ['O', 'O'],
        bonds: [[0, 1, 2]]  // double bond
    }
};

/**
 * Get element data by symbol
 * @param {string} symbol - Element symbol (e.g., 'C', 'H', 'O')
 * @returns {object|null} Element data or null if not found
 */
function getElement(symbol) {
    return ELEMENTS[symbol] || null;
}

/**
 * Get bond energy between two elements
 * @param {string} symbol1 - First element symbol
 * @param {string} symbol2 - Second element symbol
 * @param {number} bondOrder - 1, 2, or 3 for single/double/triple
 * @returns {number} Bond energy
 */
function getBondEnergy(symbol1, symbol2, bondOrder = 1) {
    const bondSymbols = ['', '-', '=', '≡'];
    const key1 = `${symbol1}${bondSymbols[bondOrder]}${symbol2}`;
    const key2 = `${symbol2}${bondSymbols[bondOrder]}${symbol1}`;

    return BOND_ENERGIES[key1] || BOND_ENERGIES[key2] || BOND_ENERGIES.DEFAULT;
}

/**
 * Get all available element symbols
 * @returns {string[]} Array of element symbols
 */
function getAvailableElements() {
    return Object.keys(ELEMENTS);
}

/**
 * Get elements by category
 * @param {string} category - Element category
 * @returns {object[]} Array of elements in that category
 */
function getElementsByCategory(category) {
    return Object.values(ELEMENTS).filter(e => e.category === category);
}

// Make available globally
window.ELEMENTS = ELEMENTS;
window.BOND_ENERGIES = BOND_ENERGIES;
window.ELECTRONEGATIVITY = ELECTRONEGATIVITY;
window.MOLECULE_TEMPLATES = MOLECULE_TEMPLATES;
window.getElement = getElement;
window.getBondEnergy = getBondEnergy;
window.getAvailableElements = getAvailableElements;
window.getElementsByCategory = getElementsByCategory;
