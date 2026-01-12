/**
 * Core Utilities
 * Helper functions used throughout the simulation
 */

const Utils = {
    /**
     * Generate a unique ID
     */
    generateId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Calculate distance between two points
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Calculate distance squared (faster, no sqrt)
     */
    distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    /**
     * Clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Random number in range
     */
    random(min, max) {
        return min + Math.random() * (max - min);
    },

    /**
     * Random integer in range (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },

    /**
     * Pick random element from array
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Shuffle array in place
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    /**
     * Convert HSL to RGB hex color
     */
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    },

    /**
     * Normalize a 2D vector
     */
    normalize(x, y) {
        const len = Math.sqrt(x * x + y * y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: x / len, y: y / len };
    },

    /**
     * Calculate angle between two points
     */
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * Deep clone an object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Debounce a function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

// Vector2 class for physics calculations
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    mul(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    div(scalar) {
        if (scalar === 0) return new Vector2(0, 0);
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len === 0) return new Vector2(0, 0);
        return this.div(len);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    distanceTo(v) {
        return this.sub(v).length();
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    static fromAngle(angle, length = 1) {
        return new Vector2(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    static random(minX, maxX, minY, maxY) {
        return new Vector2(
            Utils.random(minX, maxX),
            Utils.random(minY, maxY)
        );
    }
}

// Make available globally
window.Utils = Utils;
window.Vector2 = Vector2;

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
    'Câ‰¡C': 200,
    'C-H': 99,
    'C-O': 86,
    'C=O': 177,
    'C-N': 73,
    'C=N': 147,
    'Câ‰¡N': 213,
    'O-H': 111,
    'O-O': 35,
    'O=O': 119,
    'N-H': 93,
    'N-N': 39,
    'N=N': 100,
    'Nâ‰¡N': 226,
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
    const bondSymbols = ['', '-', '=', 'â‰¡'];
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

/**
 * Atom Entity
 * The fundamental building block of the simulation
 */

class Atom {
    /**
     * Create a new atom
     * @param {string} symbol - Element symbol (e.g., 'C', 'H', 'O')
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    constructor(symbol, x, y) {
        this.id = Utils.generateId();
        this.symbol = symbol;
        this.element = getElement(symbol);

        if (!this.element) {
            throw new Error(`Unknown element: ${symbol}`);
        }

        // Position and physics
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);

        // Bonding
        this.bonds = [];  // Array of Bond objects
        this.maxBonds = this.element.valence;

        // State
        this.selected = false;
        this.highlighted = false;
        this.moleculeId = null;  // Reference to parent molecule if bonded

        // Physics properties
        this.mass = this.element.mass;
        this.radius = this.element.radius * 0.5;  // Visual radius scaled down
        this.charge = 0;  // Net charge (for ions)
    }

    /**
     * Get the number of current bonds (counting bond order)
     */
    get bondCount() {
        return this.bonds.reduce((sum, bond) => sum + bond.order, 0);
    }

    /**
     * Get available valence (how many more bonds can form)
     */
    get availableValence() {
        return Math.max(0, this.maxBonds - this.bondCount);
    }

    /**
     * Check if this atom can bond with another
     * @param {Atom} other - The other atom
     * @param {number} order - Bond order (1, 2, or 3)
     */
    canBondWith(other, order = 1) {
        if (this === other) return false;
        if (this.availableValence < order) return false;
        if (other.availableValence < order) return false;

        // Check if already bonded
        if (this.isBondedTo(other)) return false;

        return true;
    }

    /**
     * Check if already bonded to another atom
     * @param {Atom} other - The other atom
     */
    isBondedTo(other) {
        return this.bonds.some(bond =>
            bond.atom1 === other || bond.atom2 === other
        );
    }

    /**
     * Get the bond with another atom
     * @param {Atom} other - The other atom
     * @returns {Bond|null}
     */
    getBondWith(other) {
        return this.bonds.find(bond =>
            bond.atom1 === other || bond.atom2 === other
        ) || null;
    }

    /**
     * Add a bond to this atom
     * @param {Bond} bond - The bond to add
     */
    addBond(bond) {
        if (!this.bonds.includes(bond)) {
            this.bonds.push(bond);
        }
    }

    /**
     * Remove a bond from this atom
     * @param {Bond} bond - The bond to remove
     */
    removeBond(bond) {
        const index = this.bonds.indexOf(bond);
        if (index !== -1) {
            this.bonds.splice(index, 1);
        }
    }

    /**
     * Get all atoms bonded to this one
     * @returns {Atom[]}
     */
    getBondedAtoms() {
        return this.bonds.map(bond =>
            bond.atom1 === this ? bond.atom2 : bond.atom1
        );
    }

    /**
     * Apply a force to this atom
     * @param {Vector2} force - Force vector
     */
    applyForce(force) {
        // F = ma, so a = F/m
        const a = force.div(this.mass);
        this.acceleration = this.acceleration.add(a);
    }

    /**
     * Update physics
     * @param {number} dt - Delta time
     */
    update(dt) {
        // Verlet-style integration
        this.velocity = this.velocity.add(this.acceleration.mul(dt));

        // Apply damping (friction)
        this.velocity = this.velocity.mul(0.99);

        // Update position
        this.position = this.position.add(this.velocity.mul(dt));

        // Reset acceleration
        this.acceleration = new Vector2(0, 0);
    }

    /**
     * Render the atom
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} scale - Zoom scale
     * @param {Vector2} offset - Camera offset
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        // Draw atom circle
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);

        // Gradient fill
        const gradient = ctx.createRadialGradient(
            screenX - screenRadius * 0.3,
            screenY - screenRadius * 0.3,
            0,
            screenX,
            screenY,
            screenRadius
        );
        gradient.addColorStop(0, this.lightenColor(this.element.color, 40));
        gradient.addColorStop(1, this.element.color);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Border
        if (this.selected) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
        } else if (this.highlighted) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();

        // Draw symbol
        if (screenRadius > 10) {
            ctx.fillStyle = this.getContrastColor(this.element.color);
            ctx.font = `bold ${Math.max(10, screenRadius * 0.7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.symbol, screenX, screenY);
        }
    }

    /**
     * Lighten a hex color
     */
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
    }

    /**
     * Get contrasting text color (black or white)
     */
    getContrastColor(hex) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }

    /**
     * Check if a point is inside this atom
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} scale - Current zoom scale
     * @param {Vector2} offset - Camera offset
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        const dx = x - screenX;
        const dy = y - screenY;
        return (dx * dx + dy * dy) <= (screenRadius * screenRadius);
    }

    /**
     * Serialize atom to plain object
     */
    serialize() {
        return {
            id: this.id,
            symbol: this.symbol,
            x: this.position.x,
            y: this.position.y,
            vx: this.velocity.x,
            vy: this.velocity.y,
            charge: this.charge,
            moleculeId: this.moleculeId
        };
    }

    /**
     * Create atom from serialized data
     */
    static deserialize(data) {
        const atom = new Atom(data.symbol, data.x, data.y);
        atom.id = data.id;
        atom.velocity = new Vector2(data.vx, data.vy);
        atom.charge = data.charge || 0;
        atom.moleculeId = data.moleculeId;
        return atom;
    }
}

// Make available globally
window.Atom = Atom;

/**
 * Bond Entity
 * Represents a chemical bond between two atoms
 */

class Bond {
    /**
     * Create a new bond
     * @param {Atom} atom1 - First atom
     * @param {Atom} atom2 - Second atom
     * @param {number} order - Bond order (1=single, 2=double, 3=triple)
     */
    constructor(atom1, atom2, order = 1) {
        this.id = Utils.generateId();
        this.atom1 = atom1;
        this.atom2 = atom2;
        this.order = Utils.clamp(order, 1, 3);

        // Visual properties
        this.highlighted = false;
        this.selected = false;

        // Physics
        this.restLength = this.calculateRestLength();
        this.strength = this.calculateStrength();

        // Register bond with atoms
        atom1.addBond(this);
        atom2.addBond(this);
    }

    /**
     * Calculate the rest length based on atomic radii
     */
    calculateRestLength() {
        const r1 = this.atom1.element.radius * 0.5;
        const r2 = this.atom2.element.radius * 0.5;
        // Shorter for higher bond orders
        const orderFactor = 1 - (this.order - 1) * 0.1;
        return (r1 + r2) * 1.5 * orderFactor;
    }

    /**
     * Calculate bond strength based on elements
     */
    calculateStrength() {
        return getBondEnergy(this.atom1.symbol, this.atom2.symbol, this.order);
    }

    /**
     * Get the current length of the bond
     */
    get length() {
        return this.atom1.position.distanceTo(this.atom2.position);
    }

    /**
     * Get the strain on the bond (how stretched/compressed)
     */
    get strain() {
        return Math.abs(this.length - this.restLength) / this.restLength;
    }

    /**
     * Check if bond should break based on strain
     */
    shouldBreak() {
        // Higher order bonds are stronger
        const maxStrain = 0.5 + this.order * 0.2;
        return this.strain > maxStrain;
    }

    /**
     * Apply spring forces to maintain bond length
     * @param {number} stiffness - Spring stiffness
     */
    applySpringForce(stiffness = 0.5) {
        const delta = this.atom2.position.sub(this.atom1.position);
        const distance = delta.length();

        if (distance === 0) return;

        // Spring force: F = -k * (x - rest)
        const displacement = distance - this.restLength;
        const forceMagnitude = stiffness * displacement * this.order;

        const direction = delta.normalize();
        const force = direction.mul(forceMagnitude);

        this.atom1.applyForce(force);
        this.atom2.applyForce(force.mul(-1));
    }

    /**
     * Break this bond
     */
    break() {
        this.atom1.removeBond(this);
        this.atom2.removeBond(this);
    }

    /**
     * Get the other atom in the bond
     * @param {Atom} atom - One of the bonded atoms
     * @returns {Atom} The other atom
     */
    getOther(atom) {
        return atom === this.atom1 ? this.atom2 : this.atom1;
    }

    /**
     * Get midpoint of the bond
     */
    getMidpoint() {
        return this.atom1.position.add(this.atom2.position).div(2);
    }

    /**
     * Render the bond
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} scale - Zoom scale
     * @param {Vector2} offset - Camera offset
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }) {
        const x1 = (this.atom1.position.x + offset.x) * scale;
        const y1 = (this.atom1.position.y + offset.y) * scale;
        const x2 = (this.atom2.position.x + offset.x) * scale;
        const y2 = (this.atom2.position.y + offset.y) * scale;

        // Calculate perpendicular direction for multiple lines
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length;
        const perpY = dx / length;

        // Line spacing for multiple bonds
        const spacing = 4 * scale;

        // Set style
        if (this.selected) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
        } else if (this.highlighted) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 3;
        } else {
            // Color based on strain
            const strainColor = this.strain > 0.3
                ? `rgba(255, ${Math.floor(255 * (1 - this.strain))}, 0, 0.8)`
                : 'rgba(255, 255, 255, 0.6)';
            ctx.strokeStyle = strainColor;
            ctx.lineWidth = 2;
        }

        // Draw bond lines based on order
        if (this.order === 1) {
            // Single bond
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        } else if (this.order === 2) {
            // Double bond
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * spacing, y1 + perpY * spacing);
            ctx.lineTo(x2 + perpX * spacing, y2 + perpY * spacing);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1 - perpX * spacing, y1 - perpY * spacing);
            ctx.lineTo(x2 - perpX * spacing, y2 - perpY * spacing);
            ctx.stroke();
        } else if (this.order === 3) {
            // Triple bond
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1 + perpX * spacing * 1.5, y1 + perpY * spacing * 1.5);
            ctx.lineTo(x2 + perpX * spacing * 1.5, y2 + perpY * spacing * 1.5);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1 - perpX * spacing * 1.5, y1 - perpY * spacing * 1.5);
            ctx.lineTo(x2 - perpX * spacing * 1.5, y2 - perpY * spacing * 1.5);
            ctx.stroke();
        }
    }

    /**
     * Check if a point is near this bond
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} threshold - Distance threshold
     * @param {number} scale - Current zoom scale
     * @param {Vector2} offset - Camera offset
     */
    containsPoint(x, y, threshold = 5, scale = 1, offset = { x: 0, y: 0 }) {
        const x1 = (this.atom1.position.x + offset.x) * scale;
        const y1 = (this.atom1.position.y + offset.y) * scale;
        const x2 = (this.atom2.position.x + offset.x) * scale;
        const y2 = (this.atom2.position.y + offset.y) * scale;

        // Point to line segment distance
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= threshold;
    }

    /**
     * Serialize bond to plain object
     */
    serialize() {
        return {
            id: this.id,
            atom1Id: this.atom1.id,
            atom2Id: this.atom2.id,
            order: this.order
        };
    }

    /**
     * Create bond from serialized data
     * @param {object} data - Serialized bond data
     * @param {Map} atomMap - Map of atom IDs to Atom objects
     */
    static deserialize(data, atomMap) {
        const atom1 = atomMap.get(data.atom1Id);
        const atom2 = atomMap.get(data.atom2Id);

        if (!atom1 || !atom2) {
            throw new Error('Cannot deserialize bond: atoms not found');
        }

        const bond = new Bond(atom1, atom2, data.order);
        bond.id = data.id;
        return bond;
    }
}

/**
 * Try to form a bond between two atoms
 * @param {Atom} atom1 - First atom
 * @param {Atom} atom2 - Second atom
 * @param {number} order - Desired bond order
 * @returns {Bond|null} The created bond or null if not possible
 */
function tryFormBond(atom1, atom2, order = 1) {
    if (!atom1.canBondWith(atom2, order)) {
        return null;
    }

    return new Bond(atom1, atom2, order);
}

// Make available globally
window.Bond = Bond;
window.tryFormBond = tryFormBond;

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
     * Check if molecule can participate in polymer formation
     * Molecules with 3+ atoms that are at least 50% stable can polymerize
     */
    canPolymerize() {
        if (this.atoms.length < 3) return false;

        // Calculate stability ratio
        let totalValence = 0;
        let usedValence = 0;
        for (const atom of this.atoms) {
            totalValence += atom.maxValence || 4;
            usedValence += (atom.maxValence || 4) - (atom.availableValence || 0);
        }

        const stabilityRatio = usedValence / totalValence;
        return stabilityRatio >= 0.5; // At least 50% of bonds are satisfied
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

/**
 * Polymer / Biomolecule
 * Chains of molecules with functional properties
 * Level 3 in the abstraction hierarchy
 * 
 * Polymer Types:
 * - LIPID: Fatty acid chains (membranes)
 * - CARBOHYDRATE: Sugar chains (energy)
 * - PROTEIN: Amino acid chains (structure/enzymes)
 * - NUCLEIC_ACID: Nucleotide chains (DNA/RNA)
 */

// Polymer type constants
const PolymerType = {
    GENERIC: 'generic',
    LIPID: 'lipid',
    CARBOHYDRATE: 'carbohydrate',
    PROTEIN: 'protein',
    NUCLEIC_ACID: 'nucleic_acid'
};

// Type colors for visualization
const PolymerColors = {
    generic: { primary: '#8b5cf6', secondary: '#a78bfa' },     // Purple
    lipid: { primary: '#eab308', secondary: '#fde047' },       // Yellow/Gold
    carbohydrate: { primary: '#22c55e', secondary: '#86efac' }, // Green
    protein: { primary: '#3b82f6', secondary: '#93c5fd' },     // Blue
    nucleic_acid: { primary: '#ef4444', secondary: '#fca5a5' }  // Red
};

// Type labels for display
const PolymerLabels = {
    generic: 'Polymer',
    lipid: 'Lipid',
    carbohydrate: 'Carbohydrate',
    protein: 'Protein',
    nucleic_acid: 'Nucleic Acid'
};

class Polymer {
    /**
     * Create a polymer from molecules
     * @param {Molecule[]} molecules - Array of molecules forming the chain
     * @param {string} type - Polymer type (from PolymerType)
     * @param {string} name - Optional name for this polymer
     */
    constructor(molecules = [], type = null, name = null) {
        this.id = Utils.generateId();
        this.molecules = molecules;
        this.name = name;

        // Auto-detect type if not specified
        this.type = type || this._detectType();

        // Link molecules to this polymer
        for (const mol of molecules) {
            mol.proteinId = this.id;  // Using proteinId for backward compatibility
        }

        // Polymer properties
        this.activeSites = [];  // Functional regions
        this.folded = false;
        this.foldPattern = null;  // 2D shape after folding

        // Selection state
        this.selected = false;
        this.highlighted = false;

        // Calculate derived properties
        this._updateProperties();
    }

    /**
     * Detect polymer type based on molecule composition
     */
    _detectType() {
        if (this.molecules.length === 0) return PolymerType.GENERIC;

        // Count elements across all molecules
        const elementCounts = { C: 0, H: 0, O: 0, N: 0, P: 0, S: 0 };
        let totalAtoms = 0;

        for (const mol of this.molecules) {
            for (const atom of mol.atoms) {
                const symbol = atom.symbol;
                if (elementCounts[symbol] !== undefined) {
                    elementCounts[symbol]++;
                }
                totalAtoms++;
            }
        }

        // Calculate ratios
        const C = elementCounts.C || 0;
        const H = elementCounts.H || 0;
        const O = elementCounts.O || 0;
        const N = elementCounts.N || 0;
        const P = elementCounts.P || 0;

        // Classification heuristics

        // Nucleic Acid: Has phosphorus and nitrogen (DNA/RNA backbone)
        if (P > 0 && N > 0) {
            return PolymerType.NUCLEIC_ACID;
        }

        // Protein/Amino Acid: Has nitrogen but no phosphorus
        if (N > 0 && P === 0) {
            return PolymerType.PROTEIN;
        }

        // Carbohydrate: C:H:O ratio approximately 1:2:1
        if (C > 0 && H > 0 && O > 0 && N === 0 && P === 0) {
            const hToC = H / C;
            const oToC = O / C;
            if (hToC >= 1.5 && hToC <= 2.5 && oToC >= 0.5 && oToC <= 1.5) {
                return PolymerType.CARBOHYDRATE;
            }
        }

        // Lipid: High C:H ratio, low O, no N (fatty acids)
        if (C > 0 && H > 0 && N === 0 && P === 0) {
            const hToC = H / C;
            const oToC = O / (C || 1);
            if (hToC >= 1.8 && oToC < 0.5) {
                return PolymerType.LIPID;
            }
        }

        return PolymerType.GENERIC;
    }

    /**
     * Update derived properties
     */
    _updateProperties() {
        // Calculate total mass
        this.mass = this.molecules.reduce((sum, mol) => sum + mol.mass, 0);

        // Generate sequence (chain of molecule formulas)
        this.sequence = this.molecules.map(m => m.formula).join('-');

        // Generate unique fingerprint
        this.fingerprint = this._generateFingerprint();
    }

    /**
     * Generate unique fingerprint for this polymer
     */
    _generateFingerprint() {
        const typePrefix = this.type.toUpperCase().substring(0, 3);
        const parts = this.molecules.map(m => m.fingerprint).sort();
        return `${typePrefix}:${parts.join('|')}`;
    }

    /**
     * Get the display color for this polymer's type
     */
    getColor() {
        return PolymerColors[this.type] || PolymerColors.generic;
    }

    /**
     * Get the display label for this polymer's type
     */
    getLabel() {
        return PolymerLabels[this.type] || 'Polymer';
    }

    /**
     * Add a molecule to the chain
     * @param {Molecule} molecule - Molecule to add
     */
    addMolecule(molecule) {
        molecule.proteinId = this.id;
        this.molecules.push(molecule);
        this._updateProperties();
        // Re-detect type with new molecule
        this.type = this._detectType();
    }

    /**
     * Remove a molecule from the chain
     * @param {string} moleculeId - ID of molecule to remove
     */
    removeMolecule(moleculeId) {
        const index = this.molecules.findIndex(m => m.id === moleculeId);
        if (index !== -1) {
            this.molecules[index].proteinId = null;
            this.molecules.splice(index, 1);
            this._updateProperties();
        }
    }

    /**
     * Define an active site on this polymer
     * @param {object} site - Active site definition
     */
    addActiveSite(site) {
        this.activeSites.push({
            id: Utils.generateId(),
            moleculeIndices: site.moleculeIndices || [],
            type: site.type || 'catalytic',
            specificity: site.specificity || [],
            strength: site.strength || 1.0
        });
    }

    /**
     * Fold the polymer into a 2D shape
     */
    fold() {
        if (this.molecules.length < 2) return;

        this.folded = true;
        const center = this.getCenter();
        const numMols = this.molecules.length;
        const spacing = 50;

        this.foldPattern = [];

        for (let i = 0; i < numMols; i++) {
            const angle = i * 0.8;
            const radius = spacing * (1 + i * 0.3);

            this.foldPattern.push({
                moleculeId: this.molecules[i].id,
                relativeX: Math.cos(angle) * radius,
                relativeY: Math.sin(angle) * radius
            });
        }
    }

    /**
     * Unfold the polymer (linearize)
     */
    unfold() {
        this.folded = false;
        this.foldPattern = null;
    }

    /**
     * Get the center position of the polymer
     */
    getCenter() {
        if (this.molecules.length === 0) {
            return new Vector2(0, 0);
        }

        let sumX = 0, sumY = 0;
        for (const mol of this.molecules) {
            const molCenter = mol.getCenter();
            sumX += molCenter.x;
            sumY += molCenter.y;
        }

        return new Vector2(
            sumX / this.molecules.length,
            sumY / this.molecules.length
        );
    }

    /**
     * Check if the polymer is stable
     */
    isStable() {
        if (this.molecules.length < 2) return false;
        return this.molecules.every(m => m.isStable());
    }

    /**
     * Check if this polymer can catalyze a reaction
     */
    canCatalyze(substrates) {
        for (const site of this.activeSites) {
            if (site.type === 'catalytic') {
                const matches = substrates.filter(s =>
                    site.specificity.includes(s.formula) ||
                    site.specificity.includes('*')
                );
                if (matches.length > 0) return true;
            }
        }
        return false;
    }

    /**
     * Apply forces to maintain structure
     */
    applyForces(dt) {
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const mol1 = this.molecules[i];
            const mol2 = this.molecules[i + 1];

            const center1 = mol1.getCenter();
            const center2 = mol2.getCenter();

            const dx = center2.x - center1.x;
            const dy = center2.y - center1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const targetDist = 80;
            const stiffness = 0.05;

            if (dist > 0) {
                const forceMag = (dist - targetDist) * stiffness;
                const fx = (dx / dist) * forceMag;
                const fy = (dy / dist) * forceMag;

                for (const atom of mol1.atoms) {
                    atom.velocity.x += fx * dt;
                    atom.velocity.y += fy * dt;
                }
                for (const atom of mol2.atoms) {
                    atom.velocity.x -= fx * dt;
                    atom.velocity.y -= fy * dt;
                }
            }
        }
    }

    /**
     * Update all molecules
     */
    update(dt) {
        this.applyForces(dt);
        for (const mol of this.molecules) {
            mol.update(dt);
        }
    }

    /**
     * Render the polymer
     */
    render(ctx, level, camera) {
        if (this.molecules.length === 0) return;

        const colors = this.getColor();

        if (level <= 1) {
            this._renderChainConnections(ctx, camera, colors);
            for (const mol of this.molecules) {
                mol.render(ctx, level, camera);
            }
        } else if (level === 2) {
            this._renderAsPolymer(ctx, camera, colors);
        } else {
            this._renderAsBlob(ctx, camera, colors);
        }
    }

    /**
     * Render chain connections between molecules
     */
    _renderChainConnections(ctx, camera, colors) {
        if (this.molecules.length < 2) return;

        ctx.save();
        ctx.strokeStyle = this.selected ? '#f59e0b' : colors.primary;
        ctx.lineWidth = 3 / camera.zoom;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        for (let i = 0; i < this.molecules.length - 1; i++) {
            const center1 = this.molecules[i].getCenter();
            const center2 = this.molecules[i + 1].getCenter();

            ctx.moveTo((center1.x - camera.x) * camera.zoom, (center1.y - camera.y) * camera.zoom);
            ctx.lineTo((center2.x - camera.x) * camera.zoom, (center2.y - camera.y) * camera.zoom);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Render as polymer structure
     */
    _renderAsPolymer(ctx, camera, colors) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;

        ctx.save();

        // Draw connections
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 4 / camera.zoom;
        ctx.beginPath();

        for (let i = 0; i < this.molecules.length - 1; i++) {
            const c1 = this.molecules[i].getCenter();
            const c2 = this.molecules[i + 1].getCenter();
            ctx.moveTo((c1.x - camera.x) * camera.zoom, (c1.y - camera.y) * camera.zoom);
            ctx.lineTo((c2.x - camera.x) * camera.zoom, (c2.y - camera.y) * camera.zoom);
        }
        ctx.stroke();

        // Draw molecule blobs
        for (const mol of this.molecules) {
            const mc = mol.getCenter();
            const mx = (mc.x - camera.x) * camera.zoom;
            const my = (mc.y - camera.y) * camera.zoom;
            const radius = 20 * camera.zoom;

            ctx.beginPath();
            ctx.arc(mx, my, radius, 0, Math.PI * 2);
            ctx.fillStyle = this.highlighted ? colors.secondary + 'aa' : colors.primary + '66';
            ctx.fill();
            ctx.strokeStyle = this.selected ? '#f59e0b' : colors.primary;
            ctx.stroke();
        }

        // Draw label with type
        const label = this.name || `${this.getLabel()} (${this.molecules.length})`;
        ctx.fillStyle = '#e8e8f0';
        ctx.font = `${12 * camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, screenX, screenY + 40 * camera.zoom);

        ctx.restore();
    }

    /**
     * Render as simplified blob
     */
    _renderAsBlob(ctx, camera, colors) {
        const center = this.getCenter();
        const screenX = (center.x - camera.x) * camera.zoom;
        const screenY = (center.y - camera.y) * camera.zoom;
        const radius = (15 + this.molecules.length * 5) * camera.zoom;

        ctx.save();

        // Outer glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
        gradient.addColorStop(0, colors.primary + 'cc');
        gradient.addColorStop(0.7, colors.primary + '4d');
        gradient.addColorStop(1, colors.primary + '00');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = this.highlighted ? colors.secondary : colors.primary;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        if (this.selected) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Serialize polymer for storage
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            moleculeIds: this.molecules.map(m => m.id),
            activeSites: this.activeSites,
            folded: this.folded,
            fingerprint: this.fingerprint
        };
    }

    /**
     * Get all atoms in this polymer
     */
    getAllAtoms() {
        const atoms = [];
        for (const mol of this.molecules) {
            atoms.push(...mol.atoms);
        }
        return atoms;
    }

    /**
     * Get all bonds in this polymer
     */
    getAllBonds() {
        const bonds = [];
        for (const mol of this.molecules) {
            bonds.push(...mol.bonds);
        }
        return bonds;
    }
}

/**
 * Create polymers from nearby molecules
 * @param {Molecule[]} molecules - All molecules
 * @param {number} maxDistance - Max distance for molecules to form a polymer
 * @returns {Polymer[]} New polymers found
 */
function findPotentialPolymers(molecules, maxDistance = 100) {
    const polymers = [];
    const assigned = new Set();

    for (const mol of molecules) {
        if (assigned.has(mol.id) || mol.proteinId) continue;
        if (!mol.isStable()) continue;

        // Find nearby molecules that could form a chain
        const chain = [mol];
        assigned.add(mol.id);

        let current = mol;
        let found = true;

        while (found) {
            found = false;
            const currentCenter = current.getCenter();

            for (const other of molecules) {
                if (assigned.has(other.id) || other.proteinId) continue;
                if (!other.isStable()) continue;

                const otherCenter = other.getCenter();
                const dist = Utils.distance(
                    currentCenter.x, currentCenter.y,
                    otherCenter.x, otherCenter.y
                );

                if (dist < maxDistance) {
                    chain.push(other);
                    assigned.add(other.id);
                    current = other;
                    found = true;
                    break;
                }
            }
        }

        // Only create polymer if we have a chain of 2+ molecules
        if (chain.length >= 2) {
            polymers.push(new Polymer(chain));
        }
    }

    return polymers;
}

// Backward compatibility aliases
const Protein = Polymer;
const findPotentialProteins = findPotentialPolymers;

// Make available globally
window.PolymerType = PolymerType;
window.PolymerColors = PolymerColors;
window.PolymerLabels = PolymerLabels;
window.Polymer = Polymer;
window.Protein = Protein;  // Backward compatibility
window.findPotentialPolymers = findPotentialPolymers;
window.findPotentialProteins = findPotentialProteins;  // Backward compatibility

/**
 * Neural Network
 * Lightweight feed-forward neural network for cell behavior
 * No external dependencies
 */

class NeuralNetwork {
    /**
     * Create a neural network
     * @param {number[]} layers - Layer sizes, e.g., [4, 8, 4] for 4 inputs, 8 hidden, 4 outputs
     * @param {string} activation - Activation function: 'sigmoid', 'relu', 'tanh'
     */
    constructor(layers, activation = 'sigmoid') {
        this.layers = layers;
        this.activation = activation;

        // Initialize weights and biases
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < layers.length - 1; i++) {
            // Weight matrix from layer i to layer i+1
            const weightMatrix = this._createMatrix(layers[i + 1], layers[i]);
            this._randomizeMatrix(weightMatrix);
            this.weights.push(weightMatrix);

            // Bias vector for layer i+1
            const biasVector = new Array(layers[i + 1]).fill(0).map(() => (Math.random() - 0.5) * 0.5);
            this.biases.push(biasVector);
        }
    }

    /**
     * Create a matrix (2D array)
     */
    _createMatrix(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    /**
     * Randomize matrix values (Xavier initialization)
     */
    _randomizeMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const scale = Math.sqrt(2 / (rows + cols));

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = (Math.random() - 0.5) * 2 * scale;
            }
        }
    }

    /**
     * Activation function
     */
    _activate(x) {
        switch (this.activation) {
            case 'sigmoid':
                return 1 / (1 + Math.exp(-x));
            case 'relu':
                return Math.max(0, x);
            case 'tanh':
                return Math.tanh(x);
            default:
                return 1 / (1 + Math.exp(-x));
        }
    }

    /**
     * Forward propagation
     * @param {number[]} inputs - Input values
     * @returns {number[]} Output values
     */
    forward(inputs) {
        if (inputs.length !== this.layers[0]) {
            throw new Error(`Expected ${this.layers[0]} inputs, got ${inputs.length}`);
        }

        let current = inputs.slice();

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            const biases = this.biases[i];
            const next = [];

            for (let j = 0; j < weights.length; j++) {
                let sum = biases[j];
                for (let k = 0; k < current.length; k++) {
                    sum += weights[j][k] * current[k];
                }
                next.push(this._activate(sum));
            }

            current = next;
        }

        return current;
    }

    /**
     * Get all weights as a flat array
     * @returns {number[]} Flattened weights and biases
     */
    getWeights() {
        const flat = [];

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    flat.push(weights[j][k]);
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                flat.push(this.biases[i][j]);
            }
        }

        return flat;
    }

    /**
     * Set all weights from a flat array
     * @param {number[]} flat - Flattened weights and biases
     */
    setWeights(flat) {
        let index = 0;

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    weights[j][k] = flat[index++];
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                this.biases[i][j] = flat[index++];
            }
        }
    }

    /**
     * Get total number of weights
     */
    getWeightCount() {
        let count = 0;
        for (let i = 0; i < this.layers.length - 1; i++) {
            count += this.layers[i] * this.layers[i + 1]; // weights
            count += this.layers[i + 1]; // biases
        }
        return count;
    }

    /**
     * Mutate weights randomly
     * @param {number} rate - Mutation rate (0-1), probability of each weight being mutated
     * @param {number} strength - Mutation strength, max change amount
     */
    mutate(rate = 0.1, strength = 0.5) {
        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    if (Math.random() < rate) {
                        weights[j][k] += (Math.random() - 0.5) * 2 * strength;
                    }
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                if (Math.random() < rate) {
                    this.biases[i][j] += (Math.random() - 0.5) * 2 * strength;
                }
            }
        }
    }

    /**
     * Create a copy of this neural network
     * @returns {NeuralNetwork} Cloned network
     */
    clone() {
        const clone = new NeuralNetwork(this.layers.slice(), this.activation);
        clone.setWeights(this.getWeights());
        return clone;
    }

    /**
     * Serialize to JSON-compatible object
     */
    serialize() {
        return {
            layers: this.layers,
            activation: this.activation,
            weights: this.getWeights()
        };
    }

    /**
     * Create from serialized data
     * @param {object} data - Serialized network data
     * @returns {NeuralNetwork}
     */
    static deserialize(data) {
        const nn = new NeuralNetwork(data.layers, data.activation);
        nn.setWeights(data.weights);
        return nn;
    }

    /**
     * Create a random neural network with random topology
     * @param {number} inputs - Number of inputs
     * @param {number} outputs - Number of outputs
     * @param {number} hiddenLayers - Number of hidden layers (0-3)
     * @param {number} hiddenSize - Size of hidden layers
     * @returns {NeuralNetwork}
     */
    static random(inputs, outputs, hiddenLayers = 1, hiddenSize = 8) {
        const layers = [inputs];
        for (let i = 0; i < hiddenLayers; i++) {
            layers.push(hiddenSize);
        }
        layers.push(outputs);

        return new NeuralNetwork(layers);
    }
}

// Make available globally
window.NeuralNetwork = NeuralNetwork;

/**
 * Cell Memory
 * Simple key-value memory with decay for cell learning
 */

class CellMemory {
    constructor() {
        this.memories = new Map();
        this.decayRate = 0.01; // Per tick decay
        this.maxMemories = 20;
    }

    /**
     * Store a memory
     * @param {string} key - Memory key
     * @param {*} value - Memory value
     * @param {number} strength - Initial strength (0-1)
     */
    store(key, value, strength = 1.0) {
        this.memories.set(key, {
            value,
            strength,
            timestamp: Date.now()
        });

        // Limit memory count
        if (this.memories.size > this.maxMemories) {
            this._pruneWeakest();
        }
    }

    /**
     * Retrieve a memory
     * @param {string} key - Memory key
     * @returns {*} Memory value or null
     */
    recall(key) {
        const memory = this.memories.get(key);
        if (!memory) return null;

        // Strengthen on recall
        memory.strength = Math.min(1, memory.strength + 0.1);

        return memory.value;
    }

    /**
     * Check if memory exists and is strong enough
     * @param {string} key - Memory key
     * @param {number} threshold - Minimum strength threshold
     */
    has(key, threshold = 0.1) {
        const memory = this.memories.get(key);
        return memory && memory.strength >= threshold;
    }

    /**
     * Get memory strength
     * @param {string} key - Memory key
     */
    getStrength(key) {
        const memory = this.memories.get(key);
        return memory ? memory.strength : 0;
    }

    /**
     * Update memories (decay over time)
     */
    update() {
        for (const [key, memory] of this.memories) {
            memory.strength -= this.decayRate;

            if (memory.strength <= 0) {
                this.memories.delete(key);
            }
        }
    }

    /**
     * Remove weakest memories
     */
    _pruneWeakest() {
        const sorted = Array.from(this.memories.entries())
            .sort((a, b) => a[1].strength - b[1].strength);

        // Remove weakest half
        const removeCount = Math.floor(sorted.length / 2);
        for (let i = 0; i < removeCount; i++) {
            this.memories.delete(sorted[i][0]);
        }
    }

    /**
     * Get all memories as array
     */
    getAll() {
        return Array.from(this.memories.entries()).map(([key, mem]) => ({
            key,
            value: mem.value,
            strength: mem.strength
        }));
    }

    /**
     * Clear all memories
     */
    clear() {
        this.memories.clear();
    }

    /**
     * Serialize memory
     */
    serialize() {
        return Array.from(this.memories.entries()).map(([key, mem]) => ({
            key,
            value: mem.value,
            strength: mem.strength
        }));
    }

    /**
     * Deserialize memory
     */
    static deserialize(data) {
        const memory = new CellMemory();
        for (const item of data) {
            memory.store(item.key, item.value, item.strength);
        }
        return memory;
    }
}

// Make available globally
window.CellMemory = CellMemory;

/**
 * Cell
 * Living unit with neural network-based behavior
 */

class Cell {
    /**
     * Create a cell
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {NeuralNetwork} brain - Neural network for behavior (optional)
     */
    constructor(x, y, brain = null) {
        this.id = Utils.generateId();
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);

        // Physical properties
        this.radius = 30;
        this.mass = 1;
        this.maxSpeed = 2;

        // Energy and metabolism
        this.energy = 100;
        this.maxEnergy = 100;
        this.metabolismRate = 0.1; // Energy consumed per tick
        this.movementCost = 0.05; // Extra energy per movement

        // Neural network brain
        // Inputs: [energy, food_dist, food_angle, threat_dist, threat_angle, random]
        // Outputs: [move_forward, turn, eat, reproduce]
        this.brain = brain || new NeuralNetwork([6, 12, 8, 4], 'tanh');

        // Sensor data (updated each tick)
        this.sensorData = {
            nearestFood: null,
            nearestThreat: null,
            energyLevel: 1
        };

        // State
        this.age = 0;
        this.generation = 0;
        this.isAlive = true;
        this.reproductionCooldown = 0;
        this.reproductionCost = 50;
        this.minReproductionEnergy = 70;

        // Visual properties
        this.color = this._generateColor();
        this.hue = Math.random() * 360;

        // Memory (for learning behaviors)
        this.memory = new CellMemory();

        // Component molecules (optional detail)
        this.molecules = [];
    }

    /**
     * Generate a color based on neural network weights
     */
    _generateColor() {
        const weights = this.brain.getWeights();
        const sum = weights.slice(0, 10).reduce((a, b) => a + Math.abs(b), 0);
        const hue = (sum * 50) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Update sensors based on environment
     * @param {Environment} environment
     */
    updateSensors(environment) {
        this.sensorData.energyLevel = this.energy / this.maxEnergy;

        // Find nearest food (free molecules with energy value)
        let nearestFoodDist = Infinity;
        let nearestFood = null;

        for (const molecule of environment.getAllMolecules()) {
            if (molecule.isStable && molecule.isStable()) {
                const dist = this.position.distanceTo(molecule.centerOfMass);
                if (dist < nearestFoodDist && dist < 200) {
                    nearestFoodDist = dist;
                    nearestFood = molecule;
                }
            }
        }

        this.sensorData.nearestFood = nearestFood;
        this.sensorData.nearestFoodDist = nearestFoodDist === Infinity ? 200 : nearestFoodDist;

        // Calculate angle to food
        if (nearestFood) {
            const dx = nearestFood.centerOfMass.x - this.position.x;
            const dy = nearestFood.centerOfMass.y - this.position.y;
            this.sensorData.nearestFoodAngle = Math.atan2(dy, dx);
        } else {
            this.sensorData.nearestFoodAngle = 0;
        }

        // Find nearest threat (other cells with more energy)
        let nearestThreatDist = Infinity;
        let nearestThreat = null;

        if (environment.cells) {
            for (const cell of environment.cells.values()) {
                if (cell.id !== this.id && cell.isAlive) {
                    const dist = this.position.distanceTo(cell.position);
                    if (dist < nearestThreatDist && dist < 200 && cell.energy > this.energy * 1.2) {
                        nearestThreatDist = dist;
                        nearestThreat = cell;
                    }
                }
            }
        }

        this.sensorData.nearestThreat = nearestThreat;
        this.sensorData.nearestThreatDist = nearestThreatDist === Infinity ? 200 : nearestThreatDist;

        // Calculate angle to threat
        if (nearestThreat) {
            const dx = nearestThreat.position.x - this.position.x;
            const dy = nearestThreat.position.y - this.position.y;
            this.sensorData.nearestThreatAngle = Math.atan2(dy, dx);
        } else {
            this.sensorData.nearestThreatAngle = 0;
        }
    }

    /**
     * Process brain and get actions
     * @returns {object} Actions to take
     */
    think() {
        // Prepare inputs (normalized 0-1 or -1 to 1)
        const inputs = [
            this.sensorData.energyLevel,
            1 - (this.sensorData.nearestFoodDist / 200), // Closer = higher
            this.sensorData.nearestFoodAngle / Math.PI, // -1 to 1
            1 - (this.sensorData.nearestThreatDist / 200),
            this.sensorData.nearestThreatAngle / Math.PI,
            Math.random() * 2 - 1 // Random input for exploration
        ];

        // Get outputs from brain
        const outputs = this.brain.forward(inputs);

        return {
            moveForward: outputs[0], // -1 to 1
            turn: outputs[1],        // -1 to 1
            eat: outputs[2] > 0.5,   // boolean
            reproduce: outputs[3] > 0.7 // boolean (higher threshold)
        };
    }

    /**
     * Update cell state
     * @param {Environment} environment
     */
    update(environment) {
        if (!this.isAlive) return;

        this.age++;
        this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);

        // Update sensors
        this.updateSensors(environment);

        // Think and get actions
        const actions = this.think();

        // Apply movement
        this._applyMovement(actions, environment);

        // Try to eat
        if (actions.eat) {
            this._tryEat(environment);
        }

        // Try to reproduce
        if (actions.reproduce && this.canReproduce()) {
            this._reproduce(environment);
        }

        // Metabolism
        this.energy -= this.metabolismRate;

        // Check death
        if (this.energy <= 0) {
            this.die(environment);
        }

        // Update visual color based on energy
        this._updateColor();
    }

    /**
     * Apply movement based on actions
     */
    _applyMovement(actions, environment) {
        // Calculate movement direction
        const currentAngle = Math.atan2(this.velocity.y, this.velocity.x);
        const turnAmount = actions.turn * 0.1; // Max turn rate
        const newAngle = currentAngle + turnAmount;

        // Apply forward movement
        const speed = actions.moveForward * this.maxSpeed;
        const dx = Math.cos(newAngle) * speed;
        const dy = Math.sin(newAngle) * speed;

        this.velocity.x = dx;
        this.velocity.y = dy;

        // Update position
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Boundary collision
        const padding = this.radius;
        if (this.position.x < padding) {
            this.position.x = padding;
            this.velocity.x *= -0.5;
        }
        if (this.position.x > environment.width - padding) {
            this.position.x = environment.width - padding;
            this.velocity.x *= -0.5;
        }
        if (this.position.y < padding) {
            this.position.y = padding;
            this.velocity.y *= -0.5;
        }
        if (this.position.y > environment.height - padding) {
            this.position.y = environment.height - padding;
            this.velocity.y *= -0.5;
        }

        // Movement costs energy
        const moveSpeed = Math.sqrt(dx * dx + dy * dy);
        this.energy -= moveSpeed * this.movementCost;
    }

    /**
     * Try to eat nearby food
     */
    _tryEat(environment) {
        const food = this.sensorData.nearestFood;
        if (!food) return;

        const dist = this.position.distanceTo(food.centerOfMass);
        if (dist < this.radius + 20) {
            // Consume the molecule for energy
            const energyGain = food.atoms.length * 5;
            this.energy = Math.min(this.maxEnergy, this.energy + energyGain);

            // Remove the molecule from environment
            for (const atom of food.atoms) {
                environment.removeAtom(atom.id);
            }
            environment.removeMolecule(food.id);

            // Store in memory
            this.memory.store('lastMeal', Date.now());
        }
    }

    /**
     * Check if can reproduce
     */
    canReproduce() {
        return this.energy >= this.minReproductionEnergy &&
            this.reproductionCooldown === 0 &&
            this.age > 100;
    }

    /**
     * Reproduce - create offspring
     */
    _reproduce(environment) {
        if (!this.canReproduce()) return null;

        // Energy cost
        this.energy -= this.reproductionCost;
        this.reproductionCooldown = 200;

        // Create offspring with mutated brain
        const offspringX = this.position.x + (Math.random() - 0.5) * 50;
        const offspringY = this.position.y + (Math.random() - 0.5) * 50;

        const offspringBrain = this.brain.clone();
        offspringBrain.mutate(0.1, 0.3); // 10% mutation rate, 0.3 strength

        const offspring = new Cell(offspringX, offspringY, offspringBrain);
        offspring.generation = this.generation + 1;
        offspring.energy = 40; // Start with some energy

        // Add to environment
        if (environment.addCell) {
            environment.addCell(offspring);
        }

        return offspring;
    }

    /**
     * Cell death
     */
    die(environment) {
        this.isAlive = false;

        // Could spawn molecules as remains
        // For now, just mark as dead
    }

    /**
     * Update color based on energy level
     */
    _updateColor() {
        const energyRatio = this.energy / this.maxEnergy;
        const saturation = 50 + energyRatio * 30;
        const lightness = 30 + energyRatio * 30;
        this.color = `hsl(${this.hue}, ${saturation}%, ${lightness}%)`;
    }

    /**
     * Check if point is inside cell
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        const dx = x - screenX;
        const dy = y - screenY;

        return dx * dx + dy * dy <= screenRadius * screenRadius;
    }

    /**
     * Render the cell
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     * @param {object} offset
     * @param {boolean} detailed - Show internal details
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }, detailed = false) {
        if (!this.isAlive) return;

        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        // Cell membrane
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);

        // Fill with gradient based on energy
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, screenRadius
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, `hsla(${this.hue}, 60%, 30%, 0.8)`);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Membrane outline
        ctx.strokeStyle = `hsla(${this.hue}, 80%, 60%, 0.9)`;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Energy bar
        const barWidth = screenRadius * 1.5;
        const barHeight = 4 * scale;
        const barX = screenX - barWidth / 2;
        const barY = screenY - screenRadius - 10 * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const energyRatio = Math.max(0, this.energy / this.maxEnergy);
        ctx.fillStyle = energyRatio > 0.5 ? '#4ade80' : (energyRatio > 0.2 ? '#fbbf24' : '#ef4444');
        ctx.fillRect(barX, barY, barWidth * energyRatio, barHeight);

        // Detailed view - show nucleus and internal structures
        if (detailed) {
            // Nucleus
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenRadius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 50%, 40%, 0.7)`;
            ctx.fill();

            // Generation text
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`G${this.generation}`, screenX, screenY + 4 * scale);
        }
    }

    /**
     * Serialize cell data
     */
    serialize() {
        return {
            id: this.id,
            x: this.position.x,
            y: this.position.y,
            energy: this.energy,
            age: this.age,
            generation: this.generation,
            brain: this.brain.serialize(),
            hue: this.hue
        };
    }

    /**
     * Deserialize cell data
     */
    static deserialize(data) {
        const brain = NeuralNetwork.deserialize(data.brain);
        const cell = new Cell(data.x, data.y, brain);
        cell.id = data.id;
        cell.energy = data.energy;
        cell.age = data.age;
        cell.generation = data.generation;
        cell.hue = data.hue;
        cell._updateColor();
        return cell;
    }
}

