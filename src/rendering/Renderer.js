import {
  AmbientLight,
  BufferGeometry,
  Clock,
  DirectionalLight,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  PCFSoftShadowMap,
  Plane,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Renderer {
  constructor({ root }) {
    this.root = root;
    this.scene = new Scene();
    this.clock = new Clock();
    this.camera = new PerspectiveCamera(55, 1, 0.1, 1200);
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.controls = null;
    this.resizeObserver = null;
    this.bottomSafeArea = 0;
    this.projectionOffsetY = -0.28;
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    this.renderHeight = 1;
    this.stars = null;
  }

  setup() {
    this.scene.background = null;
    this.camera.position.set(0, 62, 82);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.root.clientWidth, this.root.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.className = 'sim-canvas';
    this.root.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 26;
    this.controls.maxDistance = 180;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 0, 0);
    this.addLights();
    this.addStars();
    this.observeResize();
  }

  addLights() {
    const ambient = new AmbientLight(0xb9d7e8, 0.52);
    const sun = new DirectionalLight(0xffffff, 2.2);

    sun.position.set(28, 54, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    this.scene.add(ambient, sun);
  }

  addStars() {
    const geometry = new BufferGeometry();
    const positions = [];
    const count = 1200;
    const radius = 900;

    for (let index = 0; index < count; index += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const distance = radius * (0.72 + Math.random() * 0.28);

      positions.push(
        Math.sin(phi) * Math.cos(theta) * distance,
        Math.cos(phi) * distance,
        Math.sin(phi) * Math.sin(theta) * distance,
      );
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.stars = new Points(
      geometry,
      new PointsMaterial({
        color: 0xc8e6ff,
        size: 1.15,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
    );
    this.scene.add(this.stars);
  }

  observeResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    const safeArea = this.getBottomSafeArea(height);
    const renderHeight = Math.max(1, height - safeArea);

    this.renderHeight = renderHeight;
    this.camera.aspect = width / renderHeight;
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[9] = this.projectionOffsetY;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.renderer.setSize(width, height, false);
    this.renderer.setViewport(0, safeArea, width, renderHeight);
  }

  updateCameraTarget(position = new Vector3()) {
    this.controls.target.lerp(position, 0.03);
  }

  getBottomSafeArea(height) {
    return this.bottomSafeArea;
  }

  getGroundPoint(event) {
    this.updatePointerFromEvent(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const point = new Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, point);

    if (!hit) {
      return null;
    }

    return point;
  }

  pickObject(event, objects) {
    this.updatePointerFromEvent(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits[0]?.object ?? null;
  }

  updatePointerFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (localY > this.renderHeight) {
      this.pointer.set(999, 999);
      return;
    }

    this.pointer.x = (localX / rect.width) * 2 - 1;
    this.pointer.y = -(localY / this.renderHeight) * 2 + 1;
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.controls.dispose();

    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
