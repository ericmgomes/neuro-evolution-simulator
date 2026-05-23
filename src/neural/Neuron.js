export class Neuron {
  constructor(weights, bias) {
    this.weights = weights;
    this.bias = bias;
  }

  activate(inputs) {
    let sum = this.bias;

    for (let index = 0; index < this.weights.length; index += 1) {
      sum += inputs[index] * this.weights[index];
    }

    return Math.tanh(sum);
  }
}
