export class Genome {
  constructor(genes, lineageHue, lineageAge = 0) {
    this.genes = genes;
    this.lineageHue = lineageHue;
    this.lineageAge = lineageAge;
  }

  static geneCount(topology) {
    let count = 0;

    for (let index = 0; index < topology.length - 1; index += 1) {
      const inputCount = topology[index];
      const outputCount = topology[index + 1];
      count += outputCount * (inputCount + 1);
    }

    return count;
  }

  static random(topology, random) {
    const count = Genome.geneCount(topology);
    const genes = Array.from({ length: count }, () => random.signed());
    return new Genome(genes, null, 0);
  }

  clone() {
    return new Genome([...this.genes], this.lineageHue, this.lineageAge);
  }
}
