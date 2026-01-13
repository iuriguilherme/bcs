/**
 * Controls
 * User interaction handling
 */

class Controls {
    /**
     * Create controls handler
     * @param {Viewer} viewer - The viewer instance
     * @param {Simulation} simulation - The simulation instance
     * @param {Catalogue} catalogue - The catalogue instance
     */
    constructor(viewer, simulation, catalogue) {
        this.viewer = viewer;
        this.simulation = simulation;
        this.catalogue = catalogue;
        this.environment = simulation.environment;

        // Current tool
        this.tool = 'place';  // 'select', 'place', 'delete'
        this.selectedElement = 'C';  // Currently selected atom type for placement

        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            down: false,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0
        };

        // Selected blueprint for placement
        this.selectedBlueprint = null;
        this.selectedPolymerTemplate = null;

        // Key states
        this.keys = new Set();

        // Bind event handlers
        this._bindEvents();
    }

    /**
     * Bind all event listeners
     */
    _bindEvents() {
        const canvas = this.viewer.canvas;

        // Mouse events
        canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
        canvas.addEventListener('wheel', this._onWheel.bind(this));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard events
        document.addEventListener('keydown', this._onKeyDown.bind(this));
        document.addEventListener('keyup', this._onKeyUp.bind(this));
    }

    /**
     * Set current tool
     * @param {string} tool - Tool name
     */
    setTool(tool) {
        this.tool = tool;
        this.viewer.canvas.style.cursor = this._getCursorForTool(tool);

        // Update tool button visual state
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    /**
     * Get cursor style for tool
     */
    _getCursorForTool(tool) {
        switch (tool) {
            case 'select': return 'default';
            case 'place': return 'crosshair';
            case 'delete': return 'not-allowed';
            default: return 'default';
        }
    }

    /**
     * Set selected element for placement
     * @param {string} symbol - Element symbol
     */
    setSelectedElement(symbol) {
        this.selectedElement = symbol;
        this.selectedBlueprint = null;
    }

    /**
     * Set selected blueprint for placement
     * @param {Blueprint} blueprint - Blueprint to place
     */
    setSelectedBlueprint(blueprint) {
        this.selectedBlueprint = blueprint;
    }

    /**
     * Handle mouse down
     */
    _onMouseDown(event) {
        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mouse.down = true;
        this.mouse.dragStartX = x;
        this.mouse.dragStartY = y;

        // Right-click or middle-click for panning
        if (event.button === 1 || event.button === 2) {
            this.mouse.dragging = true;
            this.viewer.canvas.style.cursor = 'grabbing';
            return;
        }

        // Left-click actions based on tool
        switch (this.tool) {
            case 'place':
                this._handlePlace(x, y);
                break;
            case 'select':
                this._handleSelect(x, y);
                break;
            case 'delete':
                this._handleDelete(x, y);
                break;
        }
    }

    /**
     * Handle mouse move
     */
    _onMouseMove(event) {
        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mouse.x = x;
        this.mouse.y = y;

        // Panning
        if (this.mouse.dragging && this.mouse.down) {
            const dx = x - this.mouse.dragStartX;
            const dy = y - this.mouse.dragStartY;

            this.viewer.pan(-dx, -dy);

            this.mouse.dragStartX = x;
            this.mouse.dragStartY = y;
        }

        // Hover effects
        this._updateHover(x, y);
    }

    /**
     * Handle mouse up
     */
    _onMouseUp(event) {
        this.mouse.down = false;
        this.mouse.dragging = false;

        this.viewer.canvas.style.cursor = this._getCursorForTool(this.tool);
    }

    /**
     * Handle mouse wheel (zoom)
     */
    _onWheel(event) {
        event.preventDefault();

        const rect = this.viewer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const delta = -Math.sign(event.deltaY);
        this.viewer.zoom(delta, x, y);
    }

    /**
     * Handle key down
     */
    _onKeyDown(event) {
        this.keys.add(event.key);

        // Number keys for abstraction level
        if (event.key >= '1' && event.key <= '5') {
            this.viewer.setLevel(parseInt(event.key) - 1);
            this._updateLevelButtons();
        }

        // Space to toggle simulation
        if (event.key === ' ') {
            event.preventDefault();
            this.simulation.toggle();
            this._updatePlayButton();
        }

        // S for step
        if (event.key === 's' || event.key === 'S') {
            this.simulation.step();
        }

        // Delete/Backspace to delete selected
        if (event.key === 'Delete' || event.key === 'Backspace') {
            this._deleteSelected();
        }

        // Escape to clear selection
        if (event.key === 'Escape') {
            this.viewer.clearSelection();
            this.selectedBlueprint = null;
        }
    }

    /**
     * Handle key up
     */
    _onKeyUp(event) {
        this.keys.delete(event.key);
    }

    /**
     * Handle place action
     */
    _handlePlace(screenX, screenY) {
        const worldPos = this.viewer.screenToWorld(screenX, screenY);

        // Check bounds
        if (worldPos.x < 0 || worldPos.x > this.environment.width ||
            worldPos.y < 0 || worldPos.y > this.environment.height) {
            return;
        }

        // At cell level (3+), place cells
        if (this.viewer.level >= 3) {
            const cell = new Cell(worldPos.x, worldPos.y);
            this.environment.addCell(cell);
        }
        // At polymer level (2), place polymers or molecules
        else if (this.viewer.level === 2) {
            if (this.selectedPolymerTemplate) {
                // Place polymer from template
                const polymer = this.selectedPolymerTemplate.instantiate(worldPos.x, worldPos.y, this.catalogue);
                if (polymer) {
                    // Add all molecules and atoms to environment
                    for (const mol of polymer.molecules) {
                        for (const atom of mol.atoms) {
                            this.environment.addAtom(atom);
                        }
                        for (const bond of mol.bonds) {
                            this.environment.addBond(bond);
                        }
                        this.environment.addMolecule(mol);
                    }
                    this.environment.addProtein(polymer);
                    console.log(`Placed polymer: ${this.selectedPolymerTemplate.name}`);
                }
            } else if (this.selectedBlueprint) {
                // Fall back to molecule placement
                const molecule = this.selectedBlueprint.instantiate(worldPos.x, worldPos.y);
                if (molecule) {
                    for (const atom of molecule.atoms) {
                        this.environment.addAtom(atom);
                    }
                    for (const bond of molecule.bonds) {
                        this.environment.addBond(bond);
                    }
                    this.environment.addMolecule(molecule);
                }
            }
        }
        // At molecule level (1), place molecules from blueprints
        else if (this.viewer.level === 1) {
            if (this.selectedBlueprint) {
                const molecule = this.selectedBlueprint.instantiate(worldPos.x, worldPos.y);
                if (molecule) {
                    for (const atom of molecule.atoms) {
                        this.environment.addAtom(atom);
                    }
                    for (const bond of molecule.bonds) {
                        this.environment.addBond(bond);
                    }
                    this.environment.addMolecule(molecule);
                }
            }
            // Don't place atoms at molecule level - require blueprint selection
        }
        // At atom level (0), place single atoms
        else {
            const atom = new Atom(this.selectedElement, worldPos.x, worldPos.y);
            this.environment.addAtom(atom);
        }

        // Immediate render so entity appears even when paused
        this.viewer.render();
    }

    /**
     * Handle select action
     */
    _handleSelect(screenX, screenY) {
        const result = this.viewer.getEntityAt(screenX, screenY);

        this.viewer.clearSelection();

        if (result) {
            if (result.type === 'atom') {
                result.entity.selected = true;
                this.viewer.selectedAtom = result.entity;
            } else if (result.type === 'molecule') {
                result.entity.selected = true;
                this.viewer.selectedMolecule = result.entity;
            } else if (result.type === 'cell') {
                this.viewer.selectedCell = result.entity;
            } else if (result.type === 'polymer') {
                result.entity.selected = true;
            }

            this._updateInspector(result);
            this._switchToInspectorTab();
        }
    }

    /**
     * Switch to inspector tab
     */
    _switchToInspectorTab() {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'inspector');
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'inspectorTab');
        });
    }

    /**
     * Handle delete action
     */
    _handleDelete(screenX, screenY) {
        const result = this.viewer.getEntityAt(screenX, screenY);
        if (!result) return;

        // At cell level (3) or higher, delete cells
        if (this.viewer.level >= 3 && result.type === 'cell') {
            this.environment.removeCell(result.entity.id);
        }
        // At molecule level (1) or higher, delete entire molecules
        else if (this.viewer.level >= 1 && result.type === 'molecule') {
            const atoms = [...result.entity.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(result.entity.id);
        } else if (result.type === 'atom') {
            this.environment.removeAtom(result.entity.id);
        } else if (result.type === 'molecule') {
            // Fallback: delete molecule at any level
            const atoms = [...result.entity.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(result.entity.id);
        }

        // Immediate render to show deletion
        this.viewer.render();
    }

    /**
     * Delete currently selected entity
     */
    _deleteSelected() {
        if (this.viewer.selectedAtom) {
            this.environment.removeAtom(this.viewer.selectedAtom.id);
            this.viewer.selectedAtom = null;
        }
        if (this.viewer.selectedMolecule) {
            // Delete all atoms in molecule
            const atoms = [...this.viewer.selectedMolecule.atoms];
            for (const atom of atoms) {
                this.environment.removeAtom(atom.id);
            }
            this.environment.removeMolecule(this.viewer.selectedMolecule.id);
            this.viewer.selectedMolecule = null;
        }
    }

    /**
     * Update hover effects
     */
    _updateHover(screenX, screenY) {
        // Clear previous hover
        if (this.viewer.hoveredAtom) {
            this.viewer.hoveredAtom.highlighted = false;
            this.viewer.hoveredAtom = null;
        }
        if (this.viewer.hoveredMolecule) {
            this.viewer.hoveredMolecule.highlighted = false;
            this.viewer.hoveredMolecule = null;
        }

        // Find new hover
        const result = this.viewer.getEntityAt(screenX, screenY);

        if (result) {
            result.entity.highlighted = true;
            if (result.type === 'atom') {
                this.viewer.hoveredAtom = result.entity;
            } else {
                this.viewer.hoveredMolecule = result.entity;
            }
        }
    }

    /**
     * Update level buttons UI
     */
    _updateLevelButtons() {
        const buttons = document.querySelectorAll('.level-btn');
        buttons.forEach((btn, i) => {
            btn.classList.toggle('active', i === this.viewer.level);
        });
    }

    /**
     * Update play button UI
     */
    _updatePlayButton() {
        const btn = document.getElementById('playPauseBtn');
        if (btn) {
            btn.textContent = this.simulation.running ? 'Pause' : 'Play';
        }
    }

    /**
     * Update inspector panel
     */
    _updateInspector(result) {
        const content = document.getElementById('inspectorContent');
        if (!content) return;

        if (result.type === 'atom') {
            const atom = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${atom.element.name} (${atom.symbol})</h3>
                    <p>Atomic Number: ${atom.element.number}</p>
                    <p>Mass: ${atom.mass.toFixed(3)} u</p>
                    <p>Valence: ${atom.bondCount}/${atom.maxBonds}</p>
                    <p>Bonds: ${atom.bonds.length}</p>
                    <p>Position: (${atom.position.x.toFixed(1)}, ${atom.position.y.toFixed(1)})</p>
                    ${atom.moleculeId ? `<p>Molecule ID: ${atom.moleculeId.substring(0, 8)}...</p>` : ''}
                </div>
            `;
        } else if (result.type === 'molecule') {
            const mol = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${mol.name || mol.formula}</h3>
                    <p>Formula: ${mol.formula}</p>
                    <p>Mass: ${mol.mass.toFixed(3)} u</p>
                    <p>Atoms: ${mol.atoms.length}</p>
                    <p>Bonds: ${mol.bonds.length}</p>
                    <p>Stable: ${mol.isStable() ? 'Yes &#10003;' : 'No'}</p>
                    ${mol.isStable() ? '<button class="tool-btn" onclick="window.app.registerMolecule()">Add to Catalogue</button>' : ''}
                </div>
            `;
        } else if (result.type === 'cell') {
            const cell = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>Cell (Gen ${cell.generation})</h3>
                    <p>Energy: ${cell.energy.toFixed(1)} / ${cell.maxEnergy}</p>
                    <p>Age: ${cell.age} ticks</p>
                    <p>Position: (${cell.position.x.toFixed(1)}, ${cell.position.y.toFixed(1)})</p>
                    <p>Brain: ${cell.brain.layers.join(' → ')}</p>
                    <p>Weights: ${cell.brain.getWeightCount()}</p>
                    <p>Alive: ${cell.isAlive ? 'Yes &#10003;' : 'No'}</p>
                </div>
            `;
        } else if (result.type === 'polymer') {
            const poly = result.entity;
            const typeLabel = poly.getLabel ? poly.getLabel() : 'Polymer';
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${poly.name || typeLabel}</h3>
                    <p>Type: ${typeLabel}</p>
                    <p>Molecules: ${poly.molecules.length}</p>
                    <p>Sequence: ${poly.sequence.substring(0, 30)}${poly.sequence.length > 30 ? '...' : ''}</p>
                    <p>Mass: ${poly.mass.toFixed(3)} u</p>
                    <p>Stable: ${poly.isStable() ? 'Yes &#10003;' : 'No'}</p>
                </div>
            `;
        }
    }
}

// Make available globally
window.Controls = Controls;