// Make available globally
window.Cell = Cell;

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

/**
 * Simulation Engine
 * Main loop and timing control
 */

class Simulation {
    /**
     * Create a new simulation
     * @param {Environment} environment - The environment to simulate
     */
    constructor(environment) {
        this.environment = environment;

        // Timing
        this.running = false;
        this.tick = 0;
        this.speed = 1.0;  // Simulation speed multiplier
        this.targetFPS = 60;
        this.actualFPS = 0;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedDt = 1 / 60;  // Fixed timestep

        // Animation frame request
        this.frameId = null;

        // Callbacks
        this.onTick = null;
        this.onUpdate = null;

        // Bound update for requestAnimationFrame
        this._update = this._update.bind(this);
    }

    /**
     * Start the simulation
     */
    start() {
        if (this.running) return;

        this.running = true;
        this.lastTime = performance.now();
        this.frameId = requestAnimationFrame(this._update);
    }

    /**
     * Pause the simulation
     */
    pause() {
        this.running = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    /**
     * Toggle running state
     */
    toggle() {
        if (this.running) {
            this.pause();
        } else {
            this.start();
        }
    }

    /**
     * Advance one step
     */
    step() {
        this._simulationStep(this.fixedDt);
    }

    /**
     * Set simulation speed
     * @param {number} speed - Speed multiplier (0.1 to 10)
     */
    setSpeed(speed) {
        this.speed = Utils.clamp(speed, 0.1, 10);
    }

    /**
     * Main update loop
     * @param {number} currentTime - Current timestamp
     */
    _update(currentTime) {
        if (!this.running) return;

        // Calculate delta time
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Track FPS
        this.actualFPS = 1 / deltaTime;

        // Accumulator for fixed timestep
        this.accumulator += deltaTime * this.speed;

        // Run simulation steps
        while (this.accumulator >= this.fixedDt) {
            this._simulationStep(this.fixedDt);
            this.accumulator -= this.fixedDt;
        }

        // Call update callback (for rendering)
        if (this.onUpdate) {
            this.onUpdate(deltaTime);
        }

        // Continue loop
        this.frameId = requestAnimationFrame(this._update);
    }

    /**
     * Single simulation step
     * @param {number} dt - Fixed delta time
     */
    _simulationStep(dt) {
        this.tick++;

        // Update environment
        this.environment.update(dt);

        // Call tick callback
        if (this.onTick) {
            this.onTick(this.tick);
        }
    }

    /**
     * Reset simulation
     */
    reset() {
        this.pause();
        this.tick = 0;
        this.environment.clear();
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            tick: this.tick,
            fps: Math.round(this.actualFPS),
            running: this.running,
            speed: this.speed,
            ...this.environment.stats
        };
    }
}

