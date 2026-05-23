export class SeededRandom {
  constructor(seed) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed || 1;
  }

  reset(seed = this.initialSeed) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed || 1;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  signed() {
    return this.next() * 2 - 1;
  }

  integer(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }
}
