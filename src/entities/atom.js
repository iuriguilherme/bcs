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
        this.moleculeId = null;       // Reference to parent molecule if bonded
        this.claimedByIntentId = null; // Intent that has claimed this atom (null = free)

        // Physics properties
        this.mass = this.element.mass;
        this.radius = this.element.radius * 0.5;  // Visual radius scaled down
        this.charge = 0;  // Net charge (for ions)
        
        // Repulsion tracking - Map of moleculeId -> remaining ticks of repulsion
        this.repulsions = new Map();
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
     * Whether this atom is isolated from normal inter-particle physics.
     * Claimed atoms are guided by intention attraction forces and must not be
     * displaced by free-atom repulsion (repulsion strength 500 >> intent attraction ~2).
     */
    get isPhysicsIsolated() {
        return !!this.claimedByIntentId;
        // Future: add || !!this.controlledByCellId when cell physics isolation is needed
    }

    /**
     * Check if this atom can bond with another
     * @param {Atom} other - The other atom
     * @param {number} order - Bond order (1, 2, or 3)
     * @param {Object} context - Optional context for intent-controlled bonding
     * @param {string} [context.intentId] - Intent ID for bypassing claim restrictions
     */
    canBondWith(other, order = 1, context = {}) {
        if (this === other) return false;

        // Context-aware bonding: intent-controlled bonds bypass claim restrictions
        if (context.intentId) {
            // This bond is being formed by an intent that claims this atom
            if (context.intentId === this.claimedByIntentId) {
                const valenceOk = this.availableValence >= order && other.availableValence >= order;
                if (!valenceOk && !context.allowOvervalence) return false;
                return !this.isBondedTo(other);
            }
        }

        // Claimed atoms refuse bonds from non-intent sources
        if (this.claimedByIntentId) return false;

        if (this.availableValence < order || other.availableValence < order) {
            if (!context.intentId || !context.allowOvervalence) return false;
        }

        // Sealed atoms (in stable polymers) cannot form new bonds
        if (this.isSealed || other.isSealed) return false;

        // Check if already bonded
        if (this.isBondedTo(other)) return false;

        // Check if this atom is repelled from the other atom's molecule
        if (other.moleculeId && this.repulsions.has(other.moleculeId)) return false;
        // Check if the other atom is repelled from this atom's molecule
        if (this.moleculeId && other.repulsions.has(this.moleculeId)) return false;

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
     * Add a repulsion from a molecule
     * @param {string} moleculeId - ID of the molecule to be repelled from
     * @param {number} duration - Duration in ticks (default 200)
     */
    addRepulsion(moleculeId, duration = 200) {
        this.repulsions.set(moleculeId, duration);
    }

    /**
     * Check if this atom is repelled from a molecule
     * @param {string} moleculeId - ID of the molecule
     * @returns {boolean}
     */
    isRepelledFrom(moleculeId) {
        return this.repulsions.has(moleculeId);
    }

    /**
     * Update repulsion timers, removing expired ones
     */
    updateRepulsions() {
        for (const [moleculeId, remaining] of this.repulsions) {
            if (remaining <= 1) {
                this.repulsions.delete(moleculeId);
            } else {
                this.repulsions.set(moleculeId, remaining - 1);
            }
        }
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
        // Decay repulsions
        this.updateRepulsions();
        
        // Verlet-style integration
        this.velocity = this.velocity.add(this.acceleration.mul(dt));

        // Apply damping (friction)
        this.velocity = this.velocity.mul(0.99);

        // Clamp speed to prevent tunnelling under strong expulsion forces.
        // repulsionForce=200 gives H atoms (mass=1.008) a terminal velocity of
        // ~330 world-units/tick, which exceeds the 300-unit intent zone radius.
        // If attractionStrength or bounceForce change in environment.js,
        // recalibrate this ceiling accordingly.
        const MAX_SPEED = 400;
        const speed = this.velocity.length();
        if (speed > MAX_SPEED) {
            this.velocity = this.velocity.mul(MAX_SPEED / speed);
        }

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
            moleculeId: this.moleculeId,
            claimedByIntentId: this.claimedByIntentId || null
        };
    }

    /**
     * Create atom from serialized data
     */
    static deserialize(data) {
        const x = Number.isFinite(data.x) ? data.x : 0;
        const y = Number.isFinite(data.y) ? data.y : 0;
        const atom = new Atom(data.symbol, x, y);
        atom.id = data.id;
        const vx = Number.isFinite(data.vx) ? data.vx : 0;
        const vy = Number.isFinite(data.vy) ? data.vy : 0;
        atom.velocity = new Vector2(vx, vy);
        atom.charge = Number.isFinite(data.charge) ? data.charge : 0;
        atom.moleculeId = data.moleculeId;
        atom.claimedByIntentId = data.claimedByIntentId || null;
        return atom;
    }
}

// Make available globally
window.Atom = Atom;
