import { Layer } from './Layer.js';

export class NeuralNetwork {
  constructor(layers, topology) {
    this.layers = layers;
    this.topology = topology;
  }

  static fromGenome(genome, topology) {
    const layers = [];
    let cursor = 0;

    for (let index = 0; index < topology.length - 1; index += 1) {
      const result = Layer.fromWeights(
        topology[index],
        topology[index + 1],
        genome.genes,
        cursor,
      );

      layers.push(result.layer);
      cursor = result.cursor;
    }

    return new NeuralNetwork(layers, topology);
  }

  feedForward(inputs) {
    return this.layers.reduce(
      (currentInputs, layer) => layer.feedForward(currentInputs),
      inputs,
    );
  }

  getStructureLabel() {
    return this.topology.join('-');
  }
}
