import { Vector3 } from 'three';
import { Evolver } from '../evolution/Evolver.js';
import { MotorSystem } from '../organisms/MotorSystem.js';
import { Organism } from '../organisms/Organism.js';
import { Sensors } from '../organisms/Sensors.js';
import { SandboxExplorationRule } from '../rules/SandboxExplorationRule.js';
import { SeededRandom } from '../utils/SeededRandom.js';
import { FoodManager } from '../world/FoodManager.js';
import { ObstacleManager } from '../world/ObstacleManager.js';
import { PredatorManager } from '../world/PredatorManager.js';
import { PerceptionOverlay } from '../rendering/PerceptionOverlay.js';
import { TrailSystem } from '../rendering/TrailSystem.js';

export class Simulation {
  constructor({ scene, config }) {
    this.scene = scene;
    this.config = config;
    this.random = new SeededRandom(config.seed);
    this.sensors = new Sensors({
      arenaSize: config.arenaSize,
      maxAge: config.maxAge,
    });
    this.motor = new MotorSystem();
    this.foodManager = new FoodManager({
      scene,
      config,
      random: this.random,
    });
    this.obstacleManager = new ObstacleManager({
      scene,
      config,
      random: this.random,
    });
    this.predatorManager = new PredatorManager({
      scene,
      config,
      random: this.random,
    });
    this.rule = new SandboxExplorationRule({
      arenaSize: config.arenaSize,
      maxAge: config.maxAge,
      foodManager: this.foodManager,
      predatorManager: this.predatorManager,
      obstacleManager: this.obstacleManager,
      random: this.random,
    });
    this.evolver = new Evolver({
      topology: config.topology,
      config: config.evolution,
      random: this.random,
    });
    this.organisms = [];
    this.generation = 1;
    this.generationTime = 0;
    this.paused = false;
    this.speed = config.speed.defaultMultiplier * config.speed.simulationScale;
    this.accumulator = 0;
    this.centerOfLife = new Vector3();
    this.generationComposition = {
      elite: 0,
      inherited: 0,
      newcomers: config.populationSize,
      childrenFromTop1: 0,
      childrenFromTop5: 0,
    };
    this.lastGenerationResult = this.createEmptyGenerationResult();
    this.selectedOrganism = null;
    this.selectedPredator = null;
    this.overlay = new PerceptionOverlay({
      scene,
      rule: this.rule,
    });
    this.trails = new TrailSystem({
      scene,
      maxArchivedGenerations: config.trails.maxArchivedGenerations,
    });
    this.trails.setVisible(config.trails.visible);
  }

  setup() {
    this.obstacleManager.setup();
    this.foodManager.setup();
    this.predatorManager.setup();
    const genomes = this.evolver.createInitialPopulation(this.config.populationSize);
    this.spawnGeneration(genomes);
  }

  update(deltaTime) {
    if (this.paused) {
      return;
    }

    const effectiveDelta = this.speed <= 1
      ? Math.min(deltaTime * this.speed, this.config.speed.fixedStep)
      : deltaTime * this.speed;

    this.accumulator += effectiveDelta;
    const startedAt = performance.now();
    let steps = 0;

    while (this.shouldRunSubstep(startedAt, steps)) {
      this.runSubstep(this.config.speed.fixedStep);
      this.accumulator -= this.config.speed.fixedStep;
      steps += 1;
    }

    this.updateCenterOfLife();
    this.overlay.update(this.selectedPredator ?? this.selectedOrganism);
    this.trails.update(this.organisms);

    if (this.shouldAdvanceGeneration()) {
      this.advanceGeneration();
    }
  }

  shouldRunSubstep(startedAt, steps) {
    if (this.accumulator < this.config.speed.fixedStep) {
      return false;
    }

    if (steps >= this.config.speed.maxSubsteps) {
      return false;
    }

    return performance.now() - startedAt < this.config.speed.cpuBudgetMs;
  }

  runSubstep(deltaTime) {
    this.generationTime += deltaTime;

    for (const organism of this.organisms) {
      organism.update(deltaTime, this.rule);
    }

    this.predatorManager.update(deltaTime, this.organisms);
  }

