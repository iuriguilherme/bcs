/**
 * Prokaryote
 * Chemistry-based unicellular organism
 * Level 4 in the abstraction hierarchy (above polymers)
 * 
 * Prokaryotes are simpler than eukaryotes:
 * - No membrane-bound nucleus (nucleoid region instead)
 * - No organelles (ribosomes are free in cytoplasm)
 * - Single circular chromosome
 * 
 * Required components:
 * - Membrane: LIPID polymers forming boundary
 * - Nucleoid: NUCLEIC_ACID polymers (DNA)
 * 
 * Optional components:
 * - Ribosomes: PROTEIN polymers
 * - Plasmids: Additional small NUCLEIC_ACID polymers
 */

class Prokaryote {
    /**
     * Create a prokaryote from polymers
     * @param {object} components - Object containing component arrays
     * @param {Polymer[]} components.membrane - LIPID polymers forming cell boundary
     * @param {Polymer[]} components.nucleoid - NUCLEIC_ACID polymers (genetic material)
     * @param {Polymer[]} components.ribosomes - PROTEIN polymers (optional)
     */
    constructor(components = {}) {
        this.id = Utils.generateId();

        // Core structural components
        this.membrane = components.membrane || [];
        this.nucleoid = components.nucleoid || [];
        this.ribosomes = components.ribosomes || [];

        // Link polymers to this prokaryote
        for (const polymer of [...this.membrane, ...this.nucleoid, ...this.ribosomes]) {
            polymer.prokaryoteId = this.id;
        }

        // Cytoplasm contents
        this.cytoplasm = {
            molecules: [],      // Free molecules inside the cell
            atp: 100,           // Energy currency (arbitrary units)
            maxAtp: 200
        };

        // Physical properties (derived from membrane)
        this._updatePhysicalProperties();

        // State
        this.age = 0;
        this.isAlive = true;
        this.generation = 0;

        // Metabolic rates
        this.baseMetabolism = 0.05;     // ATP consumed per tick
        this.atpPerCarbohydrate = 10;   // ATP gained from digesting carbohydrate

        // Division properties
        this.divisionThreshold = 150;   // ATP needed to divide
        this.divisionCooldown = 0;
        this.divisionCooldownMax = 500; // Ticks between divisions

        // Selection state
        this.selected = false;
        this.highlighted = false;
    }

    /**
     * Update physical properties from membrane polymers
     */
    _updatePhysicalProperties() {
        if (this.membrane.length === 0) {
            // Keep existing position if already set, otherwise default to 0,0
            if (!this.position) {
                this.position = new Vector2(0, 0);
            }
            this.radius = 30;
            return;
        }

        // Calculate center from all membrane polymers
        let sumX = 0, sumY = 0;
        let atomCount = 0;

        for (const polymer of this.membrane) {
            const center = polymer.getCenter();
            sumX += center.x;
            sumY += center.y;
            atomCount++;
        }

        this.position = atomCount > 0
            ? new Vector2(sumX / atomCount, sumY / atomCount)
            : new Vector2(0, 0);

        // Radius based on membrane size
        const totalMass = this.membrane.reduce((sum, p) => sum + (p.mass || 0), 0);
        this.radius = Math.max(30, 20 + Math.sqrt(totalMass) * 2);
    }

    /**
     * Check if prokaryote is valid (has minimum required components)
     */
    isValid() {
        return this.membrane.length > 0 && this.nucleoid.length > 0;
    }

    /**
     * Check if point is inside the cell
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
     * Update prokaryote state
     * @param {number} dt - Delta time
     * @param {Environment} environment - Environment reference
     */
    update(dt, environment) {
        if (!this.isAlive) return;

        this.age++;
        this.divisionCooldown = Math.max(0, this.divisionCooldown - 1);

        // Metabolism - consume ATP
        this.cytoplasm.atp -= this.baseMetabolism * dt;

        // Check death
        if (this.cytoplasm.atp <= 0) {
            this.die(environment);
            return;
        }

        // Update physical properties
        this._updatePhysicalProperties();

        // Update component polymers
        for (const polymer of this.membrane) {
            polymer.update(dt);
        }
        for (const polymer of this.nucleoid) {
            polymer.update(dt);
        }
        for (const polymer of this.ribosomes) {
            polymer.update(dt);
        }

        // Try to absorb nearby nutrients
        this._tryAbsorbNutrients(environment);

        // Check binary fission (cell division)
        if (this.canDivide()) {
            this._divide(environment);
        }
    }

    /**
     * Try to absorb nearby carbohydrate polymers as nutrients
     */
    _tryAbsorbNutrients(environment) {
        // Look for nearby carbohydrate polymers (food source)
        if (!environment.polymers) return;

        for (const [polymerId, polymer] of environment.polymers) {
            // Skip polymers already part of a prokaryote
            if (polymer.prokaryoteId) continue;

            // Only absorb carbohydrates
            if (polymer.type !== PolymerType.CARBOHYDRATE) continue;

            const distance = Utils.distance(
                this.position.x, this.position.y,
                polymer.getCenter().x, polymer.getCenter().y
            );

            // Absorb if close enough
            if (distance < this.radius + 20) {
                // Gain ATP from carbohydrate
                const atpGain = this.atpPerCarbohydrate * polymer.molecules.length;
                this.cytoplasm.atp = Math.min(this.cytoplasm.maxAtp, this.cytoplasm.atp + atpGain);

                // Remove the polymer from environment
                environment.removePolymer(polymerId);
                break; // Only absorb one per tick
            }
        }
    }

    /**
     * Check if prokaryote can divide
     */
    canDivide() {
        return this.isAlive &&
            this.cytoplasm.atp >= this.divisionThreshold &&
            this.divisionCooldown === 0 &&
            this.age > 100;
    }

