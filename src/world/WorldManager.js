import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
} from 'three';
import { Chunk } from './Chunk.js';
import { ProceduralGenerator } from '../procedural/ProceduralGenerator.js';

export class WorldManager {
  constructor({ scene, config }) {
    this.scene = scene;
    this.config = config;
    this.generator = new ProceduralGenerator({ seed: config.seed });
    this.group = new Group();
    this.activeChunks = new Map();
    this.scene.add(this.group);
  }

  setup() {
    this.rebuildVisuals();
    this.activeChunks.set('0:0', new Chunk({ x: 0, z: 0, seed: this.config.seed }));
  }

  rebuildVisuals() {
    this.clearVisuals();
    this.createGlobe();
    this.createGround();
    this.createGrid();
    this.createBounds();
  }

  reset() {
    for (const chunk of this.activeChunks.values()) {
      chunk.dispose();
    }

    this.activeChunks.clear();
    this.activeChunks.set('0:0', new Chunk({ x: 0, z: 0, seed: this.config.seed }));
  }

  setArenaSize(arenaSize) {
    this.config.arenaSize = arenaSize;
    this.rebuildVisuals();
  }

  setSeed(seed) {
    this.config.seed = seed;
    this.generator = new ProceduralGenerator({ seed });
    this.rebuildVisuals();
    this.reset();
  }

  clearVisuals() {
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      this.disposeObject(child);
    }
  }

  createGround() {
    const geometry = new CircleGeometry(this.config.arenaSize * 0.5, 96);
    const material = new MeshStandardMaterial({
      color: 0x172126,
      roughness: 0.85,
      metalness: 0,
    });
    const ground = new Mesh(geometry, material);

    ground.rotation.x = -Math.PI * 0.5;
    ground.position.y = 0.018;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  createGlobe() {
    const radius = this.config.planet.radius;
    const surfaceY = -this.config.planet.surfaceOffset;
    const geometry = new SphereGeometry(radius, 96, 48);
    const material = new MeshStandardMaterial({
      map: this.createPlanetTexture(),
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
    });
    const globe = new Mesh(geometry, material);

    globe.position.set(0, surfaceY - radius, 0);
    globe.receiveShadow = true;
    this.group.add(globe);
  }

  createGrid() {
    const radius = this.config.arenaSize * 0.5;
    const divisions = 20;
    const positions = [];

    this.addConcentricGrid(positions, radius, divisions);
    this.addRadialGrid(positions, radius, 24);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const grid = new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0x223943, transparent: true, opacity: 0.66 }),
    );

    grid.position.y = 0.035;
    this.group.add(grid);
  }

  createBounds() {
    const radius = this.config.arenaSize * 0.5;
    const positions = [];
    const segments = 160;

    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const edges = new LineLoop(
      geometry,
      new LineBasicMaterial({ color: new Color(0x70d6ff), transparent: true, opacity: 0.45 }),
    );

    edges.position.set(0, 0.08, 0);
    this.group.add(edges);
  }

  addConcentricGrid(positions, radius, divisions) {
    const segments = 120;

    for (let ring = 1; ring <= divisions; ring += 1) {
      const ringRadius = (radius / divisions) * ring;

      for (let index = 0; index < segments; index += 1) {
        const a = (index / segments) * Math.PI * 2;
        const b = ((index + 1) / segments) * Math.PI * 2;
        positions.push(
          Math.sin(a) * ringRadius, 0, Math.cos(a) * ringRadius,
          Math.sin(b) * ringRadius, 0, Math.cos(b) * ringRadius,
        );
      }
    }
  }

  addRadialGrid(positions, radius, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      positions.push(0, 0, 0, Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    }
  }

  createPlanetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);

    gradient.addColorStop(0, '#17272a');
    gradient.addColorStop(0.45, '#0f1d20');
    gradient.addColorStop(1, '#091113');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 260; index += 1) {
      const a = this.noise(index * 3.17);
      const b = this.noise(index * 7.91);
      const c = this.noise(index * 13.43);
      const x = a * canvas.width;
      const y = b * canvas.height;
      const width = 18 + c * 90;
      const height = 3 + this.noise(index * 17.19) * 14;
      context.fillStyle = this.noise(index * 23.71) > 0.55
        ? 'rgba(42, 78, 63, 0.38)'
        : 'rgba(24, 58, 73, 0.34)';
      context.beginPath();
      context.ellipse(x, y, width, height, this.noise(index * 29.37) * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  noise(value) {
    const raw = Math.sin(value + this.config.seed * 0.001) * 43758.5453;
    return raw - Math.floor(raw);
  }

  getActiveChunkCount() {
    return this.activeChunks.size;
  }

  dispose() {
    this.reset();
    this.clearVisuals();
    this.scene.remove(this.group);
  }

  disposeObject(root) {
    root.traverse((object) => {
      if (!object.isMesh && !object.isLineSegments && !object.isLine) {
        return;
      }

      object.geometry.dispose();

      if (object.material?.map) {
        object.material.map.dispose();
      }

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
        return;
      }

      object.material.dispose();
    });
  }
}
