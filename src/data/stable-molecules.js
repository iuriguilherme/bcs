/**
 * Stable Molecule Registry
 * Defines known stable molecules with their correct geometric configurations.
 * Used to reshape unstable molecules that match these formulas into their
 * natural stable forms.
 * 
 * ============================================================================
 * VALENCE CLOSURE REQUIREMENT
 * ============================================================================
 * 
 * All molecules in this registry MUST have fully closed valence - meaning
 * every atom must have its bonding capacity completely satisfied:
 * 
 *   Element | Valence | Must have exactly this many bonds
 *   --------|---------|----------------------------------
 *   H       |    1    | 1 bond
 *   C       |    4    | 4 bonds (single, double, triple combinations)
 *   N       |    3    | 3 bonds
 *   O       |    2    | 2 bonds
 *   S       |    2    | 2 bonds
 *   Cl      |    1    | 1 bond
 *   Na      |    1    | 1 bond
 *   K       |    1    | 1 bond
 *   Ca      |    2    | 2 bonds
 *   Fe      |  2 or 3 | 2 or 3 bonds
 * 
 * WHY NO OPEN VALENCE MOLECULES?
 * ------------------------------
 * 
 * 1. STABILITY DEFINITION: In this simulation, a molecule is "stable" when
 *    ALL atoms have availableValence === 0. This is the fundamental gate
 *    for molecule completion and cataloguing.
 * 
 * 2. RESHAPE LOOPS: Molecules with unsatisfied valence never become stable,
 *    causing infinite reshape attempts as the system tries to fix them.
 * 
 * 3. POLYMER FORMATION: The canPolymerize() check relies on isStable().
 *    Open-valence molecules would incorrectly try to form polymers.
 * 
 * 4. CHEMISTRY ACCURACY: Real radicals and ions (like OH•, H3O+, CO3²⁻)
 *    are highly reactive intermediates, not stable end products. This
 *    simulation focuses on stable molecular species.
 * 
 * REMOVED MOLECULES (for reference):
 * - C3, C4, C5, C6, C8, C10, C12: End carbons have 2 bonds (need 4)
 * - C2O, C4O, C5O: End carbon has 3 bonds (need 4)
 * - C3O: End carbon has 2 bonds (need 4)
 * - CO3: Oxygen atoms have 1 bond each (need 2) - carbonate radical
 * - C2O3: End carbons have 2 bonds each (need 4)
 * - H3O: Oxygen has 3 bonds (max 2) - hydronium ion
 * 
 * ============================================================================
 */

