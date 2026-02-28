/**
 * Intention Entity
 * Represents a blueprint intention zone that attracts required components
 * to form molecules, polymers, or cells organically
 */

class Intention {
    /**
     * Create a new intention zone
     * @param {string} type - 'molecule', 'polymer', or 'cell'
     * @param {Object} blueprint - The blueprint to fulfill
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    constructor(type, blueprint, x, y) {
        this.id = Utils.generateId();
        this.type = type;
        this.blueprint = blueprint;
        this.position = new Vector2(x, y);

        // Attraction properties
        this.radius = this._getRadiusByType();
        this.attractionForce = 3.0; // Strong attraction force
        // Calibrated against environment.js physics constants:
        //   attractionStrength = 20 (per bonded pair within attractionRadius=80)
        //   bounceForce = 100 (boundary wall reference force)
        // repulsionForce must exceed attractionStrength per neighbour pair so atoms
        // cannot be held inside zones by inter-particle bonding. Floor (200×0.5=100)
        // equals bounceForce, ensuring boundary expulsion even with multiple neighbours.
        // If attractionStrength or bounceForce change in environment.js, recalibrate.
        this.repulsionForce = 200.0;

        // Progress tracking
        this.progress = 0;
        // TODO: gatheredComponents is only populated for type='polymer'/'cell'.
        // For type='molecule', use getGatheredCount() which reads from this.progress instead.
        this.gatheredComponents = new Set();
        this.fulfilled = false;
        this.createdEntity = null;

        // Timing
        this.age = 0;
        this.maxAge = 10000; // Timeout after 10000 ticks if not fulfilled
        this.createdAt = Date.now(); // Timestamp for when intention was created

        // Exclusion list: molecules that existed before this intention was placed
        // These should be ignored when checking for completion
        this.excludedMoleculeIds = new Set();
        this.exclusionInitialized = false;

        // Seed molecule tracking (molecule intents only)
        // The seed molecule is the partially-formed target molecule being assembled
        this.seedMoleculeId = null;

        // Visual state
        this.pulsePhase = 0;
        this.selected = false;
    }

    /**
     * Initialize the exclusion list with currently existing molecules
     * Call this once after adding the intention to the environment
     * @param {Environment} environment - The environment to scan
     */
    initializeExclusions(environment) {
        if (this.exclusionInitialized) return;

        // Record all existing molecules that would match our requirements
        if (this.type === 'molecule') {
            const requirements = this.getRequirements();
            if (requirements && requirements.type === 'atoms' && requirements.count) {
                for (const mol of environment.molecules.values()) {
                    // Exclude all molecules that match our atom count requirement
                    if (mol.atoms.length === requirements.count) {
                        this.excludedMoleculeIds.add(mol.id);
                    }
                }
            }
        }

        this.exclusionInitialized = true;
        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`Intention ${this.id.substring(0, 8)} initialized with ${this.excludedMoleculeIds.size} excluded molecules`);
        }
    }

    /**
     * Get appropriate radius based on intention type
     * This is the attraction range - entities within this distance will be pulled
     */
    _getRadiusByType() {
        switch (this.type) {
            case 'molecule': return 300;  // Large range to attract atoms
            case 'polymer': return 400;   // Even larger for molecules
            case 'cell': return 500;      // Largest for polymers
            default: return 300;
        }
    }

    /**
     * Get the target element composition for molecule intentions
     * @returns {Object} - Map of element symbol to count, e.g., { C: 2, H: 4 }
     */
    getTargetComposition() {
        if (this.type !== 'molecule') return null;

        const composition = {};

        if (this.blueprint.atomData) {
            for (const atom of this.blueprint.atomData) {
                composition[atom.symbol] = (composition[atom.symbol] || 0) + 1;
            }
        }

        return composition;
    }

    /**
     * Get the number of gathered components for display.
     * For molecule intents, gatheredComponents is never populated — use progress instead.
     * For polymer/cell intents, gatheredComponents is maintained by _attractComponents.
     * @returns {number}
     */
    getGatheredCount() {
        if (this.type === 'molecule') {
            const requirements = this.getRequirements();
            const reqCount = requirements?.count || 0;
            return Math.round(this.progress * reqCount);
        }
        return this.gatheredComponents.size;
    }

    /**
     * Get the element composition for polymer intentions (from monomer template)
     * @returns {Set} - Set of element symbols needed for the monomer
     */
    getMonomerElements() {
        if (this.type !== 'polymer') return null;

        const requirements = this.getRequirements();
        const elements = new Set();

        // Get elements from monomer template's atomLayout
        if (requirements.monomerTemplate && requirements.monomerTemplate.atomLayout) {
            for (const atom of requirements.monomerTemplate.atomLayout) {
                elements.add(atom.symbol);
            }
        }

        // Fallback to requiredElements if no atomLayout
        if (elements.size === 0 && requirements.requiredElements) {
            for (const el of requirements.requiredElements) {
                elements.add(el);
            }
        }

        return elements;
    }

    /**
     * Calculate what changes a molecule needs to become the target molecule
     * @param {Molecule} molecule - The molecule to compare
     * @returns {Object} - { needed: { H: 2 }, excess: { O: 1 }, isMatch: false }
     */
    getCompositionDelta(molecule) {
        if (this.type !== 'molecule') return null;

        const target = this.getTargetComposition();
        if (!target) return null;

        // Get current molecule composition
        const current = {};
        for (const atom of molecule.atoms) {
            current[atom.symbol] = (current[atom.symbol] || 0) + 1;
        }

        const needed = {};  // Atoms we need to add
        const excess = {};  // Atoms we need to remove

        // Check what's needed (in target but not enough in current)
        for (const [symbol, count] of Object.entries(target)) {
            const have = current[symbol] || 0;
            if (have < count) {
                needed[symbol] = count - have;
            }
        }

        // Check what's in excess (in current but not needed or too many)
        for (const [symbol, count] of Object.entries(current)) {
            const want = target[symbol] || 0;
            if (count > want) {
                excess[symbol] = count - want;
            }
        }

        const isMatch = Object.keys(needed).length === 0 && Object.keys(excess).length === 0;

        return { needed, excess, isMatch };
    }

    /**
     * Get required components based on blueprint
     */
    getRequirements() {
        if (this.type === 'molecule') {
            // For molecules, we need specific atoms
            // Extract elements from atomData if available
            let elements = this.blueprint.requiredElements;
            if (!elements && this.blueprint.atomData) {
                const elementSet = new Set();
                for (const atom of this.blueprint.atomData) {
                    elementSet.add(atom.symbol);
                }
                elements = Array.from(elementSet);
            }
            return {
                type: 'atoms',
                elements: elements || ['C'],
                count: this.blueprint.atomData?.length || 4
            };
        } else if (this.type === 'polymer') {
            // For polymers, we need specific MONOMERS (identical molecules that chain)
            // NEW: Use monomer template system
            const monomerTemplate = this.blueprint.monomerTemplate || null;
            const monomerId = this.blueprint.monomerId || null;

            // Resolve monomer template if we have an ID but no template yet
            let resolvedTemplate = monomerTemplate;
            if (!resolvedTemplate && monomerId && typeof getMonomerTemplate === 'function') {
                resolvedTemplate = getMonomerTemplate(monomerId);
            }

            return {
                type: 'monomers',
                count: this.blueprint.minMonomers || this.blueprint.minMolecules || 3,
                monomerId: monomerId,
                monomerTemplate: resolvedTemplate,
                monomerFormula: resolvedTemplate?.formula || null,
                monomerName: resolvedTemplate?.name || this.blueprint.name || 'Unknown',
                requiredElements: this.blueprint.requiredElements || resolvedTemplate?.requiredElements || []
            };
        } else if (this.type === 'cell') {
            // For cells, we need specific polymers with chain length requirements
            const blueprint = this.blueprint;

            // If no detailed requirements, fall back to basic roles
            if (!blueprint?.requirements) {
                return {
                    type: 'polymers',
                    roles: ['membrane', 'nucleoid']
                };
            }

            // Map requirements to detailed format for inspector display
            const polymerReqs = [];
            for (const [role, req] of Object.entries(blueprint.requirements)) {
                // Look up polymer and monomer templates
                const polymerTemplate = typeof CELL_ESSENTIAL_POLYMERS !== 'undefined'
                    ? CELL_ESSENTIAL_POLYMERS[req.polymerId] : null;
                let monomerTemplate = null;
                if (polymerTemplate?.monomerId && typeof getMonomerTemplate === 'function') {
                    monomerTemplate = getMonomerTemplate(polymerTemplate.monomerId);
                }

                polymerReqs.push({
                    role,
                    polymerId: req.polymerId,
                    polymerName: polymerTemplate?.name || req.polymerId,
                    polymerType: polymerTemplate?.type || 'generic',
                    minChainLength: req.minChainLength || 2,
                    count: req.count || 1,
                    description: req.description || '',
                    monomerId: polymerTemplate?.monomerId || null,
                    monomerTemplate: monomerTemplate,
                    monomerFormula: monomerTemplate?.formula || null
                });
            }

            return {
                type: 'polymers_detailed',
                cellName: blueprint.name || 'Cell',
                species: blueprint.species || null,
                color: blueprint.color || '#8b5cf6',
                polymerRequirements: polymerReqs,
                totalPolymers: polymerReqs.reduce((sum, r) => sum + r.count, 0)
            };
        }
        return null;
    }

    /**
     * Update intention state
     * @param {Environment} environment - The environment
     * @param {number} dt - Delta time
     */
    update(environment, _dt) {
        this.age++;
        this.pulsePhase += 0.05;

        // NOTE: No timeout - intentions persist until fulfilled or manually deleted
        // (Bug #6 fix from AGENTS.md)

        if (this.type === 'molecule') {
            // Rule-based system for molecule intents
            // Each rule executes in order, sharing a cached state object
            this._validateSeed(environment);
            const state = this._buildState(environment);
            this._rule1_repelIrrelevantAtoms(environment, state);
            this._rule2_repelIrrelevantMolecules(environment, state);
            this._rule3_claimFreeAtoms(environment, state);
            this._rule4_extractFromMolecules(environment, state);
            this._rule5_attractClaimed(environment, state);
            this._rule6_bondClaimed(environment, state);
            this._rule7_checkCompletion(environment, state);
            this._updateProgress(state);
        } else {
            // Polymer/cell intents use existing logic (unchanged)
            this._attractComponents(environment);
            this._checkCompletion(environment);
        }
    }

    // =====================================================
    // MOLECULE INTENT: Rule-Based Assembly System
    // =====================================================

    /**
     * Build shared state object for this tick.
     * Performs a SINGLE spatial query (cached) rather than 6 separate ones,
     * giving ~6x performance improvement per intent per tick.
     */
    _buildState(environment) {
        const nearbyAtoms = environment.getAtomsNear(
            this.position.x, this.position.y, this.radius * 1.2
        );
        const targetComp = this.getTargetComposition() || {};
        const targetFormula = this.blueprint ? this.blueprint.formula : null;
        const totalNeeded = Object.values(targetComp).reduce((s, n) => s + n, 0);

        // Get seed molecule if it exists
        const seedMol = this.seedMoleculeId
            ? environment.seedMolecules.get(this.seedMoleculeId)
            : null;
        const seedAtomIds = new Set(seedMol ? seedMol.atoms.map(a => a.id) : []);

        // Separate nearby atoms into categories for rule consumption
        const claimed = []; // Atoms claimed by THIS intent
        const free = [];    // Unclaimed, unbonded atoms

        for (const atom of nearbyAtoms) {
            if (seedAtomIds.has(atom.id)) continue; // Seed atoms handled by seed mol
            if (atom.claimedByIntentId === this.id) {
                claimed.push(atom);
            } else if (!atom.claimedByIntentId && !atom.moleculeId) {
                free.push(atom);
            }
        }

        return {
            nearbyAtoms,
            targetComp,
            targetFormula,
            totalNeeded,
            seedMol,
            seedAtomIds,
            // Snapshot of atoms claimed in PRIOR ticks only (read-only for all rules).
            // Rules 1–2 (expulsion) use this to identify surplus; Rules 3–5 mutate
            // atom.claimedByIntentId directly. If _buildState() is ever refactored
            // to rebuild state mid-pipeline, update the surplus check in
            // _rule2_repelIrrelevantMolecules() to re-read live atom state instead.
            claimed,
            free,
            extractedThisTick: false // Rule 4 sets this to prevent multiple extractions
        };
    }

    /**
     * Validate the seed molecule still exists and its atoms are live.
     * Called at start of each tick to handle external deletions gracefully.
     */
    _validateSeed(environment) {
        if (!this.seedMoleculeId) return;

        const seedMol = environment.seedMolecules.get(this.seedMoleculeId);
        if (!seedMol) {
            // Seed was deleted externally - clear claims and reset
            this._clearAllClaims(environment);
            this.seedMoleculeId = null;
            return;
        }

        // Remove atoms that no longer exist in the environment
        seedMol.atoms = seedMol.atoms.filter(a => environment.atoms.has(a.id));

        if (seedMol.atoms.length === 0) {
            // Seed is empty - full reset
            this._resetSeed(environment);
        }
    }

    /**
     * Get all atoms currently claimed by this intention that still exist.
     * Safe to call even if claimed atoms were deleted since last tick.
     */
    _getClaimedAtoms(environment) {
        const claimed = [];
        for (const atom of environment.atoms.values()) {
            if (atom.claimedByIntentId === this.id) {
                claimed.push(atom);
            }
        }
        return claimed;
    }

    /**
     * Release all atom claims belonging to this intention.
     */
    _clearAllClaims(environment) {
        for (const atom of environment.atoms.values()) {
            if (atom.claimedByIntentId === this.id) {
                atom.claimedByIntentId = null;
            }
        }
    }

    /**
     * Fully reset the seed molecule: break bonds, release atoms, remove from environment.
     * Called when seed is destroyed or intent is being cleaned up.
     */
    _resetSeed(environment) {
        if (this.seedMoleculeId) {
            const seedMol = environment.seedMolecules.get(this.seedMoleculeId);
            if (seedMol) {
                // Break all bonds in the seed molecule
                for (const bond of [...seedMol.bonds]) {
                    bond.break(false); // No energy release during cleanup
                    environment.bonds.delete(bond.id);
                }
                // Release all seed atoms
                for (const atom of seedMol.atoms) {
                    atom.moleculeId = null;
                    atom.claimedByIntentId = null;
                }
                environment.seedMolecules.delete(this.seedMoleculeId);
            }
            this.seedMoleculeId = null;
        }
        this._clearAllClaims(environment);
    }

    /**
     * Update progress based on how many of the needed atoms are gathered
     * (in seed + claimed but not yet bonded).
     */
    _updateProgress(state) {
        const { totalNeeded, seedMol, claimed } = state;
        if (totalNeeded === 0) return;

        const seedCount = seedMol ? seedMol.atoms.length : 0;
        const claimedCount = claimed.length;
        this.progress = Math.min(1, (seedCount + claimedCount) / totalNeeded);
    }

    // --- Rule stubs (implemented in Phases 3–7) ---

    _rule1_repelIrrelevantAtoms(_environment, state) {
        const { nearbyAtoms, targetComp, seedAtomIds } = state;
        const targetElements = new Set(Object.keys(targetComp));

        for (const atom of nearbyAtoms) {
            // Skip seed atoms and atoms already claimed by this intent
            if (seedAtomIds.has(atom.id)) continue;
            if (atom.claimedByIntentId === this.id) continue;
            // Skip atoms claimed by other intents (their intent handles them)
            if (atom.claimedByIntentId) continue;
            // Skip atoms in molecules (handled by Rule 2 via the molecule)
            if (atom.moleculeId) continue;

            if (!targetElements.has(atom.symbol)) {
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius && dist > 1) {
                    const dir = atom.position.sub(this.position).normalize();
                    const strength = Math.max(
                        this.repulsionForce * (1 - dist / this.radius),
                        this.repulsionForce * 0.5
                    );
                    atom.applyForce(dir.mul(strength));
                }
            }
        }
    }

    _rule2_repelIrrelevantMolecules(environment, state) {
        // `claimed` is a start-of-tick snapshot (see _buildState comment).
        // Do NOT mutate it here — Rules 3–5 write atom.claimedByIntentId directly.
        const { targetFormula, totalNeeded, targetComp, claimed } = state;
        if (!targetFormula) return;

        // Precompute claimed element counts for the surplus check below.
        const targetElements = new Set(Object.keys(targetComp));
        const claimedCount = {};
        for (const atom of claimed) {
            claimedCount[atom.symbol] = (claimedCount[atom.symbol] || 0) + 1;
        }

        for (const mol of environment.molecules.values()) {
            if (mol.isSeedFor) continue;    // Never repel seed molecules
            if (mol.polymerId) continue;    // Never repel polymer-protected molecules
            if (mol.formula === targetFormula) continue; // Already target formula

            // Condition 1: wrong-element check.
            // A molecule containing any element NOT in the target can never become
            // the target molecule through chemistry, so expel it immediately.
            const hasWrongElement = mol.atoms.some(a => !targetElements.has(a.symbol));

            // Condition 2: surplus check.
            // A molecule with only correct elements but whose elements are all already
            // fully claimed is surplus — expel it to prevent late-assembly crowding.
            //
            // NOTE: This intentionally overrides Bug #11's "leave unstable molecules alone" rule.
            // An unstable same-element mol (e.g. C2H3 in a C2H4 zone where 2C+4H are claimed)
            // could theoretically gain an H and become the target, but once claiming is complete
            // the intent bonds and fulfills within a few ticks — that window is negligible and
            // leaving surplus molecules creates late-assembly gridlock. Do NOT remove isSurplus
            // citing Bug #11; the trade-off is deliberate.
            // Ref: docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md
            const isSurplus = !hasWrongElement &&
                mol.atoms.every(a => (claimedCount[a.symbol] || 0) >= (targetComp[a.symbol] || 0));

            // Repel stable molecules always (they block assembly space).
            // Also repel large unstable molecules larger than the target (tar-balls):
            // they create dense repulsion fields that push seeds away from intent center
            // and occupy atoms the intent needs. Small unstable molecules (e.g. C2H2 when
            // assembling C2H4) are left alone unless they contain wrong elements or are surplus.
            const shouldRepel = mol.isStable()
                || mol.atoms.length > totalNeeded
                || hasWrongElement
                || isSurplus;
            if (!shouldRepel) continue;

            const center = mol.centerOfMass;
            const dist = center.distanceTo(this.position);
            if (dist >= this.radius || dist <= 10) continue;

            const dir = center.sub(this.position).normalize();
            const strength = Math.max(
                this.repulsionForce * (1 - dist / this.radius),
                this.repulsionForce * 0.5
            );
            // Apply force per atom (not via mol.applyForce which divides by total mass).
            // mol.applyForce gives each atom force * atom_mass/total_mass → acceleration
            // of force/total_mass, which is negligible for a 200-atom tar-ball.
            // Per-atom application gives each atom acceleration = strength/atom_mass,
            // strong enough to actually move large clusters out of the intent zone.
            for (const atom of mol.atoms) {
                atom.applyForce(dir.mul(strength));
            }
        }
    }

    _rule3_claimFreeAtoms(environment, state) {
        const { free, targetComp, seedMol, claimed, totalNeeded } = state;

        // Calculate current composition deficit
        const deficit = Object.assign({}, targetComp);
        if (seedMol) {
            for (const atom of seedMol.atoms) {
                if (deficit[atom.symbol] !== undefined) {
                    deficit[atom.symbol]--;
                }
            }
        }
        for (const atom of claimed) {
            if (deficit[atom.symbol] !== undefined) {
                deficit[atom.symbol]--;
            }
        }

        // Calculate this intent's progress (for priority in contests)
        const myProgress = state.totalNeeded > 0
            ? ((seedMol ? seedMol.atoms.length : 0) + claimed.length) / totalNeeded
            : 0;

        for (const atom of free) {
            const need = deficit[atom.symbol];
            if (!need || need <= 0) continue; // Don't need this element

            const dist = atom.position.distanceTo(this.position);
            if (dist > this.radius) continue; // Out of range

            // Priority check: only claim if we have higher progress than competing intent
            if (atom.claimedByIntentId && atom.claimedByIntentId !== this.id) {
                const competitor = environment.intentions.get(atom.claimedByIntentId);
                if (competitor && competitor.progress >= myProgress) continue; // Yield
                // We have higher priority - steal the claim
            }

            atom.claimedByIntentId = this.id;
            deficit[atom.symbol]--;
        }
    }

    _rule4_extractFromMolecules(environment, state) {
        const { targetComp, seedMol, claimed } = state;

        // Calculate deficit - how many of each element do we still need?
        const deficit = Object.assign({}, targetComp);
        if (seedMol) {
            for (const a of seedMol.atoms) {
                if (deficit[a.symbol] !== undefined) deficit[a.symbol]--;
            }
        }
        for (const a of claimed) {
            if (deficit[a.symbol] !== undefined) deficit[a.symbol]--;
        }

        // Check if there's actually a deficit worth extracting for
        const hasDeficit = Object.values(deficit).some(n => n > 0);
        if (!hasDeficit) return;
        if (state.extractedThisTick) return;

        // Build list of molecules with useful atoms, prioritizing unstable ones
        const candidates = [];
        for (const mol of environment.molecules.values()) {
            if (mol.isSeedFor) continue;      // Never extract from seed molecules
            if (mol.polymerId) continue;       // Never break polymer-protected molecules
            if (mol.isReshaping) continue;     // Don't disturb reshaping molecules

            // Check if this molecule has any atoms we need
            let hasNeededAtom = false;
            for (const symbol of Object.keys(deficit)) {
                if (deficit[symbol] > 0 && mol.atoms.some(a => a.symbol === symbol)) {
                    hasNeededAtom = true;
                    break;
                }
            }
            if (!hasNeededAtom) continue;

            const center = mol.centerOfMass;
            const dist = center.distanceTo(this.position);
            if (dist > this.radius) continue;

            candidates.push({ mol, dist, unstable: !mol.isStable() });
        }

        if (candidates.length === 0) return;

        // Sort: unstable molecules first (easier to extract from), then by distance
        candidates.sort((a, b) => {
            if (a.unstable && !b.unstable) return -1;
            if (!a.unstable && b.unstable) return 1;
            return a.dist - b.dist;
        });

        // Extract one atom from the best candidate
        for (const { mol } of candidates) {
            for (const symbol of Object.keys(deficit)) {
                if (deficit[symbol] <= 0) continue;
                const extracted = mol.extractAtom(symbol);
                if (extracted) {
                    state.extractedThisTick = true;
                    if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                        console.log(`[Intention ${this.id.substring(0, 8)}] Rule4: extracted ${symbol} from ${mol.formula}`);
                    }
                    return; // One extraction per tick
                }
            }
        }
    }

    _rule5_attractClaimed(environment, state) {
        const { claimed, seedMol } = state;
        // Rule 5 force constants (tuned for ~300 atoms, 4 intentions):
        // CLAIMED_PEAK   = 2.5  (distance-scaled, active in inner 80% of radius)
        // CLAIMED_FLOOR  = 2.0  (minimum; also active in outer 20%+beyond — prevents freeze)
        // SEED_ANCHOR    = 15.0 (was 3.0; increased to resist tar-ball repulsion ~8/atom)
        // SEED_DAMP_FRAC = 0.5  (fraction of outward velocity cancelled per tick, mass-normalised)
        // Attract toward seed center if it exists, otherwise toward intention center
        const target = seedMol ? seedMol.centerOfMass : this.position;

        for (const atom of claimed) {
            // Validate atom still exists
            if (!environment.atoms.has(atom.id)) continue;

            const dist = atom.position.distanceTo(target);
            if (dist > 1) {
                const dir = target.sub(atom.position).normalize();
                // Scale force by atom mass so all atoms get equal acceleration (F=ma, a=F/m).
                // Without this, heavy atoms (C mass=12) converge 12x slower than H (mass=1).
                const normalized = 1 - dist / this.radius;
                // Minimum force floor: ensure atoms that have escaped the intent radius
                // (where normalized = 0) are still pulled back. Without the floor, atoms
                // claimed at high velocity drift beyond radius and get zero force forever.
                // Note: floor (2.0) also activates in outer 20% of zone (dist > 0.8*radius) where
                // normalized < 0.8. This creates a stronger flat pull near the boundary, preventing
                // atoms from hovering at the zone edge. Intentional behaviour.
                const forceMag = Math.max(
                    this.attractionForce * 2.5 * normalized * atom.mass,
                    this.attractionForce * 2.0 * atom.mass
                );
                atom.applyForce(dir.mul(forceMag));
            }
        }

        // Anchor the seed molecule to this intention's center so it doesn't drift away.
        // Without this, the seed floats freely and claimed atoms can never catch up to it.
        // Force multiplied by 15 (was 3) to resist repulsion from nearby molecules.
        // Velocity correction cancels outward motion each tick so seeds converge quickly.
        if (seedMol) {
            for (const seedAtom of seedMol.atoms) {
                if (!environment.atoms.has(seedAtom.id)) continue;
                const dist = seedAtom.position.distanceTo(this.position);
                if (dist > 1) {
                    const dir = this.position.sub(seedAtom.position).normalize();
                    seedAtom.applyForce(dir.mul(this.attractionForce * 15.0 * seedAtom.mass));
                    // Cancel any velocity component pointing away from intent center
                    // so accumulated momentum doesn't carry the seed further out
                    const awayComponent = -seedAtom.velocity.dot(dir); // positive when moving away from center
                    if (awayComponent > 0) {
                        seedAtom.applyForce(dir.mul(awayComponent * 0.5 * seedAtom.mass));
                    }
                }
            }
        }
    }

    _rule6_bondClaimed(environment, state) {
        const { claimed, seedMol, targetComp } = state;
        if (claimed.length === 0) return;

        // Find a claimed atom that is close enough to bond
        // Sort claimed atoms by valence descending so the "hub" atom (e.g. C in CH4)
        // is tried first — prevents H-H seeds forming before a C-H seed
        const claimedByValence = [...claimed].sort((a, b) => b.maxBonds - a.maxBonds);
        // Only allow the highest-valence claimed atom(s) to act as the seed nucleus.
        // This prevents falling through to H-H when C can't yet reach an H.
        const maxValenceInClaimed = claimedByValence.length > 0 ? claimedByValence[0].maxBonds : 0;

        for (const atom of claimedByValence) {
            if (!environment.atoms.has(atom.id)) continue;

            if (seedMol) {
                // Don't add atoms to a reshaping seed — the atom-to-template mapping
                // was computed for the current atom count. Adding new atoms mid-reshaping
                // makes the mapping stale and causes _restructureBonds to leave the new
                // atoms without bonds, which creates a permanently stuck hasValidValence=false state.
                if (seedMol.isReshaping) return;

                // Try to bond this atom to an appropriate atom in the seed molecule
                const bondingRadius = (atom.radius + 15) * 2.5; // Generous bonding distance

                for (const seedAtom of seedMol.atoms) {
                    if (!seedAtom.availableValence) continue;

                    const dist = atom.position.distanceTo(seedAtom.position);
                    if (dist > bondingRadius) continue;

                    // Context-aware bonding: bypasses claim restriction for this intent's atoms
                    if (!atom.canBondWith(seedAtom, 1, { intentId: this.id })) continue;
                    if (!seedAtom.canBondWith(atom, 1)) continue;

                    // Create the bond
                    const bond = new Bond(atom, seedAtom, 1);
                    environment.bonds.set(bond.id, bond);

                    // Add atom to seed molecule
                    seedMol.atoms.push(atom);
                    atom.moleculeId = seedMol.id;
                    atom.claimedByIntentId = null; // Clear claim - now part of seed
                    seedMol.updateProperties();

                    if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                        console.log(`[Intention ${this.id.substring(0, 8)}] Rule6: bonded ${atom.symbol} to seed ${seedMol.formula}`);
                    }
                    return; // One bond per tick for stability
                }
            } else {
                // No seed molecule yet - this atom becomes the initial seed nucleus
                // Guard 1: all required element types must be represented in claimed set.
                // Prevents H-H seeds when C hasn't arrived yet (e.g., for C2H4).
                if (targetComp) {
                    const claimedSymbols = new Set(claimed.map(a => a.symbol));
                    for (const sym of Object.keys(targetComp)) {
                        if (targetComp[sym] > 0 && !claimedSymbols.has(sym)) return;
                    }
                }
                // Guard 2: only the highest-valence atom(s) may act as seed nucleus.
                // If C (val=4) hasn't found a partner yet, don't fall through to H-H (val=1).
                if (atom.maxBonds < maxValenceInClaimed) break;
                // Find another claimed atom to pair with as seed start
                for (const other of claimedByValence) {
                    if (other === atom) continue;
                    if (!environment.atoms.has(other.id)) continue;

                    const dist = atom.position.distanceTo(other.position);
                    const bondingRadius = (atom.radius + other.radius) * 2.5;
                    if (dist > bondingRadius) continue;

                    if (!atom.canBondWith(other, 1, { intentId: this.id })) continue;
                    if (!other.canBondWith(atom, 1, { intentId: this.id })) continue;

                    // Create bond between two claimed atoms → this forms the initial seed
                    const bond = new Bond(atom, other, 1);
                    environment.bonds.set(bond.id, bond);

                    // Create seed molecule from these two atoms
                    const seedMolNew = new Molecule([atom, other]);
                    seedMolNew.isSeedFor = this.id;
                    // Override ID assignment from Molecule constructor (it already set moleculeId)
                    environment.seedMolecules.set(seedMolNew.id, seedMolNew);
                    this.seedMoleculeId = seedMolNew.id;

                    atom.claimedByIntentId = null;
                    other.claimedByIntentId = null;

                    if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                        console.log(`[Intention ${this.id.substring(0, 8)}] Rule6: created initial seed ${seedMolNew.formula}`);
                    }
                    return;
                }
            }
        }
    }

    _rule7_checkCompletion(environment, state) {
        const { seedMol, targetFormula, totalNeeded } = state;
        if (!seedMol) return;

        // Step 1: Check chemical stability (all valences satisfied)
        // Use hasValidValence() NOT isStable() - seed molecules skip normal lifecycle
        if (!seedMol.hasValidValence()) {
            // Fix 4: Cancel any reshaping that started before this molecule became a seed
            // (e.g. regular molecule lifecycle called startReshaping(Dicarbon) on a C2 pair
            // BEFORE the intention could claim it). Seeds with too few atoms will never advance
            // their reshaping timer — the updateReshaping() call below requires atoms.length >= totalNeeded.
            if (seedMol.isReshaping && seedMol.atoms.length < totalNeeded) {
                seedMol.cancelReshaping();
            }

            // Special case: molecule might need double/triple bonds (e.g. ethylene C=C).
            // With only order-1 bonds, C's in C=C have availableValence=1 and will never
            // satisfy valence naturally. If atom count matches target, try template reshaping
            // first - this will fix bond orders (creating double bonds) and satisfy valence.
            if (seedMol.atoms.length >= totalNeeded && totalNeeded > 0 && !seedMol.geometryVerified) {
                if (typeof matchesStableTemplate === 'function') {
                    const template = matchesStableTemplate(seedMol);
                    if (template) {
                        if (!seedMol.isReshaping) {
                            seedMol.startReshaping(template);
                        }
                        if (seedMol.isReshaping) {
                            const done = seedMol.updateReshaping(1);
                            if (done) {
                                seedMol.geometryVerified = true;
                                environment.syncBonds();
                                // valence now satisfied via double bonds - next tick will complete
                            }
                        }
                    }
                }
            } else if (seedMol.geometryVerified && !seedMol.isReshaping) {
                // Reshaping previously completed but hasValidValence is still false.
                // This means _restructureBonds used a stale/wrong template and left some
                // atoms without bonds. Reset geometry so reshaping retries with a fresh
                // atom-to-template mapping based on the current molecule composition.
                seedMol.geometryVerified = false;
                seedMol.targetTemplate = null;
                seedMol.targetPositions = null;
                seedMol.atomToTemplateIndex = null;
            }
            return;
        }

        // Step 2: Check formula matches blueprint
        if (targetFormula && seedMol.formula !== targetFormula) {
            // If all atoms are bond-saturated (valid valence) but formula is wrong,
            // the seed is permanently stuck — no new atoms can bond to it.
            // Reset it so the atoms are released and we can try again.
            if (seedMol.hasValidValence()) {
                this._resetSeed(environment);
            }
            return;
        }

        // Step 3: Handle geometry check
        if (!seedMol.geometryVerified) {
            // Check if geometry needs reshaping
            if (typeof matchesStableTemplate === 'function' && typeof needsReshaping === 'function') {
                const template = matchesStableTemplate(seedMol);
                if (template && needsReshaping(seedMol, template)) {
                    // Geometry wrong - manually trigger reshaping and WAIT
                    if (!seedMol.isReshaping) {
                        seedMol.startReshaping(template);
                    }
                    // Process one reshaping step
                    if (seedMol.isReshaping) {
                        const done = seedMol.updateReshaping(1);
                        if (done) {
                            seedMol.geometryVerified = true;
                            // Sync newly created bonds into environment
                            environment.syncBonds();
                        }
                    }
                    return; // Wait for geometry to be correct
                } else {
                    // Formula matches template but geometry is OK, or no template exists
                    seedMol.geometryVerified = true;
                }
            } else {
                // No template checking available - mark verified
                seedMol.geometryVerified = true;
            }
        }

        // Step 4: Seed is complete! Promote to normal molecule
        if (seedMol.geometryVerified) {
            this._completeSeedMolecule(environment, seedMol);
        }
    }

    /**
     * Promote the completed seed molecule to a normal molecule,
     * clean up all claims, and mark this intention as fulfilled.
     */
    _completeSeedMolecule(environment, seedMol) {
        // Remove from seed molecules and add to normal molecules
        environment.seedMolecules.delete(seedMol.id);
        seedMol.isSeedFor = null;
        environment.molecules.set(seedMol.id, seedMol);

        // Clear all atom claims (some may still be claimed if we completed early)
        this._clearAllClaims(environment);

        // Mark intent fulfilled
        this.createdEntity = seedMol;
        this.fulfilled = true;
        this.seedMoleculeId = null;

        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`[Intention ${this.id.substring(0, 8)}] FULFILLED: molecule ${seedMol.formula} complete`);
        }
    }

    /**
     * Attract nearby components toward this intention
     */
    _attractComponents(environment) {
        const requirements = this.getRequirements();
        if (!requirements) return;

        if (requirements.type === 'atoms') {
            const targetComp = this.getTargetComposition();
            const neededElements = targetComp ? new Set(Object.keys(targetComp)) : null;

            // Attract free atoms AND atoms in unstable molecules
            for (const atom of environment.atoms.values()) {
                // Check if atom is in a molecule
                if (atom.moleculeId) {
                    const mol = environment.molecules.get(atom.moleculeId);
                    if (mol) {
                        // Skip atoms in stable molecules - they're done
                        if (mol.isStable()) continue;
                        // CRITICAL: Skip atoms in reshaping molecules - don't disturb geometry
                        if (mol.isReshaping) continue;
                    }
                }

                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius && dist > 5) {
                    const direction = this.position.sub(atom.position).normalize();
                    let forceMagnitude = this.attractionForce * (1 - dist / this.radius);

                    // Smart attraction: attract needed elements, repel unneeded
                    if (neededElements) {
                        if (neededElements.has(atom.symbol)) {
                            // This element is needed - stronger attraction
                            forceMagnitude *= 1.5;
                        } else {
                            // This element is NOT in the target - repel away FAST
                            // Use strong repulsion with minimum force to ensure it works even with overlapping intentions
                            // Floor 0.3 here (vs. 0.5 in molecule-intent Rules 1-2): polymer/cell
                            // intents have larger radii with gentler boundary dynamics; 0.3 is sufficient.
                            const repelStrength = Math.max(this.repulsionForce * (1 - dist / this.radius), this.repulsionForce * 0.3);
                            const repelForce = direction.mul(-repelStrength);
                            atom.applyForce(repelForce);
                            continue; // Skip normal force application
                        }
                    }

                    const force = direction.mul(forceMagnitude);
                    atom.applyForce(force);
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }

            // Also attract unstable molecules as a whole (moves all their atoms)
            // BUT: Don't move molecules that are currently reshaping - let them finish!
            for (const mol of environment.molecules.values()) {
                // Skip stable molecules - they don't need attraction
                if (mol.isStable()) continue;

                // CRITICAL: Skip molecules that are reshaping - moving them will break geometry
                if (mol.isReshaping) continue;

                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    // Strong force for unstable molecules - pull them in quickly
                    const force = direction.mul(this.attractionForce * 2.0 * (1 - dist / this.radius));
                    mol.applyForce(force);
                }
            }

            // Repel only fully stable molecules that don't match the target formula
            // Unstable molecules with useful atoms should NOT be repelled - let them transform
            const targetFormula = this.blueprint ? this.blueprint.formula : null;
            for (const mol of environment.molecules.values()) {
                // Skip molecules that are still reshaping (let them finish)
                if (mol.isReshaping) continue;

                // If this molecule IS the target formula, don't repel it
                if (targetFormula && mol.formula === targetFormula) continue;

                // Only repel STABLE molecules - unstable molecules may still transform
                if (!mol.isStable()) continue;

                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    // Very strong repulsion for unrelated stable molecules
                    // Use minimum force to ensure repulsion works even with overlapping intentions
                    // Floor 0.3 here (vs. 0.5 in molecule-intent Rules 1-2): polymer/cell
                    // intents have larger radii with gentler boundary dynamics; 0.3 is sufficient.
                    const repelStrength = Math.max(this.repulsionForce * (1 - dist / this.radius), this.repulsionForce * 0.3);
                    const repelForce = direction.mul(-repelStrength);
                    mol.applyForce(repelForce);
                }
            }
        } else if (requirements.type === 'molecules') {
            // Attract molecules (that aren't in polymers)
            for (const mol of environment.molecules.values()) {
                // Skip molecules already in polymers
                if (mol.polymerId) continue;

                const center = mol.getCenter();
                const dist = center.distanceTo(this.position);
                if (dist < this.radius && dist > 10) {
                    const direction = this.position.sub(center).normalize();
                    const force = direction.mul(this.attractionForce * (1 - dist / this.radius));
                    mol.applyForce(force);
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }
        } else if (requirements.type === 'monomers') {
            // Attract only molecules that match the required monomer formula
            const requiredFormula = requirements.monomerFormula;
            const monomerElements = this.getMonomerElements();

            // Repel free atoms that are not part of the monomer formula
            for (const atom of environment.atoms.values()) {
                // Skip atoms in molecules
                if (atom.moleculeId) continue;

                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius && dist > 5) {
                    const direction = this.position.sub(atom.position).normalize();

                    if (monomerElements && monomerElements.has(atom.symbol)) {
                        // This element is part of the monomer - attract it
                        const force = direction.mul(this.attractionForce * 0.8 * (1 - dist / this.radius));
                        atom.applyForce(force);
                    } else {
                        // This element is NOT part of the monomer - repel it fast
                        // Floor 0.3 here (vs. 0.5 in molecule-intent Rules 1-2): polymer/cell
                        // intents have larger radii with gentler boundary dynamics; 0.3 is sufficient.
                        const repelStrength = Math.max(this.repulsionForce * (1 - dist / this.radius), this.repulsionForce * 0.3);
                        const repelForce = direction.mul(-repelStrength);
                        atom.applyForce(repelForce);
                    }
                }
            }

            for (const mol of environment.molecules.values()) {
                // Skip molecules already in polymers
                if (mol.polymerId) continue;

                const center = mol.getCenter();
                const dist = center.distanceTo(this.position);

                // Check if this is the right monomer type
                const isCorrectMonomer = mol.isMonomer &&
                    (!requiredFormula || mol.formula === requiredFormula);

                if (dist > 10) {
                    const direction = this.position.sub(center).normalize();

                    if (isCorrectMonomer) {
                        // Attract correct monomers with extended range (2x radius).
                        // Use a minimum force floor so escaped monomers are always
                        // pulled back even if they drift beyond the normal radius.
                        if (dist < this.radius * 2) {
                            const normalized = Math.max(0, 1 - dist / this.radius);
                            // Use a strong minimum force (1.5x) so escaped monomers are
                            // reliably pulled back against environmental turbulence.
                            const forceMag = Math.max(this.attractionForce * 1.5, this.attractionForce * 3.0 * normalized);
                            mol.applyForce(direction.mul(forceMag));
                        }
                    } else if (mol.isStable() && dist < this.radius) {
                        // Only repel STABLE molecules that are NOT the required monomer,
                        // and only within the normal radius.
                        // Unstable molecules may still transform into the needed monomer.
                        // Floor 0.3 here (vs. 0.5 in molecule-intent Rules 1-2): polymer/cell
                        // intents have larger radii with gentler boundary dynamics; 0.3 is sufficient.
                        const repelStrength = Math.max(this.repulsionForce * (1 - dist / this.radius), this.repulsionForce * 0.3);
                        const repelForce = direction.mul(-repelStrength);
                        mol.applyForce(repelForce);
                    }
                    // Note: gatheredComponents is now managed in progress calculation
                }
            }
        } else if (requirements.type === 'polymers' || requirements.type === 'polymers_detailed') {
            // Attract polymers - for both basic and detailed cell requirements
            for (const polymer of environment.proteins.values()) {
                // Skip polymers already part of a cell
                if (polymer.prokaryoteId) continue;

                // Skip polymers already claimed by another intention
                if (polymer.claimedByIntentionId && polymer.claimedByIntentionId !== this.id) continue;

                const center = polymer.getCenter();
                const dist = center.distanceTo(this.position);

                if (dist < this.radius && dist > 20) {
                    // For detailed requirements, only attract polymers we need
                    let shouldAttract = true;
                    if (requirements.type === 'polymers_detailed' && requirements.polymerRequirements) {
                        shouldAttract = false;
                        for (const req of requirements.polymerRequirements) {
                            // Check if this polymer matches any requirement
                            const polymerType = polymer.type;
                            const expectedType = typeof CELL_ESSENTIAL_POLYMERS !== 'undefined'
                                ? CELL_ESSENTIAL_POLYMERS[req.polymerId]?.type : null;

                            if (polymerType === expectedType) {
                                // Check chain length
                                const chainLength = polymer.monomers?.length || polymer.molecules?.length || 0;
                                if (chainLength >= req.minChainLength) {
                                    shouldAttract = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (shouldAttract) {
                        const direction = this.position.sub(center).normalize();
                        // Polymers move slower
                        for (const mol of polymer.molecules) {
                            mol.applyForce(direction.mul(this.attractionForce * 0.5));
                        }
                    }
                }
            }
        }

        // Update progress based on components in/near the zone
        const requirements2 = this.getRequirements();
        if (requirements2.type === 'atoms' && requirements2.count) {
            // Count only RELEVANT atoms in zone (matching target composition)
            const targetComp = this.getTargetComposition();
            const neededElements = targetComp ? new Set(Object.keys(targetComp)) : null;

            let relevantAtomsInZone = 0;
            // Clear and rebuild gatheredComponents each frame
            this.gatheredComponents.clear();

            for (const atom of environment.atoms.values()) {
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    // Only count atoms that are relevant to the target molecule
                    if (!neededElements || neededElements.has(atom.symbol)) {
                        relevantAtomsInZone++;
                        this.gatheredComponents.add(atom.id);
                    }
                }
            }
            this.progress = Math.min(1, relevantAtomsInZone / requirements2.count);
        } else if (requirements2.type === 'monomers' && requirements2.count) {
            // Count matching monomers in zone
            let monomersInZone = 0;
            const requiredFormula = requirements2.monomerFormula;

            // Clear and rebuild gatheredComponents each frame
            this.gatheredComponents.clear();

            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                if (!mol.isMonomer) continue;
                if (requiredFormula && mol.formula !== requiredFormula) continue;

                const dist = mol.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    monomersInZone++;
                    this.gatheredComponents.add(mol.id);
                }
            }
            this.progress = Math.min(1, monomersInZone / requirements2.count);
        } else if (requirements2.count) {
            // For other types, also rebuild gatheredComponents
            this.gatheredComponents.clear();
            // Progress will be updated by the specific type handler
            this.progress = 0;
        }
    }

    /**
     * Check if intention can be fulfilled
     */
    _checkCompletion(environment) {
        const requirements = this.getRequirements();
        if (!requirements) return;

        if (requirements.type === 'atoms' && requirements.count) {
            // Check if there's a matching molecule in the zone
            // OR if we have enough free atoms to form one

            // First check for existing molecules that match our requirements
            // Skip molecules that existed before this intention was placed
            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;

                // IMPORTANT: Skip molecules that existed before this intention was created
                if (this.excludedMoleculeIds.has(mol.id)) continue;

                // CRITICAL: Skip molecules already claimed by another intention
                // This prevents overlapping intentions from all being fulfilled by the same molecule
                if (mol.claimedByIntentionId && mol.claimedByIntentionId !== this.id) continue;

                // CRITICAL: Molecule must be STABLE before we count it as complete
                // This ensures the molecule has finished reshaping and won't become unstable
                if (!mol.isStable()) continue;

                // CRITICAL: Molecule must not be in the middle of reshaping
                // Wait for it to complete its transformation to the stable form
                if (mol.isReshaping) continue;

                // If geometry is already verified, trust it - don't re-check
                // This prevents constant re-triggering of reshaping
                if (!mol.geometryVerified) {
                    // Only check geometry for molecules that haven't been verified yet
                    if (typeof matchesStableTemplate === 'function' && typeof needsReshaping === 'function') {
                        const template = matchesStableTemplate(mol);
                        if (template && needsReshaping(mol, template)) {
                            // Molecule has wrong geometry - trigger reshaping and wait
                            mol.startReshaping(template);
                            continue;
                        }
                    }
                }

                const center = mol.getCenter ? mol.getCenter() : mol.centerOfMass;
                const dist = center.distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    // CRITICAL: Validate formula matches blueprint, not just atom count
                    // This prevents unrelated molecules from fulfilling the intention
                    const blueprintFormula = this.blueprint.formula;
                    if (blueprintFormula && mol.formula === blueprintFormula) {
                        // Mark intention as fulfilled - correct stable molecule formed!
                        // CRITICAL: Claim the molecule so other overlapping intentions can't use it
                        mol.claimedByIntentionId = this.id;
                        this.createdEntity = mol;
                        this.fulfilled = true;
                        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                            console.log(`[Intention ${this.id.substring(0, 8)}] Fulfilled: Stable molecule ${mol.formula} matches blueprint`);
                        }
                        return;
                    }
                    // If no formula in blueprint, fall back to atom count check (legacy)
                    else if (!blueprintFormula && mol.atoms.length === requirements.count) {
                        // CRITICAL: Claim the molecule so other overlapping intentions can't use it
                        mol.claimedByIntentionId = this.id;
                        this.createdEntity = mol;
                        this.fulfilled = true;
                        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                            console.log(`[Intention ${this.id.substring(0, 8)}] Fulfilled: New stable molecule ${mol.formula} formed (atom count match)`);
                        }
                        return;
                    }
                }
            }

            // If no matching molecule, check for free atoms
            const nearbyAtoms = [];
            for (const atom of environment.atoms.values()) {
                if (atom.moleculeId) continue;
                const dist = atom.position.distanceTo(this.position);
                if (dist < this.radius * 0.5) {
                    nearbyAtoms.push(atom);
                }
            }

            if (nearbyAtoms.length >= requirements.count) {
                // Form the molecule!
                this._formMolecule(environment, nearbyAtoms.slice(0, requirements.count));
            }
        } else if (requirements.type === 'molecules' && requirements.count) {
            // Check if we have enough molecules nearby
            const nearbyMolecules = [];
            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                // CRITICAL: Skip molecules already claimed by another intention
                if (mol.claimedByIntentionId && mol.claimedByIntentionId !== this.id) continue;
                const dist = mol.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.5) {
                    nearbyMolecules.push(mol);
                }
            }

            if (nearbyMolecules.length >= requirements.count) {
                // Form the polymer!
                this._formPolymer(environment, nearbyMolecules.slice(0, requirements.count));
            }
        } else if (requirements.type === 'monomers' && requirements.count) {
            // NEW: Check for matching monomer molecules
            const requiredFormula = requirements.monomerFormula;
            const nearbyMonomers = [];

            for (const mol of environment.molecules.values()) {
                if (mol.polymerId) continue;
                if (!mol.isMonomer) continue;
                if (requiredFormula && mol.formula !== requiredFormula) continue;
                // CRITICAL: Skip molecules already claimed by another intention
                if (mol.claimedByIntentionId && mol.claimedByIntentionId !== this.id) continue;

                const dist = mol.getCenter().distanceTo(this.position);
                // Use 0.8x radius (generous) so strongly-attracted monomers can
                // trigger completion without needing to be perfectly centered.
                if (dist < this.radius * 0.8) {
                    nearbyMonomers.push(mol);
                }
            }

            if (nearbyMonomers.length >= requirements.count) {
                // Form the polymer from monomers!
                this._formPolymerFromMonomers(environment, nearbyMonomers.slice(0, requirements.count), requirements.monomerTemplate);
            }
        } else if (requirements.type === 'polymers') {
            // Check if we have required polymer types (basic/legacy mode)
            const nearbyPolymers = { membrane: null, structure: null, genetics: null };
            for (const polymer of environment.proteins.values()) {
                // CRITICAL: Skip polymers already claimed by another intention
                if (polymer.claimedByIntentionId && polymer.claimedByIntentionId !== this.id) continue;
                if (polymer.prokaryoteId) continue;
                const dist = polymer.getCenter().distanceTo(this.position);
                if (dist < this.radius * 0.6) {
                    const role = polymer.cellRole || polymer.type;
                    if (role === 'membrane' || role === 'lipid') nearbyPolymers.membrane = polymer;
                    if (role === 'structure' || role === 'protein') nearbyPolymers.structure = polymer;
                    if (role === 'genetics' || role === 'nucleic_acid') nearbyPolymers.genetics = polymer;
                }
            }

            if (nearbyPolymers.membrane && nearbyPolymers.genetics) {
                // Form the cell! (structure is optional)
                const polymersToUse = Object.values(nearbyPolymers).filter(p => p);
                this._formCell(environment, polymersToUse);
            }
        } else if (requirements.type === 'polymers_detailed' && requirements.polymerRequirements) {
            // NEW: Detailed polymer requirements with chain length validation
            const fulfillment = {};
            let allSatisfied = true;
            let totalGathered = 0;

            // Clear gathered components for this frame
            this.gatheredComponents.clear();

            for (const req of requirements.polymerRequirements) {
                // Find polymers matching this requirement
                const matching = [];

                for (const polymer of environment.proteins.values()) {
                    // Skip polymers already used
                    if (polymer.prokaryoteId) continue;
                    if (polymer.claimedByIntentionId && polymer.claimedByIntentionId !== this.id) continue;

                    // Check distance
                    const dist = polymer.getCenter().distanceTo(this.position);
                    if (dist >= this.radius * 0.6) continue;

                    // Check type matches
                    const polymerType = polymer.type;
                    const expectedType = typeof CELL_ESSENTIAL_POLYMERS !== 'undefined'
                        ? CELL_ESSENTIAL_POLYMERS[req.polymerId]?.type : null;

                    if (polymerType !== expectedType) continue;

                    // Check chain length
                    const chainLength = polymer.monomers?.length || polymer.molecules?.length || 0;
                    if (chainLength < req.minChainLength) continue;

                    matching.push(polymer);
                    this.gatheredComponents.add(polymer.id);
                }

                fulfillment[req.role] = {
                    have: matching.length,
                    need: req.count,
                    satisfied: matching.length >= req.count,
                    polymers: matching
                };

                totalGathered += matching.length;

                if (matching.length < req.count) {
                    allSatisfied = false;
                }
            }

            // Update progress based on how many requirements are met
            const totalNeeded = requirements.totalPolymers || 2;
            this.progress = Math.min(1, totalGathered / totalNeeded);

            // Store fulfillment for inspector display
            this.polymerFulfillment = fulfillment;

            if (allSatisfied) {
                // Gather all matching polymers and form the cell
                const polymersToUse = [];
                for (const [_role, status] of Object.entries(fulfillment)) {
                    for (let i = 0; i < status.need && i < status.polymers.length; i++) {
                        polymersToUse.push(status.polymers[i]);
                    }
                }

                if (polymersToUse.length > 0) {
                    this._formCell(environment, polymersToUse);
                }
            }
        }
    }

    /**
     * Form a molecule from gathered atoms
     */
    _formMolecule(environment, atoms) {
        // Sort atoms: heavier atoms (C, N, O) first as potential centers
        atoms.sort((a, b) => b.mass - a.mass);

        // Try to bond atoms intelligently
        // For molecules like CH4, bond all H to the central C
        const centralAtom = atoms[0]; // Heaviest atom as center

        for (let i = 1; i < atoms.length; i++) {
            const atom = atoms[i];

            // First try to bond to central atom
            if (centralAtom.availableValence > 0 && atom.availableValence > 0 && !centralAtom.isBondedTo(atom)) {
                const bond = new Bond(centralAtom, atom);
                environment.addBond(bond);
            } else {
                // If central is full, try to bond to previous atoms
                for (let j = 0; j < i; j++) {
                    const other = atoms[j];
                    if (other.availableValence > 0 && atom.availableValence > 0 && !other.isBondedTo(atom)) {
                        const bond = new Bond(other, atom);
                        environment.addBond(bond);
                        break;
                    }
                }
            }
        }

        // Only create molecule from atoms that actually have bonds
        const bondedAtoms = atoms.filter(a => a.bonds.length > 0);

        if (bondedAtoms.length < 2) {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Not enough bonded atoms to form molecule`);
            }
            return; // Don't fulfill - try again next tick
        }

        // Create molecule from bonded atoms only
        const molecule = new Molecule(bondedAtoms);
        environment.addMolecule(molecule);

        // CRITICAL: Validate the formed molecule matches our blueprint formula
        // If wrong molecule formed, don't fulfill - keep trying
        const blueprintFormula = this.blueprint.formula;
        if (blueprintFormula && molecule.formula !== blueprintFormula) {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Formed ${molecule.formula} but need ${blueprintFormula}, continuing...`);
            }
            return; // Don't fulfill - wrong molecule formed
        }

        // CRITICAL: Do NOT fulfill here!
        // We just created bonds - the molecule may not be stable yet.
        // The _checkCompletion loop above will verify stability and fulfill.
        // Just log that molecule was formed - completion check will handle the rest.
        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`[Intention ${this.id.substring(0, 8)}] Created molecule ${molecule.formula}, waiting for stability...`);
        }
    }

    /**
     * Form a polymer from gathered molecules
     */
    _formPolymer(environment, molecules) {
        // Validate molecules can polymerize - they need available valence (open bonds)
        const polymerizableMolecules = molecules.filter(mol => {
            // Check if any atom in the molecule has available valence
            for (const atom of mol.atoms) {
                if (atom.availableValence > 0) {
                    return true; // This molecule can bind
                }
            }
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Molecule ${mol.formula} cannot polymerize - no available valence`);
            }
            return false;
        });

        if (polymerizableMolecules.length < 2) {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Cannot form polymer: need at least 2 molecules with available valence`);
            }
            return; // Don't form polymer
        }

        // Mark molecules as part of polymer and claim them
        const polymerId = Utils.generateId();
        polymerizableMolecules.forEach(mol => {
            mol.polymerId = polymerId;
            mol.claimedByIntentionId = this.id;  // Claim so other intentions don't double-count
        });

        // Create polymer
        const polymer = new Polymer(polymerizableMolecules, this.blueprint.type, this.blueprint.name);
        polymer.seal(); // Seal the polymer so internal atoms can't bond externally
        environment.addProtein(polymer);

        this.createdEntity = polymer;
        this.fulfilled = true;

        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`[Intention ${this.id.substring(0, 8)}] Fulfilled: Created polymer ${polymer.name || polymer.type}`);
        }
    }

    /**
     * Form a polymer chain from monomer molecules
     * NEW: Uses monomer template system for proper chain creation
     * @param {Environment} environment 
     * @param {Molecule[]} monomers - Identical monomer molecules to chain
     * @param {Object} monomerTemplate - The monomer template defining polymerization
     */
    _formPolymerFromMonomers(environment, monomers, monomerTemplate) {
        if (monomers.length < 2) {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Cannot form polymer: need at least 2 monomers`);
            }
            return;
        }

        const monomerName = monomerTemplate?.name || monomers[0]?.formula || 'Unknown';
        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`[Intention ${this.id.substring(0, 8)}] Forming polymer from ${monomers.length} ${monomerName} monomers`);
        }

        // Create polymer with monomer template
        const polymer = new Polymer(monomers, monomerTemplate, this.blueprint.name);

        // Mark molecules as part of polymer and claim them
        monomers.forEach(mol => {
            mol.polymerId = polymer.id;
            mol.claimedByIntentionId = this.id;  // Claim so other intentions don't double-count
        });

        // Handle polymerization type
        if (monomerTemplate?.polymerizationType === 'condensation') {
            // Condensation polymerization releases water molecules
            const waterCount = monomers.length - 1; // n-1 water released
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Condensation polymerization: ${waterCount} H2O molecules released (conceptually)`);
            }
            // Note: Could actually spawn water molecules here if desired
        } else if (monomerTemplate?.polymerizationType === 'addition') {
            if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
                console.log(`[Intention ${this.id.substring(0, 8)}] Addition polymerization: double bonds opened to form chain`);
            }
        }

        // Seal polymer to prevent external bonding
        polymer.seal();

        // Add to environment
        environment.addProtein(polymer);

        this.createdEntity = polymer;
        this.fulfilled = true;

        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            console.log(`[Intention ${this.id.substring(0, 8)}] Polymer created: ${polymer.name || polymer.type} from ${monomers.length} ${monomerName} monomers`);
        }
    }

    /**
     * Form a cell (Prokaryote) from gathered polymers
     */
    _formCell(environment, polymers) {
        // Categorize polymers by their role
        const components = {
            membrane: [],
            nucleoid: [],
            ribosomes: []
        };

        for (const polymer of polymers) {
            polymer.claimedByIntentionId = this.id;  // Claim so other intentions don't double-count

            // Categorize by type
            const type = polymer.type;
            if (type === 'lipid') {
                components.membrane.push(polymer);
            } else if (type === 'nucleic_acid') {
                components.nucleoid.push(polymer);
            } else if (type === 'protein') {
                components.ribosomes.push(polymer);
            }

            // Don't remove from environment yet - Prokaryote will own them
        }

        // Create Prokaryote at this position with categorized components
        const prokaryote = new Prokaryote(components);
        prokaryote.position = new Vector2(this.position.x, this.position.y);

        // Store blueprint info if available
        if (this.blueprint) {
            prokaryote.blueprintId = this.blueprint.id;
            prokaryote.species = this.blueprint.species || null;
            prokaryote.cellName = this.blueprint.name || 'Cell';
        }

        // Give it some starting energy
        prokaryote.cytoplasm.atp = 50;

        // Add to environment
        environment.addProkaryote(prokaryote);

        // Mark polymers as belonging to this prokaryote
        for (const polymer of polymers) {
            polymer.prokaryoteId = prokaryote.id;
        }

        this.createdEntity = prokaryote;
        this.fulfilled = true;

        if (typeof Debug !== 'undefined' && Debug.shouldLog('intentions')) {
            const cellName = this.blueprint?.name || 'Prokaryote';
            console.log(`[Intention ${this.id.substring(0, 8)}] Fulfilled: Created ${cellName} from ${polymers.length} polymers`);
        }
    }

    /**
     * Render the intention zone
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     * @param {Vector2} offset
     * @param {Environment|null} environment - Optional; enables claimed-atom lines and seed glow
     */
    render(ctx, scale = 1, offset = { x: 0, y: 0 }, environment = null) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        const screenRadius = this.radius * scale;

        // Pulsing effect
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 0.8;

        // Get color based on type
        const colors = this._getColors();

        // Draw attraction radius (dashed circle)
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.setLineDash([10, 5]);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw glow effect
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, screenRadius
        );
        gradient.addColorStop(0, colors.glowInner);
        gradient.addColorStop(0.5, colors.glowMid);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw progress ring
        if (this.progress > 0) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenRadius * 0.9, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
            ctx.strokeStyle = colors.progress;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // --- Molecule-intent visual overlays (require environment access) ---
        if (this.type === 'molecule' && environment !== null) {
            // 1. Thin lines from each claimed atom to the intent center
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            for (const atom of environment.atoms.values()) {
                if (atom.claimedByIntentId !== this.id) continue;
                const ax = (atom.position.x + offset.x) * scale;
                const ay = (atom.position.y + offset.y) * scale;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(screenX, screenY);
                ctx.stroke();
            }
            ctx.restore();

            // 2. Pulsing glow around the seed molecule
            if (this.seedMoleculeId) {
                const seedMol = environment.seedMolecules.get(this.seedMoleculeId);
                if (seedMol && seedMol.atoms.size > 0) {
                    const com = seedMol.centerOfMass;
                    const sx = (com.x + offset.x) * scale;
                    const sy = (com.y + offset.y) * scale;
                    // Approximate radius from atom count
                    const glowR = (12 + seedMol.atoms.length * 8) * scale * pulse;
                    const seedGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
                    seedGrad.addColorStop(0, colors.glowInner);
                    seedGrad.addColorStop(0.6, colors.glowMid);
                    seedGrad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.save();
                    ctx.globalAlpha = 0.45 * pulse;
                    ctx.beginPath();
                    ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
                    ctx.fillStyle = seedGrad;
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        // Draw center icon/preview
        this._renderPreview(ctx, screenX, screenY, scale, pulse, colors);

        // Draw label
        ctx.fillStyle = colors.text;
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.blueprint.name || this.type, screenX, screenY + screenRadius * 0.6);

        // Draw progress text: "X/Y atoms" for molecule intents, percentage for others
        ctx.font = `${10 * scale}px sans-serif`;
        if (this.type === 'molecule') {
            const targetComp = this.getTargetComposition() || {};
            const totalNeeded = Object.values(targetComp).reduce((s, n) => s + n, 0);
            const gathered = Math.round(this.progress * totalNeeded);
            ctx.fillText(`${gathered}/${totalNeeded} atoms`, screenX, screenY + screenRadius * 0.6 + 15);
        } else {
            ctx.fillText(`${Math.round(this.progress * 100)}%`, screenX, screenY + screenRadius * 0.6 + 15);
        }
    }

    /**
     * Render preview of target entity
     */
    _renderPreview(ctx, screenX, screenY, scale, pulse, colors) {
        const previewRadius = 20 * scale * pulse;

        ctx.beginPath();
        ctx.arc(screenX, screenY, previewRadius, 0, Math.PI * 2);
        ctx.fillStyle = colors.preview;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw icon based on type
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${16 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(this.type === 'molecule' ? 'M' : this.type === 'polymer' ? 'P' : 'C', screenX, screenY);
    }

    /**
     * Get colors based on intention type
     */
    _getColors() {
        switch (this.type) {
            case 'molecule':
                return {
                    border: 'rgba(139, 92, 246, 0.6)',
                    glowInner: 'rgba(139, 92, 246, 0.4)',
                    glowMid: 'rgba(139, 92, 246, 0.2)',
                    progress: '#8b5cf6',
                    preview: 'rgba(139, 92, 246, 0.6)',
                    text: '#a78bfa'
                };
            case 'polymer':
                return {
                    border: 'rgba(34, 197, 94, 0.6)',
                    glowInner: 'rgba(34, 197, 94, 0.4)',
                    glowMid: 'rgba(34, 197, 94, 0.2)',
                    progress: '#22c55e',
                    preview: 'rgba(34, 197, 94, 0.6)',
                    text: '#4ade80'
                };
            case 'cell':
                return {
                    border: 'rgba(59, 130, 246, 0.6)',
                    glowInner: 'rgba(59, 130, 246, 0.4)',
                    glowMid: 'rgba(59, 130, 246, 0.2)',
                    progress: '#3b82f6',
                    preview: 'rgba(59, 130, 246, 0.6)',
                    text: '#60a5fa'
                };
            default:
                return {
                    border: 'rgba(255, 255, 255, 0.4)',
                    glowInner: 'rgba(255, 255, 255, 0.2)',
                    glowMid: 'rgba(255, 255, 255, 0.1)',
                    progress: '#ffffff',
                    preview: 'rgba(255, 255, 255, 0.4)',
                    text: '#ffffff'
                };
        }
    }

    /**
     * Check if point is inside intention zone (for selection)
     * Uses small hitbox around center icon, not the full attraction radius
     */
    containsPoint(x, y, scale = 1, offset = { x: 0, y: 0 }) {
        const screenX = (this.position.x + offset.x) * scale;
        const screenY = (this.position.y + offset.y) * scale;
        // Use small hitbox radius (matches the center icon size) instead of full attraction radius
        const hitboxRadius = 25 * scale;

        const dx = x - screenX;
        const dy = y - screenY;
        return (dx * dx + dy * dy) <= (hitboxRadius * hitboxRadius);
    }
}

// Make available globally
window.Intention = Intention;