// Make available globally
window.Simulation = Simulation;

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
        // Create atoms at relative positions
        const atoms = this.atomData.map(data =>
            new Atom(data.symbol, x + data.relX, y + data.relY)
        );

        // Create bonds
        for (const bondData of this.bondData) {
            const atom1 = atoms[bondData.atom1Index];
            const atom2 = atoms[bondData.atom2Index];
            new Bond(atom1, atom2, bondData.order);
        }

        // Create molecule
        const molecule = new Molecule(atoms);
        molecule.name = this.name;

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

/**
 * Catalogue
 * Central storage for blueprints with IndexedDB persistence
 */

class Catalogue {
    constructor() {
        this.molecules = new Map();  // fingerprint -> MoleculeBlueprint
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
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to load molecules:', request.error);
                resolve();
            };
        });
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
        this.cells.clear();
        this.organisms.clear();
        this.knownFingerprints.clear();

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

/**
 * Viewer
 * Multi-level renderer for the simulation
 */

// Abstraction levels (6 levels)
const AbstractionLevel = {
    ATOM: 0,
    MOLECULE: 1,
    PROTEIN: 2,
    CELL: 3,
    ORGANISM: 4,
    POPULATION: 5
};

const LEVEL_NAMES = ['Atoms', 'Molecules', 'Proteins', 'Cells', 'Organisms', 'Populations'];

