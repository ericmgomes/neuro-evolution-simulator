import { BaseRule } from './BaseRule.js';
import { clamp, normalize, wrapAngle } from '../utils/math.js';

export class SandboxExplorationRule extends BaseRule {
  constructor({ arenaSize, maxAge, foodManager, predatorManager, obstacleManager, random }) {
    super();
    this.arenaSize = arenaSize;
    this.maxAge = maxAge;
    this.foodManager = foodManager;
    this.predatorManager = predatorManager;
    this.obstacleManager = obstacleManager;
    this.random = random;
    this.curiosityPhase = random.range(0, Math.PI * 2);
  }

  reset() {
    this.curiosityPhase = this.random.range(0, Math.PI * 2);
  }

  getCuriositySignal(organism) {
    const wave = Math.sin(organism.age * 0.9 + organism.id * 0.37 + this.curiosityPhase);
    return clamp(wave, -1, 1);
  }

  getFoodInputs(organism) {
    const nearest = this.foodManager.getNearest(organism.position);

    if (!nearest.item) {
      return [0, 0];
    }

    const halfArena = this.arenaSize * 0.5;
    const dx = nearest.item.position.x - organism.position.x;
    const dz = nearest.item.position.z - organism.position.z;
    const heading = Math.atan2(dx, dz);
    const direction = Math.sin(wrapAngle(heading - organism.rotation));
    const closeness = 1 - normalize(nearest.distance, 0, halfArena * 1.4);

    return [closeness, direction];
  }

  getPredatorInputs(organism) {
    const nearest = this.predatorManager.getNearestPredator(organism.position);

    if (!nearest.predator) {
      return [0, 0];
    }

    const predator = nearest.predator;
    const halfArena = this.arenaSize * 0.5;
    const dx = predator.position.x - organism.position.x;
    const dz = predator.position.z - organism.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const heading = Math.atan2(dx, dz);
    const direction = Math.sin(wrapAngle(heading - organism.rotation));
    const danger = 1 - normalize(distance, 0, halfArena * 1.4);

    return [danger, direction];
  }

  getObstacleInputs(organism) {
    const nearest = this.obstacleManager.getNearest(organism.position);

    if (!nearest) {
      return [0, 0];
    }

    const halfArena = this.arenaSize * 0.5;
    const dx = nearest.x - organism.position.x;
    const dz = nearest.z - organism.position.z;
    const heading = Math.atan2(dx, dz);
    const direction = Math.sin(wrapAngle(heading - organism.rotation));
    const danger = 1 - normalize(nearest.distance, 0, halfArena * 0.55);

    return [danger, direction];
  }

  evaluate(organism, deltaTime) {
    if (!organism.alive) {
      return;
    }

    const halfArena = this.arenaSize * 0.5;
    const distanceFromCenter = Math.sqrt(
      organism.position.x * organism.position.x + organism.position.z * organism.position.z,
    );
    const limitDistance = halfArena - distanceFromCenter;
    const outsidePenalty = limitDistance < 0 ? 12 : 0;
    const boundaryPenalty = limitDistance < 3 ? (3 - limitDistance) * 0.008 : 0;
    const predatorDanger = this.getPredatorInputs(organism)[0];
    const obstacleCollision = this.obstacleManager.getCollision(organism.position);
    const obstaclePenalty = this.getObstaclePenalty(obstacleCollision);
    const movement = organism.velocity.length();
    const efficientMovement = movement > 0.35 ? movement * 0.018 : -0.08;
    const exploration = organism.distanceTraveled * 0.002;
    const survivalNearPredator = predatorDanger > 0.45 ? movement * 0.018 : 0;

    organism.fitness += deltaTime * (
      0.22 + efficientMovement + exploration + survivalNearPredator - boundaryPenalty - outsidePenalty
      - obstaclePenalty
    );
    organism.energy -= (
      Math.max(0, boundaryPenalty) + outsidePenalty + obstaclePenalty
    ) * deltaTime;

    if (obstacleCollision?.type === 'lake') {
      organism.velocity.multiplyScalar(0.58);
    }

    this.collectFood(organism);
  }

  getObstaclePenalty(collision) {
    if (!collision) {
      return 0;
    }

    if (collision.type === 'lake') {
      return this.obstacleManager.config.obstacles.lakePenalty;
    }

    return this.obstacleManager.config.obstacles.mountainPenalty;
  }

  collectFood(organism) {
    const collected = this.foodManager.collectNear(
      organism.position,
      this.foodManager.config.food.collectRadius,
    );

    if (!collected) {
      return;
    }

    organism.foodEaten += 1;
    organism.energy = Math.min(
      organism.maxEnergy,
      organism.energy + this.foodManager.config.food.energy,
    );
    organism.fitness += 6;
  }

  isDead(organism) {
    return this.getDeathReason(organism) !== null;
  }

  getDeathReason(organism) {
    const halfArena = this.arenaSize * 0.5;
    const distanceFromCenter = Math.sqrt(
      organism.position.x * organism.position.x + organism.position.z * organism.position.z,
    );

    if (distanceFromCenter > halfArena) {
      return 'map';
    }

    if (organism.energy <= 0) {
      return 'energy';
    }

    if (this.obstacleManager.getCollision(organism.position)) {
      return 'obstacle';
    }

    if (organism.age >= this.maxAge) {
      return 'age';
    }

    return null;
  }
}
