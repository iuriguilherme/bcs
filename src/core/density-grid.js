/**
 * DensityGrid
 * A grid that stores element densities instead of tracking individual atoms.
 * Used during Abstract Mode to improve performance.
 */
class DensityGrid {
    /**
     * Create a new density grid
     * @param {number} width - World width
     * @param {number} height - World height
     * @param {number} gridSize - Size of each sector (default 100 to match spatial grid)
     */
    constructor(width, height, gridSize = 100) {
        this.width = width;
        this.height = height;
        this.gridSize = gridSize;
        this.sectors = new Map();

        this.cols = Math.ceil(width / gridSize);
        this.rows = Math.ceil(height / gridSize);

        // Initialize all sectors
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const key = `${x},${y}`;
                this.sectors.set(key, {
                    elements: {},
                    total: 0
                });
            }
        }

        this.diffusionRate = 0.02; // 2% of atoms diffuse per tick
    }

    /**
     * Clear the grid
     */
    clear() {
        for (const sector of this.sectors.values()) {
            sector.elements = {};
            sector.total = 0;
        }
    }

    /**
     * Get the sector key for a position
     */
    getSectorKey(x, y) {
        const col = Math.floor(x / this.gridSize);
        const row = Math.floor(y / this.gridSize);

        // Clamp to valid range
        const cCol = Math.max(0, Math.min(col, this.cols - 1));
        const cRow = Math.max(0, Math.min(row, this.rows - 1));

        return `${cCol},${cRow}`;
    }

    /**
     * Increment density for a specific element in a sector
     */
    addDensity(x, y, symbol, amount = 1) {
        const key = this.getSectorKey(x, y);
        const sector = this.sectors.get(key);
        if (!sector) return;

        sector.elements[symbol] = (sector.elements[symbol] || 0) + amount;
        sector.total += amount;
    }

    /**
     * Try to consume elements from a sector
     * Returns the actual amount consumed (may be less than requested)
     */
    consumeDensity(x, y, symbol, amount) {
        const key = this.getSectorKey(x, y);
        const sector = this.sectors.get(key);
        if (!sector || !sector.elements[symbol]) return 0;

        const available = sector.elements[symbol];
        const consumed = Math.min(available, amount);

        sector.elements[symbol] -= consumed;
        sector.total -= consumed;

        if (sector.elements[symbol] <= 0) {
            delete sector.elements[symbol];
        }

        return consumed;
    }

    /**
     * Update loop for the density grid (handles diffusion)
     */
    update(dt) {
        // Create a buffer for changes to apply simultaneously
        const changes = new Map();

        for (const [key, sector] of this.sectors.entries()) {
            if (sector.total === 0) continue;

            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);

            // Get neighbors
            const neighbors = [];
            if (x > 0) neighbors.push(`${x-1},${y}`);
            if (x < this.cols - 1) neighbors.push(`${x+1},${y}`);
            if (y > 0) neighbors.push(`${x},${y-1}`);
            if (y < this.rows - 1) neighbors.push(`${x},${y+1}`);

            if (neighbors.length === 0) continue;

            for (const [symbol, count] of Object.entries(sector.elements)) {
                if (count <= 0) continue;

                // Diffuse a small amount of this element to neighbors
                // Since counts are integers, we use probability for fractional diffusion
                const diffusionAmount = count * this.diffusionRate;
                const wholeAmount = Math.floor(diffusionAmount);
                const fraction = diffusionAmount - wholeAmount;

                let toDiffuse = wholeAmount;
                if (Math.random() < fraction) {
                    toDiffuse += 1;
                }

                if (toDiffuse <= 0) continue;

                // Ensure we don't diffuse more than we have
                toDiffuse = Math.min(toDiffuse, count);

                // Distribute to neighbors
                let distributed = 0;
                for (const neighborKey of neighbors) {
                    // Simple uniform distribution
                    if (Math.random() < 0.5) {
                        if (!changes.has(neighborKey)) changes.set(neighborKey, {});
                        changes.get(neighborKey)[symbol] = (changes.get(neighborKey)[symbol] || 0) + 1;
                        distributed++;
                        if (distributed >= toDiffuse) break;
                    }
                }

                // If not all distributed, randomly assign the rest
                let attempts = 0;
                while (distributed < toDiffuse && attempts < 10) {
                    const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
                    if (!changes.has(randomNeighbor)) changes.set(randomNeighbor, {});
                    changes.get(randomNeighbor)[symbol] = (changes.get(randomNeighbor)[symbol] || 0) + 1;
                    distributed++;
                    attempts++;
                }

                // Record subtractions for this sector
                if (distributed > 0) {
                    if (!changes.has(key)) changes.set(key, {});
                    changes.get(key)[symbol] = (changes.get(key)[symbol] || 0) - distributed;
                }
            }
        }

        // Apply changes
        for (const [key, elementChanges] of changes.entries()) {
            const sector = this.sectors.get(key);
            for (const [symbol, change] of Object.entries(elementChanges)) {
                sector.elements[symbol] = (sector.elements[symbol] || 0) + change;
                sector.total += change;

                if (sector.elements[symbol] <= 0) {
                    delete sector.elements[symbol];
                }
            }
        }
    }
}

// Make available globally
window.DensityGrid = DensityGrid;