const STABLE_MOLECULES = {
    'H2': {
        name: 'Hydrogen',
        formula: 'H2',
        atoms: [
            { symbol: 'H', relX: -15, relY: 0 },
            { symbol: 'H', relX: 15, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 }
        ],
        description: 'Diatomic hydrogen - single bond'
    },
    'O2': {
        name: 'Oxygen',
        formula: 'O2',
        atoms: [
            { symbol: 'O', relX: -20, relY: 0 },
            { symbol: 'O', relX: 20, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 }
        ],
        description: 'Diatomic oxygen - double bond'
    },
    'N2': {
        name: 'Nitrogen',
        formula: 'N2',
        atoms: [
            { symbol: 'N', relX: -18, relY: 0 },
            { symbol: 'N', relX: 18, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 3 }
        ],
        description: 'Diatomic nitrogen - triple bond'
    },
    'H2O': {
        name: 'Water',
        formula: 'H2O',
        atoms: [
            { symbol: 'O', relX: 0, relY: 0 },          // Central oxygen
            { symbol: 'H', relX: -24, relY: 19 },       // 104.5° bond angle
            { symbol: 'H', relX: 24, relY: 19 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 }
        ],
        description: 'Water - bent shape, 104.5° bond angle'
    },
    'CO2': {
        name: 'Carbon Dioxide',
        formula: 'CO2',
        atoms: [
            { symbol: 'C', relX: 0, relY: 0 },          // Central carbon
            { symbol: 'O', relX: -35, relY: 0 },        // Linear: 180°
            { symbol: 'O', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },           // Double bond
            { atom1: 0, atom2: 2, order: 2 }            // Double bond
        ],
        description: 'Carbon dioxide - linear, double bonds'
    },
    'CH4': {
        name: 'Methane',
        formula: 'CH4',
        atoms: [
            { symbol: 'C', relX: 0, relY: 0 },          // Central carbon
            { symbol: 'H', relX: 0, relY: -25 },        // Tetrahedral (2D projection)
            { symbol: 'H', relX: 23, relY: 12 },
            { symbol: 'H', relX: -23, relY: 12 },
            { symbol: 'H', relX: 0, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 }
        ],
        description: 'Methane - tetrahedral geometry'
    },
    'NH3': {
        name: 'Ammonia',
        formula: 'NH3',
        atoms: [
            { symbol: 'N', relX: 0, relY: 0 },          // Central nitrogen
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 19, relY: 11 },
            { symbol: 'H', relX: -19, relY: 11 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 }
        ],
        description: 'Ammonia - trigonal pyramidal'
    },
    'HCl': {
        name: 'Hydrogen Chloride',
        formula: 'ClH',
        atoms: [
            { symbol: 'Cl', relX: -17, relY: 0 },
            { symbol: 'H', relX: 17, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 }
        ],
        description: 'Hydrogen chloride - polar covalent'
    },
    'CO': {
        name: 'Carbon Monoxide',
        formula: 'CO',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'O', relX: 15, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 3 }
        ],
        description: 'Carbon monoxide - triple bond'
    },
    'H2S': {
        name: 'Hydrogen Sulfide',
        formula: 'H2S',
        atoms: [
            { symbol: 'S', relX: 0, relY: 0 },          // Central sulfur
            { symbol: 'H', relX: -22, relY: 16 },       // ~92° bond angle
            { symbol: 'H', relX: 22, relY: 16 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 }
        ],
        description: 'Hydrogen sulfide - bent shape'
    },

    // ===== CARBON ALLOTROPES & CLUSTERS =====
    // NOTE: Most carbon allotropes (C3-C12) removed because they have unsatisfied valences.
    // Linear cumulenes have end carbons with only 2 bonds (need 4).
    // Cyclic rings with alternating double/single bonds give 3 bonds per carbon (need 4).
    // Only C2 with quadruple bond is kept.

    'C2': {
        name: 'Dicarbon',
        formula: 'C2',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'C', relX: 15, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 4 }  // Quadruple bond (or double based on model)
        ],
        description: 'Dicarbon - found in carbon vapor and comets'
    },

    // ===== CARBON-OXYGEN COMPOUNDS =====

    'C3O2': {
        name: 'Carbon Suboxide',
        formula: 'C3O2',
        atoms: [
            { symbol: 'O', relX: -45, relY: 0 },
            { symbol: 'C', relX: -22, relY: 0 },
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'C', relX: 22, relY: 0 },
            { symbol: 'O', relX: 45, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 2 },
            { atom1: 2, atom2: 3, order: 2 },
            { atom1: 3, atom2: 4, order: 2 }
        ],
        description: 'Carbon suboxide - linear O=C=C=C=O'
    },
    // C2O, C4O, C5O removed - end carbon has only 3 bonds (needs 4)
    // CO3 removed - bottom oxygens have only 1 bond each (need 2) - it's a radical
    // C2O3 removed - end carbons have only 2 bonds each (needs 4)
    // C3O removed - end carbon has only 2 bonds (needs 4)
    'C2O2': {
        name: 'Ethylenedione',
        formula: 'C2O2',
        atoms: [
            { symbol: 'O', relX: -35, relY: 0 },
            { symbol: 'C', relX: -12, relY: 0 },
            { symbol: 'C', relX: 12, relY: 0 },
            { symbol: 'O', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 2 },
            { atom1: 2, atom2: 3, order: 2 }
        ],
        description: 'Ethylenedione - O=C=C=O (glyoxal precursor)'
    },
    'C4O2': {
        name: 'Butatrienedione',
        formula: 'C4O2',
        atoms: [
            { symbol: 'O', relX: -50, relY: 0 },
            { symbol: 'C', relX: -28, relY: 0 },
            { symbol: 'C', relX: -9, relY: 0 },
            { symbol: 'C', relX: 9, relY: 0 },
            { symbol: 'C', relX: 28, relY: 0 },
            { symbol: 'O', relX: 50, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 2 },
            { atom1: 2, atom2: 3, order: 2 },
            { atom1: 3, atom2: 4, order: 2 },
            { atom1: 4, atom2: 5, order: 2 }
        ],
        description: 'Butatrienedione - O=C=C=C=C=O'
    },
    'C5O2': {
        name: 'Pentatetraenedione',
        formula: 'C5O2',
        atoms: [
            { symbol: 'O', relX: -60, relY: 0 },
            { symbol: 'C', relX: -38, relY: 0 },
            { symbol: 'C', relX: -19, relY: 0 },
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'C', relX: 19, relY: 0 },
            { symbol: 'C', relX: 38, relY: 0 },
            { symbol: 'O', relX: 60, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 2 },
            { atom1: 2, atom2: 3, order: 2 },
            { atom1: 3, atom2: 4, order: 2 },
            { atom1: 4, atom2: 5, order: 2 },
            { atom1: 5, atom2: 6, order: 2 }
        ],
        description: 'Pentatetraenedione - O=C=C=C=C=C=O'
    },

    // ===== NITROGEN COMPOUNDS =====
    // Note: N2 and NH3 are defined above in the basic molecules section

    'HCN': {
        name: 'Hydrogen Cyanide',
        formula: 'CHN',
        atoms: [
            { symbol: 'H', relX: -30, relY: 0 },
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'N', relX: 25, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // H-C single
            { atom1: 1, atom2: 2, order: 3 }   // C≡N triple
        ],
        description: 'Hydrogen cyanide - linear, triple bond C≡N'
    },
    // N2O removed - resonance structure doesn't fit simple valence model (middle N would have 4 bonds)
    'CH3N': {
        name: 'Methanimine',
        formula: 'CH3N',
        atoms: [
            { symbol: 'C', relX: -12, relY: 0 },
            { symbol: 'N', relX: 18, relY: 0 },
            { symbol: 'H', relX: -30, relY: -15 },
            { symbol: 'H', relX: -30, relY: 15 },
            { symbol: 'H', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },  // C=N double
            { atom1: 0, atom2: 2, order: 1 },  // C-H
            { atom1: 0, atom2: 3, order: 1 },  // C-H
            { atom1: 1, atom2: 4, order: 1 }   // N-H
        ],
        description: 'Methanimine - simplest imine H2C=NH'
    },
    'CH5N': {
        name: 'Methylamine',
        formula: 'CH5N',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'N', relX: 20, relY: 0 },
            { symbol: 'H', relX: -35, relY: 0 },
            { symbol: 'H', relX: -25, relY: -20 },
            { symbol: 'H', relX: -25, relY: 20 },
            { symbol: 'H', relX: 35, relY: -15 },
            { symbol: 'H', relX: 35, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // C-N single
            { atom1: 0, atom2: 2, order: 1 },  // C-H
            { atom1: 0, atom2: 3, order: 1 },  // C-H
            { atom1: 0, atom2: 4, order: 1 },  // C-H
            { atom1: 1, atom2: 5, order: 1 },  // N-H
            { atom1: 1, atom2: 6, order: 1 }   // N-H
        ],
        description: 'Methylamine - simplest primary amine CH3-NH2'
    },
    'N2H4': {
        name: 'Hydrazine',
        formula: 'H4N2',
        atoms: [
            { symbol: 'N', relX: -15, relY: 0 },
            { symbol: 'N', relX: 15, relY: 0 },
            { symbol: 'H', relX: -30, relY: -15 },
            { symbol: 'H', relX: -30, relY: 15 },
            { symbol: 'H', relX: 30, relY: -15 },
            { symbol: 'H', relX: 30, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // N-N single
            { atom1: 0, atom2: 2, order: 1 },  // N-H
            { atom1: 0, atom2: 3, order: 1 },  // N-H
            { atom1: 1, atom2: 4, order: 1 },  // N-H
            { atom1: 1, atom2: 5, order: 1 }   // N-H
        ],
        description: 'Hydrazine - rocket fuel precursor H2N-NH2'
    },
    'CHNO': {
        name: 'Isocyanic Acid',
        formula: 'CHNO',
        atoms: [
            { symbol: 'H', relX: -40, relY: 0 },
            { symbol: 'N', relX: -15, relY: 0 },
            { symbol: 'C', relX: 10, relY: 0 },
            { symbol: 'O', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // H-N single
            { atom1: 1, atom2: 2, order: 2 },  // N=C double
            { atom1: 2, atom2: 3, order: 2 }   // C=O double
        ],
        description: 'Isocyanic acid - linear H-N=C=O'
    },
    'CH2N2': {
        name: 'Cyanamide',
        formula: 'CH2N2',
        atoms: [
            { symbol: 'N', relX: -25, relY: 0 },
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'N', relX: 25, relY: 0 },
            { symbol: 'H', relX: -40, relY: -15 },
            { symbol: 'H', relX: -40, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // N-C single
            { atom1: 1, atom2: 2, order: 3 },  // C≡N triple
            { atom1: 0, atom2: 3, order: 1 },  // N-H
            { atom1: 0, atom2: 4, order: 1 }   // N-H
        ],
        description: 'Cyanamide - H2N-C≡N, prebiotic molecule'
    },

    // ===== SIMPLE CARBOHYDRATES =====

    'CH2O': {
        name: 'Formaldehyde',
        formula: 'CH2O',
        atoms: [
            { symbol: 'C', relX: 0, relY: 0 },
            { symbol: 'O', relX: 25, relY: 0 },
            { symbol: 'H', relX: -15, relY: -18 },
            { symbol: 'H', relX: -15, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 }
        ],
        description: 'Formaldehyde - simplest aldehyde (H2C=O)'
    },
    'C2H4O2': {
        name: 'Glycolaldehyde',
        formula: 'C2H4O2',
        atoms: [
            { symbol: 'C', relX: -20, relY: 0 },        // CHO carbon
            { symbol: 'C', relX: 20, relY: 0 },         // CH2OH carbon
            { symbol: 'O', relX: -40, relY: 0 },        // Aldehyde O
            { symbol: 'O', relX: 40, relY: 10 },        // Hydroxyl O
            { symbol: 'H', relX: -20, relY: -22 },      // CHO hydrogen
            { symbol: 'H', relX: 20, relY: -22 },
            { symbol: 'H', relX: 20, relY: 22 },
            { symbol: 'H', relX: 55, relY: 15 }         // OH hydrogen
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 2 },
            { atom1: 1, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 1, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 3, atom2: 7, order: 1 }
        ],
        description: 'Glycolaldehyde - simplest sugar, found in space (HOCH2-CHO)'
    },
    'C3H6O3': {
        name: 'Glyceraldehyde',
        formula: 'C3H6O3',
        atoms: [
            { symbol: 'C', relX: -30, relY: 0 },        // CHO
            { symbol: 'C', relX: 0, relY: 0 },          // CHOH
            { symbol: 'C', relX: 30, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -50, relY: 0 },        // Aldehyde O
            { symbol: 'O', relX: 0, relY: 25 },         // Middle OH
            { symbol: 'O', relX: 50, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 30, relY: -22 },
            { symbol: 'H', relX: 30, relY: 22 },
            { symbol: 'H', relX: 10, relY: 38 },
            { symbol: 'H', relX: 62, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 2 },
            { atom1: 1, atom2: 4, order: 1 },
            { atom1: 2, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 }
        ],
        description: 'Glyceraldehyde - 3-carbon aldose sugar (triose)'
    },
    'C3H6O3k': {
        name: 'Dihydroxyacetone',
        formula: 'C3H6O3',
        atoms: [
            { symbol: 'C', relX: -30, relY: 0 },        // CH2OH
            { symbol: 'C', relX: 0, relY: 0 },          // C=O
            { symbol: 'C', relX: 30, relY: 0 },         // CH2OH
            { symbol: 'O', relX: 0, relY: -25 },        // Ketone O
            { symbol: 'O', relX: -50, relY: 10 },       // Left OH
            { symbol: 'O', relX: 50, relY: 10 },        // Right OH
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: -30, relY: 22 },
            { symbol: 'H', relX: 30, relY: -22 },
            { symbol: 'H', relX: 30, relY: 22 },
            { symbol: 'H', relX: -62, relY: 18 },
            { symbol: 'H', relX: 62, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 1, atom2: 3, order: 2 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 2, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 }
        ],
        description: 'Dihydroxyacetone - 3-carbon ketose sugar (triose)'
    },
    'C4H8O4': {
        name: 'Erythrose',
        formula: 'C4H8O4',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },        // CHO
            { symbol: 'C', relX: -15, relY: 0 },        // CHOH
            { symbol: 'C', relX: 15, relY: 0 },         // CHOH
            { symbol: 'C', relX: 45, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -65, relY: 0 },        // Aldehyde O
            { symbol: 'O', relX: -15, relY: 25 },       // OH
            { symbol: 'O', relX: 15, relY: 25 },        // OH
            { symbol: 'O', relX: 65, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -45, relY: -20 },
            { symbol: 'H', relX: -15, relY: -20 },
            { symbol: 'H', relX: 15, relY: -20 },
            { symbol: 'H', relX: 45, relY: -20 },
            { symbol: 'H', relX: 45, relY: 20 },
            { symbol: 'H', relX: -5, relY: 38 },
            { symbol: 'H', relX: 25, relY: 38 },
            { symbol: 'H', relX: 77, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 2 },
            { atom1: 1, atom2: 5, order: 1 },
            { atom1: 2, atom2: 6, order: 1 },
            { atom1: 3, atom2: 7, order: 1 },
            { atom1: 0, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 5, atom2: 13, order: 1 },
            { atom1: 6, atom2: 14, order: 1 },
            { atom1: 7, atom2: 15, order: 1 }
        ],
        description: 'Erythrose - 4-carbon aldose sugar (tetrose)'
    },
    'C5H10O5': {
        name: 'Ribose',
        formula: 'C5H10O5',
        atoms: [
            { symbol: 'C', relX: -55, relY: 0 },        // CHO
            { symbol: 'C', relX: -28, relY: 0 },        // CHOH
            { symbol: 'C', relX: 0, relY: 0 },          // CHOH
            { symbol: 'C', relX: 28, relY: 0 },         // CHOH
            { symbol: 'C', relX: 55, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -75, relY: 0 },        // Aldehyde O
            { symbol: 'O', relX: -28, relY: 25 },       // OH
            { symbol: 'O', relX: 0, relY: 25 },         // OH
            { symbol: 'O', relX: 28, relY: 25 },        // OH
            { symbol: 'O', relX: 75, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -55, relY: -20 },
            { symbol: 'H', relX: -28, relY: -20 },
            { symbol: 'H', relX: 0, relY: -20 },
            { symbol: 'H', relX: 28, relY: -20 },
            { symbol: 'H', relX: 55, relY: -20 },
            { symbol: 'H', relX: 55, relY: 20 },
            { symbol: 'H', relX: -18, relY: 38 },
            { symbol: 'H', relX: 10, relY: 38 },
            { symbol: 'H', relX: 38, relY: 38 },
            { symbol: 'H', relX: 87, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 2 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 2, atom2: 7, order: 1 },
            { atom1: 3, atom2: 8, order: 1 },
            { atom1: 4, atom2: 9, order: 1 },
            { atom1: 0, atom2: 10, order: 1 },
            { atom1: 1, atom2: 11, order: 1 },
            { atom1: 2, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 },
            { atom1: 4, atom2: 15, order: 1 },
            { atom1: 6, atom2: 16, order: 1 },
            { atom1: 7, atom2: 17, order: 1 },
            { atom1: 8, atom2: 18, order: 1 },
            { atom1: 9, atom2: 19, order: 1 }
        ],
        description: 'Ribose - 5-carbon aldose sugar (pentose), RNA backbone'
    },
    'C5H10O5k': {
        name: 'Ribulose',
        formula: 'C5H10O5',
        atoms: [
            { symbol: 'C', relX: -55, relY: 0 },        // CH2OH
            { symbol: 'C', relX: -28, relY: 0 },        // C=O
            { symbol: 'C', relX: 0, relY: 0 },          // CHOH
            { symbol: 'C', relX: 28, relY: 0 },         // CHOH
            { symbol: 'C', relX: 55, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -75, relY: 10 },       // Terminal OH
            { symbol: 'O', relX: -28, relY: -25 },      // Ketone O
            { symbol: 'O', relX: 0, relY: 25 },         // OH
            { symbol: 'O', relX: 28, relY: 25 },        // OH
            { symbol: 'O', relX: 75, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -55, relY: -20 },
            { symbol: 'H', relX: -55, relY: 20 },
            { symbol: 'H', relX: 0, relY: -20 },
            { symbol: 'H', relX: 28, relY: -20 },
            { symbol: 'H', relX: 55, relY: -20 },
            { symbol: 'H', relX: 55, relY: 20 },
            { symbol: 'H', relX: -87, relY: 18 },
            { symbol: 'H', relX: 10, relY: 38 },
            { symbol: 'H', relX: 38, relY: 38 },
            { symbol: 'H', relX: 87, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 2 },
            { atom1: 2, atom2: 7, order: 1 },
            { atom1: 3, atom2: 8, order: 1 },
            { atom1: 4, atom2: 9, order: 1 },
            { atom1: 0, atom2: 10, order: 1 },
            { atom1: 0, atom2: 11, order: 1 },
            { atom1: 2, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 },
            { atom1: 4, atom2: 15, order: 1 },
            { atom1: 5, atom2: 16, order: 1 },
            { atom1: 7, atom2: 17, order: 1 },
            { atom1: 8, atom2: 18, order: 1 },
            { atom1: 9, atom2: 19, order: 1 }
        ],
        description: 'Ribulose - 5-carbon ketose sugar (pentose), CO2 fixation'
    },
    'C6H12O6': {
        name: 'Glucose',
        formula: 'C6H12O6',
        atoms: [
            { symbol: 'C', relX: -70, relY: 0 },        // CHO
            { symbol: 'C', relX: -42, relY: 0 },        // CHOH
            { symbol: 'C', relX: -14, relY: 0 },        // CHOH
            { symbol: 'C', relX: 14, relY: 0 },         // CHOH
            { symbol: 'C', relX: 42, relY: 0 },         // CHOH
            { symbol: 'C', relX: 70, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -90, relY: 0 },        // Aldehyde O
            { symbol: 'O', relX: -42, relY: 25 },       // OH
            { symbol: 'O', relX: -14, relY: 25 },       // OH
            { symbol: 'O', relX: 14, relY: 25 },        // OH
            { symbol: 'O', relX: 42, relY: 25 },        // OH
            { symbol: 'O', relX: 90, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -70, relY: -20 },
            { symbol: 'H', relX: -42, relY: -20 },
            { symbol: 'H', relX: -14, relY: -20 },
            { symbol: 'H', relX: 14, relY: -20 },
            { symbol: 'H', relX: 42, relY: -20 },
            { symbol: 'H', relX: 70, relY: -20 },
            { symbol: 'H', relX: 70, relY: 20 },
            { symbol: 'H', relX: -32, relY: 38 },
            { symbol: 'H', relX: -4, relY: 38 },
            { symbol: 'H', relX: 24, relY: 38 },
            { symbol: 'H', relX: 52, relY: 38 },
            { symbol: 'H', relX: 102, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 2 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 3, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 },
            { atom1: 0, atom2: 12, order: 1 },
            { atom1: 1, atom2: 13, order: 1 },
            { atom1: 2, atom2: 14, order: 1 },
            { atom1: 3, atom2: 15, order: 1 },
            { atom1: 4, atom2: 16, order: 1 },
            { atom1: 5, atom2: 17, order: 1 },
            { atom1: 5, atom2: 18, order: 1 },
            { atom1: 7, atom2: 19, order: 1 },
            { atom1: 8, atom2: 20, order: 1 },
            { atom1: 9, atom2: 21, order: 1 },
            { atom1: 10, atom2: 22, order: 1 },
            { atom1: 11, atom2: 23, order: 1 }
        ],
        description: 'Glucose - 6-carbon aldose sugar (hexose), primary energy source'
    },
    'C6H12O6k': {
        name: 'Fructose',
        formula: 'C6H12O6',
        atoms: [
            { symbol: 'C', relX: -70, relY: 0 },        // CH2OH
            { symbol: 'C', relX: -42, relY: 0 },        // C=O
            { symbol: 'C', relX: -14, relY: 0 },        // CHOH
            { symbol: 'C', relX: 14, relY: 0 },         // CHOH
            { symbol: 'C', relX: 42, relY: 0 },         // CHOH
            { symbol: 'C', relX: 70, relY: 0 },         // CH2OH
            { symbol: 'O', relX: -90, relY: 10 },       // Terminal OH
            { symbol: 'O', relX: -42, relY: -25 },      // Ketone O
            { symbol: 'O', relX: -14, relY: 25 },       // OH
            { symbol: 'O', relX: 14, relY: 25 },        // OH
            { symbol: 'O', relX: 42, relY: 25 },        // OH
            { symbol: 'O', relX: 90, relY: 10 },        // Terminal OH
            { symbol: 'H', relX: -70, relY: -20 },
            { symbol: 'H', relX: -70, relY: 20 },
            { symbol: 'H', relX: -14, relY: -20 },
            { symbol: 'H', relX: 14, relY: -20 },
            { symbol: 'H', relX: 42, relY: -20 },
            { symbol: 'H', relX: 70, relY: -20 },
            { symbol: 'H', relX: 70, relY: 20 },
            { symbol: 'H', relX: -102, relY: 18 },
            { symbol: 'H', relX: -4, relY: 38 },
            { symbol: 'H', relX: 24, relY: 38 },
            { symbol: 'H', relX: 52, relY: 38 },
            { symbol: 'H', relX: 102, relY: 18 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 2 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 3, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 },
            { atom1: 0, atom2: 12, order: 1 },
            { atom1: 0, atom2: 13, order: 1 },
            { atom1: 2, atom2: 14, order: 1 },
            { atom1: 3, atom2: 15, order: 1 },
            { atom1: 4, atom2: 16, order: 1 },
            { atom1: 5, atom2: 17, order: 1 },
            { atom1: 5, atom2: 18, order: 1 },
            { atom1: 6, atom2: 19, order: 1 },
            { atom1: 8, atom2: 20, order: 1 },
            { atom1: 9, atom2: 21, order: 1 },
            { atom1: 10, atom2: 22, order: 1 },
            { atom1: 11, atom2: 23, order: 1 }
        ],
        description: 'Fructose - 6-carbon ketose sugar (hexose), fruit sugar'
    },

    // ===== HYDROXIDES & BASES =====

    'HNaO': {
        name: 'Sodium Hydroxide',
        formula: 'HNaO',
        atoms: [
            { symbol: 'Na', relX: -20, relY: 0 },
            { symbol: 'O', relX: 10, relY: 0 },
            { symbol: 'H', relX: 30, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 }
        ],
        description: 'Sodium hydroxide (lye/caustic soda) - strong base NaOH'
    },
    'HKO': {
        name: 'Potassium Hydroxide',
        formula: 'HKO',
        atoms: [
            { symbol: 'K', relX: -22, relY: 0 },
            { symbol: 'O', relX: 10, relY: 0 },
            { symbol: 'H', relX: 30, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 }
        ],
        description: 'Potassium hydroxide (caustic potash) - strong base KOH'
    },
    'CaH2O2': {
        name: 'Calcium Hydroxide',
        formula: 'CaH2O2',
        atoms: [
            { symbol: 'Ca', relX: 0, relY: 0 },
            { symbol: 'O', relX: -25, relY: 15 },
            { symbol: 'O', relX: 25, relY: 15 },
            { symbol: 'H', relX: -40, relY: 25 },
            { symbol: 'H', relX: 40, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 1, atom2: 3, order: 1 },
            { atom1: 2, atom2: 4, order: 1 }
        ],
        description: 'Calcium hydroxide (slaked lime) - Ca(OH)2'
    },
    'FeH2O2': {
        name: 'Iron(II) Hydroxide',
        formula: 'FeH2O2',
        atoms: [
            { symbol: 'Fe', relX: 0, relY: 0 },
            { symbol: 'O', relX: -25, relY: 15 },
            { symbol: 'O', relX: 25, relY: 15 },
            { symbol: 'H', relX: -40, relY: 25 },
            { symbol: 'H', relX: 40, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 1, atom2: 3, order: 1 },
            { atom1: 2, atom2: 4, order: 1 }
        ],
        description: 'Iron(II) hydroxide (ferrous hydroxide) - Fe(OH)2'
    },
    'FeH3O3': {
        name: 'Iron(III) Hydroxide',
        formula: 'FeH3O3',
        atoms: [
            { symbol: 'Fe', relX: 0, relY: 0 },
            { symbol: 'O', relX: 0, relY: -25 },
            { symbol: 'O', relX: -22, relY: 12 },
            { symbol: 'O', relX: 22, relY: 12 },
            { symbol: 'H', relX: 0, relY: -45 },
            { symbol: 'H', relX: -37, relY: 22 },
            { symbol: 'H', relX: 37, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 1, atom2: 4, order: 1 },
            { atom1: 2, atom2: 5, order: 1 },
            { atom1: 3, atom2: 6, order: 1 }
        ],
        description: 'Iron(III) hydroxide (ferric hydroxide) - Fe(OH)3'
    },
    'ClHO': {
        name: 'Hypochlorous Acid',
        formula: 'ClHO',
        atoms: [
            { symbol: 'Cl', relX: -18, relY: 0 },
            { symbol: 'O', relX: 10, relY: 0 },
            { symbol: 'H', relX: 28, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 }
        ],
        description: 'Hypochlorous acid - weak acid, disinfectant HOCl'
    },
    // H3O (Hydronium) removed - it's an ion (O has 3 bonds but valence is 2)
    'H2O2': {
        name: 'Hydrogen Peroxide',
        formula: 'H2O2',
        atoms: [
            { symbol: 'O', relX: -12, relY: 0 },
            { symbol: 'O', relX: 12, relY: 0 },
            { symbol: 'H', relX: -28, relY: 15 },
            { symbol: 'H', relX: 28, relY: -15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 1, atom2: 3, order: 1 }
        ],
        description: 'Hydrogen peroxide - oxidizer with O-O bond'
    },

    // ===== HYDROCARBONS - ALKANES (saturated) =====

    'C2H6': {
        name: 'Ethane',
        formula: 'C2H6',
        atoms: [
            { symbol: 'C', relX: -18, relY: 0 },        // C1
            { symbol: 'C', relX: 18, relY: 0 },         // C2
            { symbol: 'H', relX: -33, relY: -15 },
            { symbol: 'H', relX: -33, relY: 15 },
            { symbol: 'H', relX: -18, relY: -25 },
            { symbol: 'H', relX: 33, relY: -15 },
            { symbol: 'H', relX: 33, relY: 15 },
            { symbol: 'H', relX: 18, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 1, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 }
        ],
        description: 'Ethane - simplest alkane with C-C bond'
    },
    'C3H8': {
        name: 'Propane',
        formula: 'C3H8',
        atoms: [
            { symbol: 'C', relX: -30, relY: 0 },        // C1 (methyl)
            { symbol: 'C', relX: 0, relY: 0 },          // C2 (central)
            { symbol: 'C', relX: 30, relY: 0 },         // C3 (methyl)
            { symbol: 'H', relX: -45, relY: -15 },
            { symbol: 'H', relX: -45, relY: 15 },
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 0, relY: 22 },
            { symbol: 'H', relX: 45, relY: -15 },
            { symbol: 'H', relX: 45, relY: 15 },
            { symbol: 'H', relX: 30, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 }
        ],
        description: 'Propane - 3-carbon alkane'
    },
    'C4H10': {
        name: 'Butane',
        formula: 'C4H10',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },        // C1
            { symbol: 'C', relX: -15, relY: 0 },        // C2
            { symbol: 'C', relX: 15, relY: 0 },         // C3
            { symbol: 'C', relX: 45, relY: 0 },         // C4
            { symbol: 'H', relX: -60, relY: -15 },
            { symbol: 'H', relX: -60, relY: 15 },
            { symbol: 'H', relX: -45, relY: -22 },
            { symbol: 'H', relX: -15, relY: -22 },
            { symbol: 'H', relX: -15, relY: 22 },
            { symbol: 'H', relX: 15, relY: -22 },
            { symbol: 'H', relX: 15, relY: 22 },
            { symbol: 'H', relX: 60, relY: -15 },
            { symbol: 'H', relX: 60, relY: 15 },
            { symbol: 'H', relX: 45, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 }
        ],
        description: 'Butane - 4-carbon alkane'
    },
    'C5H12': {
        name: 'Pentane',
        formula: 'C5H12',
        atoms: [
            { symbol: 'C', relX: -60, relY: 0 },        // C1
            { symbol: 'C', relX: -30, relY: 0 },        // C2
            { symbol: 'C', relX: 0, relY: 0 },          // C3
            { symbol: 'C', relX: 30, relY: 0 },         // C4
            { symbol: 'C', relX: 60, relY: 0 },         // C5
            { symbol: 'H', relX: -75, relY: -15 },
            { symbol: 'H', relX: -75, relY: 15 },
            { symbol: 'H', relX: -60, relY: -22 },
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: -30, relY: 22 },
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 0, relY: 22 },
            { symbol: 'H', relX: 30, relY: -22 },
            { symbol: 'H', relX: 30, relY: 22 },
            { symbol: 'H', relX: 75, relY: -15 },
            { symbol: 'H', relX: 75, relY: 15 },
            { symbol: 'H', relX: 60, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 },
            { atom1: 4, atom2: 15, order: 1 },
            { atom1: 4, atom2: 16, order: 1 }
        ],
        description: 'Pentane - 5-carbon alkane'
    },
    'C6H14': {
        name: 'Hexane',
        formula: 'C6H14',
        atoms: [
            { symbol: 'C', relX: -75, relY: 0 },        // C1
            { symbol: 'C', relX: -45, relY: 0 },        // C2
            { symbol: 'C', relX: -15, relY: 0 },        // C3
            { symbol: 'C', relX: 15, relY: 0 },         // C4
            { symbol: 'C', relX: 45, relY: 0 },         // C5
            { symbol: 'C', relX: 75, relY: 0 },         // C6
            { symbol: 'H', relX: -90, relY: -15 },
            { symbol: 'H', relX: -90, relY: 15 },
            { symbol: 'H', relX: -75, relY: -22 },
            { symbol: 'H', relX: -45, relY: -22 },
            { symbol: 'H', relX: -45, relY: 22 },
            { symbol: 'H', relX: -15, relY: -22 },
            { symbol: 'H', relX: -15, relY: 22 },
            { symbol: 'H', relX: 15, relY: -22 },
            { symbol: 'H', relX: 15, relY: 22 },
            { symbol: 'H', relX: 45, relY: -22 },
            { symbol: 'H', relX: 45, relY: 22 },
            { symbol: 'H', relX: 90, relY: -15 },
            { symbol: 'H', relX: 90, relY: 15 },
            { symbol: 'H', relX: 75, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 0, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 1, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 2, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 },
            { atom1: 3, atom2: 14, order: 1 },
            { atom1: 4, atom2: 15, order: 1 },
            { atom1: 4, atom2: 16, order: 1 },
            { atom1: 5, atom2: 17, order: 1 },
            { atom1: 5, atom2: 18, order: 1 },
            { atom1: 5, atom2: 19, order: 1 }
        ],
        description: 'Hexane - 6-carbon alkane'
    },

    // ===== HYDROCARBONS - ALKENES (unsaturated with C=C) =====

    'C3H6': {
        name: 'Propene',
        formula: 'C3H6',
        atoms: [
            { symbol: 'C', relX: -30, relY: 0 },        // C1 (CH3)
            { symbol: 'C', relX: 0, relY: 0 },          // C2 (=CH)
            { symbol: 'C', relX: 30, relY: 0 },         // C3 (=CH2)
            { symbol: 'H', relX: -45, relY: -15 },
            { symbol: 'H', relX: -45, relY: 15 },
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: 0, relY: 22 },
            { symbol: 'H', relX: 45, relY: -15 },
            { symbol: 'H', relX: 45, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 2 },           // C=C double bond
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 2, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 }
        ],
        description: 'Propene - 3-carbon alkene (propylene)'
    },
    'C4H8': {
        name: 'Butene',
        formula: 'C4H8',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },        // C1 (CH3)
            { symbol: 'C', relX: -15, relY: 0 },        // C2
            { symbol: 'C', relX: 15, relY: 0 },         // C3
            { symbol: 'C', relX: 45, relY: 0 },         // C4 (=CH2)
            { symbol: 'H', relX: -60, relY: -15 },
            { symbol: 'H', relX: -60, relY: 15 },
            { symbol: 'H', relX: -45, relY: -22 },
            { symbol: 'H', relX: -15, relY: -22 },
            { symbol: 'H', relX: -15, relY: 22 },
            { symbol: 'H', relX: 15, relY: 22 },
            { symbol: 'H', relX: 60, relY: -15 },
            { symbol: 'H', relX: 60, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 2 },           // C=C double bond
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 3, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 }
        ],
        description: 'Butene - 4-carbon alkene (1-butene)'
    },
    'C5H10': {
        name: 'Pentene',
        formula: 'C5H10',
        atoms: [
            { symbol: 'C', relX: -60, relY: 0 },        // C1
            { symbol: 'C', relX: -30, relY: 0 },        // C2
            { symbol: 'C', relX: 0, relY: 0 },          // C3
            { symbol: 'C', relX: 30, relY: 0 },         // C4
            { symbol: 'C', relX: 60, relY: 0 },         // C5 (=CH2)
            { symbol: 'H', relX: -75, relY: -15 },
            { symbol: 'H', relX: -75, relY: 15 },
            { symbol: 'H', relX: -60, relY: -22 },
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: -30, relY: 22 },
            { symbol: 'H', relX: 0, relY: -22 },
            { symbol: 'H', relX: 0, relY: 22 },
            { symbol: 'H', relX: 30, relY: 22 },
            { symbol: 'H', relX: 75, relY: -15 },
            { symbol: 'H', relX: 75, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 2 },           // C=C double bond
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 4, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 }
        ],
        description: 'Pentene - 5-carbon alkene (1-pentene)'
    },

    // ===== HYDROCARBONS - ALKYNES (triple bond) =====

    'C2H2': {
        name: 'Acetylene',
        formula: 'C2H2',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'C', relX: 15, relY: 0 },
            { symbol: 'H', relX: -35, relY: 0 },
            { symbol: 'H', relX: 35, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 3 },           // C≡C triple bond
            { atom1: 0, atom2: 2, order: 1 },
            { atom1: 1, atom2: 3, order: 1 }
        ],
        description: 'Acetylene - simplest alkyne with C≡C triple bond'
    },
    'C3H4': {
        name: 'Propyne',
        formula: 'C3H4',
        atoms: [
            { symbol: 'C', relX: -30, relY: 0 },        // CH3
            { symbol: 'C', relX: 0, relY: 0 },          // C (triple)
            { symbol: 'C', relX: 30, relY: 0 },         // CH
            { symbol: 'H', relX: -45, relY: -15 },
            { symbol: 'H', relX: -45, relY: 15 },
            { symbol: 'H', relX: -30, relY: -22 },
            { symbol: 'H', relX: 50, relY: 0 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 3 },           // C≡C triple bond
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 2, atom2: 6, order: 1 }
        ],
        description: 'Propyne - 3-carbon alkyne (methylacetylene)'
    },
    'C4H6': {
        name: 'Butyne',
        formula: 'C4H6',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },        // CH3
            { symbol: 'C', relX: -15, relY: 0 },        // C (triple)
            { symbol: 'C', relX: 15, relY: 0 },         // C (triple)
            { symbol: 'C', relX: 45, relY: 0 },         // CH3
            { symbol: 'H', relX: -60, relY: -15 },
            { symbol: 'H', relX: -60, relY: 15 },
            { symbol: 'H', relX: -45, relY: -22 },
            { symbol: 'H', relX: 60, relY: -15 },
            { symbol: 'H', relX: 60, relY: 15 },
            { symbol: 'H', relX: 45, relY: 22 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 3 },           // C≡C triple bond
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 3, atom2: 7, order: 1 },
            { atom1: 3, atom2: 8, order: 1 },
            { atom1: 3, atom2: 9, order: 1 }
        ],
        description: 'Butyne - 4-carbon alkyne (2-butyne)'
    },

    // ===== HYDROCARBONS - AROMATICS =====

    'C6H6': {
        name: 'Benzene',
        formula: 'C6H6',
        atoms: [
            // Hexagonal ring of carbons (60° apart)
            { symbol: 'C', relX: 0, relY: -30 },        // Top
            { symbol: 'C', relX: 26, relY: -15 },       // Top-right
            { symbol: 'C', relX: 26, relY: 15 },        // Bottom-right
            { symbol: 'C', relX: 0, relY: 30 },         // Bottom
            { symbol: 'C', relX: -26, relY: 15 },       // Bottom-left
            { symbol: 'C', relX: -26, relY: -15 },      // Top-left
            // Hydrogens pointing outward
            { symbol: 'H', relX: 0, relY: -50 },
            { symbol: 'H', relX: 43, relY: -25 },
            { symbol: 'H', relX: 43, relY: 25 },
            { symbol: 'H', relX: 0, relY: 50 },
            { symbol: 'H', relX: -43, relY: 25 },
            { symbol: 'H', relX: -43, relY: -25 }
        ],
        bonds: [
            // Alternating double bonds (Kekulé structure)
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 2 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 2 },
            { atom1: 5, atom2: 0, order: 1 },
            // C-H bonds
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 3, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 }
        ],
        description: 'Benzene - aromatic ring with delocalized electrons'
    },
    'C7H8': {
        name: 'Toluene',
        formula: 'C7H8',
        atoms: [
            // Benzene ring
            { symbol: 'C', relX: 0, relY: -30 },
            { symbol: 'C', relX: 26, relY: -15 },
            { symbol: 'C', relX: 26, relY: 15 },
            { symbol: 'C', relX: 0, relY: 30 },
            { symbol: 'C', relX: -26, relY: 15 },
            { symbol: 'C', relX: -26, relY: -15 },
            // Methyl group on top carbon
            { symbol: 'C', relX: 0, relY: -55 },
            // Ring hydrogens (5, top has CH3)
            { symbol: 'H', relX: 43, relY: -25 },
            { symbol: 'H', relX: 43, relY: 25 },
            { symbol: 'H', relX: 0, relY: 50 },
            { symbol: 'H', relX: -43, relY: 25 },
            { symbol: 'H', relX: -43, relY: -25 },
            // Methyl hydrogens
            { symbol: 'H', relX: -15, relY: -65 },
            { symbol: 'H', relX: 15, relY: -65 },
            { symbol: 'H', relX: 0, relY: -75 }
        ],
        bonds: [
            // Aromatic ring
            { atom1: 0, atom2: 1, order: 2 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 2 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 2 },
            { atom1: 5, atom2: 0, order: 1 },
            // C-CH3
            { atom1: 0, atom2: 6, order: 1 },
            // C-H on ring
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 3, atom2: 9, order: 1 },
            { atom1: 4, atom2: 10, order: 1 },
            { atom1: 5, atom2: 11, order: 1 },
            // CH3 hydrogens
            { atom1: 6, atom2: 12, order: 1 },
            { atom1: 6, atom2: 13, order: 1 },
            { atom1: 6, atom2: 14, order: 1 }
        ],
        description: 'Toluene - methylbenzene aromatic compound'
    },

    // ===== HYDROCARBONS - CYCLIC =====

    'C3H6cyc': {
        name: 'Cyclopropane',
        formula: 'C3H6',
        atoms: [
            // Triangular ring
            { symbol: 'C', relX: 0, relY: -20 },
            { symbol: 'C', relX: 17, relY: 10 },
            { symbol: 'C', relX: -17, relY: 10 },
            // Hydrogens
            { symbol: 'H', relX: -12, relY: -35 },
            { symbol: 'H', relX: 12, relY: -35 },
            { symbol: 'H', relX: 32, relY: 0 },
            { symbol: 'H', relX: 27, relY: 25 },
            { symbol: 'H', relX: -32, relY: 0 },
            { symbol: 'H', relX: -27, relY: 25 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 0, order: 1 },
            { atom1: 0, atom2: 3, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 1, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 2, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 }
        ],
        description: 'Cyclopropane - 3-membered carbon ring'
    },
    'C4H8cyc': {
        name: 'Cyclobutane',
        formula: 'C4H8',
        atoms: [
            // Square ring
            { symbol: 'C', relX: -15, relY: -15 },
            { symbol: 'C', relX: 15, relY: -15 },
            { symbol: 'C', relX: 15, relY: 15 },
            { symbol: 'C', relX: -15, relY: 15 },
            // Hydrogens
            { symbol: 'H', relX: -30, relY: -25 },
            { symbol: 'H', relX: -15, relY: -35 },
            { symbol: 'H', relX: 30, relY: -25 },
            { symbol: 'H', relX: 15, relY: -35 },
            { symbol: 'H', relX: 30, relY: 25 },
            { symbol: 'H', relX: 15, relY: 35 },
            { symbol: 'H', relX: -30, relY: 25 },
            { symbol: 'H', relX: -15, relY: 35 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 0, order: 1 },
            { atom1: 0, atom2: 4, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 1, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 2, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 3, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 }
        ],
        description: 'Cyclobutane - 4-membered carbon ring'
    },
    'C5H10cyc': {
        name: 'Cyclopentane',
        formula: 'C5H10',
        atoms: [
            // Pentagon ring
            { symbol: 'C', relX: 0, relY: -25 },
            { symbol: 'C', relX: 24, relY: -8 },
            { symbol: 'C', relX: 15, relY: 20 },
            { symbol: 'C', relX: -15, relY: 20 },
            { symbol: 'C', relX: -24, relY: -8 },
            // Hydrogens
            { symbol: 'H', relX: -12, relY: -40 },
            { symbol: 'H', relX: 12, relY: -40 },
            { symbol: 'H', relX: 40, relY: -18 },
            { symbol: 'H', relX: 35, relY: 5 },
            { symbol: 'H', relX: 25, relY: 35 },
            { symbol: 'H', relX: 5, relY: 35 },
            { symbol: 'H', relX: -25, relY: 35 },
            { symbol: 'H', relX: -5, relY: 35 },
            { symbol: 'H', relX: -40, relY: -18 },
            { symbol: 'H', relX: -35, relY: 5 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 0, order: 1 },
            { atom1: 0, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 1, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 2, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 3, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 4, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 }
        ],
        description: 'Cyclopentane - 5-membered carbon ring'
    },
    'C6H12': {
        name: 'Cyclohexane',
        formula: 'C6H12',
        atoms: [
            // Hexagonal ring
            { symbol: 'C', relX: 0, relY: -28 },
            { symbol: 'C', relX: 24, relY: -14 },
            { symbol: 'C', relX: 24, relY: 14 },
            { symbol: 'C', relX: 0, relY: 28 },
            { symbol: 'C', relX: -24, relY: 14 },
            { symbol: 'C', relX: -24, relY: -14 },
            // Hydrogens (2 per carbon)
            { symbol: 'H', relX: -12, relY: -43 },
            { symbol: 'H', relX: 12, relY: -43 },
            { symbol: 'H', relX: 40, relY: -24 },
            { symbol: 'H', relX: 38, relY: -4 },
            { symbol: 'H', relX: 40, relY: 24 },
            { symbol: 'H', relX: 38, relY: 4 },
            { symbol: 'H', relX: -12, relY: 43 },
            { symbol: 'H', relX: 12, relY: 43 },
            { symbol: 'H', relX: -40, relY: 24 },
            { symbol: 'H', relX: -38, relY: 4 },
            { symbol: 'H', relX: -40, relY: -24 },
            { symbol: 'H', relX: -38, relY: -4 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 1 },
            { atom1: 4, atom2: 5, order: 1 },
            { atom1: 5, atom2: 0, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 1, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 2, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 3, atom2: 12, order: 1 },
            { atom1: 3, atom2: 13, order: 1 },
            { atom1: 4, atom2: 14, order: 1 },
            { atom1: 4, atom2: 15, order: 1 },
            { atom1: 5, atom2: 16, order: 1 },
            { atom1: 5, atom2: 17, order: 1 }
        ],
        description: 'Cyclohexane - 6-membered carbon ring (chair conformation)'
    },

    // ===== MONOMER MOLECULES (for polymer formation) =====

    'C2H4': {
        name: 'Ethylene',
        formula: 'C2H4',
        isMonomer: true,
        polymerName: 'Polyethylene',
        atoms: [
            { symbol: 'C', relX: -15, relY: 0 },
            { symbol: 'C', relX: 15, relY: 0 },
            { symbol: 'H', relX: -30, relY: -15 },
            { symbol: 'H', relX: -30, relY: 15 },
            { symbol: 'H', relX: 30, relY: -15 },
            { symbol: 'H', relX: 30, relY: 15 }
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 2 },  // C=C double bond
            { atom1: 0, atom2: 2, order: 1 },  // C-H
            { atom1: 0, atom2: 3, order: 1 },  // C-H
            { atom1: 1, atom2: 4, order: 1 },  // C-H
            { atom1: 1, atom2: 5, order: 1 }   // C-H
        ],
        description: 'Ethylene - simplest alkene with C=C double bond'
    },
    'C2H5NO2': {
        name: 'Glycine',
        formula: 'C2H5NO2',
        isMonomer: true,
        polymerName: 'Protein',
        atoms: [
            { symbol: 'N', relX: -30, relY: 0 },    // Amino nitrogen
            { symbol: 'C', relX: 0, relY: 0 },      // Alpha carbon
            { symbol: 'C', relX: 30, relY: 0 },     // Carboxyl carbon
            { symbol: 'O', relX: 45, relY: -15 },   // Carboxyl O (double bond)
            { symbol: 'O', relX: 45, relY: 15 },    // Carboxyl OH
            { symbol: 'H', relX: -45, relY: -10 },  // NH2 hydrogen
            { symbol: 'H', relX: -45, relY: 10 },   // NH2 hydrogen
            { symbol: 'H', relX: 0, relY: -20 },    // CH2 hydrogen
            { symbol: 'H', relX: 0, relY: 20 },     // CH2 hydrogen
            { symbol: 'H', relX: 60, relY: 20 }     // OH hydrogen
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },  // N-C
            { atom1: 1, atom2: 2, order: 1 },  // C-C
            { atom1: 2, atom2: 3, order: 2 },  // C=O
            { atom1: 2, atom2: 4, order: 1 },  // C-O
            { atom1: 0, atom2: 5, order: 1 },  // N-H
            { atom1: 0, atom2: 6, order: 1 },  // N-H
            { atom1: 1, atom2: 7, order: 1 },  // C-H
            { atom1: 1, atom2: 8, order: 1 },  // C-H
            { atom1: 4, atom2: 9, order: 1 }   // O-H
        ],
        description: 'Glycine - simplest amino acid (H2N-CH2-COOH)'
    },
    'C4H8O2': {
        name: 'Butyric Acid (Fatty Acid)',
        formula: 'C4H8O2',
        isMonomer: true,
        polymerName: 'Lipid Chain',
        atoms: [
            { symbol: 'C', relX: -45, relY: 0 },   // Methyl C
            { symbol: 'C', relX: -15, relY: 0 },   // CH2
            { symbol: 'C', relX: 15, relY: 0 },    // CH2
            { symbol: 'C', relX: 45, relY: 0 },    // Carboxyl C
            { symbol: 'O', relX: 60, relY: -15 },  // C=O
            { symbol: 'O', relX: 60, relY: 15 },   // C-OH
            { symbol: 'H', relX: -55, relY: -12 },
            { symbol: 'H', relX: -55, relY: 12 },
            { symbol: 'H', relX: -55, relY: 0 },   // CH3 H
            { symbol: 'H', relX: -15, relY: -15 },
            { symbol: 'H', relX: -15, relY: 15 },
            { symbol: 'H', relX: 15, relY: -15 },
            { symbol: 'H', relX: 15, relY: 15 },
            { symbol: 'H', relX: 75, relY: 20 }    // OH hydrogen
        ],
        bonds: [
            { atom1: 0, atom2: 1, order: 1 },
            { atom1: 1, atom2: 2, order: 1 },
            { atom1: 2, atom2: 3, order: 1 },
            { atom1: 3, atom2: 4, order: 2 },
            { atom1: 3, atom2: 5, order: 1 },
            { atom1: 0, atom2: 6, order: 1 },
            { atom1: 0, atom2: 7, order: 1 },
            { atom1: 0, atom2: 8, order: 1 },
            { atom1: 1, atom2: 9, order: 1 },
            { atom1: 1, atom2: 10, order: 1 },
            { atom1: 2, atom2: 11, order: 1 },
            { atom1: 2, atom2: 12, order: 1 },
            { atom1: 5, atom2: 13, order: 1 }
        ],
        description: 'Butyric acid - short chain fatty acid (CH3-CH2-CH2-COOH)'
    }
};

