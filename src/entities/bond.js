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
     * Break this bond with energy release
     * @param {boolean} addEnergy - Whether to add repulsion velocity (default true)
     */
    break(addEnergy = true) {
        // Release energy as velocity pushing atoms apart
        if (addEnergy && this.atom1 && this.atom2) {
            const delta = this.atom2.position.sub(this.atom1.position);
            const dist = delta.length();
            if (dist > 0) {
                const direction = delta.normalize();
                // Energy released proportional to bond strength
                const energyFactor = 3 + this.order * 2;  // Higher order = more energy
                this.atom1.velocity = this.atom1.velocity.add(direction.mul(-energyFactor));
                this.atom2.velocity = this.atom2.velocity.add(direction.mul(energyFactor));
            }
        }
        
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
