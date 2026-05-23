import { normalize, wrapAngle } from '../utils/math.js';

export class Sensors {
  constructor({ arenaSize, maxAge }) {
    this.arenaSize = arenaSize;
    this.maxAge = maxAge;
  }

  read(organism, rule) {
    const halfArena = this.arenaSize * 0.5;
    const distanceFromCenter = Math.sqrt(
      organism.position.x * organism.position.x + organism.position.z * organism.position.z,
    );
    const distanceToLimit = halfArena - distanceFromCenter;
    const headingToCenter = Math.atan2(-organism.position.x, -organism.position.z);
    const centerBias = Math.sin(wrapAngle(headingToCenter - organism.rotation));

    return [
      organism.energy / organism.maxEnergy,
      normalize(organism.velocity.length(), 0, organism.maxSpeed),
      normalize(organism.age, 0, this.maxAge),
      normalize(distanceFromCenter, 0, halfArena),
      normalize(distanceToLimit, 0, halfArena),
      centerBias,
      rule.getCuriositySignal(organism),
      organism.movementTrend,
      ...rule.getFoodInputs(organism),
      ...rule.getPredatorInputs(organism),
      ...rule.getObstacleInputs(organism),
    ];
  }
}
