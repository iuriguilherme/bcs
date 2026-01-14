/**
 * Catalogue UI
 * User interface for the catalogue panel
 */

class CatalogueUI {
    /**
     * Create catalogue UI
     * @param {Catalogue} catalogue - The catalogue instance
     * @param {Controls} controls - The controls instance
     */
    constructor(catalogue, controls) {
        this.catalogue = catalogue;
        this.controls = controls;

        // DOM elements
        this.listContainer = document.getElementById('catalogueList');
        this.searchInput = document.getElementById('catalogueSearch');

        // Set up callbacks
        this.catalogue.onBlueprintAdded = this._onBlueprintAdded.bind(this);

        // Bind events
        this._bindEvents();

        // Initial render
        this.render();
    }

    /**
     * Bind event listeners
     */
    _bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', Utils.debounce(() => {
                this.render(this.searchInput.value);
            }, 200));
        }
    }

    /**
     * Callback when new blueprint is added
     */
    _onBlueprintAdded(blueprint) {
        this.render();
    }

    /**
     * Render the catalogue list
     * @param {string} filter - Optional search filter
     */
    render(filter = '') {
        if (!this.listContainer) return;

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

        let html = '';
        const filterLower = filter.toLowerCase();

        // Section 1: Atoms
        const commonAtoms = ['H', 'C', 'N', 'O', 'P', 'S', 'Cl', 'Na', 'K', 'Ca', 'Fe'];
        const matchingAtoms = filter
            ? commonAtoms.filter(s => s.toLowerCase().includes(filterLower) || getElement(s)?.name.toLowerCase().includes(filterLower))
            : commonAtoms;

        if (matchingAtoms.length > 0) {
            html += '<div class="catalogue-section"><h4>Atoms</h4><div class="catalogue-grid">';
            for (const symbol of matchingAtoms) {
                const element = getElement(symbol);
                if (element) {
                    html += `
                        <button class="catalogue-atom-btn" data-symbol="${symbol}" data-level="0">
                            <span class="atom-symbol">${symbol}</span>
                            <span class="atom-name">${element.name}</span>
                        </button>
                    `;
                }
            }
            html += '</div></div>';
        }

        // Section 2: Molecules
        const allBlueprints = filter
            ? this.catalogue.search(filter)
            : this.catalogue.getAllMolecules();
        const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp));
        blueprints.sort((a, b) => b.createdAt - a.createdAt);

        if (blueprints.length > 0) {
            html += '<div class="catalogue-section"><h4>Molecules</h4>';
            html += blueprints.map(bp => this._renderItem(bp)).join('');
            html += '</div>';
        }

        // Section 3: Polymer Templates
        const polymerTemplates = window.getAllPolymerTemplates ? window.getAllPolymerTemplates() : [];
        const matchingPolymers = filter
            ? polymerTemplates.filter(p => p.name.toLowerCase().includes(filterLower) || p.type.toLowerCase().includes(filterLower))
            : polymerTemplates;

        if (matchingPolymers.length > 0) {
            html += '<div class="catalogue-section"><h4>Polymer Templates</h4><div class="catalogue-grid">';
            for (const template of matchingPolymers) {
                const colorMap = { lipid: '#ef4444', protein: '#3b82f6', nucleic_acid: '#22c55e', carbohydrate: '#f59e0b' };
                const color = colorMap[template.type] || '#8b5cf6';
                html += `
                    <button class="catalogue-polymer-btn" data-polymer-id="${template.id}" data-level="2" style="border-color: ${color};">
                        <span class="polymer-name">${template.name}</span>
                        <span class="polymer-type">${template.type}</span>
                    </button>
                `;
            }
            html += '</div></div>';
        }

        if (!html) {
            html = '<p class="empty-state">No matches found.</p>';
        }

        this.listContainer.innerHTML = html;

        // Bind atom click handlers
        this.listContainer.querySelectorAll('.catalogue-atom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                const level = parseInt(btn.dataset.level);
                this.controls.setSelectedElement(symbol);
                this.controls.setTool('place');
                if (window.app) window.app.setLevel(level);
            });
        });

        // Bind molecule click handlers
        this.listContainer.querySelectorAll('.catalogue-item').forEach(item => {
            const fingerprint = item.dataset.fingerprint;
            item.addEventListener('click', () => {
                this._selectBlueprint(fingerprint);
                if (window.app) window.app.setLevel(1); // Molecule level
            });
        });

        // Bind polymer click handlers
        this.listContainer.querySelectorAll('.catalogue-polymer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const polymerId = btn.dataset.polymerId;
                const level = parseInt(btn.dataset.level);
                const template = polymerTemplates.find(p => p.id === polymerId);
                if (template) {
                    this.controls.selectedPolymerTemplate = template;
                    this.controls.setTool('place');
                    if (window.app) window.app.setLevel(level);
                }
            });
        });
    }


    /**
     * Render a single catalogue item
     */
    _renderItem(blueprint) {
        const isSelected = this.controls.selectedBlueprint?.fingerprint === blueprint.fingerprint;
        const atomCount = blueprint.atomData ? blueprint.atomData.length : 0;
        // Encode fingerprint for safe HTML attribute storage
        const encodedFingerprint = encodeURIComponent(blueprint.fingerprint);

        return `
            <div class="catalogue-item ${isSelected ? 'selected' : ''}" 
                 data-fingerprint="${encodedFingerprint}"
                 title="${blueprint.name} - ${blueprint.formula}">
                <div class="catalogue-item-preview">
                    <canvas class="preview-canvas" 
                            width="40" height="40"
                            data-fingerprint="${encodedFingerprint}"></canvas>
                </div>
                <div class="catalogue-item-info">
                    <div class="catalogue-item-name">${blueprint.name}</div>
                    <div class="catalogue-item-formula">${atomCount} atoms</div>
                </div>
                <div class="catalogue-item-status">
                    ${blueprint.isStable ? '&#10003;' : '!'}
                </div>
            </div>
        `;
    }

    /**
     * Select a blueprint for placement
     */
    _selectBlueprint(encodedFingerprint) {
        // Decode the URI-encoded fingerprint
        const fingerprint = decodeURIComponent(encodedFingerprint);
        const blueprint = this.catalogue.getMolecule(fingerprint);
        if (blueprint) {
            this.controls.setSelectedBlueprint(blueprint);
            this.controls.setTool('place');

            // Switch to molecule level if at atom level
            if (this.controls.viewer && this.controls.viewer.level < 1) {
                this.controls.viewer.setLevel(1);
                // Update level buttons
                document.querySelectorAll('.level-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.level === '1');
                });
            }

            // Update UI
            document.querySelectorAll('.catalogue-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.fingerprint === encodedFingerprint);
            });

            // Clear atom selection
            document.querySelectorAll('.atom-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }
    }

    /**
     * Render preview canvases
     */
    renderPreviews() {
        const canvases = this.listContainer.querySelectorAll('.preview-canvas');

        canvases.forEach(canvas => {
            const fingerprint = canvas.dataset.fingerprint;
            const blueprint = this.catalogue.getMolecule(fingerprint);

            if (blueprint) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                blueprint.renderPreview(ctx, canvas.width / 2, canvas.height / 2, 35);
            }
        });
    }
}

