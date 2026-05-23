export class Chunk {
  constructor({ x, z, seed }) {
    this.x = x;
    this.z = z;
    this.seed = seed;
    this.objects = [];
  }

  dispose() {
    for (const object of this.objects) {
      if (object.dispose) {
        object.dispose();
      }
    }

    this.objects.length = 0;
  }
}
