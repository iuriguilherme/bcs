/**
 * Cell Blueprints
 * Pre-defined templates for known bacteria/prokaryotes
 * 
 * Each cell blueprint specifies:
 * - Required polymer types with minimum chain lengths
 * - Biological metadata (species name, description)
 * - Future: environmental effects (produces/consumes)
 */

/**
 * Cell blueprint definitions
 * Each entry describes a type of prokaryote that can be formed
 */
const CELL_BLUEPRINTS = {
    // Minimal viable cell - simplest possible life form
    MINIMAL_CELL: {
        id: 'minimal_cell',
        name: 'Minimal Cell',
        species: 'Protocellus minimus',
        description: 'Simplest possible living cell with just membrane and genetic material',
        requirements: {
            membrane: {
                polymerId: 'PHOSPHOLIPID',
                minChainLength: 2,
                count: 1,
                description: 'Lipid bilayer enclosing the cell'
            },
            nucleoid: {
                polymerId: 'DNA',
                minChainLength: 2,
                count: 1,
                description: 'Genetic material for replication'
            }
        },
        color: '#4ade80',  // Green
        // Future: environmental effects
        environmentalEffects: null
    },

    // Cyanobacteria - photosynthetic, produces oxygen
    CYANOBACTERIA: {
        id: 'cyanobacteria',
        name: 'Cyanobacteria',
        species: 'Synechococcus elongatus',
        description: 'Photosynthetic bacteria that produce oxygen. Essential for early Earth atmosphere.',
        requirements: {
            membrane: {
                polymerId: 'PHOSPHOLIPID',
                minChainLength: 3,
                count: 1,
                description: 'Double membrane with thylakoid system'
            },
            nucleoid: {
                polymerId: 'DNA',
                minChainLength: 3,
                count: 1,
                description: 'Circular chromosome'
            },
            ribosomes: {
                polymerId: 'STRUCTURAL_PROTEIN',
                minChainLength: 2,
                count: 1,
                description: 'Protein synthesis machinery'
            }
        },
        color: '#22d3ee',  // Cyan (appropriate for cyanobacteria!)
        // Documented for future implementation
        environmentalEffects: {
            produces: [{ molecule: 'O2', rate: 0.1 }],
            consumes: [
                { molecule: 'CO2', rate: 0.1 },
                { molecule: 'H2O', rate: 0.05 }
            ],
            description: 'Photosynthesis: 6CO2 + 6H2O → C6H12O6 + 6O2'
        }
    },

    // E. coli - common model organism
    ESCHERICHIA_COLI: {
        id: 'e_coli',
        name: 'E. coli',
        species: 'Escherichia coli',
        description: 'Common gut bacterium and model organism for molecular biology.',
        requirements: {
            membrane: {
                polymerId: 'PHOSPHOLIPID',
                minChainLength: 3,
                count: 2,
                description: 'Inner and outer membrane'
            },
            nucleoid: {
                polymerId: 'DNA',
                minChainLength: 4,
                count: 1,
                description: 'Single circular chromosome'
            },
            ribosomes: {
                polymerId: 'STRUCTURAL_PROTEIN',
                minChainLength: 3,
                count: 2,
                description: 'Thousands of ribosomes for protein production'
            }
        },
        color: '#f472b6',  // Pink
        environmentalEffects: null
    },

    // Thermophile - heat-loving extremophile
    THERMOPHILE: {
        id: 'thermophile',
        name: 'Thermophile',
        species: 'Thermus aquaticus',
        description: 'Heat-loving bacteria. Source of Taq polymerase used in PCR.',
        requirements: {
            membrane: {
                polymerId: 'PHOSPHOLIPID',
                minChainLength: 4,
                count: 2,
                description: 'Heat-stable lipid bilayer'
            },
            nucleoid: {
                polymerId: 'DNA',
                minChainLength: 3,
                count: 1,
                description: 'Heat-stable DNA'
            },
            ribosomes: {
                polymerId: 'STRUCTURAL_PROTEIN',
                minChainLength: 3,
                count: 1,
                description: 'Heat-stable proteins'
            }
        },
        color: '#f97316',  // Orange (for heat)
        environmentalEffects: null
    }
};

/**
 * CellBlueprint - Template for creating cells from polymers
 */
class CellBlueprint {
    constructor(template) {
        this.id = template.id;
        this.name = template.name;
        this.species = template.species || null;
        this.description = template.description || '';
        this.requirements = template.requirements || {};
        this.color = template.color || '#8b5cf6';
        this.environmentalEffects = template.environmentalEffects || null;

        // Calculate total polymers needed
        this.totalPolymersRequired = 0;
        for (const req of Object.values(this.requirements)) {
            this.totalPolymersRequired += req.count;
        }

        // Generate fingerprint
        this.fingerprint = this._generateFingerprint();
    }

    /**
     * Generate unique fingerprint for this blueprint
     */
    _generateFingerprint() {
        const parts = [];
        for (const [role, req] of Object.entries(this.requirements)) {
            parts.push(`${role}:${req.polymerId}:${req.minChainLength}:${req.count}`);
        }
        return `cell:${this.id}:${parts.sort().join('|')}`;
    }