/**
 * Get a stable molecule template by formula
 * @param {string} formula - Molecular formula (e.g., 'H2O', 'CO2')
 * @returns {Object|null} Template object or null if not found
 */
function getStableMoleculeTemplate(formula) {
    return STABLE_MOLECULES[formula] || null;
}

/**
 * Check if a molecule's atoms match a known stable template
 * Returns the template if matched, null otherwise
 * @param {Molecule} molecule - The molecule to check
 * @returns {Object|null} Matching template or null
 */
function matchesStableTemplate(molecule) {
    if (!molecule || !molecule.formula) return null;

    const template = STABLE_MOLECULES[molecule.formula];
    if (!template) return null;

    // Verify atom counts match
    const moleculeAtomCounts = {};
    for (const atom of molecule.atoms) {
        moleculeAtomCounts[atom.symbol] = (moleculeAtomCounts[atom.symbol] || 0) + 1;
    }

    const templateAtomCounts = {};
    for (const atomData of template.atoms) {
        templateAtomCounts[atomData.symbol] = (templateAtomCounts[atomData.symbol] || 0) + 1;
    }

    // Check if counts match
    const moleculeSymbols = Object.keys(moleculeAtomCounts).sort();
    const templateSymbols = Object.keys(templateAtomCounts).sort();

    if (moleculeSymbols.length !== templateSymbols.length) return null;

    for (let i = 0; i < moleculeSymbols.length; i++) {
        if (moleculeSymbols[i] !== templateSymbols[i]) return null;
        if (moleculeAtomCounts[moleculeSymbols[i]] !== templateAtomCounts[templateSymbols[i]]) return null;
    }

    return template;
}

