import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { clamp } from '../utils/math.js';

const trailColor = new Color();

export class TrailSystem {
  constructor({ scene, maxPoints = 18, minDistance = 0.85, maxArchivedGenerations = 5 }) {
    this.scene = scene;
    this.maxPoints = maxPoints;
    this.minDistanceSq = minDistance * minDistance;
    this.maxArchivedGenerations = maxArchivedGenerations;
    this.visible = false;
    this.trails = new Map();
    this.archivedGenerations = [];
  }

  register(organism) {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(this.maxPoints * 3);
    const material = new LineBasicMaterial({
      color: this.getColor(organism),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const line = new Line(geometry, material);

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);
    this.scene.add(line);
    this.trails.set(organism, this.createTrailRecord(line));
  }

  createTrailRecord(line) {
    return {
      line,
      points: [],
      lastPosition: new Vector3(),
    };
  }

  update(organisms) {
    if (!this.visible) {
      return;
    }

    for (const organism of organisms) {
      this.updateTrail(organism);
    }
  }

  updateTrail(organism) {
    const trail = this.trails.get(organism);

    if (!trail) {
      return;
    }

    if (!organism.alive) {
      trail.line.visible = false;
      return;
    }

    trail.line.visible = this.visible;
    trail.line.material.color.copy(this.getColor(organism));

    const point = this.getTrailPoint(organism);

    if (trail.points.length === 0) {
      this.pushPoint(trail, point);
      return;
    }

    if (trail.lastPosition.distanceToSquared(point) < this.minDistanceSq) {
      return;
    }

    this.pushPoint(trail, point);
  }

  pushPoint(trail, point) {
    trail.points.push(point.clone());
    trail.lastPosition.copy(point);

    while (trail.points.length > this.maxPoints) {
      trail.points.shift();
    }

    this.syncGeometry(trail);
  }

  syncGeometry(trail) {
    const attribute = trail.line.geometry.getAttribute('position');

    for (let index = 0; index < trail.points.length; index += 1) {
      const point = trail.points[index];
      attribute.setXYZ(index, point.x, point.y, point.z);
    }

    attribute.needsUpdate = true;
    trail.line.geometry.setDrawRange(0, trail.points.length);
    trail.line.geometry.computeBoundingSphere();
  }

  getTrailPoint(organism) {
    return new Vector3(organism.position.x, 0.12, organism.position.z);
  }

  getColor(organism) {
    if (organism.genome.lineageHue === null) {
      return trailColor.setHSL(0, 0, 0.78);
    }

    const lineageIntensity = clamp((organism.genome.lineageAge + 1) / 3, 0, 1);
    return trailColor.setHSL(organism.genome.lineageHue, 0.42 + lineageIntensity * 0.36, 0.56);
  }

  clear() {
    for (const trail of this.trails.values()) {
      trail.points.length = 0;
      trail.line.geometry.setDrawRange(0, 0);
      trail.line.visible = false;
    }
  }

  startGeneration(organisms, preserveHistory) {
    if (!preserveHistory) {
      this.clear();
      this.clearArchived();
      return;
    }

    this.archiveCurrentTrails();

    for (const organism of organisms) {
      this.register(organism);
    }

    this.pruneArchivedGenerations();
  }

  archiveCurrentTrails() {
    const current = [...this.trails.values()];
    const archived = current
      .filter((trail) => trail.points.length > 1);
    const discarded = current
      .filter((trail) => trail.points.length <= 1);

    if (archived.length === 0) {
      this.disposeCurrentTrails();
      return;
    }

    for (const trail of archived) {
      trail.line.visible = this.visible;
      trail.line.material.opacity = 0.24;
    }

    this.archivedGenerations.push(archived);
    this.disposeTrailList(discarded);
    this.trails.clear();
  }

  pruneArchivedGenerations() {
    while (this.archivedGenerations.length > this.maxArchivedGenerations) {
      const generation = this.archivedGenerations.shift();
      this.disposeTrailList(generation);
    }
  }

  clearArchived() {
    for (const generation of this.archivedGenerations) {
      this.disposeTrailList(generation);
    }

    this.archivedGenerations.length = 0;
  }

  setVisible(visible) {
    this.visible = visible;

    for (const trail of this.trails.values()) {
      trail.line.visible = visible && trail.points.length > 1;
    }

    for (const generation of this.archivedGenerations) {
      for (const trail of generation) {
        trail.line.visible = visible;
      }
    }
  }

  disposeCurrentTrails() {
    this.disposeTrailList([...this.trails.values()]);
    this.trails.clear();
  }

  disposeTrailList(trails) {
    for (const trail of trails) {
      this.scene.remove(trail.line);
      trail.line.geometry.dispose();
      trail.line.material.dispose();
    }
  }

  dispose() {
    this.disposeCurrentTrails();
    this.clearArchived();
  }
}
