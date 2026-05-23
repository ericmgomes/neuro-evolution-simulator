import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  RingGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';

const start = new Vector3();
const end = new Vector3();

export class PerceptionOverlay {
  constructor({ scene, rule }) {
    this.scene = scene;
    this.rule = rule;
    this.group = new Group();
    this.lines = {
      food: this.createLine(0x79f28f),
      predator: this.createLine(0xff3b3b),
      obstacle: this.createLine(0x8fb3ff),
    };
    this.selector = this.createSelector();
    this.group.visible = false;
    this.group.add(this.lines.food, this.lines.predator, this.lines.obstacle, this.selector);
    this.scene.add(this.group);
  }

  update(organism) {
    if (!organism) {
      this.group.visible = false;
      return;
    }

    if (organism.target !== undefined) {
      this.updatePredator(organism);
      return;
    }

    if (!organism.alive) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.selector.position.set(organism.position.x, 0.08, organism.position.z);
    this.updateFoodLine(organism);
    this.updatePredatorLine(organism);
    this.updateObstacleLine(organism);
  }

  updatePredator(predator) {
    this.group.visible = true;
    this.selector.position.set(predator.position.x, 0.08, predator.position.z);
    this.lines.food.visible = false;
    this.lines.obstacle.visible = false;
    this.setLine(this.lines.predator, predator.position, predator.target?.position);
  }

  updateFoodLine(organism) {
    const nearest = this.rule.foodManager.getNearest(organism.position);
    this.setLine(this.lines.food, organism.position, nearest.item?.position);
  }

  updatePredatorLine(organism) {
    const nearest = this.rule.predatorManager.getNearestPredator(organism.position);
    this.setLine(this.lines.predator, organism.position, nearest.predator?.position);
  }

  updateObstacleLine(organism) {
    const nearest = this.rule.obstacleManager.getNearest(organism.position);

    if (!nearest) {
      this.lines.obstacle.visible = false;
      return;
    }

    end.set(nearest.x, 0.16, nearest.z);
    this.setLine(this.lines.obstacle, organism.position, end);
  }

  setLine(line, from, to) {
    if (!to) {
      line.visible = false;
      return;
    }

    line.visible = true;
    start.set(from.x, 0.18, from.z);
    end.set(to.x, 0.18, to.z);
    line.geometry.setAttribute('position', new Float32BufferAttribute([
      start.x, start.y, start.z,
      end.x, end.y, end.z,
    ], 3));
    line.geometry.attributes.position.needsUpdate = true;
  }

  createLine(hexColor) {
    return new Line(
      new BufferGeometry(),
      new LineBasicMaterial({
        color: new Color(hexColor),
        transparent: true,
        opacity: 0.78,
      }),
    );
  }

  createSelector() {
    const mesh = new Mesh(
      new RingGeometry(0.68, 0.9, 32),
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: 2,
      }),
    );
    mesh.rotation.x = -Math.PI * 0.5;
    return mesh;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!object.geometry) {
        return;
      }

      object.geometry.dispose();
      object.material.dispose();
    });
  }
}
