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

        // Check for spawner zone resize handles first
        const spawner = window.cellApp?.atomSpawner;
        if (spawner && spawner.active) {
            const scale = this.viewer.camera.zoom;
            const offset = this.viewer.getOffset();
            const resizeEdge = spawner.getResizeHandleAt(x, y, scale, offset);

            if (resizeEdge) {
                spawner.startResize(resizeEdge, x, y);
                this.viewer.canvas.style.cursor = spawner.getCursorForEdge(resizeEdge);
                return;
            }
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

        // Check for spawner zone resizing
        const spawner = window.cellApp?.atomSpawner;
        if (spawner && spawner.resizing) {
            const scale = this.viewer.camera.zoom;
            spawner.updateResize(x, y, scale);
            this.viewer.render();
            return;
        }

        // Panning
        if (this.mouse.dragging && this.mouse.down) {
            const dx = x - this.mouse.dragStartX;
            const dy = y - this.mouse.dragStartY;

            this.viewer.pan(dx, dy);

            this.mouse.dragStartX = x;
            this.mouse.dragStartY = y;

            // Render immediately so view updates even when paused
            this.viewer.render();
        }

        // Check for spawner resize handle hover
        if (spawner && spawner.active) {
            const scale = this.viewer.camera.zoom;
            const offset = this.viewer.getOffset();
            const resizeEdge = spawner.getResizeHandleAt(x, y, scale, offset);

            if (resizeEdge) {
                this.viewer.canvas.style.cursor = spawner.getCursorForEdge(resizeEdge);
                return;
            }
        }

        // Hover effects
        this._updateHover(x, y);
    }

    /**
     * Handle mouse up
     */
    _onMouseUp(event) {
        // End spawner resize if active
        const spawner = window.cellApp?.atomSpawner;
        if (spawner && spawner.resizing) {
            spawner.endResize();

            // Update modal inputs if open
            const widthInput = document.getElementById('zoneWidth');
            const heightInput = document.getElementById('zoneHeight');
            if (widthInput) widthInput.value = Math.round(spawner.zone.width);
            if (heightInput) heightInput.value = Math.round(spawner.zone.height);
        }

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

        // Render immediately so view updates even when paused
        this.viewer.render();
    }

    /**
     * Handle key down
     */
    _onKeyDown(event) {
        // Ignore keyboard shortcuts when typing in input fields
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
        if (isTyping) {
            return;
        }

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

        // At cell level (3+), place cell intentions (attract polymers to form cells)
        if (this.viewer.level >= 3) {
            if (this.selectedCellBlueprint) {
                // Create cell intention zone with selected blueprint
                const intention = new Intention('cell', this.selectedCellBlueprint, worldPos.x, worldPos.y);
                this.environment.addIntention(intention);
                console.log(`Placed cell intention: ${this.selectedCellBlueprint.name}`);
            } else {
                // No blueprint selected - show hint
                console.log('No cell blueprint selected. Select a cell type from the palette first.');
            }
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
            } else if (result.type === 'prokaryote') {
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

        // At cell level (3) or higher, delete prokaryotes
        if (this.viewer.level >= 3 && result.type === 'prokaryote') {
            this.environment.removeProkaryote(result.entity.id);
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
            btn.textContent = this.simulation.running ? '⏸️ Pause' : '▶️ Play';
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
                    polymerIdStr = `<p>Polymer ID: ${mol.polymerId}</p>`;
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
                    ${atom.moleculeId ? `<p>Molecule ID: ${atom.moleculeId}</p>` : ''}
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
                    <p>Molecule ID: ${mol.id}</p>
                    <p>Formula: ${mol.formula}</p>
                    <p>Mass: ${mol.mass.toFixed(3)} u</p>
                    <p>Atoms: ${mol.atoms.length}</p>
                    <p>Bonds: ${mol.bonds.length}</p>
                    <p>Stable: ${mol.isStable() ? 'Yes &#10003;' : 'No'}</p>
                    ${mol.isReshaping ? '<p style="color: #4ade80;">Reshaping...</p>' : ''}
                    ${mol.polymerId ? `<p>Polymer ID: ${mol.polymerId}</p>` : ''}
                    ${catalogueBtn}
                </div>
            `;

            // Render molecule shape preview after DOM update
            setTimeout(() => {
                this._renderMoleculePreview(canvasId, mol);
            }, 0);
        } else if (result.type === 'prokaryote') {
            const prok = result.entity;
            const components = prok.getComponentSummary();

            // Get cell name from blueprint or use generic label
            const cellName = prok.cellName || 'Prokaryote';
            const speciesLine = prok.species
                ? `<p style="color: #94a3b8; font-style: italic;">${prok.species}</p>`
                : '';

            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${cellName}</h3>
                    ${speciesLine}
                    <p>Generation: ${prok.generation}</p>
                    <hr style="border-color: #444; margin: 8px 0;">
                    <p>ATP: ${prok.cytoplasm.atp.toFixed(1)} / ${prok.cytoplasm.maxAtp}</p>
                    <p>Age: ${prok.age} ticks</p>
                    <p>Position: (${prok.position.x.toFixed(1)}, ${prok.position.y.toFixed(1)})</p>
                    <hr style="border-color: #444; margin: 8px 0;">
                    <p><strong>Components:</strong></p>
                    <p>• Membrane: ${components.membrane} polymers</p>
                    <p>• Nucleoid: ${components.nucleoid} polymers</p>
                    <p>• Ribosomes: ${components.ribosomes} polymers</p>
                    <p>Alive: ${prok.isAlive ? 'Yes &#10003;' : 'No'}</p>
                </div>
            `;
        } else if (result.type === 'polymer') {
            const poly = result.entity;
            const typeLabel = poly.getLabel ? poly.getLabel() : 'Polymer';
            content.innerHTML = `
                <div class="inspector-item">
                    <h3>${poly.name || typeLabel}</h3>
                    <p>Polymer ID: ${poly.id}</p>
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
            } else if (requirements?.type === 'polymers_detailed') {
                // NEW: Detailed cell recipe with polymer requirements
                const cellName = requirements.cellName || 'Cell';
                const species = requirements.species;
                const color = requirements.color || '#8b5cf6';

                let html = `<p style="color: ${color}; font-weight: bold;"><strong>Recipe: ${cellName}</strong></p>`;
                if (species) {
                    html += `<p style="color: #94a3b8; font-style: italic;">${species}</p>`;
                }
                html += '<hr style="border-color: #444; margin: 8px 0;">';
                html += '<p><strong>Required Polymers:</strong></p>';

                // Show each polymer requirement
                for (const req of requirements.polymerRequirements || []) {
                    const roleColors = {
                        'membrane': '#f59e0b',
                        'nucleoid': '#3b82f6',
                        'ribosomes': '#22c55e'
                    };
                    const roleColor = roleColors[req.role] || '#8b5cf6';

                    // Get current progress from intention's polymerFulfillment
                    const have = intention.polymerFulfillment?.[req.role]?.have || 0;
                    const progressIcon = have >= req.count ? '✓' : `${have}/${req.count}`;

                    html += `
                        <p style="color: ${roleColor}; margin-top: 4px;">
                            <strong>${req.role}:</strong> ${req.count}× ${req.polymerName} 
                            <span style="color: #666;">[${progressIcon}]</span>
                        </p>
                        <p style="color: #94a3b8; font-size: 0.85em; margin-left: 12px;">
                            Chain: ${req.minChainLength}+ monomers
                        </p>
                    `;

                    // Show what monomer to create
                    if (req.monomerFormula) {
                        html += `
                            <p style="color: #4ade80; font-size: 0.85em; margin-left: 12px;">
                                → Create ${req.monomerFormula} molecules
                            </p>
                        `;
                    }
                }

                reqDetails = html;
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

    /**
     * Update inspector with polymer template data (before placing intention)
     * @param {Object} template - Polymer blueprint template
     */
    updateInspectorWithPolymerTemplate(template) {
        const content = document.getElementById('inspectorContent');
        if (!content || !template) return;

        // Switch to inspector tab
        this._switchToInspectorTab();

        // Get monomer info
        let monomerInfo = '';
        if (template.monomerId) {
            const monomerTemplate = typeof getMonomerTemplate === 'function'
                ? getMonomerTemplate(template.monomerId)
                : null;
            if (monomerTemplate) {
                monomerInfo = `
                    <hr style="border-color: #444; margin: 8px 0;">
                    <p><strong>Monomer Required:</strong></p>
                    <p>${monomerTemplate.name}</p>
                    <p style="color: #4ade80; font-weight: bold;">${monomerTemplate.formula}</p>
                    <p style="color: #94a3b8; font-size: 0.9em;"><em>Create ${template.minMonomers || 2}+ of these molecules</em></p>
                `;
            }
        }

        // Get type color
        const typeColors = {
            'lipid': '#f59e0b',
            'protein': '#22c55e',
            'nucleic_acid': '#3b82f6',
            'carbohydrate': '#ec4899',
            'generic': '#8b5cf6'
        };
        const typeColor = typeColors[template.type] || '#8b5cf6';

        content.innerHTML = `
            <div class="inspector-item">
                <h3 style="color: ${typeColor};">${template.name}</h3>
                <p><strong>Type:</strong> ${template.type}</p>
                <p>${template.description || ''}</p>
                ${template.essential ? '<p style="color: #4ade80;">&#9733; Essential for cells</p>' : ''}
                ${template.cellRole ? `<p><strong>Cell Role:</strong> ${template.cellRole}</p>` : ''}
                <hr style="border-color: #444; margin: 8px 0;">
                <p><strong>Min Monomers:</strong> ${template.minMonomers || template.minMolecules || 2}</p>
                ${monomerInfo}
                <hr style="border-color: #444; margin: 8px 0;">
                <p style="color: #94a3b8;"><em>Click in the view to place this polymer intention</em></p>
            </div>
        `;
    }
}

// Make available globally
window.Controls = Controls;