  spawnGeneration(genomes) {
    const spawnRadius = this.config.arenaSize * 0.18;

    for (let index = 0; index < genomes.length; index += 1) {
      const organism = new Organism({
        id: index,
        genome: genomes[index],
        topology: this.config.topology,
        sensors: this.sensors,
        motor: this.motor,
        random: this.random,
      });

      organism.spawnWithin(spawnRadius);
      this.organisms.push(organism);
      this.scene.add(organism.mesh);
      this.trails.register(organism);
    }
  }

  reuseGeneration(genomes) {
    const spawnRadius = this.config.arenaSize * 0.18;

    for (let index = 0; index < this.organisms.length; index += 1) {
      const organism = this.organisms[index];
      organism.revive(genomes[index], this.config.topology);
      organism.spawnWithin(spawnRadius);
    }

    this.trails.startGeneration(
      this.organisms,
      this.config.trails.visible && this.config.trails.preserveHistory,
    );
  }

  advanceGeneration() {
    this.lastGenerationResult = this.getGenerationResult();
    const nextGeneration = this.evolver.nextGeneration(this.organisms);
    this.generation += 1;
    this.generationTime = 0;
    this.generationComposition = nextGeneration.stats;
    this.rule.reset();
    this.reuseGeneration(nextGeneration.genomes);
  }

  shouldAdvanceGeneration() {
    if (this.generationTime >= this.config.generationDuration) {
      return true;
    }

    return this.getAliveCount() === 0;
  }

  updateCenterOfLife() {
    this.centerOfLife.set(0, 0, 0);
    let count = 0;

    for (const organism of this.organisms) {
      if (!organism.alive) {
        continue;
      }

      this.centerOfLife.add(organism.position);
      count += 1;
    }

    if (count === 0) {
      return;
    }

    this.centerOfLife.divideScalar(count);
  }

  getAliveCount() {
    return this.organisms.reduce((count, organism) => count + (organism.alive ? 1 : 0), 0);
  }

  getStats() {
    const alive = this.getAliveCount();
    const dead = this.organisms.length - alive;
    const fitnessTotal = this.organisms.reduce((sum, organism) => sum + organism.fitness, 0);
    const bestFitness = this.organisms.reduce(
      (best, organism) => Math.max(best, organism.fitness),
      0,
    );
    const currentGenerationResult = this.getGenerationResult({
      bestFitness,
      averageFitness: fitnessTotal / this.organisms.length,
    });

    return {
      generation: this.generation,
      alive,
      dead,
      alivePercent: (alive / this.organisms.length) * 100,
      deadPercent: (dead / this.organisms.length) * 100,
      bestFitness,
      averageFitness: fitnessTotal / this.organisms.length,
      averageEnergy: this.getAverageEnergy(),
      foodAvailable: this.foodManager.getAvailableCount(),
      foodCollected: this.foodManager.totalCollected,
      predatorKills: this.predatorManager.getKills(),
      predatorReward: this.predatorManager.getReward(),
      generationComposition: this.generationComposition,
      lastGenerationResult: this.lastGenerationResult,
      comparison: this.getGenerationComparison(currentGenerationResult),
      generationTime: this.generationTime,
      seed: this.config.seed,
      arenaSize: this.config.arenaSize,
      network: this.config.topology.join('-'),
      paused: this.paused,
      centerOfLife: this.centerOfLife,
      selectedOrganism: this.getSelectedStats(),
    };
  }

  getSelectableMeshes() {
    return [
      ...this.organisms.map((organism) => organism.mesh),
      ...this.predatorManager.predators.map((predator) => predator.mesh),
    ];
  }

  selectFromObject(object) {
    const selectable = this.findSelectableFromObject(object);
    this.selectedOrganism = selectable?.type === 'organism' && selectable.value.alive
      ? selectable.value
      : null;
    this.selectedPredator = selectable?.type === 'predator' ? selectable.value : null;
  }

  findSelectableFromObject(object) {
    let current = object;

    while (current) {
      if (current.userData?.organism) {
        return { type: 'organism', value: current.userData.organism };
      }

      if (current.userData?.predator) {
        return { type: 'predator', value: current.userData.predator };
      }

      current = current.parent;
    }

    return null;
  }

