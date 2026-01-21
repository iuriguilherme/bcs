/**
 * AtomSpawner
 * System that automatically spawns random atoms in a defined zone
 */

class AtomSpawner {
    /**
     * Create a new atom spawner
     * @param {Environment} environment - The environment to spawn atoms in
     */
    constructor(environment) {
        this.environment = environment;
        this.id = Utils.generateId();

        // Spawner state
        this.active = false;
        this.tickInterval = 60;  // Ticks between spawns (default: 1 per second at 60fps)
        this.tickCounter = 0;

        // Atom pool - which atoms can be spawned
        this.atomPool = ['H', 'C', 'N', 'O'];  // Default pool

        // Atom weights - spawn probability multipliers (1-8)
        // Higher weight = more likely to spawn relative to others
        this.atomWeights = {};  // e.g., { H: 4, C: 2, O: 1 }

        // Spawn zone (in world coordinates)
        // Default: center of environment, 600x600 area
        const centerX = environment.width / 2;
        const centerY = environment.height / 2;
        this.zone = {
            x: centerX - 300,
            y: centerY - 300,
            width: 600,
            height: 600
        };

        // UI state for zone resizing
        this.resizing = false;
        this.resizeEdge = null;  // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
        this.resizeStartMouse = { x: 0, y: 0 };
        this.resizeStartZone = { x: 0, y: 0, width: 0, height: 0 };

        // Visual settings
        this.zoneColor = 'rgba(16, 185, 129, 0.3)';  // Green tint
        this.zoneBorderColor = 'rgba(16, 185, 129, 0.8)';
        this.handleSize = 10;
    }

    /**
     * Toggle spawner on/off
     */
    toggle() {
        this.active = !this.active;
        this.tickCounter = 0;
        return this.active;
    }

    /**
     * Set spawner active state
     * @param {boolean} active - Whether spawner is active
     */
    setActive(active) {
        this.active = active;
        if (active) {
            this.tickCounter = 0;
        }
    }

    /**
     * Set tick interval between spawns
     * @param {number} ticks - Number of ticks between spawns
     */
    setTickInterval(ticks) {
        this.tickInterval = Math.max(1, Math.floor(ticks));
    }

    /**
     * Set the atom pool
     * @param {string[]} atoms - Array of element symbols
     */
    setAtomPool(atoms) {
        if (atoms && atoms.length > 0) {
            this.atomPool = atoms.slice();
        }
    }

    /**
     * Set weight for a specific atom type
     * @param {string} symbol - Element symbol
     * @param {number} weight - Weight multiplier (1-8)
     */
    setAtomWeight(symbol, weight) {
        this.atomWeights[symbol] = Math.max(1, Math.min(8, weight));
    }

    /**
     * Set all atom weights at once
     * @param {object} weights - Map of symbol to weight
     */
    setAtomWeights(weights) {
        this.atomWeights = {};
        for (const symbol in weights) {
            this.setAtomWeight(symbol, weights[symbol]);
        }
    }

    /**
     * Get weight for an atom (defaults to 1 if not set)
     * @param {string} symbol - Element symbol
     * @returns {number} - Weight multiplier
     */
    getAtomWeight(symbol) {
        return this.atomWeights[symbol] || 1;
    }

    /**
     * Set the spawn zone
     * @param {number} x - Zone X position
     * @param {number} y - Zone Y position
     * @param {number} width - Zone width
     * @param {number} height - Zone height
     */
    setZone(x, y, width, height) {
        this.zone.x = Math.max(0, x);
        this.zone.y = Math.max(0, y);
        this.zone.width = Math.max(50, width);
        this.zone.height = Math.max(50, height);

        // Clamp to environment bounds
        if (this.zone.x + this.zone.width > this.environment.width) {
            this.zone.x = this.environment.width - this.zone.width;
        }
        if (this.zone.y + this.zone.height > this.environment.height) {
            this.zone.y = this.environment.height - this.zone.height;
        }
    }

    /**
     * Update spawner - called every simulation tick
     * @param {number} dt - Delta time
     */
    update(dt) {
        if (!this.active) return;

        this.tickCounter++;

        if (this.tickCounter >= this.tickInterval) {
            this.tickCounter = 0;
            this._spawnAtom();
        }
    }

    /**
     * Spawn a random atom in the zone using weighted selection
     */
    _spawnAtom() {
        if (this.atomPool.length === 0) return;

        // Pick atom using weighted random selection
        const symbol = this._selectWeightedAtom();

        // Pick random position in zone
        const x = this.zone.x + Math.random() * this.zone.width;
        const y = this.zone.y + Math.random() * this.zone.height;

        // Create and add atom
        const atom = new Atom(symbol, x, y);
        this.environment.addAtom(atom);
    }

