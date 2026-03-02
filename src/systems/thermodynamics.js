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

    /**
     * Get effective temperature at a position — intention zones override global temp
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Temperature in Kelvin
     */
    getTemperatureAt(x, y) {
        for (const intention of this.environment.intentions.values()) {
            if (intention.localTemperature == null) continue;
            if (intention.fulfilled) continue;
            const localTemp = intention.localTemperature;
            if (!Number.isFinite(localTemp) || localTemp < 1 || localTemp > 600) continue;
            const dx = x - intention.position.x;
            const dy = y - intention.position.y;
            const distSq = dx * dx + dy * dy;
            const radiusSq = intention.radius * intention.radius;
            if (distSq <= radiusSq) {
                return localTemp;
            }
        }
        return this.environment.temperature;
    }
}

window.Thermodynamics = Thermodynamics;