/**
 * Calculate the target positions for a molecule's atoms based on a template
 * This maps the molecule's atoms to the template atoms by element type
 * @param {Molecule} molecule - The molecule to reshape
 * @param {Object} template - The stable template
 * @returns {Object} Object with targetPositions (Map<Atom, Vector2>) and atomToTemplateIndex (Map<Atom, number>)
 */
function getTargetConfiguration(molecule, template) {
    const center = molecule.centerOfMass;
    const targetPositions = new Map();
    const atomToTemplateIndex = new Map();  // Track which template index each atom maps to

    // Group molecule atoms by symbol
    const atomsBySymbol = {};
    for (const atom of molecule.atoms) {
        if (!atomsBySymbol[atom.symbol]) {
            atomsBySymbol[atom.symbol] = [];
        }
        atomsBySymbol[atom.symbol].push(atom);
    }

    // Group template atoms by symbol
    const templateAtomsBySymbol = {};
    for (let i = 0; i < template.atoms.length; i++) {
        const atomData = template.atoms[i];
        if (!templateAtomsBySymbol[atomData.symbol]) {
            templateAtomsBySymbol[atomData.symbol] = [];
        }
        templateAtomsBySymbol[atomData.symbol].push({
            ...atomData,
            index: i
        });
    }

    // Match atoms to template positions
    // For each symbol, assign molecule atoms to template positions
    // Use a simple greedy assignment based on current proximity
    for (const symbol of Object.keys(atomsBySymbol)) {
        const atoms = atomsBySymbol[symbol];
        const templatePositions = templateAtomsBySymbol[symbol];

        if (!templatePositions || atoms.length !== templatePositions.length) {
            continue;
        }

        // For each atom, find the closest available template position
        const usedTemplateIndices = new Set();

        for (const atom of atoms) {
            let bestIndex = -1;
            let bestDistance = Infinity;

            for (let i = 0; i < templatePositions.length; i++) {
                if (usedTemplateIndices.has(i)) continue;

                const tPos = templatePositions[i];
                const targetX = center.x + tPos.relX;
                const targetY = center.y + tPos.relY;
                const dist = atom.position.distanceTo(new Vector2(targetX, targetY));

                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestIndex = i;
                }
            }

            if (bestIndex !== -1) {
                usedTemplateIndices.add(bestIndex);
                const tPos = templatePositions[bestIndex];
                targetPositions.set(atom, new Vector2(
                    center.x + tPos.relX,
                    center.y + tPos.relY
                ));
                // Store the original template index for this atom
                atomToTemplateIndex.set(atom, tPos.index);
            }
        }
    }

    return { targetPositions, atomToTemplateIndex };
}