    /**
     * Select an atom from the pool using weighted random selection
     * @returns {string} - Selected element symbol
     */
    _selectWeightedAtom() {
        // Calculate total weight
        let totalWeight = 0;
        for (const symbol of this.atomPool) {
            totalWeight += this.getAtomWeight(symbol);
        }

        // Random value in range [0, totalWeight)
        let random = Math.random() * totalWeight;

        // Walk through atoms, subtracting weights until we find the one
        for (const symbol of this.atomPool) {
            random -= this.getAtomWeight(symbol);
            if (random <= 0) {
                return symbol;
            }
        }

        // Fallback (should never reach here)
        return this.atomPool[this.atomPool.length - 1];
    }

    /**
     * Render the spawn zone
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} scale - Zoom scale
     * @param {object} offset - Camera offset
     */
    render(ctx, scale, offset) {
        if (!this.active) return;

        const screenX = (this.zone.x + offset.x) * scale;
        const screenY = (this.zone.y + offset.y) * scale;
        const screenWidth = this.zone.width * scale;
        const screenHeight = this.zone.height * scale;

        // Draw zone fill
        ctx.fillStyle = this.zoneColor;
        ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

        // Draw zone border
        ctx.strokeStyle = this.zoneBorderColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);
        ctx.setLineDash([]);

        // Draw resize handles
        this._renderResizeHandles(ctx, screenX, screenY, screenWidth, screenHeight);

