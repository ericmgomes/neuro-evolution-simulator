import { Neuron } from './Neuron.js';

export class Layer {
  constructor(neurons) {
    this.neurons = neurons;
  }

  static fromWeights(inputCount, outputCount, genes, cursor) {
    const neurons = [];
    let geneIndex = cursor;

    for (let output = 0; output < outputCount; output += 1) {
      const weights = genes.slice(geneIndex, geneIndex + inputCount);
      geneIndex += inputCount;
      neurons.push(new Neuron(weights, genes[geneIndex]));
      geneIndex += 1;
    }

    return {
      layer: new Layer(neurons),
      cursor: geneIndex,
    };
  }

  feedForward(inputs) {
    return this.neurons.map((neuron) => neuron.activate(inputs));
  }
}