// Style additions for catalogue items
const style = document.createElement('style');
style.textContent = `
    .catalogue-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        cursor: pointer;
        transition: all 150ms ease;
    }
    
    .catalogue-item:hover {
        border-color: var(--accent-primary);
        transform: translateX(4px);
    }
    
    .catalogue-item.selected {
        border-color: var(--accent-primary);
        background: rgba(99, 102, 241, 0.1);
    }
    
    .catalogue-item-preview {
        flex-shrink: 0;
    }
    
    .preview-canvas {
        display: block;
        background: var(--bg-secondary);
        border-radius: 4px;
    }
    
    .catalogue-item-info {
        flex: 1;
        min-width: 0;
    }
    
    .catalogue-item-name {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .catalogue-item-formula {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .catalogue-item-status {
        font-size: 1rem;
    }
    
    .inspector-item {
        padding: 8px 0;
    }
    
    .inspector-item h3 {
        font-size: 1rem;
        margin-bottom: 8px;
        color: var(--accent-primary);
    }
    
    .inspector-item p {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-bottom: 4px;
    }
    
    .catalogue-section {
        margin-bottom: 16px;
    }
    
    .catalogue-section h4 {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--border-subtle);
    }
    
    .catalogue-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
    }
    
    .catalogue-atom-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 4px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
    }
    
    .catalogue-atom-btn:hover {
        background: rgba(99, 102, 241, 0.2);
        border-color: var(--accent-primary);
    }
    
    .catalogue-atom-btn .atom-symbol {
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--text-primary);
    }
    
    .catalogue-atom-btn .atom-name {
        font-size: 0.65rem;
        color: var(--text-secondary);
    }
    
    .catalogue-polymer-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 4px;
        background: var(--bg-tertiary);
        border: 2px solid;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
    }
    
    .catalogue-polymer-btn:hover {
        background: rgba(139, 92, 246, 0.2);
    }
    
    .catalogue-polymer-btn .polymer-name {
        font-weight: 600;
        font-size: 0.7rem;
        color: var(--text-primary);
        text-align: center;
    }
    
    .catalogue-polymer-btn .polymer-type {
        font-size: 0.6rem;
        color: var(--text-secondary);
    }
`;
document.head.appendChild(style);

// Make available globally
window.CatalogueUI = CatalogueUI;
