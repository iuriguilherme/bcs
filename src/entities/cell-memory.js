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
