/**
 * Viewer
 * Multi-level renderer for the simulation
 */

// Abstraction levels (6 levels)
const AbstractionLevel = {
    ATOM: 0,
    MOLECULE: 1,
    PROTEIN: 2,
    CELL: 3,
    ORGANISM: 4,
    POPULATION: 5
};

const LEVEL_NAMES = ['Atoms', 'Molecules', 'Proteins', 'Cells', 'Organisms', 'Populations'];

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
        this.selectedCell = null;
        this.hoveredAtom = null;
        this.hoveredMolecule = null;
        this.hoveredCell = null;

        // Performance
        this.lastRenderTime = 0;

        // Grid settings
        this.showGrid = true;
        this.gridSpacing = 100;

        // Callbacks
        this.onRender = null;

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
        this.level = Utils.clamp(level, 0, 5);
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
            case AbstractionLevel.PROTEIN:
                this._renderProteinLevel();
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

        // Render intention zones (blueprint attraction zones)
        this._renderIntentions();

        // Draw environment bounds
        this._renderBounds();

        // Draw grid (optional)
        if (this.showGrid && this.camera.zoom > 0.3) {
            this._renderGrid();
        }

        this.lastRenderTime = performance.now() - startTime;

        // Trigger callback
        if (this.onRender) {
            this.onRender();
        }
    }

    /**
     * Render intention zones
     */
    _renderIntentions() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        const intentions = this.environment.getAllIntentions ? this.environment.getAllIntentions() : [];
        for (const intention of intentions) {
            // Only show intentions relevant to current level
            // Molecule intentions: levels 0-1 (atom and molecule levels)
            // Polymer intentions: levels 1-2 (molecule and polymer levels)
            // Cell intentions: levels 2-3 (polymer and cell levels)
            let shouldRender = false;
            if (intention.type === 'molecule' && this.level <= 1) {
                shouldRender = true;
            } else if (intention.type === 'polymer' && this.level >= 1 && this.level <= 2) {
                shouldRender = true;
            } else if (intention.type === 'cell' && this.level >= 2 && this.level <= 3) {
                shouldRender = true;
            }

            if (shouldRender) {
                intention.render(this.ctx, scale, offset);
            }
        }
    }

    /**
     * Render at atom level
     */
    _renderAtomLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render polymer chain connections first (behind everything)
        const polymers = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
        for (const polymer of polymers) {
            this._renderPolymerConnections(polymer, scale, offset);
        }

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

        // Render polymer chain connections first (behind molecules)
        const polymers = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
        for (const polymer of polymers) {
            this._renderPolymerConnections(polymer, scale, offset);
        }

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
     * Render at protein level
     */
    _renderProteinLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render proteins
        const proteins = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
        for (const protein of proteins) {
            protein.render(this.ctx, 2, { x: -offset.x, y: -offset.y, zoom: scale });
        }

        // Render molecules not in proteins
        for (const molecule of this.environment.getAllMolecules()) {
            if (!molecule.proteinId) {
                molecule.renderSimplified(this.ctx, scale, offset);
            }
        }

        // Render free atoms
        for (const atom of this.environment.getAllAtoms()) {
            if (!atom.moleculeId) {
                atom.render(this.ctx, scale, offset);
            }
        }
    }

    /**
     * Render polymer chain connections between molecules
     * @param {Polymer} polymer - The polymer to render connections for
     * @param {number} scale - Zoom scale
     * @param {object} offset - Camera offset
     */
    _renderPolymerConnections(polymer, scale, offset) {
        if (!polymer.molecules || polymer.molecules.length < 2) return;

        this.ctx.save();
        this.ctx.strokeStyle = polymer.selected ? '#f59e0b' : '#f97316'; // Orange color for polymer bonds
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);

        this.ctx.beginPath();
        for (let i = 0; i < polymer.molecules.length - 1; i++) {
            const mol1 = polymer.molecules[i];
            const mol2 = polymer.molecules[i + 1];

            const center1 = mol1.getCenter ? mol1.getCenter() : mol1.centerOfMass;
            const center2 = mol2.getCenter ? mol2.getCenter() : mol2.centerOfMass;

            const x1 = (center1.x + offset.x) * scale;
            const y1 = (center1.y + offset.y) * scale;
            const x2 = (center2.x + offset.x) * scale;
            const y2 = (center2.y + offset.y) * scale;

            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    /**
     * Render at cell level
     */
    _renderCellLevel() {
        const scale = this.camera.zoom;
        const offset = this.getOffset();

        // Render cells
        const cells = this.environment.getAllCells ? this.environment.getAllCells() : [];
        for (const cell of cells) {
            if (cell.isAlive) {
                const isSelected = this.selectedCell && this.selectedCell.id === cell.id;
                cell.render(this.ctx, scale, offset, isSelected);
            }
        }

        // Render molecules as small dots (simplified view)
        for (const molecule of this.environment.getAllMolecules()) {
            const center = molecule.centerOfMass;
            const screenX = (center.x + offset.x) * scale;
            const screenY = (center.y + offset.y) * scale;

            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, 4 * scale, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
            this.ctx.fill();
        }

        // Show cell count if no cells
        if (cells.length === 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.font = '18px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                'No cells yet - Place cells from the palette',
                this.canvas.width / 2,
                this.canvas.height / 2
            );
        }
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

        // Check intentions first (highest priority for selection)
        const intentions = this.environment.getAllIntentions ? this.environment.getAllIntentions() : [];
        for (const intention of intentions) {
            if (intention.containsPoint(screenX, screenY, scale, offset)) {
                return { type: 'intention', entity: intention };
            }
        }

        // At cell level or higher, prioritize cells
        if (this.level >= 3) {
            const cells = this.environment.getAllCells ? this.environment.getAllCells() : [];
            for (const cell of cells) {
                if (cell.isAlive && cell.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'cell', entity: cell };
                }
            }
        }

        // At protein/polymer level, check polymers
        if (this.level >= 2) {
            const polymers = this.environment.getAllProteins ? this.environment.getAllProteins() : [];
            for (const polymer of polymers) {
                // Check if click is near polymer center
                const center = polymer.getCenter();
                const screenCX = (center.x + offset.x) * scale;
                const screenCY = (center.y + offset.y) * scale;
                const radius = (15 + polymer.molecules.length * 5) * scale;

                const dx = screenX - screenCX;
                const dy = screenY - screenCY;
                if (dx * dx + dy * dy <= radius * radius) {
                    return { type: 'polymer', entity: polymer };
                }
            }
        }

        // At molecule level or higher, check molecules
        if (this.level >= 1) {
            // Check molecules first
            for (const molecule of this.environment.getAllMolecules()) {
                if (molecule.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'molecule', entity: molecule };
                }
            }
            // Then check free atoms (not in molecules)
            for (const atom of this.environment.getAllAtoms()) {
                if (!atom.moleculeId && atom.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'atom', entity: atom };
                }
            }
        } else {
            // At atom level, prioritize atoms
            for (const atom of this.environment.getAllAtoms()) {
                if (atom.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'atom', entity: atom };
                }
            }
            // Then check molecules
            for (const molecule of this.environment.getAllMolecules()) {
                if (molecule.containsPoint(screenX, screenY, scale, offset)) {
                    return { type: 'molecule', entity: molecule };
                }
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