  getSelectedStats() {
    if (this.selectedPredator) {
      return this.getSelectedPredatorStats();
    }

    if (!this.selectedOrganism?.alive) {
      return null;
    }

    const organism = this.selectedOrganism;
    const food = this.foodManager.getNearest(organism.position);
    const predator = this.predatorManager.getNearestPredator(organism.position);
    const obstacle = this.obstacleManager.getNearest(organism.position);
    const outputs = organism.lastOutputs ?? [];

    return {
      type: 'Organismo',
      id: organism.id,
      energy: organism.energy,
      fitness: organism.fitness,
      age: organism.age,
      foodEaten: organism.foodEaten,
      foodDistance: food.distance,
      predatorDistance: predator.distance,
      obstacleDistance: obstacle?.distance ?? 0,
      outputMove: outputs[2] ?? 0,
      outputTurn: (outputs[1] ?? 0) - (outputs[0] ?? 0),
      outputBrake: outputs[3] ?? 0,
    };
  }

  getSelectedPredatorStats() {
    const predator = this.selectedPredator;
    const target = predator.target?.alive ? predator.target : null;

    return {
      type: 'Predador',
      id: this.predatorManager.predators.indexOf(predator),
      energy: null,
      fitness: predator.reward,
      age: 0,
      foodEaten: predator.kills,
      foodDistance: 0,
      predatorDistance: target ? predator.position.distanceTo(target.position) : 0,
      obstacleDistance: this.obstacleManager.getNearest(predator.position)?.distance ?? 0,
      outputMove: predator.velocity.length(),
      outputTurn: 0,
      outputBrake: 0,
    };
  }

  getAverageEnergy() {
    const total = this.organisms.reduce((sum, organism) => sum + organism.energy, 0);
    return total / this.organisms.length;
  }

  getGenerationResult(overrides = {}) {
    const result = this.createEmptyGenerationResult();
    const lineageCounts = new Map();
    let fitnessTotal = 0;
    let ageTotal = 0;
    let foodTotal = 0;

    for (const organism of this.organisms) {
      result.bestFitness = Math.max(result.bestFitness, organism.fitness);
      fitnessTotal += organism.fitness;
      ageTotal += organism.age;
      foodTotal += organism.foodEaten;

      if (organism.alive) {
        result.survivors += 1;
      }

      if (organism.deathReason === 'predator') {
        result.predatorDeaths += 1;
      }

      if (organism.deathReason === 'map') {
        result.mapDeaths += 1;
      }

      if (organism.deathReason === 'energy') {
        result.energyDeaths += 1;
      }

      if (organism.deathReason === 'obstacle') {
        result.obstacleDeaths += 1;
      }

      if (organism.deathReason === 'age') {
        result.ageDeaths += 1;
      }

      const lineage = organism.genome.lineageHue === null
        ? 'white'
        : organism.genome.lineageHue.toFixed(2);
      lineageCounts.set(lineage, (lineageCounts.get(lineage) ?? 0) + 1);
    }

    result.averageFitness = fitnessTotal / this.organisms.length;
    result.averageLifetime = ageTotal / this.organisms.length;
    result.foodCollected = foodTotal;
    result.dominantLineagePercent = this.getDominantLineagePercent(lineageCounts);
    Object.assign(result, overrides);
    return result;
  }

  getGenerationComparison(current) {
    const previous = this.lastGenerationResult;
    const ready = this.generation > 1;

    return {
      ready,
      fitnessDelta: ready ? current.averageFitness - previous.averageFitness : 0,
      foodDelta: ready ? current.foodCollected - previous.foodCollected : 0,
      survivorDelta: ready ? current.survivors - previous.survivors : 0,
      predatorDeathDelta: ready ? current.predatorDeaths - previous.predatorDeaths : 0,
      obstacleDeathDelta: ready ? current.obstacleDeaths - previous.obstacleDeaths : 0,
      lifetimeDelta: ready ? current.averageLifetime - previous.averageLifetime : 0,
    };
  }

  getDominantLineagePercent(lineageCounts) {
    let largest = 0;

    for (const count of lineageCounts.values()) {
      largest = Math.max(largest, count);
    }

    return (largest / this.organisms.length) * 100;
  }

  createEmptyGenerationResult() {
    return {
      survivors: 0,
      predatorDeaths: 0,
      mapDeaths: 0,
      energyDeaths: 0,
      obstacleDeaths: 0,
      ageDeaths: 0,
      dominantLineagePercent: 0,
      bestFitness: 0,
      averageFitness: 0,
      averageLifetime: 0,
      foodCollected: 0,
    };
  }

  setPaused(paused) {
    this.paused = paused;
  }