class Viewer {
    /**
     * Create a new viewer
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Environment} environment - Environment to render
     */
    constructor(canvas, environment) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.environment = environment;

        // Camera
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            minZoom: 0.1,
            maxZoom: 5
        };

        // Abstraction level
        this.level = AbstractionLevel.ATOM;

        // Selection
        this.selectedAtom = null;
        this.selectedMolecule = null;
        this.selectedCell = null;
        this.hoveredAtom = null;
        this.hoveredMolecule = null;
        this.hoveredCell = null;

        // Performance
        this.lastRenderTime = 0;

        // Grid settings
        this.showGrid = true;
        this.gridSpacing = 100;

        // Callbacks
        this.onRender = null;

        // Resize handler
        this._resizeHandler = this._handleResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);
        this._handleResize();
    }

    /**
     * Handle window resize
     */
    _handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    /**
     * Set abstraction level
     * @param {number} level - Level from AbstractionLevel enum
     */
    setLevel(level) {
        this.level = Utils.clamp(level, 0, 5);
        this.clearSelection();
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        if (this.selectedAtom) {
            this.selectedAtom.selected = false;
            this.selectedAtom = null;
        }
        if (this.selectedMolecule) {
            this.selectedMolecule.selected = false;
            this.selectedMolecule = null;
        }
    }

    /**
     * Get camera offset
     */
    getOffset() {
        return {
            x: this.canvas.width / (2 * this.camera.zoom) - this.camera.x,
            y: this.canvas.height / (2 * this.camera.zoom) - this.camera.y
        };
    }

    /**
     * Screen to world coordinates
     * @param {number} screenX - Screen X
     * @param {number} screenY - Screen Y
     */
    screenToWorld(screenX, screenY) {
        const offset = this.getOffset();
        return {
            x: screenX / this.camera.zoom - offset.x,
            y: screenY / this.camera.zoom - offset.y
        };
    }

    /**
     * World to screen coordinates
     * @param {number} worldX - World X
     * @param {number} worldY - World Y
     */
    worldToScreen(worldX, worldY) {
        const offset = this.getOffset();
        return {
            x: (worldX + offset.x) * this.camera.zoom,
            y: (worldY + offset.y) * this.camera.zoom
        };
    }

    /**
     * Pan the camera
     * @param {number} dx - Delta X in screen space
     * @param {number} dy - Delta Y in screen space
     */
    pan(dx, dy) {
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
    }

    /**
     * Zoom the camera
     * @param {number} delta - Zoom delta
     * @param {number} centerX - Zoom center X (screen)
     * @param {number} centerY - Zoom center Y (screen)
     */
    zoom(delta, centerX, centerY) {
        const oldZoom = this.camera.zoom;
        const newZoom = Utils.clamp(
            oldZoom * (1 + delta * 0.1),
            this.camera.minZoom,
            this.camera.maxZoom
        );

        // Zoom towards cursor
        const worldBefore = this.screenToWorld(centerX, centerY);
        this.camera.zoom = newZoom;
        const worldAfter = this.screenToWorld(centerX, centerY);

        this.camera.x += worldBefore.x - worldAfter.x;
        this.camera.y += worldBefore.y - worldAfter.y;
    }

    /**
     * Center camera on environment
     */
    centerCamera() {
        this.camera.x = this.environment.width / 2;
        this.camera.y = this.environment.height / 2;
    }

    /**
     * Render the simulation
     */
    render() {
        const ctx = this.ctx;
        const startTime = performance.now();

        // Clear
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw based on level
        switch (this.level) {
            case AbstractionLevel.ATOM:
                this._renderAtomLevel();
                break;
            case AbstractionLevel.MOLECULE:
                this._renderMoleculeLevel();
                break;
            case AbstractionLevel.PROTEIN:
                this._renderProteinLevel();
                break;
            case AbstractionLevel.CELL:
                this._renderCellLevel();
                break;
            case AbstractionLevel.ORGANISM:
                this._renderOrganismLevel();
                break;
            case AbstractionLevel.POPULATION:
                this._renderPopulationLevel();
                break;
        }

        // Draw environment bounds
        this._renderBounds();

        // Draw grid (optional)
        if (this.showGrid && this.camera.zoom > 0.3) {
            this._renderGrid();
        }

        this.lastRenderTime = performance.now() - startTime;

        // Trigger callback
        if (this.onRender) {
            this.onRender();
        }
    }

    /**
     * Render at atom level
     */
    _renderAtomLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render bonds first
        for (const bond of this.environment.getAllBonds()) {
            bond.render(this.ctx, scale, offset);
        }

        // Render atoms
        for (const atom of this.environment.getAllAtoms()) {
            atom.render(this.ctx, scale, offset);
        }
    }

    /**
     * Render at molecule level
     */
    _renderMoleculeLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render molecules as simplified blobs
        for (const molecule of this.environment.getAllMolecules()) {
            molecule.renderSimplified(this.ctx, scale, offset);
        }

        // Render free atoms (not in molecules)
        for (const atom of this.environment.getAllAtoms()) {
            if (!atom.moleculeId) {
                atom.render(this.ctx, scale, offset);
            }
        }
    }

    /**
     * Render at protein level
     */
    _renderProteinLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render proteins
        const proteins = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
        for (const protein of proteins) {
            protein.render(this.ctx, 2, { x: -offset.x, y: -offset.y, zoom: scale });
        }

        // Render molecules not in proteins
        for (const molecule of this.environment.getAllMolecules()) {
            if (!molecule.proteinId) {
                molecule.renderSimplified(this.ctx, scale, offset);
            }
        }

        // Render free atoms
        for (const atom of this.environment.getAllAtoms()) {
            if (!atom.moleculeId) {
                atom.render(this.ctx, scale, offset);
            }
        }
    }

    /**
     * Render at cell level
     */
    _renderCellLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render cells
        const cells = this.environment.getAllCells ? this.environment.getAllCells() : [];
        for (const cell of cells) {
            if (cell.isAlive) {
                const isSelected = this.selectedCell && this.selectedCell.id === cell.id;
                cell.render(this.ctx, scale, offset, isSelected);
            }
        }

        // Render molecules as small dots (simplified view)
        for (const molecule of this.environment.getAllMolecules()) {
            const center = molecule.centerOfMass;
            const screenX = (center.x + offset.x) * scale;
            const screenY = (center.y + offset.y) * scale;

            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, 4 * scale, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
            this.ctx.fill();
        }

        // Show cell count if no cells
        if (cells.length === 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.font = '18px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                'No cells yet - Place cells from the palette',
                this.canvas.width / 2,
                this.canvas.height / 2
            );
        }
    }

    /**
     * Render at organism level (placeholder)
     */
    _renderOrganismLevel() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Organism level - Coming in Phase 3',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    /**
     * Render at population level (placeholder)
     */
    _renderPopulationLevel() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Population level - Coming in Phase 4',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    /**
     * Render environment bounds
     */
    _renderBounds() {
        const ctx = this.ctx;
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            offset.x * scale,
            offset.y * scale,
            this.environment.width * scale,
            this.environment.height * scale
        );
    }

    /**
     * Render grid
     */
    _renderGrid() {
        const ctx = this.ctx;
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        const startX = Math.floor(-offset.x / this.gridSpacing) * this.gridSpacing;
        const endX = this.environment.width;
        const startY = Math.floor(-offset.y / this.gridSpacing) * this.gridSpacing;
        const endY = this.environment.height;

        // Vertical lines
        for (let x = startX; x <= endX; x += this.gridSpacing) {
            const screenX = (x + offset.x) * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += this.gridSpacing) {
            const screenY = (y + offset.y) * scale;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
            ctx.stroke();
        }
    }

    /**
     * Find entity at screen position
     * @param {number} screenX - Screen X
     * @param {number} screenY - Screen Y
     */
    getEntityAt(screenX, screenY) {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // At cell level or higher, prioritize cells
        if (this.level >= 3) {
            const cells = this.environment.getAllCells ? this.environment.getAllCells() : [];
            for (const cell of cells) {
                if (cell.isAlive && cell.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'cell', entity: cell };
                }
            }
        }

        // At protein/polymer level, check polymers
        if (this.level >= 2) {
            const polymers = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
            for (const polymer of polymers) {
                // Check if click is near polymer center
                const center = polymer.getCenter();
                const screenCX = (center.x + offset.x) * scale;
                const screenCY = (center.y + offset.y) * scale;
                const radius = (15 + polymer.molecules.length * 5) * scale;

                const dx = screenX - screenCX;
                const dy = screenY - screenCY;
                if (dx * dx + dy * dy <= radius * radius) {
                    return { type: 'polymer', entity: polymer };
                }
            }
        }

        // At molecule level or higher, check molecules
        if (this.level >= 1) {
            // Check molecules first
            for (const molecule of this.environment.getAllMolecules()) {
                if (molecule.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'molecule', entity: molecule };
                }
            }
            // Then check free atoms (not in molecules)
            for (const atom of this.environment.getAllAtoms()) {
                if (!atom.moleculeId && atom.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'atom', entity: atom };
                }
            }
        } else {
            // At atom level, prioritize atoms
            for (const atom of this.environment.getAllAtoms()) {
                if (atom.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'atom', entity: atom };
                }
            }
            // Then check molecules
            for (const molecule of this.environment.getAllMolecules()) {
                if (molecule.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'molecule', entity: molecule };
                }
            }
        }

        return null;
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('resize', this._resizeHandler);
    }
}

