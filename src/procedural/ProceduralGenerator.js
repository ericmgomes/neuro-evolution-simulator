export class ProceduralGenerator {
  constructor({ seed }) {
    this.seed = seed;
  }

  getBiomeAt(x, z) {
    const value = Math.sin((x * 12.9898 + z * 78.233 + this.seed) * 0.001);

    if (value > 0.34) {
      return 'warm';
    }

    if (value < -0.34) {
      return 'cold';
    }

    return 'temperate';
  }
}