  togglePause() {
    this.paused = !this.paused;
  }

  setSpeed(speed) {
    this.speed = speed * this.config.speed.simulationScale;
  }

  setArenaSize(arenaSize) {
    this.config.arenaSize = arenaSize;
    this.sensors.arenaSize = arenaSize;
    this.rule.arenaSize = arenaSize;
    this.foodManager.setArenaSize(arenaSize);
    this.obstacleManager.setArenaSize(arenaSize);
    this.predatorManager.setArenaSize(arenaSize);
  }

  setFoodCount(foodCount) {
    this.config.food.count = foodCount;
    this.foodManager.setFoodCount(foodCount);
  }

  setTopology(topology) {
    this.config.topology = [...topology];
    this.evolver = new Evolver({
      topology: this.config.topology,
      config: this.config.evolution,
      random: this.random,
    });
    this.resetPopulation();
  }

  setTrailHistoryEnabled(enabled) {
    this.config.trails.preserveHistory = enabled;

    if (enabled) {
      return;
    }

    this.trails.clearArchived();
  }

  setTrailsVisible(visible) {
    this.config.trails.visible = visible;
    this.trails.setVisible(visible);

    if (visible) {
      return;
    }

    this.trails.clear();
    this.trails.clearArchived();
  }

  setSeed(seed) {
    this.config.seed = seed;
    this.random.reset(seed);
    this.evolver = new Evolver({
      topology: this.config.topology,
      config: this.config.evolution,
      random: this.random,
    });
    this.generation = 1;
    this.generationTime = 0;
    this.accumulator = 0;
    this.paused = false;
    this.selectedOrganism = null;
    this.selectedPredator = null;
    this.rule.reset();
    this.obstacleManager.rebuild();
    this.foodManager.reset();
    this.predatorManager.reset();
    const genomes = this.evolver.createInitialPopulation(this.config.populationSize);
    this.reuseGeneration(genomes);
    this.trails.clearArchived();
    this.resetGenerationStats();
  }

  placeAt(mode, position) {
    if (!this.isInsideArena(position)) {
      return;
    }

    if (mode === 'food') {
      this.foodManager.addFoodAt(position);
      this.config.food.count = this.foodManager.getAvailableCount();
      return;
    }

    if (mode === 'mountain') {
      this.obstacleManager.addMountainAt(position);
      return;
    }

    if (mode === 'lake') {
      this.obstacleManager.addLakeAt(position);
    }
  }

  isInsideArena(position) {
    const radius = this.config.arenaSize * 0.5;
    return position.x * position.x + position.z * position.z <= radius * radius;
  }

  reset() {
    this.random.reset(this.config.seed);
    this.evolver = new Evolver({
      topology: this.config.topology,
      config: this.config.evolution,
      random: this.random,
    });
    this.generation = 1;
    this.generationTime = 0;
    this.accumulator = 0;
    this.paused = false;
    this.selectedOrganism = null;
    this.selectedPredator = null;
    this.rule.reset();
    this.obstacleManager.rebuild();
    this.foodManager.reset();
    this.predatorManager.reset();
    const genomes = this.evolver.createInitialPopulation(this.config.populationSize);
    this.reuseGeneration(genomes);
    this.trails.clearArchived();
    this.resetGenerationStats();
  }

  resetPopulation() {
    this.generation = 1;
    this.generationTime = 0;
    this.accumulator = 0;
    this.selectedOrganism = null;
    this.selectedPredator = null;
    this.rule.reset();
    this.predatorManager.reset();
    const genomes = this.evolver.createInitialPopulation(this.config.populationSize);
    this.reuseGeneration(genomes);
    this.trails.clearArchived();
    this.resetGenerationStats();
  }

  resetGenerationStats() {
    this.generationComposition = {
      elite: 0,
      inherited: 0,
      newcomers: this.config.populationSize,
      childrenFromTop1: 0,
      childrenFromTop5: 0,
    };
    this.lastGenerationResult = this.createEmptyGenerationResult();
  }

  dispose() {
    for (const organism of this.organisms) {
      this.scene.remove(organism.mesh);
      organism.dispose();
    }

    this.organisms.length = 0;
    this.overlay.dispose();
    this.trails.dispose();
    this.foodManager.dispose();
    this.obstacleManager.dispose();
    this.predatorManager.dispose();
  }
}
