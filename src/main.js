/**
 * Main Application Entry Point
 * Initializes and connects all components
 */

class App {
    constructor() {
        // Core components
        this.environment = null;
        this.simulation = null;
        this.catalogue = null;
        this.viewer = null;
        this.controls = null;
        this.catalogueUI = null;
        this.atomSpawner = null;
        this.tutorial = null;

        // State
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('🧬 Initializing Cell Simulator...');

        // Create environment
        this.environment = new Environment(2000, 2000);

        // Create simulation
        this.simulation = new Simulation(this.environment);

        // Create and initialize catalogue
        this.catalogue = new Catalogue();
        await this.catalogue.init();

        // Create viewer
        const canvas = document.getElementById('simCanvas');
        this.viewer = new Viewer(canvas, this.environment);
        this.viewer.centerCamera();

        // Create controls
        this.controls = new Controls(this.viewer, this.simulation, this.catalogue);

        // Create catalogue UI
        this.catalogueUI = new CatalogueUI(this.catalogue, this.controls);

        // Create atom spawner
        this.atomSpawner = new AtomSpawner(this.environment);

        // Set up simulation callbacks
        this.simulation.onUpdate = () => {
            this.viewer.render();
            this._updateStats();
        };

        this.simulation.onTick = (tick) => {
            // Update atom spawner
            if (this.atomSpawner) {
                this.atomSpawner.update(1 / 60);
            }

            // Auto-discover stable molecules every 60 ticks
            if (tick % 60 === 0) {
                this.catalogue.autoDiscover(this.environment.getAllMolecules());
                this.catalogueUI.render();
            }
        };

        // Update stats when viewer renders (for when paused)
        this.viewer.onRender = () => {
            this._updateStats();
        };

        // Set up UI
        this._setupUI();

        // Initialize palette for level 0
        this._updatePaletteForLevel(0);

        // Initial render
        this.viewer.render();

        // Add some initial atoms for demo
        this._addDemoAtoms();

        // Initialize tutorial system
        this.tutorial = new Tutorial(this);
        this._setupTutorialUI();

        this.initialized = true;
        console.log('✅ Cell Simulator initialized!');
    }

    /**
     * Set up UI event handlers
     */
    _setupUI() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn?.addEventListener('click', () => {
            this.simulation.toggle();
            playPauseBtn.textContent = this.simulation.running ? '⏸️ Pause' : '▶️ Play';
        });

        // Step button
        const stepBtn = document.getElementById('stepBtn');
        stepBtn?.addEventListener('click', () => {
            this.simulation.step();
            this.viewer.render();
            this._updateStats();
        });

        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        speedSlider?.addEventListener('input', (e) => {
            const speed = e.target.value / 50;  // 0.02 to 2.0
            this.simulation.setSpeed(speed);
        });

        // Spawner button and modal
        this._setupSpawnerUI();

        // Level buttons
        const levelButtons = document.getElementById('levelButtons');
        levelButtons?.addEventListener('click', (e) => {
            const btn = e.target.closest('.level-btn');
            if (btn) {
                const level = parseInt(btn.dataset.level);
                console.log('Setting level to:', level);
                this.viewer.setLevel(level);

                // Update button states
                document.querySelectorAll('.level-btn').forEach((b, i) => {
                    b.classList.toggle('active', i === level);
                });

                // Update palette for this level
                this._updatePaletteForLevel(level);

                // Switch to select mode when changing levels
                this.controls.setTool('select');

                // Force re-render to show the new level
                this.viewer.render();
            }
        });

        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.controls.setTool(tool);

