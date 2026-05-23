import { Vector3 } from 'three';
import { clamp, lerp, wrapAngle } from '../utils/math.js';

const forward = new Vector3();

export class MotorSystem {
  constructor() {
    this.drag = 0.92;
  }

  apply(organism, outputs, deltaTime) {
    if (!organism.alive) {
      return;
    }

    const turn = outputs[1] - outputs[0] + outputs[4] * 0.35;
    const throttle = clamp(outputs[2] * 0.5 + 0.5, 0, 1);
    const brake = clamp(outputs[3] * 0.5 + 0.5, 0, 1);
    const impulse = clamp(outputs[5] * 0.5 + 0.5, 0, 1);
    const acceleration = organism.accelerationPower * (throttle + impulse * 0.35);

    organism.rotation = wrapAngle(organism.rotation + turn * organism.turnSpeed * deltaTime);
    forward.set(Math.sin(organism.rotation), 0, Math.cos(organism.rotation));
    organism.velocity.addScaledVector(forward, acceleration * deltaTime);
    organism.velocity.multiplyScalar(lerp(this.drag, 0.78, brake));

    if (organism.velocity.lengthSq() > organism.maxSpeed * organism.maxSpeed) {
      organism.velocity.setLength(organism.maxSpeed);
    }

    organism.position.addScaledVector(organism.velocity, deltaTime);
    organism.lastMotorCost = (acceleration * 0.012 + brake * 0.25) * deltaTime;
  }
}
