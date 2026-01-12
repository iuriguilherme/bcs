/**
 * Neural Network
 * Lightweight feed-forward neural network for cell behavior
 * No external dependencies
 */

class NeuralNetwork {
    /**
     * Create a neural network
     * @param {number[]} layers - Layer sizes, e.g., [4, 8, 4] for 4 inputs, 8 hidden, 4 outputs
     * @param {string} activation - Activation function: 'sigmoid', 'relu', 'tanh'
     */
    constructor(layers, activation = 'sigmoid') {
        this.layers = layers;
        this.activation = activation;

        // Initialize weights and biases
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < layers.length - 1; i++) {
            // Weight matrix from layer i to layer i+1
            const weightMatrix = this._createMatrix(layers[i + 1], layers[i]);
            this._randomizeMatrix(weightMatrix);
            this.weights.push(weightMatrix);

            // Bias vector for layer i+1
            const biasVector = new Array(layers[i + 1]).fill(0).map(() => (Math.random() - 0.5) * 0.5);
            this.biases.push(biasVector);
        }
    }

    /**
     * Create a matrix (2D array)
     */
    _createMatrix(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    /**
     * Randomize matrix values (Xavier initialization)
     */
    _randomizeMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const scale = Math.sqrt(2 / (rows + cols));

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = (Math.random() - 0.5) * 2 * scale;
            }
        }
    }

    /**
     * Activation function
     */
    _activate(x) {
        switch (this.activation) {
            case 'sigmoid':
                return 1 / (1 + Math.exp(-x));
            case 'relu':
                return Math.max(0, x);
            case 'tanh':
                return Math.tanh(x);
            default:
                return 1 / (1 + Math.exp(-x));
        }
    }

    /**
     * Forward propagation
     * @param {number[]} inputs - Input values
     * @returns {number[]} Output values
     */
    forward(inputs) {
        if (inputs.length !== this.layers[0]) {
            throw new Error(`Expected ${this.layers[0]} inputs, got ${inputs.length}`);
        }

        let current = inputs.slice();

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            const biases = this.biases[i];
            const next = [];

            for (let j = 0; j < weights.length; j++) {
                let sum = biases[j];
                for (let k = 0; k < current.length; k++) {
                    sum += weights[j][k] * current[k];
                }
                next.push(this._activate(sum));
            }

            current = next;
        }

        return current;
    }

    /**
     * Get all weights as a flat array
     * @returns {number[]} Flattened weights and biases
     */
    getWeights() {
        const flat = [];

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    flat.push(weights[j][k]);
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                flat.push(this.biases[i][j]);
            }
        }

        return flat;
    }

    /**
     * Set all weights from a flat array
     * @param {number[]} flat - Flattened weights and biases
     */
    setWeights(flat) {
        let index = 0;

        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    weights[j][k] = flat[index++];
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                this.biases[i][j] = flat[index++];
            }
        }
    }

    /**
     * Get total number of weights
     */
    getWeightCount() {
        let count = 0;
        for (let i = 0; i < this.layers.length - 1; i++) {
            count += this.layers[i] * this.layers[i + 1]; // weights
            count += this.layers[i + 1]; // biases
        }
        return count;
    }

    /**
     * Mutate weights randomly
     * @param {number} rate - Mutation rate (0-1), probability of each weight being mutated
     * @param {number} strength - Mutation strength, max change amount
     */
    mutate(rate = 0.1, strength = 0.5) {
        for (let i = 0; i < this.weights.length; i++) {
            const weights = this.weights[i];
            for (let j = 0; j < weights.length; j++) {
                for (let k = 0; k < weights[j].length; k++) {
                    if (Math.random() < rate) {
                        weights[j][k] += (Math.random() - 0.5) * 2 * strength;
                    }
                }
            }
            for (let j = 0; j < this.biases[i].length; j++) {
                if (Math.random() < rate) {
                    this.biases[i][j] += (Math.random() - 0.5) * 2 * strength;
                }
            }
        }
    }

    /**
     * Create a copy of this neural network
     * @returns {NeuralNetwork} Cloned network
     */
    clone() {
        const clone = new NeuralNetwork(this.layers.slice(), this.activation);
        clone.setWeights(this.getWeights());
        return clone;
    }

    /**
     * Serialize to JSON-compatible object
     */
    serialize() {
        return {
            layers: this.layers,
            activation: this.activation,
            weights: this.getWeights()
        };
    }

    /**
     * Create from serialized data
     * @param {object} data - Serialized network data
     * @returns {NeuralNetwork}
     */
    static deserialize(data) {
        const nn = new NeuralNetwork(data.layers, data.activation);
        nn.setWeights(data.weights);
        return nn;
    }

    /**
     * Create a random neural network with random topology
     * @param {number} inputs - Number of inputs
     * @param {number} outputs - Number of outputs
     * @param {number} hiddenLayers - Number of hidden layers (0-3)
     * @param {number} hiddenSize - Size of hidden layers
     * @returns {NeuralNetwork}
     */
    static random(inputs, outputs, hiddenLayers = 1, hiddenSize = 8) {
        const layers = [inputs];
        for (let i = 0; i < hiddenLayers; i++) {
            layers.push(hiddenSize);
        }
        layers.push(outputs);

        return new NeuralNetwork(layers);
    }
}

// Make available globally
window.NeuralNetwork = NeuralNetwork;
