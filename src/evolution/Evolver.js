import { Genome } from './Genome.js';
import { clamp } from '../utils/math.js';

export class Evolver {
  constructor({ topology, config, random }) {
    this.topology = topology;
    this.config = config;
    this.random = random;
  }

  createInitialPopulation(size) {
    return Array.from({ length: size }, () => Genome.random(this.topology, this.random));
  }

  nextGeneration(organisms) {
    const ranked = [...organisms].sort((a, b) => b.fitness - a.fitness);
    const size = organisms.length;
    const eliteCount = Math.max(1, Math.floor(size * this.config.eliteRatio));
    const newcomerCount = Math.floor(size * this.config.randomNewcomers);
    const inheritedHue = this.random.next();
    const topParent = ranked[0];
    const topFiveParents = new Set(ranked.slice(0, 5));
    const nextGenomes = ranked
      .slice(0, eliteCount)
      .map((organism) => this.ageGenome(organism.genome.clone()));
    const stats = {
      elite: nextGenomes.length,
      inherited: 0,
      newcomers: 0,
      childrenFromTop1: 0,
      childrenFromTop5: 0,
    };

    while (nextGenomes.length < size - newcomerCount) {
      const parentA = this.pickParent(ranked);
      const parentB = this.pickParent(ranked);
      const child = this.random.chance(this.config.crossoverRate)
        ? this.crossover(parentA.genome, parentB.genome)
        : parentA.genome.clone();

      child.lineageHue = inheritedHue;
      nextGenomes.push(this.ageGenome(this.mutate(child)));
      stats.inherited += 1;
      stats.childrenFromTop1 += parentA === topParent || parentB === topParent ? 1 : 0;
      stats.childrenFromTop5 += topFiveParents.has(parentA) || topFiveParents.has(parentB) ? 1 : 0;
    }

    while (nextGenomes.length < size) {
      const newcomer = Genome.random(this.topology, this.random);
      newcomer.lineageHue = this.random.next();
      nextGenomes.push(newcomer);
      stats.newcomers += 1;
    }

    return {
      genomes: nextGenomes,
      stats,
    };
  }

  pickParent(ranked) {
    const sampleCount = Math.min(5, ranked.length);
    let best = ranked[this.random.integer(0, ranked.length - 1)];

    for (let index = 1; index < sampleCount; index += 1) {
      const candidate = ranked[this.random.integer(0, ranked.length - 1)];

      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best;
  }

  crossover(parentA, parentB) {
    const genes = parentA.genes.map((gene, index) => {
      if (this.random.chance(0.5)) {
        return gene;
      }

      return parentB.genes[index];
    });

    return new Genome(genes, this.random.next(), 0);
  }

  mutate(genome) {
    const genes = genome.genes.map((gene) => {
      if (!this.random.chance(this.config.mutationRate)) {
        return gene;
      }

      const delta = this.random.signed() * this.config.mutationStrength;
      return clamp(gene + delta, -3, 3);
    });

    return new Genome(genes, genome.lineageHue, genome.lineageAge);
  }

  ageGenome(genome) {
    genome.lineageAge += 1;
    return genome;
  }

}
