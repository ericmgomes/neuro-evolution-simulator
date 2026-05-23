import { SIMULATION_CONFIG } from '../config.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { Renderer } from '../rendering/Renderer.js';
import { HUD } from '../ui/HUD.js';
import { WorldManager } from '../world/WorldManager.js';
import { Simulation } from './Simulation.js';

export class App {
  constructor({ root, config = SIMULATION_CONFIG }) {
    this.root = root;
    this.config = config;
    this.shell = null;
    this.renderer = null;
    this.world = null;
    this.physics = null;
    this.simulation = null;
    this.hud = null;
    this.frameId = null;
    this.placementMode = null;
    this.handleCanvasPointerDown = (event) => this.handleCanvasClick(event);
  }

  start() {
    if (!this.root) {
      return;
    }

    this.createShell();
    this.renderer = new Renderer({ root: this.shell });
    this.renderer.setup();
    this.renderer.renderer.domElement.addEventListener('pointerdown', this.handleCanvasPointerDown);
    this.world = new WorldManager({
      scene: this.renderer.scene,
      config: this.config,
    });
    this.physics = new PhysicsWorld();
    this.simulation = new Simulation({
      scene: this.renderer.scene,
      config: this.config,
    });
    this.hud = new HUD({
      root: this.shell,
      config: this.config,
      onTogglePause: () => this.simulation.togglePause(),
      onReset: () => this.reset(),
      onSpeedChange: (speed) => this.simulation.setSpeed(speed),
      onArenaSizeChange: (arenaSize) => this.setArenaSize(arenaSize),
      onFoodCountChange: (foodCount) => this.simulation.setFoodCount(foodCount),
      onPlacementModeChange: (mode) => this.setPlacementMode(mode),
      onTopologyChange: (topology) => this.setTopology(topology),
      onTrailsVisibleChange: (visible) => this.simulation.setTrailsVisible(visible),
      onTrailHistoryChange: (enabled) => this.simulation.setTrailHistoryEnabled(enabled),
    });

    this.world.setup();
    this.simulation.setup();
    this.hud.setup();
    this.loop();
  }

  createShell() {
    this.shell = document.createElement('main');
    this.shell.className = 'sim-shell';
    this.root.appendChild(this.shell);
  }

  loop() {
    const deltaTime = this.renderer.clock.getDelta();

    this.updateNeural(deltaTime);
    this.updatePhysics(deltaTime);
    this.updateLogic();
    this.render();
    this.frameId = window.requestAnimationFrame(() => this.loop());
  }

  updateNeural(deltaTime) {
    this.simulation.update(deltaTime);
  }

  updatePhysics(deltaTime) {
    this.physics.update(deltaTime);
  }

  updateLogic() {
    const stats = this.simulation.getStats();
    this.renderer.updateCameraTarget(stats.centerOfLife);
    this.hud.update(stats);
  }

  render() {
    this.renderer.render();
  }

  reset() {
    this.world.reset();
    this.simulation.reset();
  }

  setArenaSize(arenaSize) {
    this.simulation.setArenaSize(arenaSize);
    this.world.setArenaSize(arenaSize);
  }

  setPlacementMode(mode) {
    this.placementMode = this.placementMode === mode ? null : mode;
    this.hud.setPlacementMode(this.placementMode);
  }

  setTopology(topology) {
    if (this.config.topology.join('-') === topology.join('-')) {
      return true;
    }

    const confirmed = window.confirm(
      `Trocar a rede para ${topology.join('-')} vai resetar a população e iniciar uma nova genética. Continuar?`,
    );

    if (!confirmed) {
      return false;
    }

    this.simulation.setTopology(topology);
    return true;
  }

  handleCanvasClick(event) {
    if (!this.placementMode) {
      this.selectOrganism(event);
      return;
    }

    const point = this.renderer.getGroundPoint(event);

    if (!point) {
      return;
    }

    this.simulation.placeAt(this.placementMode, point);
  }

  selectOrganism(event) {
    const object = this.renderer.pickObject(event, this.simulation.getSelectableMeshes());
    this.simulation.selectFromObject(object);
  }

  dispose() {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
    }

    this.renderer.renderer.domElement.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    this.hud.dispose();
    this.simulation.dispose();
    this.world.dispose();
    this.physics.dispose();
    this.renderer.dispose();
    this.shell.remove();
  }
}
