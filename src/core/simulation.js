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
