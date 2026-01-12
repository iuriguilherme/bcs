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
