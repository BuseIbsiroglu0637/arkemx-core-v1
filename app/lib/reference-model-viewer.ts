import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelFitDistance } from './model-framing';
import type { PresentationModel } from '../data/project-presentations';

export type ReferenceView = 'perspective' | 'top' | 'front';
export type ReferenceLayer = 'architecture' | 'structure';
export type ReferenceViewer = { setView: (view: ReferenceView) => void; setLayer: (layer: ReferenceLayer) => void; capture: () => string; move: (key: string) => void; dispose: () => void };

/** Supplied geometry is retained. Lighting, framing and ground are presentation only. */
export async function createReferenceViewer(host: HTMLElement, model: PresentationModel, signal: AbortSignal, onLost: () => void): Promise<ReferenceViewer> {
  if (signal.aborted || !host.isConnected) throw new DOMException('Aborted', 'AbortError');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dce4e5');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 10000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * .49;
  controls.screenSpacePanning = true;
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b7a80', 1.6));
  const keyLight = new THREE.DirectionalLight('#fff4e4', 2.0);
  keyLight.position.set(-1, 2, 1); scene.add(keyLight);
  const fill = new THREE.DirectionalLight('#e7f1ff', .6);
  fill.position.set(1, .8, -1); scene.add(fill);
  let disposed = false, frame = 0, currentView: ReferenceView = 'perspective';
  let box: THREE.Box3 | undefined;
  let suppliedModel: THREE.Object3D | undefined;
  function setLayer(layer: ReferenceLayer) {
    if (model.layers !== 'isil-villa' || !suppliedModel || disposed) return;
    const frameLayers = new Set(['FrameGround', 'FrameFirst', 'FrameRoof']);
    const architecturalLayers = new Set(['Foundation', 'GroundFloor', 'FirstFloor', 'Roof']);
    // The source model explicitly names its layer groups; no geometry is inferred or altered.
    suppliedModel.traverse(child => {
      if (frameLayers.has(child.name)) child.visible = layer === 'structure';
      else if (architecturalLayers.has(child.name)) child.visible = layer === 'architecture';
    });
    draw();
  }
  const draw = () => { if (!disposed && !frame) frame = requestAnimationFrame(() => { frame = 0; if (!disposed) renderer.render(scene, camera); }); };
  function disposeObject(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    object.traverse(child => { if (child instanceof THREE.Mesh) { geometries.add(child.geometry); (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m)); } });
    for (const material of materials) { Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); material.dispose(); }
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
  }
  const lost = (event: Event) => { event.preventDefault(); dispose(); onLost(); };
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    signal.removeEventListener('abort', dispose);
    controls.removeEventListener('change', draw); controls.dispose();
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    disposeObject(scene); renderer.dispose(); renderer.domElement.remove();
  }
  function setView(view: ReferenceView) {
    currentView = view;
    if (!box || disposed) return;
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const direction = (view === 'top' ? new THREE.Vector3(.001, 1, .001) : view === 'front' ? new THREE.Vector3(.001, .12, 1) : new THREE.Vector3(.85, .65, 1)).normalize();
    const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), .2);
    const distance = modelFitDistance(size, direction, camera.fov, aspect, 1.15);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.aspect = aspect; camera.updateProjectionMatrix(); camera.lookAt(center); controls.update(); draw();
  }
  const observer = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight || disposed) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    setView(currentView); draw();
  });
  observer.observe(host);
  controls.addEventListener('change', draw);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  signal.addEventListener('abort', dispose, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await fetch(model.src, { signal });
    if (!response.ok) throw new Error('Model yüklenemedi');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20_000_000 || buffer.byteLength !== model.bytes) throw new Error('Model bütünlüğü doğrulanamadı');
    const gltf = await new GLTFLoader().parseAsync(buffer, model.src.slice(0, model.src.lastIndexOf('/') + 1));
    if (signal.aborted || disposed) { disposeObject(gltf.scene); throw new DOMException('Aborted', 'AbortError'); }
    if (model.upAxis === 'z') gltf.scene.rotation.x = -Math.PI / 2;
    scene.add(gltf.scene);
    suppliedModel = gltf.scene;
    setLayer('architecture');
    gltf.scene.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(gltf.scene, true);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span <= 0) throw new Error('Model geometrisi geçersiz');
    camera.near = Math.max(span / 10000, .001); camera.far = span * 100;
    controls.minDistance = span * .04; controls.maxDistance = span * 5;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 15, span * 15), new THREE.MeshStandardMaterial({ color: '#c8d3d5', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(center.x, box.min.y - span * .005, center.z); scene.add(ground);
    renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
    setView('perspective');
    return { setView, setLayer, dispose, capture() { if (disposed) throw new Error('Model kapatıldı'); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }, move(key: string) {
      const offset = camera.position.clone().sub(controls.target);
      if (key === 'ArrowLeft' || key === 'ArrowRight') offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), key === 'ArrowLeft' ? -.12 : .12);
      if (key === '+' || key === '=' || key === '-') offset.setLength(THREE.MathUtils.clamp(offset.length() * (key === '-' ? 1.12 : .88), controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset); camera.lookAt(controls.target); controls.update(); draw();
    } };
  } catch (error) { dispose(); throw error; }
}