/**
 * Get the target bond configuration for a template
 * Returns an array of { atom1Index, atom2Index, order } objects
 * @param {Object} template - The stable template
 * @returns {Array} Bond configuration array
 */
function getTemplateBonds(template) {
    return template.bonds || [];
}

/**
 * Check if a molecule needs reshaping (has wrong geometry or bond orders)
 * @param {Molecule} molecule - The molecule to check
 * @param {Object} template - The stable template
 * @returns {boolean} True if reshaping is needed
 */
function needsReshaping(molecule, template) {
    if (!molecule || !template) return false;

    // Check if bond orders match template
    const templateBonds = template.bonds;
    const moleculeBonds = molecule.bonds;

    // If bond count doesn't match, definitely needs reshaping
    if (moleculeBonds.length !== templateBonds.length) {
        return true;
    }

    // Check bond orders
    for (const bond of moleculeBonds) {
        // Find matching template bond (by atom symbols)
        const symbols = [bond.atom1.symbol, bond.atom2.symbol].sort();
        let foundMatch = false;

        for (const tBond of templateBonds) {
            const tSymbols = [
                template.atoms[tBond.atom1].symbol,
                template.atoms[tBond.atom2].symbol
            ].sort();

            if (symbols[0] === tSymbols[0] && symbols[1] === tSymbols[1]) {
                if (bond.order !== tBond.order) {
                    return true; // Bond order mismatch
                }
                foundMatch = true;
                break;
            }
        }

        if (!foundMatch) {
            return true; // Bond not found in template
        }
    }

    // Check if atom positions are significantly different from template
    const config = getTargetConfiguration(molecule, template);
    const targetPositions = config.targetPositions;
    const threshold = 15; // Pixels - if any atom is more than this far from target

    for (const [atom, targetPos] of targetPositions) {
        const dist = atom.position.distanceTo(targetPos);
        if (dist > threshold) {
            return true;
        }
    }

    return false;
}

// Make available globally
window.STABLE_MOLECULES = STABLE_MOLECULES;
window.getStableMoleculeTemplate = getStableMoleculeTemplate;
window.matchesStableTemplate = matchesStableTemplate;
window.getTargetConfiguration = getTargetConfiguration;
window.getTemplateBonds = getTemplateBonds;
window.needsReshaping = needsReshaping;
