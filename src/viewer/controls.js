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
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Right-click cancels placement mode and returns to select
            if (this.tool === 'place' || this.selectedBlueprint || this.selectedPolymerTemplate) {
                this.selectedBlueprint = null;
                this.selectedPolymerTemplate = null;
                this.selectedElement = 'C'; // Reset to default element
                this.setTool('select');
            }
        });

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

            this.viewer.pan(dx, dy);

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
        // At polymer level (2), create polymer intention (attract molecules)
        else if (this.viewer.level === 2) {
            if (this.selectedPolymerTemplate) {
                // Create polymer intention zone
                const intention = new Intention('polymer', this.selectedPolymerTemplate, worldPos.x, worldPos.y);
                this.environment.addIntention(intention);
                console.log(`Placed polymer intention: ${this.selectedPolymerTemplate.name}`);
            } else if (this.selectedBlueprint) {
                // Fall back to molecule intention
                const intention = new Intention('molecule', this.selectedBlueprint, worldPos.x, worldPos.y);
                this.environment.addIntention(intention);
                console.log(`Placed molecule intention: ${this.selectedBlueprint.name || this.selectedBlueprint.formula}`);
            }
        }
        // At molecule level (1), create molecule intention (attract atoms)
        else if (this.viewer.level === 1) {
            if (this.selectedBlueprint) {
                // Create molecule intention zone
                const intention = new Intention('molecule', this.selectedBlueprint, worldPos.x, worldPos.y);
                this.environment.addIntention(intention);
                console.log(`Placed molecule intention: ${this.selectedBlueprint.name || this.selectedBlueprint.formula}`);
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
            } else if (result.type === 'intention') {
                result.entity.selected = true;
                this.viewer.selectedIntention = result.entity;
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
        const worldPos = this.viewer.screenToWorld(screenX, screenY);
        const scale = this.viewer.camera.zoom;
        const offset = this.viewer.getOffset();

        // First check for intentions (highest priority for deletion)
        const intentions = this.environment.getAllIntentions ? this.environment.getAllIntentions() : [];
        for (const intention of intentions) {
            if (intention.containsPoint(screenX, screenY, scale, offset)) {
                // Remove the intention - gathered components are automatically freed
                this.environment.removeIntention(intention.id);
                console.log(`Deleted intention: ${intention.blueprint?.name || intention.type}`);
                this.viewer.render();
                return;
            }
        }

        // Then check for regular entities
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
            // Get polymer ID through molecule
            let polymerIdStr = '';
            if (atom.moleculeId && this.environment) {
                const mol = this.environment.molecules.get(atom.moleculeId);
                if (mol && mol.polymerId) {
                    polymerIdStr = `<p>Polymer ID: ${mol.polymerId.substring(0, 8)}...</p>`;
                }
            }
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${atom.element.name} (${atom.symbol})</h3>
                    <p>Atomic Number: ${atom.element.number}</p>
                    <p>Mass: ${atom.mass.toFixed(3)} u</p>
                    <p>Valence: ${atom.bondCount}/${atom.maxBonds}</p>
                    <p>Bonds: ${atom.bonds.length}</p>
                    <p>Position: (${atom.position.x.toFixed(1)}, ${atom.position.y.toFixed(1)})</p>
                    ${atom.moleculeId ? `<p>Molecule ID: ${atom.moleculeId.substring(0, 8)}...</p>` : ''}
                    ${polymerIdStr}
                </div>
            `;
        } else if (result.type === 'molecule') {
            const mol = result.entity;
            const isInCatalogue = window.cellApp?.catalogue?.hasMolecule?.(mol.fingerprint);
            const catalogueBtn = mol.isStable()
                ? (isInCatalogue
                    ? '<p style="color: #4ade80;">&#10003; In Catalogue</p>'
                    : '<button class="tool-btn" onclick="window.cellApp.registerMolecule()">Add to Catalogue</button>')
                : '';

            // Generate unique canvas ID
            const canvasId = 'inspector-mol-preview-' + mol.id.substring(0, 8);

            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${mol.name || mol.formula}</h3>
                    <div class="inspector-shape-preview">
                        <canvas id="${canvasId}" width="120" height="120"></canvas>
                    </div>
                    <p>Formula: ${mol.formula}</p>
                    <p>Mass: ${mol.mass.toFixed(3)} u</p>
                    <p>Atoms: ${mol.atoms.length}</p>
                    <p>Bonds: ${mol.bonds.length}</p>
                    <p>Stable: ${mol.isStable() ? 'Yes &#10003;' : 'No'}</p>
                    ${mol.isReshaping ? '<p style="color: #4ade80;">Reshaping...</p>' : ''}
                    ${mol.polymerId ? `<p>Polymer ID: ${mol.polymerId.substring(0, 8)}...</p>` : ''}
                    ${catalogueBtn}
                </div>
            `;

            // Render molecule shape preview after DOM update
            setTimeout(() => {
                this._renderMoleculePreview(canvasId, mol);
            }, 0);
        } else if (result.type === 'cell') {
            const cell = result.entity;
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>Cell (Gen ${cell.generation})</h3>
                    <p>Energy: ${cell.energy.toFixed(1)} / ${cell.maxEnergy}</p>
                    <p>Age: ${cell.age} ticks</p>
                    <p>Position: (${cell.position.x.toFixed(1)}, ${cell.position.y.toFixed(1)})</p>
                    <p>Brain: ${cell.brain.layers.join(' &rarr; ')}</p>
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
                    <p>ID: ${poly.id.substring(0, 8)}...</p>
                    <p>Type: ${typeLabel}</p>
                    <p>Molecules: ${poly.molecules.length}</p>
                    <p>Sequence: ${poly.sequence.substring(0, 30)}${poly.sequence.length > 30 ? '...' : ''}</p>
                    <p>Mass: ${poly.mass.toFixed(3)} u</p>
                    <p>Stable: ${poly.isStable() ? 'Yes &#10003;' : 'No'}</p>
                    ${poly.cellRole ? `<p>Cell Role: ${poly.cellRole}</p>` : ''}
                </div>
            `;
        } else if (result.type === 'intention') {
            const intention = result.entity;
            const bpName = intention.blueprint?.name || intention.blueprint?.formula || 'Unknown';
            const requirements = intention.getRequirements();
            const reqCount = requirements?.count || '?';
            const reqType = requirements?.type || 'components';

            // Build requirements details based on type
            let reqDetails = '';
            if (requirements?.type === 'atoms') {
                const elements = requirements.elements?.join(', ') || 'Various';
                reqDetails = `<p><strong>Needs:</strong> ${reqCount} atoms</p><p>Elements: ${elements}</p>`;
            } else if (requirements?.type === 'monomers') {
                // NEW: Monomer-based polymer requirements
                const monomerName = requirements.monomerName || 'Unknown';
                const monomerFormula = requirements.monomerFormula;

                if (monomerFormula) {
                    // We know the exact monomer needed
                    reqDetails = `
                        <p><strong>Needs:</strong> ${reqCount}+ monomers</p>
                        <p><strong>Monomer:</strong> ${monomerName}</p>
                        <p style="color: #4ade80; font-weight: bold;">${monomerFormula}</p>
                        <p style="color: #94a3b8; font-size: 0.9em;"><em>Create ${reqCount}+ ${monomerFormula} molecules to form this polymer</em></p>
                    `;
                } else {
                    // Fallback for legacy blueprints without monomer template
                    const elements = requirements.requiredElements?.join(', ') || 'Various';
                    reqDetails = `<p><strong>Needs:</strong> ${reqCount} molecules</p><p><strong>With elements:</strong> ${elements}</p>`;
                }
            } else if (requirements?.type === 'molecules') {
                // Legacy support for old polymer blueprints
                const elements = requirements.requiredElements?.join(', ') || 'Various';
                reqDetails = `<p><strong>Needs:</strong> ${reqCount} molecules</p><p>With elements: ${elements}</p>`;
            } else if (requirements?.type === 'polymers') {
                const roles = requirements.roles?.join(', ') || 'Various';
                reqDetails = `<p><strong>Needs polymers with roles:</strong></p><p>${roles}</p>`;
            }

            content.innerHTML = `
                <div class="inspector-item">
                    <h3>Intention: ${bpName}</h3>
                    <p>Type: ${intention.type}</p>
                    <p>Target: ${bpName}</p>
                    <hr style="border-color: #444; margin: 8px 0;">
                    ${reqDetails}
                    <hr style="border-color: #444; margin: 8px 0;">
                    <p>Progress: ${Math.round(intention.progress * 100)}%</p>
                    <p>Gathered: ${intention.gatheredComponents.size} / ${reqCount}</p>
                    <p>Radius: ${intention.radius} units</p>
                    <p>Position: (${intention.position.x.toFixed(0)}, ${intention.position.y.toFixed(0)})</p>
                    <p>Fulfilled: ${intention.fulfilled ? 'Yes &#10003;' : 'No'}</p>
                    <button class="tool-btn" onclick="window.cellApp.deleteIntention('${intention.id}')">Delete Intention</button>
                </div>
            `;
        }
    }

    /**
     * Render a molecule shape preview on a canvas
     * @param {string} canvasId - ID of the canvas element
     * @param {Molecule} mol - The molecule to render
     */
    _renderMoleculePreview(canvasId, mol) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        if (!mol.atoms || mol.atoms.length === 0) return;

        // Calculate bounds of molecule
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        const molCenter = mol.centerOfMass;

        for (const atom of mol.atoms) {
            const relX = atom.position.x - molCenter.x;
            const relY = atom.position.y - molCenter.y;
            minX = Math.min(minX, relX);
            minY = Math.min(minY, relY);
            maxX = Math.max(maxX, relX);
            maxY = Math.max(maxY, relY);
        }

        // Calculate scale to fit in canvas with padding
        const padding = 15;
        const molWidth = maxX - minX + 40;
        const molHeight = maxY - minY + 40;
        const scale = Math.min(
            (width - padding * 2) / molWidth,
            (height - padding * 2) / molHeight,
            2 // Max scale
        );

        // Draw bonds first
        for (const bond of mol.bonds) {
            const x1 = centerX + (bond.atom1.position.x - molCenter.x) * scale;
            const y1 = centerY + (bond.atom1.position.y - molCenter.y) * scale;
            const x2 = centerX + (bond.atom2.position.x - molCenter.x) * scale;
            const y2 = centerY + (bond.atom2.position.y - molCenter.y) * scale;

            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;

            if (bond.order === 1) {
                // Single bond - one line
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            } else if (bond.order === 2) {
                // Double bond - two parallel lines
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (-dy / len) * 3;
                const offsetY = (dx / len) * 3;

                ctx.beginPath();
                ctx.moveTo(x1 + offsetX, y1 + offsetY);
                ctx.lineTo(x2 + offsetX, y2 + offsetY);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x1 - offsetX, y1 - offsetY);
                ctx.lineTo(x2 - offsetX, y2 - offsetY);
                ctx.stroke();
            } else if (bond.order === 3) {
                // Triple bond - three parallel lines
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (-dy / len) * 4;
                const offsetY = (dx / len) * 4;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x1 + offsetX, y1 + offsetY);
                ctx.lineTo(x2 + offsetX, y2 + offsetY);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x1 - offsetX, y1 - offsetY);
                ctx.lineTo(x2 - offsetX, y2 - offsetY);
                ctx.stroke();
            }
        }

        // Draw atoms
        for (const atom of mol.atoms) {
            const x = centerX + (atom.position.x - molCenter.x) * scale;
            const y = centerY + (atom.position.y - molCenter.y) * scale;
            const radius = Math.max(8, (atom.radius || 10) * scale * 0.5);

            // Atom circle with element color
            const element = getElement(atom.symbol);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = element?.color || '#888';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Element symbol
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(8, radius * 0.9)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(atom.symbol, x, y);
        }

        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
    }
}

// Make available globally
window.Controls = Controls;

