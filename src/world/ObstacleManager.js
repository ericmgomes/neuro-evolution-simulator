import {
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from 'three';

const lakeColor = new Color(0x1f6f9a);
const mountainColor = new Color(0x6d6153);

export class ObstacleManager {
  constructor({ scene, config, random }) {
    this.scene = scene;
    this.config = config;
    this.random = random;
    this.group = new Group();
    this.lakes = [];
    this.mountains = [];
    this.scene.add(this.group);
  }

  setup() {
    this.rebuild();
  }

  rebuild() {
    this.clear();
    this.createLakes();
    this.createMountains();
  }

  createLakes() {
    const size = this.config.arenaSize;
    const material = this.createLakeMaterial();
    const specs = [
      { x: -size * 0.18, z: -size * 0.02, radius: size * 0.08, depth: 0.38 },
      { x: size * 0.2, z: size * 0.12, radius: size * 0.07, depth: 0.34 },
    ];

    for (const spec of specs) {
      this.tryAddLake(spec, material);
    }

    material.dispose();
  }

  createMountains() {
    const size = this.config.arenaSize;
    const material = this.createMountainMaterial();
    const specs = [
      { x: -size * 0.3, z: size * 0.16, radius: size * 0.08, height: size * 0.12 },
      { x: size * 0.08, z: -size * 0.26, radius: size * 0.07, height: size * 0.1 },
      { x: size * 0.32, z: size * 0.28, radius: size * 0.07, height: size * 0.11 },
    ];

    for (const spec of specs) {
      this.tryAddMountain(spec, material);
    }

    material.dispose();
  }

  addLakeAt(position) {
    this.tryAddLake({
      x: position.x,
      z: position.z,
      radius: Math.max(2.8, this.config.arenaSize * 0.08),
      depth: 0.44,
    });
  }

  tryAddLake(spec, material = null) {
    const contour = this.createOrganicContour(spec.radius);

    if (this.isOutsideArena(spec, contour) || this.overlapsAny(spec, contour)) {
      return false;
    }

    const lakeMaterial = material ? material.clone() : this.createLakeMaterial();
    const mesh = new Mesh(
      this.createLakeGeometry(contour, spec.depth),
      lakeMaterial,
    );

    mesh.position.set(spec.x, -spec.depth + 0.02, spec.z);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.lakes.push(this.createObstacleRecord(spec, contour, mesh));
    return true;
  }

  addMountainAt(position) {
    this.tryAddMountain({
      x: position.x,
      z: position.z,
      radius: Math.max(2.6, this.config.arenaSize * 0.07),
      height: Math.max(4.2, this.config.arenaSize * 0.12),
    });
  }

  tryAddMountain(spec, material = null) {
    const contour = this.createOrganicContour(spec.radius);

    if (this.isOutsideArena(spec, contour) || this.overlapsAny(spec, contour)) {
      return false;
    }

    const mountainMaterial = material ? material.clone() : this.createMountainMaterial();
    const mesh = new Mesh(this.createMountainGeometry(contour, spec.height), mountainMaterial);

    mesh.position.set(spec.x, 0.02, spec.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.mountains.push(this.createObstacleRecord(spec, contour, mesh));
    return true;
  }

  createOrganicContour(radius) {
    const pointCount = this.random.integer(20, 32);
    const stretchX = this.random.range(0.75, 1.35);
    const stretchZ = this.random.range(0.75, 1.35);
    const phaseA = this.random.range(0, Math.PI * 2);
    const phaseB = this.random.range(0, Math.PI * 2);
    const phaseC = this.random.range(0, Math.PI * 2);
    const points = [];

    for (let index = 0; index < pointCount; index += 1) {
      const angle = (index / pointCount) * Math.PI * 2;
      const wobble = 1
        + Math.sin(angle * 2 + phaseA) * 0.16
        + Math.sin(angle * 3 + phaseB) * 0.11
        + Math.sin(angle * 5 + phaseC) * 0.07
        + this.random.signed() * 0.08;
      points.push({
        x: Math.cos(angle) * radius * stretchX * Math.max(0.62, wobble),
        z: Math.sin(angle) * radius * stretchZ * Math.max(0.62, wobble),
      });
    }

    return this.smoothContour(points);
  }

  smoothContour(points) {
    const smoothed = [];

    for (let index = 0; index < points.length; index += 1) {
      const previous = points[(index - 1 + points.length) % points.length];
      const current = points[index];
      const next = points[(index + 1) % points.length];

      smoothed.push({
        x: previous.x * 0.18 + current.x * 0.64 + next.x * 0.18,
        z: previous.z * 0.18 + current.z * 0.64 + next.z * 0.18,
      });
    }

    return smoothed;
  }

  createLakeGeometry(contour, depth) {
    const shape = new Shape();
    const first = contour[0];

    shape.moveTo(first.x, first.z);

    for (let index = 1; index <= contour.length; index += 1) {
      const current = contour[index % contour.length];
      const next = contour[(index + 1) % contour.length];
      const controlX = (current.x + next.x) * 0.5;
      const controlZ = (current.z + next.z) * 0.5;

      shape.quadraticCurveTo(current.x, current.z, controlX, controlZ);
    }

    shape.closePath();

    return new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: Math.min(0.34, depth * 0.65),
      bevelThickness: Math.min(0.25, depth * 0.18),
    });
  }

  createMountainGeometry(contour, height) {
    const vertices = [];
    const indices = [];
    const innerStart = contour.length;
    const peakIndex = contour.length * 2;

    for (const point of contour) {
      vertices.push(point.x, 0, point.z);
    }

    for (const point of contour) {
      vertices.push(point.x * 0.45, height * 0.34, point.z * 0.45);
    }

    vertices.push(
      this.random.signed() * 0.24,
      height,
      this.random.signed() * 0.24,
    );

    for (let index = 0; index < contour.length; index += 1) {
      const next = (index + 1) % contour.length;
      indices.push(index, next, innerStart + index);
      indices.push(next, innerStart + next, innerStart + index);
      indices.push(innerStart + index, innerStart + next, peakIndex);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  createObstacleRecord(spec, contour, mesh) {
    return {
      ...spec,
      contour,
      safetyRadius: this.getMaxContourRadius(contour) * 1.22,
      mesh,
    };
  }

  getMaxContourRadius(contour) {
    let radius = 0;

    for (const point of contour) {
      radius = Math.max(radius, Math.sqrt(point.x * point.x + point.z * point.z));
    }

    return radius;
  }

  isOutsideArena(spec, contour) {
    const radius = this.config.arenaSize * 0.5;

    for (const point of contour) {
      const x = spec.x + point.x;
      const z = spec.z + point.z;

      if (x * x + z * z > radius * radius) {
        return true;
      }
    }

    return false;
  }

  overlapsAny(spec, contour = null) {
    const obstacles = [...this.lakes, ...this.mountains];
    const radius = contour ? this.getMaxContourRadius(contour) : spec.radius;

    for (const obstacle of obstacles) {
      const dx = spec.x - obstacle.x;
      const dz = spec.z - obstacle.z;
      const minDistance = radius + obstacle.safetyRadius;

      if (dx * dx + dz * dz < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }

  createLakeMaterial() {
    return new MeshStandardMaterial({
      color: lakeColor,
      emissive: 0x062034,
      roughness: 0.42,
      transparent: true,
      opacity: 0.88,
    });
  }

  createMountainMaterial() {
    return new MeshStandardMaterial({
      color: mountainColor,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    });
  }

  getNearest(position) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const lake of this.lakes) {
      const distance = Math.max(0, this.getContourDistance(position, lake));

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { type: 'lake', x: lake.x, z: lake.z, distance };
      }
    }

    for (const mountain of this.mountains) {
      const distance = Math.max(0, this.getContourDistance(position, mountain));

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { type: 'mountain', x: mountain.x, z: mountain.z, distance };
      }
    }

    return nearest;
  }

  getCollision(position) {
    for (const mountain of this.mountains) {
      if (this.getContourDistance(position, mountain) <= 0) {
        return { type: 'mountain' };
      }
    }

    for (const lake of this.lakes) {
      if (this.getContourDistance(position, lake) <= 0) {
        return { type: 'lake' };
      }
    }

    return null;
  }

  getContourDistance(position, obstacle) {
    const local = {
      x: position.x - obstacle.x,
      z: position.z - obstacle.z,
    };
    const distance = this.getDistanceToContour(local, obstacle.contour);

    if (this.isInsideContour(local, obstacle.contour)) {
      return -distance;
    }

    return distance;
  }

  isInsideContour(point, contour) {
    let inside = false;

    for (let index = 0, previous = contour.length - 1; index < contour.length; previous = index++) {
      const a = contour[index];
      const b = contour[previous];
      const intersects = ((a.z > point.z) !== (b.z > point.z))
        && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  getDistanceToContour(point, contour) {
    let nearest = Infinity;

    for (let index = 0; index < contour.length; index += 1) {
      const a = contour[index];
      const b = contour[(index + 1) % contour.length];
      nearest = Math.min(nearest, this.getDistanceToSegment(point, a, b));
    }

    return nearest;
  }

  getDistanceToSegment(point, a, b) {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = point.x - a.x;
    const apz = point.z - a.z;
    const lengthSq = abx * abx + abz * abz;
    const t = lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, (apx * abx + apz * abz) / lengthSq));
    const x = a.x + abx * t;
    const z = a.z + abz * t;
    const dx = point.x - x;
    const dz = point.z - z;

    return Math.sqrt(dx * dx + dz * dz);
  }

  setArenaSize(arenaSize) {
    this.config.arenaSize = arenaSize;
    this.rebuild();
  }

  clear() {
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      child.geometry.dispose();
      child.material.dispose();
    }

    this.lakes.length = 0;
    this.mountains.length = 0;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
