import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

const targetPosition = new Vector3();
const predatorColor = new Color(0xff3b3b);

export class PredatorManager {
  constructor({ scene, config, random }) {
    this.scene = scene;
    this.config = config;
    this.random = random;
    this.group = new Group();
    this.predators = [];
    this.geometry = new SphereGeometry(0.82, 18, 12);
    this.material = new MeshStandardMaterial({
      color: predatorColor,
      emissive: 0x4a0505,
      roughness: 0.48,
    });
    this.scene.add(this.group);
  }

  setup() {
    this.createPredators();
    this.reset();
  }

  createPredators() {
    for (let index = 0; index < this.config.predator.count; index += 1) {
      const predator = this.createPredator();
      this.predators.push(predator);
      this.group.add(predator.mesh);
    }
  }

  createPredator() {
    const mesh = new Mesh(this.geometry, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const predator = {
      position: new Vector3(),
      velocity: new Vector3(),
      reward: 0,
      kills: 0,
      target: null,
      retargetTimer: 0,
      wanderAngle: this.random.range(-Math.PI, Math.PI),
      mesh,
    };
    mesh.userData.predator = predator;
    return predator;
  }

  update(deltaTime, organisms) {
    for (const predator of this.predators) {
      this.updatePredator(predator, deltaTime, organisms);
    }
  }

  updatePredator(predator, deltaTime, organisms) {
    predator.retargetTimer -= deltaTime;

    if (predator.retargetTimer <= 0) {
      predator.target = this.findVisibleOrganism(predator, organisms);
      predator.retargetTimer = this.config.predator.retargetInterval;
    }

    if (predator.target?.alive) {
      this.chase(predator, predator.target);
      this.tryEat(predator, predator.target);
    } else {
      this.wander(predator, deltaTime);
    }

    predator.position.addScaledVector(predator.velocity, deltaTime);
    this.clampToArena(predator);
    predator.mesh.position.copy(predator.position);
  }

  chase(predator, target) {
    targetPosition.copy(target.position).sub(predator.position);

    if (targetPosition.lengthSq() <= 0.0001) {
      return;
    }

    targetPosition.normalize();
    predator.velocity.lerp(
      targetPosition.multiplyScalar(this.config.predator.speed),
      0.025,
    );
  }

  wander(predator, deltaTime) {
    predator.wanderAngle += this.random.signed() * deltaTime * 1.6;
    targetPosition.set(
      Math.sin(predator.wanderAngle),
      0,
      Math.cos(predator.wanderAngle),
    );
    predator.velocity.lerp(
      targetPosition.multiplyScalar(this.config.predator.wanderSpeed),
      0.018,
    );
  }

  findVisibleOrganism(predator, organisms) {
    let nearest = null;
    const visionSq = this.config.predator.visionRadius * this.config.predator.visionRadius;
    let nearestDistanceSq = visionSq;

    for (const organism of organisms) {
      if (!organism.alive) {
        continue;
      }

      const distanceSq = organism.position.distanceToSquared(predator.position);

      if (distanceSq >= nearestDistanceSq) {
        continue;
      }

      nearest = organism;
      nearestDistanceSq = distanceSq;
    }

    return nearest;
  }

  getNearestPredator(position) {
    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (const predator of this.predators) {
      const distanceSq = predator.position.distanceToSquared(position);

      if (distanceSq >= nearestDistanceSq) {
        continue;
      }

      nearest = predator;
      nearestDistanceSq = distanceSq;
    }

    return {
      predator: nearest,
      distance: Math.sqrt(nearestDistanceSq),
    };
  }

  tryEat(predator, organism) {
    const radius = this.config.predator.eatRadius;

    if (!organism.alive) {
      return;
    }

    if (organism.position.distanceToSquared(predator.position) > radius * radius) {
      return;
    }

    organism.fitness -= 8;
    organism.kill('predator');
    predator.kills += 1;
    predator.reward += this.config.predator.reward;
  }

  clampToArena(predator) {
    const radius = this.config.arenaSize * 0.5;
    const distance = Math.sqrt(
      predator.position.x * predator.position.x + predator.position.z * predator.position.z,
    );

    if (distance <= radius || distance === 0) {
      return;
    }

    predator.position.x = (predator.position.x / distance) * radius;
    predator.position.z = (predator.position.z / distance) * radius;
  }

  reset() {
    const radius = this.config.arenaSize * 0.38;

    for (const predator of this.predators) {
      const angle = this.random.range(-Math.PI, Math.PI);
      const distance = Math.sqrt(this.random.next()) * radius;
      predator.position.set(
        Math.sin(angle) * distance,
        0.82,
        Math.cos(angle) * distance,
      );
      predator.velocity.set(0, 0, 0);
      predator.reward = 0;
      predator.kills = 0;
      predator.target = null;
      predator.retargetTimer = this.random.range(0, this.config.predator.retargetInterval);
      predator.mesh.position.copy(predator.position);
    }
  }

  setArenaSize(arenaSize) {
    this.config.arenaSize = arenaSize;

    for (const predator of this.predators) {
      this.clampToArena(predator);
      predator.mesh.position.copy(predator.position);
    }
  }

  getKills() {
    return this.predators.reduce((total, predator) => total + predator.kills, 0);
  }

  getReward() {
    return this.predators.reduce((total, predator) => total + predator.reward, 0);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.predators.length = 0;
  }
}
