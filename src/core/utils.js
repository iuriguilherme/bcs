/**
 * Core Utilities
 * Helper functions used throughout the simulation
 */

/**
 * Debug System
 * Toggle verbose logging via console: Debug.enable() / Debug.disable()
 * Filter by molecule ID: Debug.watchMolecule('molecule-id')
 * Filter by formula: Debug.watchFormula('H2O')
 */
const Debug = {
    enabled: false,
    watchedMoleculeId: null,
    watchedFormula: null,
    categories: {
        reshape: true,
        bonds: true,
        molecules: true,
        sync: false,  // Very verbose, off by default
        decay: true,
        intentions: true
    },

    enable() {
        this.enabled = true;
        console.log('%c[Debug] Verbose logging ENABLED', 'color: #00ff00; font-weight: bold');
        console.log('  Debug.disable() - Turn off');
        console.log('  Debug.watchMolecule(id) - Filter by molecule ID');
        console.log('  Debug.watchFormula("H2O") - Filter by formula');
        console.log('  Debug.clearWatch() - Clear filters');
        console.log('  Debug.category("sync", true) - Enable/disable category');
    },

    disable() {
        this.enabled = false;
        console.log('%c[Debug] Verbose logging DISABLED', 'color: #ff6600; font-weight: bold');
    },

    watchMolecule(id) {
        this.watchedMoleculeId = id;
        this.enabled = true;
        console.log(`%c[Debug] Watching molecule: ${id}`, 'color: #00ffff; font-weight: bold');
    },

    watchFormula(formula) {
        this.watchedFormula = formula;
        this.enabled = true;
        console.log(`%c[Debug] Watching formula: ${formula}`, 'color: #00ffff; font-weight: bold');
    },

    clearWatch() {
        this.watchedMoleculeId = null;
        this.watchedFormula = null;
        console.log('%c[Debug] Watch filters cleared', 'color: #ffff00');
    },

    category(name, enabled) {
        if (this.categories.hasOwnProperty(name)) {
            this.categories[name] = enabled;
            console.log(`%c[Debug] Category '${name}' ${enabled ? 'ENABLED' : 'DISABLED'}`, 'color: #ffff00');
        } else {
            console.log(`Available categories: ${Object.keys(this.categories).join(', ')}`);
        }
    },

    /**
     * Check if we should log for this molecule
     */
    shouldLog(category, molecule = null) {
        if (!this.enabled) return false;
        if (!this.categories[category]) return false;
        
        // If watching specific molecule/formula, filter
        if (this.watchedMoleculeId && molecule) {
            if (molecule.id !== this.watchedMoleculeId) return false;
        }
        if (this.watchedFormula && molecule) {
            if (molecule.formula !== this.watchedFormula) return false;
        }
        return true;
    },

    /**
     * Log molecule-related message with rich context
     */
    logMolecule(category, action, molecule, extra = {}) {
        if (!this.shouldLog(category, molecule)) return;

        const id = molecule.id.substring(0, 8);  // Short ID
        const formula = molecule.formula || '?';
        const atomCount = molecule.atoms?.length || 0;
        const bondCount = molecule.bonds?.length || 0;
        // Don't call isStable() here - it would cause infinite recursion
        const reshaping = molecule.isReshaping ? 'RESHAPING' : '';
        const verified = molecule.geometryVerified ? 'VERIFIED' : '';

        let msg = `[${category.toUpperCase()}] ${action} | ${formula} (${id}) | atoms:${atomCount} bonds:${bondCount} | ${reshaping} ${verified}`;
        
        if (Object.keys(extra).length > 0) {
            msg += ` | ${JSON.stringify(extra)}`;
        }

        const color = {
            reshape: '#ff00ff',
            bonds: '#00ff00',
            molecules: '#00ffff',
            sync: '#888888',
            decay: '#ff6600',
            intentions: '#ffff00'
        }[category] || '#ffffff';

        console.log(`%c${msg}`, `color: ${color}`);
    },

    /**
     * Log bond-related message
     */
    logBond(action, bond, molecule = null, extra = {}) {
        if (!this.shouldLog('bonds', molecule)) return;

        const atom1 = `${bond.atom1?.symbol || '?'}(${bond.atom1?.id?.substring(0, 6) || '?'})`;
        const atom2 = `${bond.atom2?.symbol || '?'}(${bond.atom2?.id?.substring(0, 6) || '?'})`;
        const molId = molecule ? molecule.id.substring(0, 8) : 'none';

        let msg = `[BOND] ${action} | ${atom1} --${bond.order || 1}-- ${atom2} | mol:${molId}`;
        
        if (Object.keys(extra).length > 0) {
            msg += ` | ${JSON.stringify(extra)}`;
        }

        console.log(`%c${msg}`, 'color: #00ff00');
    },

    /**
     * Log state dump for a molecule (detailed)
     */
    dumpMolecule(molecule) {
        console.group(`%c[DUMP] Molecule ${molecule.formula} (${molecule.id})`, 'color: #ff00ff; font-weight: bold');
        console.log('ID:', molecule.id);
        console.log('Formula:', molecule.formula);
        console.log('Name:', molecule.name);
        console.log('Atoms:', molecule.atoms?.length, molecule.atoms?.map(a => `${a.symbol}(${a.id.substring(0,6)})`));
        console.log('Bonds:', molecule.bonds?.length, molecule.bonds?.map(b => `${b.atom1?.symbol}-${b.atom2?.symbol} o${b.order}`));
        console.log('isStable():', molecule.isStable?.());
        console.log('hasValidValence():', molecule.hasValidValence?.());
        console.log('isReshaping:', molecule.isReshaping);
        console.log('geometryVerified:', molecule.geometryVerified);
        console.log('reshapingTimer:', molecule.reshapingTimer);
        console.log('targetTemplate:', molecule.targetTemplate?.name);
        console.log('atomToTemplateIndex size:', molecule.atomToTemplateIndex?.size);
        console.log('Atom valences:', molecule.atoms?.map(a => `${a.symbol}: ${a.bondCount}/${a.maxBonds} (avail:${a.availableValence})`));
        console.groupEnd();
    }
};

// Make Debug available globally
window.Debug = Debug;

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
