import * as THREE from 'three';
import { modelFitDistance } from './model-framing';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type ProjectModelView = 'perspective' | 'top' | 'garden';
export type ProjectModelExperience = { setView: (view: ProjectModelView) => void; setActive: (active: boolean) => void; move: (key: string) => void; dispose: () => void };

/** Architectural presentation of the supplied file, not a structural or entitlement model. */
export async function createProjectModelViewer(host: HTMLElement, signal: AbortSignal, onLost: () => void): Promise<ProjectModelExperience> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#172a31');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.screenSpacePanning = false;
  controls.zoomSpeed = 0.75;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#dbe9ed', '#48555b', 0.7));
  const fill = new THREE.DirectionalLight('#dce8ff', 0.8);
  fill.position.set(35, 25, -30); scene.add(fill);
  const sun = new THREE.DirectionalLight('#fff1da', 2.6);
  sun.position.set(-30, 65, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(window.innerWidth < 700 ? 1024 : 2048, window.innerWidth < 700 ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 0.5, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  let disposed = false, frame = 0;
  let refit = () => {};
  const draw = () => { if (!disposed && !frame) frame = requestAnimationFrame(() => { frame = 0; if (!disposed) renderer.render(scene, camera); }); };
  const lost = (event: Event) => { event.preventDefault(); dispose(); onLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  controls.addEventListener('change', draw);
  const resize = new ResizeObserver(() => { const width = host.clientWidth, height = host.clientHeight; if (width && height && !disposed) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); if (!controls.enabled) refit(); draw(); } });
  resize.observe(host);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); resize.disconnect();
    signal.removeEventListener('abort', dispose);
    controls.removeEventListener('change', draw); controls.dispose();
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    const textures = new Set<THREE.Texture>(), materials = new Set<THREE.Material>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
    for (const material of materials) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); }
    for (const texture of textures) texture.dispose();
    environment.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
  }
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const response = await fetch('/models/arkem-residential.glb', { signal });
    if (!response.ok) throw new Error('Model unavailable');
    const model = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '/models/');
    scene.add(model.scene);
    if (signal.aborted || disposed) {
      // The parser can finish after cancellation; dispose the late resources as well.
      model.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose(); material.dispose(); } } });
      throw new DOMException('Aborted', 'AbortError');
    }
    const box = new THREE.Box3().setFromObject(model.scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() === 0) throw new Error('Invalid model');
    const span = Math.max(size.x, size.z, size.y);
    model.scene.traverse(object => { if (object instanceof THREE.Mesh) {
      object.castShadow = true; object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = material.transparent ? 0.04 : 0;
          material.roughness = material.transparent ? 0.18 : 0.72;
          if (material.map) { material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); material.map.needsUpdate = true; }
        }
      }
    } });
    // Presentation plinth only: source geometry and all three model-axis scales stay unchanged.
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(size.x + 1.4, 0.38, size.z + 1.4), new THREE.MeshStandardMaterial({ color: '#85715b', roughness: 0.62, metalness: 0.15 }));
    plinth.position.set(center.x, box.min.y - 0.22, center.z); plinth.castShadow = true; plinth.receiveShadow = true; scene.add(plinth);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 30, span * 30), new THREE.MeshStandardMaterial({ color: '#152c34', roughness: 0.94 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, box.min.y - 0.45, center.z); floor.receiveShadow = true; scene.add(floor);
    controls.minDistance = span * 0.14; controls.maxDistance = span * 4;
    let currentView: ProjectModelView = 'perspective';
    const setView = (view: ProjectModelView) => {
      currentView = view;
      controls.target.copy(center);
      const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), 0.2);
      const offset = (view === 'top' ? new THREE.Vector3(0.001, 1, 0.001) : view === 'garden' ? new THREE.Vector3(0.85, 0.32, 0.82) : new THREE.Vector3(0.78, 0.75, 0.9)).normalize();
      const distance = modelFitDistance(size, offset, camera.fov, aspect);
      camera.position.copy(controls.target).addScaledVector(offset, distance);
      camera.aspect = aspect; camera.updateProjectionMatrix();
      camera.lookAt(controls.target); controls.update(); draw();
    };
    refit = () => setView(currentView);
    setView('perspective');
    renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
    camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1); camera.updateProjectionMatrix(); draw();
    return { setView, setActive: active => { controls.enabled = active; }, move: key => {
      const offset = camera.position.clone().sub(controls.target);
      if (key === 'ArrowLeft' || key === 'ArrowRight') offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), key === 'ArrowLeft' ? -0.1 : 0.1);
      if (key === '+' || key === '=' || key === '-') offset.setLength(THREE.MathUtils.clamp(offset.length() * (key === '-' ? 1.1 : 0.9), controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset); camera.lookAt(controls.target); controls.update(); draw();
    }, dispose };
  } catch (error) { dispose(); throw error; }
}