    /**
     * Check if a set of polymers satisfies this blueprint's requirements
     * @param {Polymer[]} polymers - Array of polymers to check
     * @returns {object} - { satisfied: boolean, missing: [], progress: {} }
     */
    checkRequirements(polymers) {
        const progress = {};
        const missing = [];

        for (const [role, req] of Object.entries(this.requirements)) {
            // Find polymers matching this requirement
            const matching = polymers.filter(p => {
                // Check polymer type matches the expected blueprint
                const polymerBlueprint = CELL_ESSENTIAL_POLYMERS?.[req.polymerId];
                if (!polymerBlueprint) return false;

                // Check type matches
                if (p.type !== polymerBlueprint.type) return false;

                // Check chain length (number of monomers)
                const chainLength = p.monomers?.length || p.molecules?.length || 0;
                if (chainLength < req.minChainLength) return false;

                return true;
            });

            progress[role] = {
                have: matching.length,
                need: req.count,
                satisfied: matching.length >= req.count,
                polymers: matching
            };

            if (matching.length < req.count) {
                missing.push({
                    role,
                    polymerId: req.polymerId,
                    need: req.count,
                    have: matching.length,
                    minChainLength: req.minChainLength
                });
            }
        }

        const satisfied = missing.length === 0;

        return { satisfied, missing, progress };
    }

    /**
     * Get detailed requirements for display
     * @returns {object[]} - Array of requirement details
     */
    getDetailedRequirements() {
        const details = [];

        for (const [role, req] of Object.entries(this.requirements)) {
            // Look up the polymer template to get monomer info
            const polymerTemplate = CELL_ESSENTIAL_POLYMERS?.[req.polymerId];
            let monomerTemplate = null;
            let monomerFormula = null;

            if (polymerTemplate?.monomerId && typeof getMonomerTemplate === 'function') {
                monomerTemplate = getMonomerTemplate(polymerTemplate.monomerId);
                monomerFormula = monomerTemplate?.formula;
            }

            details.push({
                role,
                polymerId: req.polymerId,
                polymerName: polymerTemplate?.name || req.polymerId,
                polymerType: polymerTemplate?.type || 'generic',
                minChainLength: req.minChainLength,
                count: req.count,
                description: req.description || '',
                monomerId: polymerTemplate?.monomerId || null,
                monomerName: monomerTemplate?.name || null,
                monomerFormula
            });
        }

        return details;
    }

    /**
     * Serialize for storage
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            species: this.species,
            requirements: this.requirements,
            color: this.color
        };
    }
}

/**
 * Get a cell blueprint by ID
 * @param {string} id - Blueprint ID (e.g., 'MINIMAL_CELL', 'CYANOBACTERIA')
 * @returns {CellBlueprint|null}
 */
function getCellBlueprint(id) {
    const template = CELL_BLUEPRINTS[id];
    if (!template) return null;
    return new CellBlueprint(template);
}

/**
 * Get all cell blueprints
 * @returns {CellBlueprint[]}
 */
function getAllCellBlueprints() {
    return Object.values(CELL_BLUEPRINTS).map(t => new CellBlueprint(t));
}

/**
 * Get polymer name from polymer ID
 * @param {string} polymerId - e.g., 'PHOSPHOLIPID', 'DNA'
 * @returns {string}
 */
function getPolymerName(polymerId) {
    const template = CELL_ESSENTIAL_POLYMERS?.[polymerId];
    return template?.name || polymerId;
}

/**
 * Get monomer template for a polymer ID
 * @param {string} polymerId - e.g., 'PHOSPHOLIPID', 'DNA'
 * @returns {object|null}
 */
function getMonomerForPolymer(polymerId) {
    const polymerTemplate = CELL_ESSENTIAL_POLYMERS?.[polymerId];
    if (!polymerTemplate?.monomerId) return null;

    if (typeof getMonomerTemplate === 'function') {
        return getMonomerTemplate(polymerTemplate.monomerId);
    }
    return null;
}

/**
 * Get color for a polymer role
 * @param {string} role - e.g., 'membrane', 'nucleoid', 'ribosomes'
 * @returns {string}
 */
function getPolymerRoleColor(role) {
    const colors = {
        membrane: '#f59e0b',   // Amber for lipids
        nucleoid: '#3b82f6',   // Blue for DNA
        ribosomes: '#22c55e',  // Green for proteins
        other: '#8b5cf6'       // Purple default
    };
    return colors[role] || colors.other;
}

// Make available globally
window.CELL_BLUEPRINTS = CELL_BLUEPRINTS;
window.CellBlueprint = CellBlueprint;
window.getCellBlueprint = getCellBlueprint;
window.getAllCellBlueprints = getAllCellBlueprints;
window.getPolymerName = getPolymerName;
window.getMonomerForPolymer = getMonomerForPolymer;
window.getPolymerRoleColor = getPolymerRoleColor;