                // Update button states
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
                    b.classList.toggle('active', b.dataset.tool === tool);
                });
            });
        });

        // Atom palette
        this._populateAtomPalette();

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === tab);
                });

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === tab + 'Tab');
                });

                // Switch to select mode when clicking inspector tab
                if (tab === 'inspector') {
                    this.controls.setTool('select');
                }
            });
        });
    }

    /**
     * Set up tutorial button handler
     */
    _setupTutorialUI() {
        const tutorialBtn = document.getElementById('tutorialBtn');
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', () => {
                if (this.tutorial.active) {
                    this.tutorial.end();
                    tutorialBtn.classList.remove('active');
                } else {
                    this.tutorial.start();
                    tutorialBtn.classList.add('active');
                }
            });
        }
    }

    /**
     * Set the current level (called from catalogue UI)
     * @param {number} level - The level to switch to
     */
    setLevel(level) {
        console.log('App.setLevel called with level:', level);
        this.viewer.setLevel(level);

        // Update button states
        document.querySelectorAll('.level-btn').forEach((b, i) => {
            b.classList.toggle('active', i === level);
        });

        // Update palette for this level
        this._updatePaletteForLevel(level);

        // Force re-render to show the new level
        this.viewer.render();
    }

    /**
     * Populate the atom palette with available elements
     */
    _populateAtomPalette() {
        const palette = document.getElementById('entityPalette');
        if (!palette) return;

        // Essential elements - synced with catalogue-ui.js
        const elements = ['H', 'C', 'N', 'O', 'P', 'S', 'Cl', 'Na', 'K', 'Ca', 'Fe'];

        palette.innerHTML = elements.map(symbol => {
            const element = getElement(symbol);
            return `
                <button class="atom-btn ${symbol === 'C' ? 'selected' : ''}" 
                        data-symbol="${symbol}"
                        style="color: ${element.color}; border-color: ${element.color}40;">
                    <span class="symbol">${symbol}</span>
                    <span class="number">${element.number}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        palette.querySelectorAll('.atom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                this.controls.setSelectedElement(symbol);

                // Update selection state
                palette.querySelectorAll('.atom-btn').forEach(b => {
                    b.classList.toggle('selected', b.dataset.symbol === symbol);
                });

                // Clear blueprint selection
                this.controls.selectedBlueprint = null;
            });
        });
    }

    /**
     * Update the entity palette based on current level
     */
    _updatePaletteForLevel(level) {
        console.log('_updatePaletteForLevel called with level:', level);
        const palette = document.getElementById('entityPalette');
        const paletteTitle = document.getElementById('paletteTitle');
        if (!palette) {
            console.log('ERROR: palette element not found');
            return;
        }
        if (!paletteTitle) {
            console.log('ERROR: paletteTitle element not found');
        }

        // Level 0: Atoms
        if (level === 0) {
            console.log('Rendering atoms palette');
            paletteTitle.textContent = 'Place Atoms';
            this._renderAtomPalette(palette);
        }
        // Level 1: Molecules from catalogue
        else if (level === 1) {
            console.log('Rendering molecules palette');
            paletteTitle.textContent = 'Place Molecules';
            this._renderMoleculePalette(palette);
        }
        // Level 2: Polymers
        else if (level === 2) {
            console.log('Rendering polymers palette');
            paletteTitle.textContent = 'Place Polymers';
            this._renderPolymerPalette(palette);
        }
        // Level 3+: Cells
        else {
            console.log('Rendering cells palette');
            paletteTitle.textContent = 'Place Cells';
            this._renderCellPalette(palette);
        }
    }

    /**
     * Render atom palette
     */
    _renderAtomPalette(palette) {
        // Synced with catalogue-ui.js commonAtoms
        const elements = ['H', 'C', 'N', 'O', 'P', 'S', 'Cl', 'Na', 'K', 'Ca', 'Fe'];

        palette.innerHTML = elements.map(symbol => {
            const element = getElement(symbol);
            return `
                <button class="palette-btn atom-btn ${symbol === 'C' ? 'selected' : ''}" 
                        data-symbol="${symbol}"
                        style="color: ${element.color}; border-color: ${element.color}40;">
                    <span class="symbol">${symbol}</span>
                    <span class="number">${element.number}</span>
                </button>
            `;
        }).join('');

        palette.querySelectorAll('.atom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                this.controls.setSelectedElement(symbol);
                this.controls.selectedBlueprint = null;
                palette.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                // Auto-select Place tool when selecting an atom
                this.controls.setTool('place');
            });
        });
    }

    /**
     * Render molecule palette from catalogue
     */
    _renderMoleculePalette(palette) {
        try {
            console.log('_renderMoleculePalette called, catalogue exists:', !!this.catalogue);
            if (!this.catalogue) {
                palette.innerHTML = '<p class="empty-state">Catalogue not initialized</p>';
                return;
            }
            // Only show stable molecules with 2+ atoms, 1+ bonds, and all valences satisfied
            const allBlueprints = this.catalogue.getAllMolecules();

            // Helper: calculate if blueprint is truly stable from its data
            const isBlueprintStable = (bp) => {
                if (!bp.atomData || bp.atomData.length < 2) return false;
                if (!bp.bondData || bp.bondData.length < 1) return false;

                // Calculate valence usage for each atom
                const atomValences = {};
                for (const atom of bp.atomData) {
                    const element = getElement(atom.symbol);
                    if (!element) return false;
                    atomValences[atom.index] = { max: element.valence, used: 0 };
                }

                // Count bonds for each atom
                for (const bond of bp.bondData) {
                    const order = bond.order || 1;
                    if (atomValences[bond.atom1Index]) {
                        atomValences[bond.atom1Index].used += order;
                    }
                    if (atomValences[bond.atom2Index]) {
                        atomValences[bond.atom2Index].used += order;
                    }
                }

                // Check all atoms have filled valence
                for (const idx in atomValences) {
                    const v = atomValences[idx];
                    if (v.used !== v.max) return false;
                }
                return true;
            };

            const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp));
            console.log('Rendering molecule palette, blueprints:', blueprints.length, 'of', allBlueprints.length, 'total');

            if (blueprints.length === 0) {
                palette.innerHTML = '<p class="empty-state">No stable molecules discovered yet. Create stable molecules at Level 1!</p>';
                return;
            }

            // Helper to escape fingerprint for HTML attributes
            const escapeAttr = (str) => str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const unescapeAttr = (str) => str.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

            palette.innerHTML = blueprints.map(bp => `
                <button class="palette-btn molecule-btn" data-fingerprint="${escapeAttr(bp.fingerprint)}">
                    <span class="formula">${bp.name || bp.formula}</span>
                    <span class="info">${bp.formula} &bull; ${bp.atomData.length} atoms</span>
                </button>
            `).join('');

            palette.querySelectorAll('.molecule-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const rawFingerprint = btn.dataset.fingerprint;
                    const fingerprint = unescapeAttr(rawFingerprint);
                    console.log('Molecule button clicked, fingerprint:', fingerprint);
                    const bp = this.catalogue.getMolecule(fingerprint);
                    console.log('Blueprint found:', bp ? bp.formula : 'NULL');
                    if (bp) {
                        this.controls.selectedBlueprint = bp;
                        this.controls.setTool('place');
                        palette.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');

                        // Show blueprint preview in inspector
                        if (this.catalogueUI && this.catalogueUI._showBlueprintInspector) {
                            this.catalogueUI._showBlueprintInspector(bp);
                        }
                    } else {
                        console.error('Blueprint not found for fingerprint:', fingerprint);
                    }
                });
            });
        } catch (e) {
            console.error('Error in _renderMoleculePalette:', e);
            palette.innerHTML = '<p class="empty-state">Error loading molecules</p>';
        }
    }

    /**
     * Render polymer palette
     */
    _renderPolymerPalette(palette) {
        try {
            // Get polymer templates from catalogue
            const polymerTemplates = this.catalogue ? this.catalogue.getAllPolymers() : [];
            // Get existing polymers from environment
            const existingPolymers = this.environment.getAllProteins ? this.environment.getAllProteins() : [];

            if (polymerTemplates.length === 0 && existingPolymers.length === 0) {
                palette.innerHTML = '<p class="empty-state">No polymer templates available.</p>';
                return;
            }

            // Helper to escape fingerprint for HTML attributes
            const escapeAttr = (str) => str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

            let html = '';

            // Show essential polymer templates first
            const essentialTemplates = polymerTemplates.filter(p => p.essential);
            const otherTemplates = polymerTemplates.filter(p => !p.essential);

            if (essentialTemplates.length > 0) {
                html += '<p class="palette-subtitle">Essential for Cells</p>';
                html += essentialTemplates.map(template => {
                    const colors = PolymerColors[template.type] || PolymerColors.generic;
                    return `
                        <button class="palette-btn polymer-template-btn" data-fingerprint="${escapeAttr(template.fingerprint)}" style="border-color: ${colors.primary};">
                            <span class="type" style="color: ${colors.primary};">${template.name}</span>
                            <span class="info">${template.type} &bull; ${template.minMolecules} mols</span>
                        </button>
                    `;
                }).join('');
            }

            if (otherTemplates.length > 0) {
                html += '<p class="palette-subtitle">Other Polymers</p>';
                html += otherTemplates.map(template => {
                    const colors = PolymerColors[template.type] || PolymerColors.generic;
                    return `
                        <button class="palette-btn polymer-template-btn" data-fingerprint="${escapeAttr(template.fingerprint)}" style="border-color: ${colors.primary};">
                            <span class="type" style="color: ${colors.primary};">${template.name}</span>
                            <span class="info">${template.type} &bull; ${template.minMolecules} mols</span>
                        </button>
                    `;
                }).join('');
            }

            // Show existing polymers in environment
            if (existingPolymers.length > 0) {
                html += '<p class="palette-subtitle">In Environment</p>';
                html += existingPolymers.map(poly => {
                    const label = poly.getLabel ? poly.getLabel() : 'Polymer';
                    const colors = poly.getColor ? poly.getColor() : { primary: '#8b5cf6' };
                    return `
                        <button class="palette-btn polymer-existing-btn" data-id="${poly.id}" style="border-color: ${colors.primary};">
                            <span class="type" style="color: ${colors.primary};">${label}</span>
                            <span class="info">${poly.molecules.length} mols</span>
                        </button>
                    `;
                }).join('');
            }

            palette.innerHTML = html;

            // Add click handlers for templates
            const unescapeAttr = (str) => str.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

            palette.querySelectorAll('.polymer-template-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fingerprint = unescapeAttr(btn.dataset.fingerprint);
                    const template = this.catalogue.getPolymer(fingerprint);
                    console.log('Polymer template selected:', template?.name);
                    if (template) {
                        this.controls.selectedPolymerTemplate = template;
                        this.controls.selectedBlueprint = null;  // Clear molecule selection
                        this.controls.setTool('place');
                        palette.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        // Show polymer template data in inspector
                        if (this.controls.updateInspectorWithPolymerTemplate) {
                            this.controls.updateInspectorWithPolymerTemplate(template);
                        }
                    }
                });
            });

        } catch (e) {
            console.error('Error in _renderPolymerPalette:', e);
            palette.innerHTML = '<p class="empty-state">Error loading polymers</p>';
        }
    }

    /**
     * Render cell/prokaryote palette with cell blueprints
     */
    _renderCellPalette(palette) {
        // Get all cell blueprints
        const blueprints = typeof getAllCellBlueprints === 'function'
            ? getAllCellBlueprints()
            : [];

        if (blueprints.length === 0) {
            palette.innerHTML = `
                <p class="palette-hint">No cell blueprints available.</p>
            `;
            return;
        }

        let html = '<div class="cell-blueprint-list">';

        for (const bp of blueprints) {
            const color = bp.color || '#8b5cf6';
            html += `
                <button class="palette-btn cell-blueprint-btn" 
                        data-blueprint-id="${bp.id}"
                        style="border-left: 3px solid ${color};">
                    <span class="symbol" style="color: ${color};">🦠</span>
                    <span class="info">
                        <strong>${bp.name}</strong>
                        ${bp.species ? `<em style="font-size: 0.8em; color: #94a3b8;">${bp.species}</em>` : ''}
                    </span>
                </button>
            `;
        }

        html += '</div>';
        html += '<p class="palette-hint">Select a cell type, then click canvas to place intention</p>';

        palette.innerHTML = html;

        // Add click handlers for blueprints
        palette.querySelectorAll('.cell-blueprint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Clear previous selection
                palette.querySelectorAll('.cell-blueprint-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                const blueprintId = btn.dataset.blueprintId;
                const blueprint = typeof getCellBlueprint === 'function'
                    ? getCellBlueprint(blueprintId)
                    : null;

                if (blueprint) {
                    // Store the selected blueprint in controls
                    this.controls.selectedCellBlueprint = blueprint;
                    this.controls.setTool('place');

                    // Show blueprint requirements in inspector
                    this._showCellBlueprintInspector(blueprint);
                }
            });
        });

        // Select first blueprint by default
        const firstBtn = palette.querySelector('.cell-blueprint-btn');
        if (firstBtn) {
            firstBtn.click();
        }
    }

    /**
     * Show cell blueprint requirements in inspector panel
     */
    _showCellBlueprintInspector(blueprint) {
        const content = document.getElementById('inspectorContent');
        if (!content || !blueprint) return;

        // Switch to inspector tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'inspector');
        });
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.toggle('active', c.id === 'inspectorTab');
        });

        const color = blueprint.color || '#8b5cf6';
        let html = `
            <div class="inspector-item">
                <h3 style="color: ${color};">${blueprint.name}</h3>
                ${blueprint.species ? `<p style="color: #94a3b8; font-style: italic;">${blueprint.species}</p>` : ''}
                <p>${blueprint.description || ''}</p>
                <hr style="border-color: #444; margin: 8px 0;">
                <p><strong>Required Polymers:</strong></p>
        `;

        // Get detailed requirements
        const details = blueprint.getDetailedRequirements ? blueprint.getDetailedRequirements() : [];

        for (const req of details) {
            const roleColors = {
                'membrane': '#f59e0b',
                'nucleoid': '#3b82f6',
                'ribosomes': '#22c55e'
            };
            const roleColor = roleColors[req.role] || '#8b5cf6';

            html += `
                <p style="color: ${roleColor}; margin-top: 4px;">
                    <strong>${req.role}:</strong> ${req.count}× ${req.polymerName}
                </p>
                <p style="color: #94a3b8; font-size: 0.85em; margin-left: 12px;">
                    Chain: ${req.minChainLength}+ monomers
                </p>
            `;

            if (req.monomerFormula) {
                html += `
                    <p style="color: #4ade80; font-size: 0.85em; margin-left: 12px;">
                        → Create ${req.monomerFormula} molecules
                    </p>
                `;
            }
        }

        html += `
                <hr style="border-color: #444; margin: 8px 0;">
                <p style="color: #94a3b8;"><em>Click in the view to place this cell intention</em></p>
            </div>
        `;

        content.innerHTML = html;
    }


    /**
     * Update statistics display
     */
    _updateStats() {
        const stats = this.simulation.getStats();

        document.getElementById('atomCount').textContent = `Atoms: ${stats.atomCount}`;
        document.getElementById('moleculeCount').textContent = `Mol: ${stats.moleculeCount}`;
        document.getElementById('proteinCount').textContent = `Poly: ${stats.proteinCount || 0}`;
        document.getElementById('cellCount').textContent = `Cells: ${stats.cellCount}`;
        document.getElementById('tickCounter').textContent = `Tick: ${stats.tick}`;
        document.getElementById('fpsCounter').textContent = `FPS: ${stats.fps}`;
    }

    /**
     * Add demo atoms for testing
     */
    _addDemoAtoms() {
        const centerX = this.environment.width / 2;
        const centerY = this.environment.height / 2;

        // Create a water molecule (H2O) manually
        const oxygen = new Atom('O', centerX, centerY);
        const hydrogen1 = new Atom('H', centerX - 30, centerY - 20);
        const hydrogen2 = new Atom('H', centerX + 30, centerY - 20);

        this.environment.addAtom(oxygen);
        this.environment.addAtom(hydrogen1);
        this.environment.addAtom(hydrogen2);

        // Create bonds
        const bond1 = new Bond(oxygen, hydrogen1, 1);
        const bond2 = new Bond(oxygen, hydrogen2, 1);

        this.environment.addBond(bond1);
        this.environment.addBond(bond2);

        // Add some free atoms
        for (let i = 0; i < 10; i++) {
            const symbol = Utils.randomChoice(['C', 'H', 'O', 'N']);
            const x = centerX + Utils.random(-200, 200);
            const y = centerY + Utils.random(-200, 200);
            const atom = new Atom(symbol, x, y);
            this.environment.addAtom(atom);
        }

        // Update molecules
        this.environment.updateMolecules();
    }

    /**
     * Register currently selected molecule to catalogue
     */
    registerMolecule() {
        if (this.viewer.selectedMolecule && this.viewer.selectedMolecule.isStable()) {
            const name = prompt('Enter a name for this molecule:', this.viewer.selectedMolecule.formula);
            if (name) {
                this.catalogue.registerMolecule(this.viewer.selectedMolecule, name);
                this.catalogueUI.render();
            }
        }
    }

    /**
     * Delete an intention by ID
     * @param {string} intentionId - The intention ID to delete
     */
    deleteIntention(intentionId) {
        this.environment.removeIntention(intentionId);
        this.viewer.selectedIntention = null;
        this.viewer.render();

        // Clear inspector
        const content = document.getElementById('inspectorContent');
        if (content) {
            content.innerHTML = '<p class="empty-state">Intention deleted.</p>';
        }
    }

    /**
     * Export simulation state
     */
    exportState() {
        const state = {
            environment: this.environment.serialize(),
            catalogue: this.catalogue.export()
        };

        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'cell-simulator-state.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Import simulation state
     */
    importState(json) {
        try {
            const state = JSON.parse(json);

            if (state.environment) {
                this.environment.deserialize(state.environment);
            }
            if (state.catalogue) {
                this.catalogue.import(state.catalogue);
            }

            this.viewer.render();
            this._updateStats();
            this.catalogueUI.render();

            console.log('State imported successfully');
        } catch (e) {
            console.error('Failed to import state:', e);
        }
    }

    /**
     * Set up atom spawner UI (button and modal)
     */
    _setupSpawnerUI() {
        const spawnerBtn = document.getElementById('spawnerBtn');
        const spawnerModal = document.getElementById('spawnerModal');
        const closeModalBtn = document.getElementById('closeSpawnerModal');
        const applyBtn = document.getElementById('applySpawnerConfig');
        const atomPoolSelector = document.getElementById('atomPoolSelector');

        if (!spawnerBtn || !spawnerModal) return;

        // Available atoms for spawning
        const availableAtoms = ['H', 'C', 'N', 'O', 'P', 'S', 'Cl', 'Na', 'K', 'Ca', 'Fe'];

        // Weight options for spawn probability
        const weightOptions = [1, 2, 3, 4, 5, 6, 8];

        // Populate atom pool selector with weight dropdowns
        atomPoolSelector.innerHTML = availableAtoms.map(symbol => {
            const element = getElement(symbol);
            const isSelected = this.atomSpawner.atomPool.includes(symbol);
            const currentWeight = this.atomSpawner.getAtomWeight(symbol);
            const weightOptionsHtml = weightOptions.map(w =>
                `<option value="${w}" ${w === currentWeight ? 'selected' : ''}>${w}x</option>`
            ).join('');
            return `
                <div class="atom-pool-item ${isSelected ? 'selected' : ''}" data-symbol="${symbol}">
                    <button class="atom-pool-btn ${isSelected ? 'selected' : ''}" 
                            data-symbol="${symbol}"
                            style="color: ${element.color}; border-color: ${element.color}40;">
                        ${symbol}
                    </button>
                    <select class="atom-weight-select" data-symbol="${symbol}" 
                            style="${isSelected ? '' : 'display: none;'}">
                        ${weightOptionsHtml}
                    </select>
                </div>
            `;
        }).join('');

        // Toggle atom in pool on click
        atomPoolSelector.querySelectorAll('.atom-pool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                const item = btn.closest('.atom-pool-item');
                const select = item.querySelector('.atom-weight-select');
                const isSelected = !btn.classList.contains('selected');

                btn.classList.toggle('selected', isSelected);
                item.classList.toggle('selected', isSelected);
                select.style.display = isSelected ? '' : 'none';
            });
        });

        // Left-click: toggle spawner on/off
        spawnerBtn.addEventListener('click', (e) => {
            if (e.shiftKey) {
                // Shift+click opens config modal
                this._openSpawnerModal();
            } else {
                // Regular click toggles spawner
                const active = this.atomSpawner.toggle();
                spawnerBtn.classList.toggle('active', active);
                this.viewer.render();
            }
        });

        // Right-click: open config modal
        spawnerBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._openSpawnerModal();
        });

        // Close modal
        closeModalBtn?.addEventListener('click', () => {
            spawnerModal.style.display = 'none';
        });

        // Click backdrop to close
        spawnerModal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
            spawnerModal.style.display = 'none';
        });

        // Apply configuration
        applyBtn?.addEventListener('click', () => {
            this._applySpawnerConfig();
            spawnerModal.style.display = 'none';
        });
    }

    /**
     * Open spawner configuration modal
     */
    _openSpawnerModal() {
        const modal = document.getElementById('spawnerModal');
        const intervalInput = document.getElementById('spawnInterval');
        const widthInput = document.getElementById('zoneWidth');
        const heightInput = document.getElementById('zoneHeight');
        const atomPoolSelector = document.getElementById('atomPoolSelector');

        if (!modal) return;

        // Update inputs with current values
        if (intervalInput) intervalInput.value = this.atomSpawner.tickInterval;
        if (widthInput) widthInput.value = Math.round(this.atomSpawner.zone.width);
        if (heightInput) heightInput.value = Math.round(this.atomSpawner.zone.height);

        // Update atom pool selection and weights
        atomPoolSelector?.querySelectorAll('.atom-pool-item').forEach(item => {
            const symbol = item.dataset.symbol;
            const btn = item.querySelector('.atom-pool-btn');
            const select = item.querySelector('.atom-weight-select');
            const isSelected = this.atomSpawner.atomPool.includes(symbol);
            const currentWeight = this.atomSpawner.getAtomWeight(symbol);

            btn.classList.toggle('selected', isSelected);
            item.classList.toggle('selected', isSelected);
            select.style.display = isSelected ? '' : 'none';
            select.value = currentWeight;
        });

        modal.style.display = 'flex';
    }

    /**
     * Apply spawner configuration from modal
     */
    _applySpawnerConfig() {
        const intervalInput = document.getElementById('spawnInterval');
        const widthInput = document.getElementById('zoneWidth');
        const heightInput = document.getElementById('zoneHeight');
        const atomPoolSelector = document.getElementById('atomPoolSelector');

        // Get selected atoms and their weights
        const selectedAtoms = [];
        const atomWeights = {};
        atomPoolSelector?.querySelectorAll('.atom-pool-item').forEach(item => {
            const btn = item.querySelector('.atom-pool-btn');
            const select = item.querySelector('.atom-weight-select');
            if (btn.classList.contains('selected')) {
                const symbol = btn.dataset.symbol;
                selectedAtoms.push(symbol);
                atomWeights[symbol] = parseInt(select.value) || 1;
            }
        });

        // Apply tick interval
        if (intervalInput) {
            this.atomSpawner.setTickInterval(parseInt(intervalInput.value) || 60);
        }

        // Apply atom pool and weights
        if (selectedAtoms.length > 0) {
            this.atomSpawner.setAtomPool(selectedAtoms);
            this.atomSpawner.setAtomWeights(atomWeights);
        }

        // Apply zone size (centered on current zone center)
        if (widthInput && heightInput) {
            const newWidth = parseInt(widthInput.value) || 400;
            const newHeight = parseInt(heightInput.value) || 400;
            const centerX = this.atomSpawner.zone.x + this.atomSpawner.zone.width / 2;
            const centerY = this.atomSpawner.zone.y + this.atomSpawner.zone.height / 2;

            this.atomSpawner.setZone(
                centerX - newWidth / 2,
                centerY - newHeight / 2,
                newWidth,
                newHeight
            );
        }

        this.viewer.render();
        console.log('Spawner config applied:', {
            interval: this.atomSpawner.tickInterval,
            pool: this.atomSpawner.atomPool,
            weights: this.atomSpawner.atomWeights,
            zone: this.atomSpawner.zone
        });
    }
}

// Create global app instance
window.cellApp = new App();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cellApp.init().catch(console.error);
});