// Make available globally
window.AbstractionLevel = AbstractionLevel;
window.LEVEL_NAMES = LEVEL_NAMES;
window.Viewer = Viewer;

/**
 * Controls
 * User interaction handling
 */

class Controls {
    /**
     * Create controls handler
     * @param {Viewer} viewer - The viewer instance
     * @param {Simulation} simulation - The simulation instance
     * @param {Catalogue} catalogue - The catalogue instance
     */
    constructor(viewer, simulation, catalogue) {
        this.viewer = viewer;
        this.simulation = simulation;
        this.catalogue = catalogue;
        this.environment = simulation.environment;

        // Current tool
        this.tool = 'place';  // 'select', 'place', 'delete'
        this.selectedElement = 'C';  // Currently selected atom type for placement

        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            down: false,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0
        };

        // Selected blueprint for placement
        this.selectedBlueprint = null;

        // Key states
        this.keys = new Set();

        // Bind event handlers
        this._bindEvents();
    }

    /**
     * Bind all event listeners
     */
    _bindEvents() {
        const canvas = this.viewer.canvas;

        // Mouse events
        canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
        canvas.addEventListener('wheel', this._onWheel.bind(this));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard events
        document.addEventListener('keydown', this._onKeyDown.bind(this));
        document.addEventListener('keyup', this._onKeyUp.bind(this));
    }

    /**
     * Set current tool
     * @param {string} tool - Tool name
     */
    setTool(tool) {
        this.tool = tool;
        this.viewer.canvas.style.cursor = this._getCursorForTool(tool);

        // Update tool button visual state
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    /**
     * Get cursor style for tool
     */
    _getCursorForTool(tool) {
        switch (tool) {
            case 'select': return 'default';
            case 'place': return 'crosshair';
            case 'delete': return 'not-allowed';
            default: return 'default';
        }
    }

    /**
     * Set selected element for placement
     * @param {string} symbol - Element symbol
     */
    setSelectedElement(symbol) {
        this.selectedElement = symbol;
        this.selectedBlueprint = null;
    }

    /**
     * Set selected blueprint for placement
     * @param {Blueprint} blueprint - Blueprint to place
     */
    setSelectedBlueprint(blueprint) {
        this.selectedBlueprint = blueprint;
    }

    /**
     * Handle mouse down
     */
    _onMouseDown(event) {
        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mouse.down = true;
        this.mouse.dragStartX = x;
        this.mouse.dragStartY = y;

        // Right-click or middle-click for panning
        if (event.button === 1 || event.button === 2) {
            this.mouse.dragging = true;
            this.viewer.canvas.style.cursor = 'grabbing';
            return;
        }

        // Left-click actions based on tool
        switch (this.tool) {
            case 'place':
                this._handlePlace(x, y);
                break;
            case 'select':
                this._handleSelect(x, y);
                break;
            case 'delete':
                this._handleDelete(x, y);
                break;
        }
    }

    /**
     * Handle mouse move
     */
    _onMouseMove(event) {
        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mouse.x = x;
        this.mouse.y = y;

        // Panning
        if (this.mouse.dragging && this.mouse.down) {
            const dx = x - this.mouse.dragStartX;
            const dy = y - this.mouse.dragStartY;

            this.viewer.pan(-dx, -dy);

            this.mouse.dragStartX = x;
            this.mouse.dragStartY = y;
        }

        // Hover effects
        this._updateHover(x, y);
    }

    /**
     * Handle mouse up
     */
    _onMouseUp(event) {
        this.mouse.down = false;
        this.mouse.dragging = false;

        this.viewer.canvas.style.cursor = this._getCursorForTool(this.tool);
    }

    /**
     * Handle mouse wheel (zoom)
     */
    _onWheel(event) {
        event.preventDefault();

        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const delta = -Math.sign(event.deltaY);
        this.viewer.zoom(delta, x, y);
    }

    /**
     * Handle key down
     */
    _onKeyDown(event) {
        this.keys.add(event.key);

        // Number keys for abstraction level
        if (event.key >= '1' && event.key <= '5') {
            this.viewer.setLevel(parseInt(event.key) - 1);
            this._updateLevelButtons();
        }

        // Space to toggle simulation
        if (event.key === ' ') {
            event.preventDefault();
            this.simulation.toggle();
            this._updatePlayButton();
        }

        // S for step
        if (event.key === 's' || event.key === 'S') {
            this.simulation.step();
        }

        // Delete/Backspace to delete selected
        if (event.key === 'Delete' || event.key === 'Backspace') {
            this._deleteSelected();
        }

        // Escape to clear selection
        if (event.key === 'Escape') {
            this.viewer.clearSelection();
            this.selectedBlueprint = null;
        }
    }

    /**
     * Handle key up
     */
    _onKeyUp(event) {
        this.keys.delete(event.key);
    }

    /**
     * Handle place action
     */
    _handlePlace(screenX, screenY) {
        const worldPos = this.viewer.screenToWorld(screenX, screenY);

        // Check bounds
        if (worldPos.x < 0 || worldPos.x > this.environment.width ||
            worldPos.y < 0 || worldPos.y > this.environment.height) {
            return;
        }

        // At cell level (3+), place cells
        if (this.viewer.level >= 3) {
            const cell = new Cell(worldPos.x, worldPos.y);
            this.environment.addCell(cell);
        }
        else if (this.selectedBlueprint) {
            // Place blueprint
            const molecule = this.selectedBlueprint.instantiate(worldPos.x, worldPos.y);
            if (molecule) {
                for (const atom of molecule.atoms) {
                    this.environment.addAtom(atom);
                }
                for (const bond of molecule.bonds) {
                    this.environment.addBond(bond);
                }
                this.environment.addMolecule(molecule);
            }
        } else {
            // Place single atom
            const atom = new Atom(this.selectedElement, worldPos.x, worldPos.y);
            this.environment.addAtom(atom);
        }

        // Immediate render so atom appears even when paused
        this.viewer.render();
    }

    /**
     * Handle select action
     */
    _handleSelect(screenX, screenY) {
        const result = this.viewer.getEntityAt(screenX, screenY);

        this.viewer.clearSelection();

        if (result) {
            if (result.type === 'atom') {
                result.entity.selected = true;
                this.viewer.selectedAtom = result.entity;
            } else if (result.type === 'molecule') {
                result.entity.selected = true;
                this.viewer.selectedMolecule = result.entity;
            } else if (result.type === 'cell') {
                this.viewer.selectedCell = result.entity;
            } else if (result.type === 'polymer') {
                result.entity.selected = true;
            }

            this._updateInspector(result);
            this._switchToInspectorTab();
        }
    }

    /**
     * Switch to inspector tab
     */
    _switchToInspectorTab() {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'inspector');
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'inspectorTab');
        });
    }

    /**
     * Handle delete action
     */
    _handleDelete(screenX, screenY) {
        const result = this.viewer.getEntityAt(screenX, screenY);
        if (!result) return;

        // At cell level (3) or higher, delete cells
        if (this.viewer.level >= 3 && result.type === 'cell') {
            this.environment.removeCell(result.entity.id);
        }
        // At molecule level (1) or higher, delete entire molecules
        else if (this.viewer.level >= 1 && result.type === 'molecule') {
            const atoms = [...result.entity.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(result.entity.id);
        } else if (result.type === 'atom') {
            this.environment.removeAtom(result.entity.id);
        } else if (result.type === 'molecule') {
            // Fallback: delete molecule at any level
            const atoms = [...result.entity.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(result.entity.id);
        }

        // Immediate render to show deletion
        this.viewer.render();
    }

    /**
     * Delete currently selected entity
     */
    _deleteSelected() {
        if (this.viewer.selectedAtom) {
            this.environment.removeAtom(this.viewer.selectedAtom.id);
            this.viewer.selectedAtom = null;
        }
        if (this.viewer.selectedMolecule) {
            // Delete all atoms in molecule
            const atoms = [...this.viewer.selectedMolecule.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(this.viewer.selectedMolecule.id);
            this.viewer.selectedMolecule = null;
        }
    }

    /**
     * Update hover effects
     */
    _updateHover(screenX, screenY) {
        // Clear previous hover
        if (this.viewer.hoveredAtom) {
            this.viewer.hoveredAtom.highlighted = false;
            this.viewer.hoveredAtom = null;
        }
        if (this.viewer.hoveredMolecule) {
            this.viewer.hoveredMolecule.highlighted = false;
            this.viewer.hoveredMolecule = null;
        }

        // Find new hover
        const result = this.viewer.getEntityAt(screenX, screenY);

        if (result) {
            result.entity.highlighted = true;
            if (result.type === 'atom') {
                this.viewer.hoveredAtom = result.entity;
            } else {
                this.viewer.hoveredMolecule = result.entity;
            }
        }
    }

    /**
     * Update level buttons UI
     */
    _updateLevelButtons() {
        const buttons = document.querySelectorAll('.level-btn');
        buttons.forEach((btn, i) => {
            btn.classList.toggle('active', i === this.viewer.level);
        });
    }

    /**
     * Update play button UI
     */
    _updatePlayButton() {
        const btn = document.getElementById('playPauseBtn');
        if (btn) {
            btn.textContent = this.simulation.running ? 'Pause' : 'Play';
        }
    }

    /**
     * Update inspector panel
     */
    _updateInspector(result) {
        const content = document.getElementById('inspectorContent');
        if (!content) return;

        if (result.type === 'atom') {
            const atom = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${atom.element.name} (${atom.symbol})</h3>
                    <p>Atomic Number: ${atom.element.number}</p>
                    <p>Mass: ${atom.mass.toFixed(3)} u</p>
                    <p>Valence: ${atom.bondCount}/${atom.maxBonds}</p>
                    <p>Bonds: ${atom.bonds.length}</p>
                    <p>Position: (${atom.position.x.toFixed(1)}, ${atom.position.y.toFixed(1)})</p>
                    ${atom.moleculeId ? `<p>Molecule ID: ${atom.moleculeId.substring(0, 8)}...</p>` : ''}
                </div>
            `;
        } else if (result.type === 'molecule') {
            const mol = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${mol.name || mol.formula}</h3>
                    <p>Formula: ${mol.formula}</p>
                    <p>Mass: ${mol.mass.toFixed(3)} u</p>
                    <p>Atoms: ${mol.atoms.length}</p>
                    <p>Bonds: ${mol.bonds.length}</p>
                    <p>Stable: ${mol.isStable() ? 'Yes &#10003;' : 'No'}</p>
                    ${mol.isStable() ? '<button class="tool-btn" onclick="window.app.registerMolecule()">Add to Catalogue</button>' : ''}
                </div>
            `;
        } else if (result.type === 'cell') {
            const cell = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>Cell (Gen ${cell.generation})</h3>
                    <p>Energy: ${cell.energy.toFixed(1)} / ${cell.maxEnergy}</p>
                    <p>Age: ${cell.age} ticks</p>
                    <p>Position: (${cell.position.x.toFixed(1)}, ${cell.position.y.toFixed(1)})</p>
                    <p>Brain: ${cell.brain.layers.join(' â†’ ')}</p>
                    <p>Weights: ${cell.brain.getWeightCount()}</p>
                    <p>Alive: ${cell.isAlive ? 'Yes &#10003;' : 'No'}</p>
                </div>
            `;
        } else if (result.type === 'polymer') {
            const poly = result.entity;
            const typeLabel = poly.getLabel ? poly.getLabel() : 'Polymer';
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${poly.name || typeLabel}</h3>
                    <p>Type: ${typeLabel}</p>
                    <p>Molecules: ${poly.molecules.length}</p>
                    <p>Sequence: ${poly.sequence.substring(0, 30)}${poly.sequence.length > 30 ? '...' : ''}</p>
                    <p>Mass: ${poly.mass.toFixed(3)} u</p>
                    <p>Stable: ${poly.isStable() ? 'Yes &#10003;' : 'No'}</p>
                </div>
            `;
        }
    }
}

// Make available globally
window.Controls = Controls;

/**
 * Catalogue UI
 * User interface for the catalogue panel
 */

class CatalogueUI {
    /**
     * Create catalogue UI
     * @param {Catalogue} catalogue - The catalogue instance
     * @param {Controls} controls - The controls instance
     */
    constructor(catalogue, controls) {
        this.catalogue = catalogue;
        this.controls = controls;

        // DOM elements
        this.listContainer = document.getElementById('catalogueList');
        this.searchInput = document.getElementById('catalogueSearch');

        // Set up callbacks
        this.catalogue.onBlueprintAdded = this._onBlueprintAdded.bind(this);

        // Bind events
        this._bindEvents();

        // Initial render
        this.render();
    }

    /**
     * Bind event listeners
     */
    _bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', Utils.debounce(() => {
                this.render(this.searchInput.value);
            }, 200));
        }
    }

    /**
     * Callback when new blueprint is added
     */
    _onBlueprintAdded(blueprint) {
        this.render();
    }

    /**
     * Render the catalogue list
     * @param {string} filter - Optional search filter
     */
    render(filter = '') {
        if (!this.listContainer) return;

        const blueprints = filter
            ? this.catalogue.search(filter)
            : this.catalogue.getAllMolecules();

        if (blueprints.length === 0) {
            this.listContainer.innerHTML = `
                <p class="empty-state">
                    ${filter ? 'No matches found.' : 'No blueprints yet. Create stable molecules to add them!'}
                </p>
            `;
            return;
        }

        // Sort by creation date (newest first)
        blueprints.sort((a, b) => b.createdAt - a.createdAt);

        this.listContainer.innerHTML = blueprints.map(bp => this._renderItem(bp)).join('');

        // Bind click handlers
        this.listContainer.querySelectorAll('.catalogue-item').forEach(item => {
            const fingerprint = item.dataset.fingerprint;

            item.addEventListener('click', () => {
                this._selectBlueprint(fingerprint);
            });

            item.addEventListener('dblclick', () => {
                // Place immediately at center
                const bp = this.catalogue.getMolecule(fingerprint);
                if (bp) {
                    this.controls.setSelectedBlueprint(bp);
                }
            });
        });
    }

    /**
     * Render a single catalogue item
     */
    _renderItem(blueprint) {
        const isSelected = this.controls.selectedBlueprint?.fingerprint === blueprint.fingerprint;
        const atomCount = blueprint.atomData ? blueprint.atomData.length : 0;
        // Encode fingerprint for safe HTML attribute storage
        const encodedFingerprint = encodeURIComponent(blueprint.fingerprint);

        return `
            <div class="catalogue-item ${isSelected ? 'selected' : ''}" 
                 data-fingerprint="${encodedFingerprint}"
                 title="${blueprint.name} - ${blueprint.formula}">
                <div class="catalogue-item-preview">
                    <canvas class="preview-canvas" 
                            width="40" height="40"
                            data-fingerprint="${encodedFingerprint}"></canvas>
                </div>
                <div class="catalogue-item-info">
                    <div class="catalogue-item-name">${blueprint.name}</div>
                    <div class="catalogue-item-formula">${atomCount} atoms</div>
                </div>
                <div class="catalogue-item-status">
                    ${blueprint.isStable ? '&#10003;' : '!'}
                </div>
            </div>
        `;
    }

    /**
     * Select a blueprint for placement
     */
    _selectBlueprint(encodedFingerprint) {
        // Decode the URI-encoded fingerprint
        const fingerprint = decodeURIComponent(encodedFingerprint);
        const blueprint = this.catalogue.getMolecule(fingerprint);
        if (blueprint) {
            this.controls.setSelectedBlueprint(blueprint);
            this.controls.setTool('place');

            // Update UI
            document.querySelectorAll('.catalogue-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.fingerprint === encodedFingerprint);
            });

            // Clear atom selection
            document.querySelectorAll('.atom-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }
    }

    /**
     * Render preview canvases
     */
    renderPreviews() {
        const canvases = this.listContainer.querySelectorAll('.preview-canvas');

        canvases.forEach(canvas => {
            const fingerprint = canvas.dataset.fingerprint;
            const blueprint = this.catalogue.getMolecule(fingerprint);

            if (blueprint) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                blueprint.renderPreview(ctx, canvas.width / 2, canvas.height / 2, 35);
            }
        });
    }
}

