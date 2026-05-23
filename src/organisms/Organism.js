import {
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { NeuralNetwork } from '../neural/NeuralNetwork.js';
import { clamp } from '../utils/math.js';

const color = new Color();

export class Organism {
  constructor({ id, genome, topology, sensors, motor, random }) {
    this.id = id;
    this.genome = genome;
    this.brain = NeuralNetwork.fromGenome(genome, topology);
    this.sensors = sensors;
    this.motor = motor;
    this.random = random;

    this.position = new Vector3();
    this.velocity = new Vector3();
    this.mesh = this.createMesh();
    this.resetState();
  }

  resetState() {
    this.rotation = this.random.range(-Math.PI, Math.PI);
    this.age = 0;
    this.energy = 1.65;
    this.maxEnergy = 2.4;
    this.fitness = 0;
    this.foodEaten = 0;
    this.alive = true;
    this.deathReason = null;
    this.distanceTraveled = 0;
    this.movementTrend = 0;
    this.lastMotorCost = 0;
    this.maxSpeed = this.random.range(8, 11);
    this.turnSpeed = this.random.range(2.2, 3.2);
    this.accelerationPower = this.random.range(11, 15);
    this.velocity.set(0, 0, 0);
  }

  spawnWithin(radius) {
    const angle = this.random.range(-Math.PI, Math.PI);
    const distance = Math.sqrt(this.random.next()) * radius;

    this.position.set(
      Math.sin(angle) * distance,
      0.7,
      Math.cos(angle) * distance,
    );
    this.syncMesh();
  }

  spawnAt(x, z) {
    this.position.set(x, 0.7, z);
    this.syncMesh();
  }

  update(deltaTime, rule) {
    if (!this.alive) {
      return;
    }

    const previousPosition = this.position.clone();
    const inputs = this.sensors.read(this, rule);
    const outputs = this.brain.feedForward(inputs);
    this.lastInputs = inputs;
    this.lastOutputs = outputs;

    this.motor.apply(this, outputs, deltaTime);
    this.age += deltaTime;
    this.energy -= 0.0008 * deltaTime + this.lastMotorCost * 0.22;
    this.distanceTraveled += previousPosition.distanceTo(this.position);
    this.movementTrend = this.velocity.length() / this.maxSpeed;
    rule.evaluate(this, deltaTime);

    if (rule.isDead(this)) {
      this.kill(rule.getDeathReason(this));
    }

    this.syncMesh();
  }

  kill(reason = 'unknown') {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.deathReason = reason;
    this.energy = Math.max(0, this.energy);
    this.mesh.visible = false;
  }

  revive(genome, topology) {
    this.genome = genome;
    this.brain = NeuralNetwork.fromGenome(genome, topology);
    this.resetState();
    this.mesh.visible = true;
  }

  createMesh() {
    const group = new Group();
    const body = new Mesh(
      new CapsuleGeometry(0.38, 0.8, 5, 10),
      new MeshStandardMaterial({
        color: 0x70d6ff,
        roughness: 0.62,
        metalness: 0.05,
      }),
    );

    body.castShadow = true;
    body.receiveShadow = true;
    body.rotation.x = Math.PI * 0.5;
    body.userData.organism = this;
    group.add(body);
    return group;
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    if (this.genome.lineageHue === null) {
      color.setHSL(0, 0, 0.82 + this.energy * 0.08);
      this.mesh.children[0].material.color.copy(color);
      return;
    }

    const lineageIntensity = clamp((this.genome.lineageAge + 1) / 3, 0, 1);
    const saturation = 0.28 + lineageIntensity * 0.5;
    const lightness = 0.6 - lineageIntensity * 0.18 + this.energy * 0.12;
    color.setHSL(this.genome.lineageHue, saturation, lightness);
    this.mesh.children[0].material.color.copy(color);
  }

  dispose() {
    this.mesh.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      object.geometry.dispose();
      object.material.dispose();
    });
  }
}
