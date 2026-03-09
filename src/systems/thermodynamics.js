/**
 * Thermodynamics System
 * Stateless utility class providing thermodynamics calculations
 * consumed by environment and intention.
 */

class Thermodynamics {
    constructor(environment) {
        this.environment = environment;
    }

    /**
     * Get stability score for a bond type (0-1, clamped)
     * @param {string} symbol1 - First element symbol
     * @param {string} symbol2 - Second element symbol
     * @param {number} order - Bond order
     * @returns {number}
     */
    getStabilityScore(symbol1, symbol2, order) {
        return Math.min(1, getBondEnergy(symbol1, symbol2, order) / MAX_BOND_ENERGY);
    }

    /**
     * Get thermal formation factor for spontaneous bonding
     * @param {string} symbol1 - First element symbol
     * @param {string} symbol2 - Second element symbol
     * @param {number} temperature - Temperature in Kelvin
     * @returns {number}
     */
    getFormationFactor(symbol1, symbol2, temperature) {
        const stability = this.getStabilityScore(symbol1, symbol2, 1);
        return Math.min(1, stability * (temperature / 298));
    }

}

window.Thermodynamics = Thermodynamics;