// Style additions for catalogue items
const style = document.createElement('style');
style.textContent = `
    .catalogue-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        cursor: pointer;
        transition: all 150ms ease;
    }
    
    .catalogue-item:hover {
        border-color: var(--accent-primary);
        transform: translateX(4px);
    }
    
    .catalogue-item.selected {
        border-color: var(--accent-primary);
        background: rgba(99, 102, 241, 0.1);
    }
    
    .catalogue-item-preview {
        flex-shrink: 0;
    }
    
    .preview-canvas {
        display: block;
        background: var(--bg-secondary);
        border-radius: 4px;
    }
    
    .catalogue-item-info {
        flex: 1;
        min-width: 0;
    }
    
    .catalogue-item-name {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .catalogue-item-formula {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .catalogue-item-status {
        font-size: 1rem;
    }
    
    .inspector-item {
        padding: 8px 0;
    }
    
    .inspector-item h3 {
        font-size: 1rem;
        margin-bottom: 8px;
        color: var(--accent-primary);
    }
    
    .inspector-item p {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-bottom: 4px;
    }
`;
document.head.appendChild(style);

// Make available globally
window.CatalogueUI = CatalogueUI;

/**
 * Main Application Entry Point
 * Initializes and connects all components
 */

class App {
    constructor() {
        // Core components
        this.environment = null;
        this.simulation = null;
        this.catalogue = null;
        this.viewer = null;
        this.controls = null;
        this.catalogueUI = null;

        // State
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('ðŸ§¬ Initializing Cell Simulator...');

        // Create environment
        this.environment = new Environment(2000, 2000);

        // Create simulation
        this.simulation = new Simulation(this.environment);

        // Create and initialize catalogue
        this.catalogue = new Catalogue();
        await this.catalogue.init();

        // Create viewer
        const canvas = document.getElementById('simCanvas');
        this.viewer = new Viewer(canvas, this.environment);
        this.viewer.centerCamera();

        // Create controls
        this.controls = new Controls(this.viewer, this.simulation, this.catalogue);

        // Create catalogue UI
        this.catalogueUI = new CatalogueUI(this.catalogue, this.controls);

        // Set up simulation callbacks
        this.simulation.onUpdate = () => {
            this.viewer.render();
            this._updateStats();
        };

        this.simulation.onTick = (tick) => {
            // Auto-discover stable molecules every 60 ticks
            if (tick % 60 === 0) {
                this.catalogue.autoDiscover(this.environment.getAllMolecules());
                this.catalogueUI.render();
            }
        };

        // Update stats when viewer renders (for when paused)
        this.viewer.onRender = () => {
            this._updateStats();
        };

        // Set up UI
        this._setupUI();

        // Initial render
        this.viewer.render();

        // Add some initial atoms for demo
        this._addDemoAtoms();

        this.initialized = true;
        console.log('âœ… Cell Simulator initialized!');
    }