    /**
     * Binary fission - divide into two daughter cells
     */
    _divide(environment) {
        if (!this.canDivide()) return null;

        // Cost of division
        this.cytoplasm.atp -= this.divisionThreshold * 0.7;
        this.divisionCooldown = this.divisionCooldownMax;

        // Create offspring at offset position
        const offsetX = (Math.random() - 0.5) * this.radius * 2;
        const offsetY = (Math.random() - 0.5) * this.radius * 2;

        // For simplicity, create a new prokaryote with empty components
        // In a full simulation, we'd actually duplicate polymers
        const offspring = new Prokaryote({
            membrane: [],
            nucleoid: [],
            ribosomes: []
        });

        offspring.position = new Vector2(
            this.position.x + offsetX,
            this.position.y + offsetY
        );
        offspring.generation = this.generation + 1;
        offspring.cytoplasm.atp = this.divisionThreshold * 0.3;
        offspring.radius = this.radius * 0.8;

        // Add to environment
        if (environment.addProkaryote) {
            environment.addProkaryote(offspring);
        }

        return offspring;
    }

    /**
     * Cell death
     */
    die(environment) {
        this.isAlive = false;

        // Unlink polymers
        for (const polymer of [...this.membrane, ...this.nucleoid, ...this.ribosomes]) {
            polymer.prokaryoteId = null;
        }

        // In future: release polymers back to environment
    }

    /**
     * Get total atom count
     */
    getAtomCount() {
        let count = 0;
        for (const polymer of [...this.membrane, ...this.nucleoid, ...this.ribosomes]) {
            count += polymer.getAllAtoms().length;
        }
        return count;
    }

    /**
     * Get component summary
     */
    getComponentSummary() {
        return {
            membrane: this.membrane.length,
            nucleoid: this.nucleoid.length,
            ribosomes: this.ribosomes.length,
            totalPolymers: this.membrane.length + this.nucleoid.length + this.ribosomes.length
        };
    }

    /**
     * Render the prokaryote
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

        ctx.save();

        // Cell membrane (outer boundary)
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);

        // Fill with gradient
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, screenRadius
        );
        gradient.addColorStop(0, 'rgba(200, 230, 200, 0.7)');
        gradient.addColorStop(0.7, 'rgba(150, 200, 150, 0.5)');
        gradient.addColorStop(1, 'rgba(100, 150, 100, 0.3)');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Membrane outline (lipid bilayer visualization)
        ctx.strokeStyle = this.selected ? '#f59e0b' : '#22c55e';
        ctx.lineWidth = 3 * scale;
        ctx.stroke();

        // Nucleoid region (irregular shape in center)
        ctx.beginPath();
        const nucleoidRadius = screenRadius * 0.4;
        ctx.ellipse(screenX, screenY, nucleoidRadius, nucleoidRadius * 0.7, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red for DNA
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        // Ribosomes (small dots)
        const ribosomeCount = Math.min(this.ribosomes.length * 2, 8);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'; // Blue for proteins
        for (let i = 0; i < ribosomeCount; i++) {
            const angle = (i / ribosomeCount) * Math.PI * 2;
            const dist = screenRadius * 0.6;
            const rx = screenX + Math.cos(angle) * dist;
            const ry = screenY + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(rx, ry, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        // ATP bar (energy indicator)
        const barWidth = screenRadius * 1.5;
        const barHeight = 4 * scale;
        const barX = screenX - barWidth / 2;
        const barY = screenY - screenRadius - 10 * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const atpRatio = Math.max(0, this.cytoplasm.atp / this.cytoplasm.maxAtp);
        ctx.fillStyle = atpRatio > 0.5 ? '#4ade80' : (atpRatio > 0.2 ? '#fbbf24' : '#ef4444');
        ctx.fillRect(barX, barY, barWidth * atpRatio, barHeight);

        // Generation label
        if (detailed) {
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`G${this.generation}`, screenX, screenY + 4 * scale);
        }

        ctx.restore();
    }

    /**
     * Serialize prokaryote data
     */
    serialize() {
        return {
            id: this.id,
            position: { x: this.position.x, y: this.position.y },
            radius: this.radius,
            age: this.age,
            generation: this.generation,
            isAlive: this.isAlive,
            cytoplasm: {
                atp: this.cytoplasm.atp,
                maxAtp: this.cytoplasm.maxAtp
            },
            membraneIds: this.membrane.map(p => p.id),
            nucleoidIds: this.nucleoid.map(p => p.id),
            ribosomeIds: this.ribosomes.map(p => p.id)
        };
    }

    /**
     * Deserialize prokaryote data
     * @param {object} data - Serialized data
     * @param {Map} polymers - Polymer map for looking up by ID
     */
    static deserialize(data, polymers) {
        const getPolymers = (ids) => ids.map(id => polymers.get(id)).filter(p => p);

        const prokaryote = new Prokaryote({
            membrane: getPolymers(data.membraneIds || []),
            nucleoid: getPolymers(data.nucleoidIds || []),
            ribosomes: getPolymers(data.ribosomeIds || [])
        });

        prokaryote.id = data.id;
        prokaryote.position = new Vector2(data.position.x, data.position.y);
        prokaryote.radius = data.radius;
        prokaryote.age = data.age;
        prokaryote.generation = data.generation;
        prokaryote.isAlive = data.isAlive;
        prokaryote.cytoplasm.atp = data.cytoplasm.atp;
        prokaryote.cytoplasm.maxAtp = data.cytoplasm.maxAtp;

        return prokaryote;
    }
}

// Make available globally
window.Prokaryote = Prokaryote;
