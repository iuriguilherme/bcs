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

        // Only show stable molecules with 2+ atoms, 1+ bonds, and all valences satisfied
        const allBlueprints = filter
            ? this.catalogue.search(filter)
            : this.catalogue.getAllMolecules();

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

        if (blueprints.length === 0) {
            this.listContainer.innerHTML = `
                <p class="empty-state">
                    ${filter ? 'No matches found.' : 'No stable molecules yet. Create stable molecules to add them!'}
                </p>
            `;
            return;
        }

        // Sort by creation date (newest first)
        blueprints.sort((a, b) => b.createdAt - a.createdAt);

        this.listContainer.innerHTML = blueprints.map(bp => this._renderItem(bp)).join('');

        // Bind click handlers
        this.listContainer.querySelectorAll('.catalogue-item').forEach(item => {
            const fingerprint = item.dataset.fingerprint;

            item.addEventListener('click', () => {
                this._selectBlueprint(fingerprint);
            });

            item.addEventListener('dblclick', () => {
                // Place immediately at center
                const bp = this.catalogue.getMolecule(fingerprint);
                if (bp) {
                    this.controls.setSelectedBlueprint(bp);
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
`;
document.head.appendChild(style);

// Make available globally
window.CatalogueUI = CatalogueUI;