    /**
     * Set up UI event handlers
     */
    _setupUI() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn?.addEventListener('click', () => {
            this.simulation.toggle();
            playPauseBtn.textContent = this.simulation.running ? 'Pause' : 'Play';
        });

        // Step button
        const stepBtn = document.getElementById('stepBtn');
        stepBtn?.addEventListener('click', () => {
            this.simulation.step();
            this.viewer.render();
            this._updateStats();
        });

        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        speedSlider?.addEventListener('input', (e) => {
            const speed = e.target.value / 50;  // 0.02 to 2.0
            this.simulation.setSpeed(speed);
        });

        // Level buttons
        const levelButtons = document.getElementById('levelButtons');
        levelButtons?.addEventListener('click', (e) => {
            const btn = e.target.closest('.level-btn');
            if (btn) {
                const level = parseInt(btn.dataset.level);
                this.viewer.setLevel(level);

                // Update button states
                document.querySelectorAll('.level-btn').forEach((b, i) => {
                    b.classList.toggle('active', i === level);
                });
            }
        });

        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.controls.setTool(tool);

                // Update button states
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
                    b.classList.toggle('active', b.dataset.tool === tool);
                });
            });
        });

        // Atom palette
        this._populateAtomPalette();

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === tab);
                });

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === tab + 'Tab');
                });
            });
        });
    }

    /**
     * Populate the atom palette with available elements
     */
    _populateAtomPalette() {
        const palette = document.getElementById('atomPalette');
        if (!palette) return;

        // Essential elements for Phase 1
        const elements = ['H', 'C', 'N', 'O', 'P', 'S', 'Na', 'Cl'];

        palette.innerHTML = elements.map(symbol => {
            const element = getElement(symbol);
            return `
                <button class="atom-btn ${symbol === 'C' ? 'selected' : ''}" 
                        data-symbol="${symbol}"
                        style="color: ${element.color}; border-color: ${element.color}40;">
                    <span class="symbol">${symbol}</span>
                    <span class="number">${element.number}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        palette.querySelectorAll('.atom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                this.controls.setSelectedElement(symbol);

                // Update selection state
                palette.querySelectorAll('.atom-btn').forEach(b => {
                    b.classList.toggle('selected', b.dataset.symbol === symbol);
                });

                // Clear blueprint selection
                this.controls.selectedBlueprint = null;
            });
        });
    }

    /**
     * Update statistics display
     */
    _updateStats() {
        const stats = this.simulation.getStats();

        document.getElementById('atomCount').textContent = `Atoms: ${stats.atomCount}`;
        document.getElementById('moleculeCount').textContent = `Mol: ${stats.moleculeCount}`;
        document.getElementById('proteinCount').textContent = `Prot: ${stats.proteinCount || 0}`;
        document.getElementById('cellCount').textContent = `Cells: ${stats.cellCount}`;
        document.getElementById('tickCounter').textContent = `Tick: ${stats.tick}`;
        document.getElementById('fpsCounter').textContent = `FPS: ${stats.fps}`;
    }

    /**
     * Add demo atoms for testing
     */
    _addDemoAtoms() {
        const centerX = this.environment.width / 2;
        const centerY = this.environment.height / 2;

        // Create a water molecule (H2O) manually
        const oxygen = new Atom('O', centerX, centerY);
        const hydrogen1 = new Atom('H', centerX - 30, centerY - 20);
        const hydrogen2 = new Atom('H', centerX + 30, centerY - 20);

        this.environment.addAtom(oxygen);
        this.environment.addAtom(hydrogen1);
        this.environment.addAtom(hydrogen2);

        // Create bonds
        const bond1 = new Bond(oxygen, hydrogen1, 1);
        const bond2 = new Bond(oxygen, hydrogen2, 1);

        this.environment.addBond(bond1);
        this.environment.addBond(bond2);

        // Add some free atoms
        for (let i = 0; i < 10; i++) {
            const symbol = Utils.randomChoice(['C', 'H', 'O', 'N']);
            const x = centerX + Utils.random(-200, 200);
            const y = centerY + Utils.random(-200, 200);
            const atom = new Atom(symbol, x, y);
            this.environment.addAtom(atom);
        }

        // Update molecules
        this.environment.updateMolecules();
    }

    /**
     * Register currently selected molecule to catalogue
     */
    registerMolecule() {
        if (this.viewer.selectedMolecule && this.viewer.selectedMolecule.isStable()) {
            const name = prompt('Enter a name for this molecule:', this.viewer.selectedMolecule.formula);
            if (name) {
                this.catalogue.registerMolecule(this.viewer.selectedMolecule, name);
                this.catalogueUI.render();
            }
        }
    }

    /**
     * Export simulation state
     */
    exportState() {
        const state = {
            environment: this.environment.serialize(),
            catalogue: this.catalogue.export()
        };

        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'cell-simulator-state.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Import simulation state
     */
    importState(json) {
        try {
            const state = JSON.parse(json);

            if (state.environment) {
                this.environment.deserialize(state.environment);
            }
            if (state.catalogue) {
                this.catalogue.import(state.catalogue);
            }

            this.viewer.render();
            this._updateStats();
            this.catalogueUI.render();

            console.log('State imported successfully');
        } catch (e) {
            console.error('Failed to import state:', e);
        }
    }
}

// Create global app instance
window.app = new App();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init().catch(console.error);
});

