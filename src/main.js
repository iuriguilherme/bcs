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

        // Set up simulation callbacks
        this.simulation.onUpdate = () => {
            this.viewer.render();
            this._updateStats();
        };

        this.simulation.onTick = (tick) => {
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
            playPauseBtn.textContent = this.simulation.running ? 'Pause' : 'Play';
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
            });
        });
    }

    /**
     * Populate the atom palette with available elements
     */
    _populateAtomPalette() {
        const palette = document.getElementById('atomPalette');
        if (!palette) return;

        // Essential elements for Phase 1
        const elements = ['H', 'C', 'N', 'O', 'P', 'S', 'Na', 'Cl'];

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
        const elements = ['H', 'C', 'N', 'O', 'P', 'S', 'Na', 'Cl'];

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
            const blueprints = this.catalogue.getAllMolecules();
            console.log('Rendering molecule palette, blueprints:', blueprints.length);

            if (blueprints.length === 0) {
                palette.innerHTML = '<p class="empty-state">No molecules discovered yet. Create stable molecules at Level 1!</p>';
                return;
            }

            // Helper to escape fingerprint for HTML attributes
            const escapeAttr = (str) => str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const unescapeAttr = (str) => str.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

            palette.innerHTML = blueprints.map(bp => `
                <button class="palette-btn molecule-btn" data-fingerprint="${escapeAttr(bp.fingerprint)}">
                    <span class="formula">${bp.formula}</span>
                    <span class="info">${bp.atomData.length} atoms</span>
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
                    }
                });
            });

        } catch (e) {
            console.error('Error in _renderPolymerPalette:', e);
            palette.innerHTML = '<p class="empty-state">Error loading polymers</p>';
        }
    }

    /**
     * Render cell palette
     */
    _renderCellPalette(palette) {
        palette.innerHTML = `
            <button class="palette-btn cell-btn selected" data-type="cell">
                <span class="symbol">&#129516;</span>
                <span class="info">New Cell</span>
            </button>
            <p class="palette-hint">Click canvas to place a cell with random neural network</p>
        `;

        palette.querySelector('.cell-btn')?.addEventListener('click', () => {
            this.controls.setTool('place');
        });
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
}

// Create global app instance
window.app = new App();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init().catch(console.error);
});