        // Draw spawn indicator icon
        this._renderSpawnIcon(ctx, screenX, screenY, screenWidth, screenHeight);
    }

    /**
     * Render resize handles at corners and edges
     */
    _renderResizeHandles(ctx, x, y, w, h) {
        const hs = this.handleSize;
        const halfHs = hs / 2;

        ctx.fillStyle = this.zoneBorderColor;

        // Corner handles
        const corners = [
            { x: x - halfHs, y: y - halfHs, edge: 'nw' },
            { x: x + w - halfHs, y: y - halfHs, edge: 'ne' },
            { x: x - halfHs, y: y + h - halfHs, edge: 'sw' },
            { x: x + w - halfHs, y: y + h - halfHs, edge: 'se' }
        ];

        for (const corner of corners) {
            ctx.fillRect(corner.x, corner.y, hs, hs);
        }

        // Edge handles (midpoints)
        const edges = [
            { x: x + w / 2 - halfHs, y: y - halfHs, edge: 'n' },
            { x: x + w / 2 - halfHs, y: y + h - halfHs, edge: 's' },
            { x: x - halfHs, y: y + h / 2 - halfHs, edge: 'w' },
            { x: x + w - halfHs, y: y + h / 2 - halfHs, edge: 'e' }
        ];

        for (const edge of edges) {
            ctx.fillRect(edge.x, edge.y, hs, hs);
        }
    }

    /**
     * Render spawn indicator
     */
    _renderSpawnIcon(ctx, x, y, w, h) {
        const centerX = x + w / 2;
        const centerY = y + 20;

        ctx.save();
        ctx.font = '14px sans-serif';
        ctx.fillStyle = this.zoneBorderColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚛️ Spawner Zone', centerX, centerY);
        ctx.restore();
    }

    /**
     * Check if a screen point is on a resize handle
     * @param {number} screenX - Screen X
     * @param {number} screenY - Screen Y
     * @param {number} scale - Camera scale
     * @param {object} offset - Camera offset
     * @returns {string|null} - Edge identifier or null
     */
    getResizeHandleAt(screenX, screenY, scale, offset) {
        if (!this.active) return null;

        const zx = (this.zone.x + offset.x) * scale;
        const zy = (this.zone.y + offset.y) * scale;
        const zw = this.zone.width * scale;
        const zh = this.zone.height * scale;
        const hs = this.handleSize;
        const halfHs = hs / 2;

        // Check corners first (they have priority)
        const corners = [
            { x: zx - halfHs, y: zy - halfHs, edge: 'nw' },
            { x: zx + zw - halfHs, y: zy - halfHs, edge: 'ne' },
            { x: zx - halfHs, y: zy + zh - halfHs, edge: 'sw' },
            { x: zx + zw - halfHs, y: zy + zh - halfHs, edge: 'se' }
        ];

        for (const corner of corners) {
            if (screenX >= corner.x && screenX <= corner.x + hs &&
                screenY >= corner.y && screenY <= corner.y + hs) {
                return corner.edge;
            }
        }

        // Check edges
        const edges = [
            { x: zx + zw / 2 - halfHs, y: zy - halfHs, edge: 'n' },
            { x: zx + zw / 2 - halfHs, y: zy + zh - halfHs, edge: 's' },
            { x: zx - halfHs, y: zy + zh / 2 - halfHs, edge: 'w' },
            { x: zx + zw - halfHs, y: zy + zh / 2 - halfHs, edge: 'e' }
        ];

        for (const edge of edges) {
            if (screenX >= edge.x && screenX <= edge.x + hs &&
                screenY >= edge.y && screenY <= edge.y + hs) {
                return edge.edge;
            }
        }

        return null;
    }

    /**
     * Check if point is inside the zone (but not on handles)
     * @param {number} screenX - Screen X
     * @param {number} screenY - Screen Y
     * @param {number} scale - Camera scale
     * @param {object} offset - Camera offset
     * @returns {boolean}
     */
    isInsideZone(screenX, screenY, scale, offset) {
        if (!this.active) return false;

        const zx = (this.zone.x + offset.x) * scale;
        const zy = (this.zone.y + offset.y) * scale;
        const zw = this.zone.width * scale;
        const zh = this.zone.height * scale;

        return screenX >= zx && screenX <= zx + zw &&
            screenY >= zy && screenY <= zy + zh;
    }

    /**
     * Start resizing from a handle
     * @param {string} edge - Edge being dragged
     * @param {number} mouseX - Mouse X position
     * @param {number} mouseY - Mouse Y position
     */
    startResize(edge, mouseX, mouseY) {
        this.resizing = true;
        this.resizeEdge = edge;
        this.resizeStartMouse = { x: mouseX, y: mouseY };
        this.resizeStartZone = { ...this.zone };
    }

    /**
     * Update resize during drag
     * @param {number} mouseX - Current mouse X
     * @param {number} mouseY - Current mouse Y
     * @param {number} scale - Camera scale
     */
    updateResize(mouseX, mouseY, scale) {
        if (!this.resizing) return;

        const dx = (mouseX - this.resizeStartMouse.x) / scale;
        const dy = (mouseY - this.resizeStartMouse.y) / scale;

        let newX = this.resizeStartZone.x;
        let newY = this.resizeStartZone.y;
        let newW = this.resizeStartZone.width;
        let newH = this.resizeStartZone.height;

        // Handle different edges
        if (this.resizeEdge.includes('n')) {
            newY = this.resizeStartZone.y + dy;
            newH = this.resizeStartZone.height - dy;
        }
        if (this.resizeEdge.includes('s')) {
            newH = this.resizeStartZone.height + dy;
        }
        if (this.resizeEdge.includes('w')) {
            newX = this.resizeStartZone.x + dx;
            newW = this.resizeStartZone.width - dx;
        }
        if (this.resizeEdge.includes('e')) {
            newW = this.resizeStartZone.width + dx;
        }

        // Apply with constraints
        this.setZone(newX, newY, newW, newH);
    }

    /**
     * End resize operation
     */
    endResize() {
        this.resizing = false;
        this.resizeEdge = null;
    }

    /**
     * Get cursor style for edge
     * @param {string} edge - Edge identifier
     * @returns {string} - CSS cursor style
     */
    getCursorForEdge(edge) {
        const cursors = {
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize',
            'nw': 'nwse-resize',
            'se': 'nwse-resize',
            'ne': 'nesw-resize',
            'sw': 'nesw-resize'
        };
        return cursors[edge] || 'default';
    }

    /**
     * Serialize spawner state
     * @returns {object} - Serialized state
     */
    serialize() {
        return {
            active: this.active,
            tickInterval: this.tickInterval,
            atomPool: this.atomPool.slice(),
            atomWeights: { ...this.atomWeights },
            zone: { ...this.zone }
        };
    }

    /**
     * Deserialize spawner state
     * @param {object} data - Serialized data
     */
    deserialize(data) {
        if (data.active !== undefined) this.active = data.active;
        if (data.tickInterval !== undefined) this.tickInterval = data.tickInterval;
        if (data.atomPool) this.atomPool = data.atomPool.slice();
        if (data.atomWeights) this.atomWeights = { ...data.atomWeights };
        if (data.zone) {
            this.zone = { ...data.zone };
        }
    }
}

// Make available globally
window.AtomSpawner = AtomSpawner;
