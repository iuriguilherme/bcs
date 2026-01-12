/**
 * Viewer
 * Multi-level renderer for the simulation
 */

// Abstraction levels
const AbstractionLevel = {
    ATOM: 0,
    MOLECULE: 1,
    CELL: 2,
    ORGANISM: 3,
    POPULATION: 4
};

const LEVEL_NAMES = ['Atoms', 'Molecules', 'Cells', 'Organisms', 'Populations'];

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
        this.hoveredAtom = null;
        this.hoveredMolecule = null;

        // Performance
        this.lastRenderTime = 0;

        // Grid settings
        this.showGrid = true;
        this.gridSpacing = 100;

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
        this.level = Utils.clamp(level, 0, 4);
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
     * Render at cell level (placeholder)
     */
    _renderCellLevel() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Cell level - Coming in Phase 2',
            this.canvas.width / 2,
            this.canvas.height / 2
        );

        // Still show molecules in the background
        this._renderMoleculeLevel();
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

        // Check atoms
        for (const atom of this.environment.getAllAtoms()) {
            if (atom.containsPoint(screenX, screenY, scale, offset)) {
                return { type: 'atom', entity: atom };
            }
        }

        // Check molecules
        for (const molecule of this.environment.getAllMolecules()) {
            if (molecule.containsPoint(screenX, screenY, scale, offset)) {
                return { type: 'molecule', entity: molecule };
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
