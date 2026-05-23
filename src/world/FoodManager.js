import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

const foodColor = new Color(0x79f28f);

export class FoodManager {
  constructor({ scene, config, random }) {
    this.scene = scene;
    this.config = config;
    this.random = random;
    this.group = new Group();
    this.food = [];
    this.totalCollected = 0;
    this.geometry = new SphereGeometry(0.34, 10, 8);
    this.material = new MeshStandardMaterial({
      color: foodColor,
      emissive: 0x123016,
      roughness: 0.5,
    });
    this.spawnCursor = 0;
    this.scene.add(this.group);
  }

  setup() {
    this.createFood();
  }

  createFood() {
    for (let index = 0; index < this.config.food.count; index += 1) {
      this.addFood();
    }
  }

  addFood() {
    const mesh = new Mesh(this.geometry, this.material);
    const item = { mesh, position: mesh.position };

    mesh.castShadow = true;
    this.group.add(mesh);
    this.food.push(item);
    this.respawn(item);
  }

  addFoodAt(position) {
    if (this.isOutsideArena(position)) {
      return;
    }

    const mesh = new Mesh(this.geometry, this.material);
    const item = { mesh, position: mesh.position };

    mesh.castShadow = true;
    item.position.set(position.x, 0.34, position.z);
    this.group.add(mesh);
    this.food.push(item);
  }

  getNearest(position) {
    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (const item of this.food) {
      const distanceSq = item.position.distanceToSquared(position);

      if (distanceSq >= nearestDistanceSq) {
        continue;
      }

      nearest = item;
      nearestDistanceSq = distanceSq;
    }

    return {
      item: nearest,
      distance: Math.sqrt(nearestDistanceSq),
    };
  }

  collectNear(position, radius) {
    const radiusSq = radius * radius;

    for (const item of this.food) {
      if (item.position.distanceToSquared(position) > radiusSq) {
        continue;
      }

      this.totalCollected += 1;
      this.respawn(item);
      return true;
    }

    return false;
  }

  reset() {
    this.totalCollected = 0;
    this.spawnCursor = 0;

    for (const item of this.food) {
      this.respawn(item);
    }
  }

  setArenaSize(arenaSize) {
    this.config.arenaSize = arenaSize;

    for (const item of this.food) {
      if (this.isOutsideArena(item.position)) {
        this.respawn(item);
      }
    }
  }

  setFoodCount(count) {
    while (this.food.length < count) {
      this.addFood();
    }

    while (this.food.length > count) {
      const item = this.food.pop();
      this.group.remove(item.mesh);
    }
  }

  respawn(item) {
    const radius = this.config.arenaSize * 0.5;
    const distance = radius * 0.68;
    const clusterRadius = Math.max(1.8, this.config.arenaSize * 0.075);
    const quadrants = [
      -Math.PI * 0.75,
      -Math.PI * 0.25,
      Math.PI * 0.75,
      Math.PI * 0.25,
    ];
    const angle = quadrants[this.spawnCursor % quadrants.length];
    this.spawnCursor += 1;

    item.position.set(
      Math.sin(angle) * distance + this.random.signed() * clusterRadius,
      0.34,
      Math.cos(angle) * distance + this.random.signed() * clusterRadius,
    );

    if (this.isOutsideArena(item.position)) {
      this.respawn(item);
    }
  }

  isOutsideArena(position) {
    const radius = this.config.arenaSize * 0.5;
    return position.x * position.x + position.z * position.z > radius * radius;
  }

  getAvailableCount() {
    return this.food.length;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.food.length = 0;
  }
}
