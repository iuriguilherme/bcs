/**
 * Prokaryote Factory
 * Factory methods for detecting and creating prokaryotes from polymer combinations
 */

/**
 * Check if a set of polymers can form a valid prokaryote
 * Minimum requirements:
 * - At least 1 LIPID polymer (membrane)
 * - At least 1 NUCLEIC_ACID polymer (genetic material)
 * 
 * @param {Polymer[]} polymers - Array of polymers to check
 * @returns {boolean} True if the polymers can form a prokaryote
 */
function canFormProkaryote(polymers) {
    if (!polymers || polymers.length < 2) return false;

    let hasLipid = false;
    let hasNucleicAcid = false;

    for (const polymer of polymers) {
        if (!polymer || !polymer.type) continue;

        if (polymer.type === PolymerType.LIPID) {
            hasLipid = true;
        }
        if (polymer.type === PolymerType.NUCLEIC_ACID) {
            hasNucleicAcid = true;
        }
    }

    return hasLipid && hasNucleicAcid;
}

/**
 * Categorize polymers by their role in a prokaryote
 * @param {Polymer[]} polymers - Array of polymers
 * @returns {object} Object with categorized polymer arrays
 */
function categorizePolymersForProkaryote(polymers) {
    const result = {
        membrane: [],
        nucleoid: [],
        ribosomes: [],
        other: []
    };

    for (const polymer of polymers) {
        if (!polymer || !polymer.type) continue;

        switch (polymer.type) {
            case PolymerType.LIPID:
                result.membrane.push(polymer);
                break;
            case PolymerType.NUCLEIC_ACID:
                result.nucleoid.push(polymer);
                break;
            case PolymerType.PROTEIN:
                result.ribosomes.push(polymer);
                break;
            default:
                result.other.push(polymer);
        }
    }

    return result;
}

/**
 * Create a prokaryote from a set of polymers
 * @param {Polymer[]} polymers - Array of polymers to combine
 * @returns {Prokaryote|null} New prokaryote or null if invalid
 */
function createProkaryoteFromPolymers(polymers) {
    if (!canFormProkaryote(polymers)) {
        return null;
    }

    const categorized = categorizePolymersForProkaryote(polymers);

    const prokaryote = new Prokaryote({
        membrane: categorized.membrane,
        nucleoid: categorized.nucleoid,
        ribosomes: categorized.ribosomes
    });

    return prokaryote;
}

/**
 * Find groups of nearby polymers that could form prokaryotes
 * @param {Map|Array} polymers - All polymers in environment
 * @param {number} maxDistance - Maximum distance for polymers to be considered nearby
 * @returns {Polymer[][]} Arrays of polymer groups that could form prokaryotes
 */
function findPotentialProkaryoteGroups(polymers, maxDistance = 150) {
    const groups = [];
    const assigned = new Set();

    // Convert to array if Map
    const polymerArray = polymers instanceof Map
        ? Array.from(polymers.values())
        : polymers;

    // Filter out polymers already part of a prokaryote
    const available = polymerArray.filter(p =>
        !p.prokaryoteId && p.isSealed
    );

    for (const startPolymer of available) {
        if (assigned.has(startPolymer.id)) continue;

        // Find all nearby polymers using BFS
        const group = [startPolymer];
        assigned.add(startPolymer.id);

        const queue = [startPolymer];
        while (queue.length > 0) {
            const current = queue.shift();
            const currentCenter = current.getCenter();

            for (const other of available) {
                if (assigned.has(other.id)) continue;

                const otherCenter = other.getCenter();
                const distance = Utils.distance(
                    currentCenter.x, currentCenter.y,
                    otherCenter.x, otherCenter.y
                );

                if (distance < maxDistance) {
                    group.push(other);
                    assigned.add(other.id);
                    queue.push(other);
                }
            }
        }

        // Only include groups that can form prokaryotes
        if (canFormProkaryote(group)) {
            groups.push(group);
        }
    }

    return groups;
}

/**
 * Auto-detect and create prokaryotes from environment polymers
 * @param {Environment} environment - Environment to check
 * @param {number} maxDistance - Maximum distance for nearby polymers
 * @returns {Prokaryote[]} Newly created prokaryotes
 */
function detectAndCreateProkaryotes(environment, maxDistance = 150) {
    if (!environment.polymers) return [];

    const newProkaryotes = [];
    const groups = findPotentialProkaryoteGroups(environment.polymers, maxDistance);

    for (const group of groups) {
        const prokaryote = createProkaryoteFromPolymers(group);
        if (prokaryote) {
            newProkaryotes.push(prokaryote);
        }
    }

    return newProkaryotes;
}

// Make available globally
window.canFormProkaryote = canFormProkaryote;
window.categorizePolymersForProkaryote = categorizePolymersForProkaryote;
window.createProkaryoteFromPolymers = createProkaryoteFromPolymers;
window.findPotentialProkaryoteGroups = findPotentialProkaryoteGroups;
window.detectAndCreateProkaryotes = detectAndCreateProkaryotes;
