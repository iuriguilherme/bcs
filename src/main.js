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

        // Set up UI
        this._setupUI();

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
                this.viewer.setLevel(level);

                // Update button states
                document.querySelectorAll('.level-btn').forEach((b, i) => {
                    b.classList.toggle('active', i === level);
                });
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
     * Update statistics display
     */
    _updateStats() {
        const stats = this.simulation.getStats();

        document.getElementById('atomCount').textContent = `Atoms: ${stats.atomCount}`;
        document.getElementById('moleculeCount').textContent = `Mol: ${stats.moleculeCount}`;
        document.getElementById('proteinCount').textContent = `Prot: ${stats.proteinCount || 0}`;
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
