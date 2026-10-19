import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type BuildingView = "outside" | "inside" | "structure";
export type WalkCommand = "forward" | "back" | "left" | "right";

/** Presentation geometry only. It is not a project model or an engineering calculation. */
export function createBuildingWalkthrough(host: HTMLElement, onUnavailable: () => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9e2e5");
  scene.fog = new THREE.Fog("#d9e2e5", 85, 170);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  const mobile = matchMedia("(max-width: 700px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 17;
  controls.maxDistance = 75;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotate = false;
  controls.enabled = false;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const foliageGeometry = new THREE.IcosahedronGeometry(1, 1);
  [boxGeometry, cylinderGeometry, foliageGeometry].forEach(g => geometries.add(g));
  const material = (color: string, roughness = 0.75, metalness = 0) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(value); return value;
  };
  const concrete = material("#c3c8c7");
  const steel = material("#253e48", 0.4, 0.6);
  const copper = material("#b97347", 0.4, 0.65);
  const panel = material("#e2e1d8", 0.65, 0.12);
  const roofMaterial = material("#637985", 0.5, 0.4);
  const glass = material("#3e7080", 0.16, 0.45);
  const paving = material("#b6bdbd");
  const asphalt = material("#637075");
  const grass = material("#6b8273");
  const leaves = material("#426457");
  const trunk = material("#6c5a46");
  const markings = material("#dfd9c6");
  const facade = new THREE.Group();
  const roof = new THREE.Group();
  scene.add(facade, roof);
  const box = (parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], mat: THREE.Material) => {
    const mesh = new THREE.Mesh(boxGeometry, mat);
    mesh.scale.set(...size); mesh.position.set(...at);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const beam = (a: [number, number, number], b: [number, number, number], width: number, depth: number, mat = steel) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const mesh = box(scene, [width, direction.length(), depth], [0, 0, 0], mat);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  };
  // A compact industrial campus, with an open loading entrance and a glazed office.
  box(scene, [145, 0.25, 145], [0, -0.35, 0], grass);
  box(scene, [44, 0.2, 55], [3, -0.17, 3], paving);
  box(scene, [44, 0.06, 9], [3, -0.025, 25], asphalt);
  box(scene, [18.7, 0.3, 30.7], [0, 0, 0], concrete);
  for (const z of [-15, -7.5, 0, 7.5, 15]) {
    for (const x of [-9, 9]) {
      box(scene, [0.62, 6.6, 0.62], [x, 3.45, z], concrete);
      box(scene, [1.2, 0.28, 1.2], [x, 0.25, z], concrete);
    }
    beam([-9, 6.7, z], [0, 8.4, z], 0.23, 0.18);
    beam([0, 8.4, z], [9, 6.7, z], 0.23, 0.18);
    beam([-9, 6.45, z], [9, 6.45, z], 0.16, 0.15);
    for (let x = -9; x < 9; x += 3) {
      const height = (n: number) => 8.4 - Math.abs(n) * 1.7 / 9;
      beam([x, 6.45, z], [x + 1.5, height(x + 1.5), z], 0.08, 0.08);
      beam([x + 1.5, height(x + 1.5), z], [x + 3, 6.45, z], 0.08, 0.08);
    }
  }
  for (const x of [-9, -6, -3, 0, 3, 6, 9]) {
    box(scene, [0.12, 0.2, 30], [x, 8.4 - Math.abs(x) * 1.7 / 9, 0], steel);
  }
  for (const x of [-8.85, 8.85]) {
    beam([x, 0.5, -14.7], [x, 6.3, -7.8], 0.065, 0.065, copper);
    beam([x, 6.3, -14.7], [x, 0.5, -7.8], 0.065, 0.065, copper);
  }
  box(facade, [0.18, 4.5, 30], [-9.25, 2.4, 0], panel);
  box(facade, [0.2, 1.5, 30], [-9.25, 5.6, 0], glass);
  box(facade, [0.18, 6.6, 30], [9.25, 3.45, 0], panel);
  box(facade, [18.5, 6.6, 0.18], [0, 3.45, -15.3], panel);
  for (const x of [-6.1, 6.1]) box(facade, [6.2, 6.6, 0.18], [x, 3.45, 15.3], panel);
  box(facade, [6, 1.5, 0.18], [0, 6, 15.3], panel);
  for (let z = -14; z <= 14; z += 1.5) {
    box(facade, [0.05, 6.35, 0.035], [9.36, 3.45, z], concrete);
    box(facade, [0.05, 4.3, 0.035], [-9.36, 2.4, z], concrete);
  }
  const slope = Math.atan2(1.7, 9);
  const leftRoof = box(roof, [9.6, 0.14, 31.2], [-4.5, 7.67, 0], roofMaterial);
  const rightRoof = box(roof, [9.6, 0.14, 31.2], [4.5, 7.67, 0], roofMaterial);
  leftRoof.rotation.z = slope; rightRoof.rotation.z = -slope;
  for (const x of [-9.5, 9.5]) box(roof, [0.18, 0.3, 31.3], [x, 6.75, 0], copper);
  box(facade, [8.5, 3.8, 0.15], [13.5, 2.05, 11.5], glass);
  box(facade, [0.15, 3.8, 9], [17.8, 2.05, 7], glass);
  box(facade, [8.7, 3.8, 0.2], [13.5, 2.05, 2.4], panel);
  box(roof, [9.4, 0.25, 10.2], [13.5, 4.1, 7], steel);
  box(scene, [9, 0.2, 9.8], [13.5, 0.08, 7], concrete);
  for (const x of [9.4, 11.5, 13.6, 15.7, 17.8]) box(facade, [0.09, 3.8, 0.2], [x, 2.05, 11.55], copper);
  box(facade, [9.4, 0.14, 2.3], [13.5, 3.35, 12.4], copper);
  // Low interior work benches provide scale without implying a specific production process.
  for (const z of [-9, -4, 1]) {
    box(scene, [3.4, 0.18, 1.5], [-5, 1, z], copper);
    for (const x of [-6.3, -3.7]) box(scene, [0.13, 0.9, 1.2], [x, 0.55, z], steel);
  }
  for (let z = -12; z <= 12; z += 3) box(scene, [0.09, 0.012, 1.5], [2.8, 0.158, z], markings);
  for (const x of [-14, -9, -4, 1, 6, 11, 16]) box(scene, [0.1, 0.02, 4.6], [x, 0.02, 20], markings);
  for (const [x, z] of [[-16, -15], [-16, -4], [-16, 8], [23, -12], [23, 1], [23, 15]]) {
    const treeTrunk = new THREE.Mesh(cylinderGeometry, trunk);
    treeTrunk.scale.set(0.18, 2.8, 0.18); treeTrunk.position.set(x, 1.35, z); scene.add(treeTrunk);
    const crown = new THREE.Mesh(foliageGeometry, leaves);
    crown.scale.set(1.65, 2.2, 1.65); crown.position.set(x, 3.65, z); crown.castShadow = true; scene.add(crown);
    box(scene, [3.6, 0.22, 3.6], [x, 0.02, z], grass);
  }
  // Static repetition shares one draw call per geometry/material and parent.
  // Keep facade and roof batches separate so view switches remain meaningful.
  const instances: THREE.InstancedMesh[] = [];
  for (const parent of [scene, facade, roof]) {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const key = `${child.geometry.uuid}:${child.material.uuid}`;
      const batch = batches.get(key) ?? []; batch.push(child); batches.set(key, batch);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const combined = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
      combined.castShadow = meshes.some(mesh => mesh.castShadow);
      combined.receiveShadow = meshes.some(mesh => mesh.receiveShadow);
      meshes.forEach((mesh, index) => { mesh.updateMatrix(); combined.setMatrixAt(index, mesh.matrix); parent.remove(mesh); });
      combined.computeBoundingSphere(); parent.add(combined); instances.push(combined);
    }
  }
  scene.add(new THREE.HemisphereLight("#eff8ff", "#6f706a", 2.4));
  const sun = new THREE.DirectionalLight("#ffead0", 4);
  sun.position.set(-24, 38, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.04; scene.add(sun);

  let view: BuildingView = "outside", active = false, disposed = false, visible = true;
  let frame = 0, yaw = 0, pitch = 0, pointer: { id: number; x: number; y: number } | null = null;
  function render() {
    if (disposed || frame || !visible || document.hidden) return;
    frame = requestAnimationFrame(() => { frame = 0; if (!disposed && visible && !document.hidden) renderer.render(scene, camera); });
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  }
  function updateLook() { camera.rotation.set(pitch, yaw, 0, "YXZ"); render(); }
  function walk(command: WalkCommand) {
    if (view !== "inside" || !active) return;
    if (command === "left" || command === "right") yaw += command === "left" ? 0.2 : -0.2;
    else {
      const direction = command === "forward" ? 0.65 : -0.65;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x - Math.sin(yaw) * direction, -7.8, 7.8);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z - Math.cos(yaw) * direction, -13.6, 13.6);
    }
    updateLook();
  }
  function setView(next: BuildingView) {
    view = next; facade.visible = next !== "structure"; roof.visible = next === "outside";
    controls.enabled = active && next !== "inside";
    pointer = null;
    if (next === "inside") { camera.position.set(0, 1.75, 12); yaw = 0; pitch = 0.12; updateLook(); }
    else { camera.position.set(34, next === "structure" ? 26 : 21, 38); controls.target.set(1.5, 3, 0); controls.update(); }
    render();
  }
  const down = (event: PointerEvent) => {
    if (!active || view !== "inside") return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    yaw -= (event.clientX - pointer.x) * 0.004;
    pitch = THREE.MathUtils.clamp(pitch - (event.clientY - pointer.y) * 0.004, -0.65, 0.7);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; updateLook();
  };
  const up = () => { pointer = null; };
  const contextLost = (event: Event) => { event.preventDefault(); onUnavailable(); };
  const visibility = () => { if (!document.hidden) render(); };
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", up);
  renderer.domElement.addEventListener("lostpointercapture", up);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  controls.addEventListener("change", render);
  document.addEventListener("visibilitychange", visibility);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) render(); });
  intersectionObserver.observe(host);
  resize(); setView("outside");
  return {
    setView, walk,
    setActive(value: boolean) { active = value; controls.enabled = active && view !== "inside"; renderer.domElement.style.pointerEvents = active ? "auto" : "none"; pointer = null; },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      controls.removeEventListener("change", render); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", up);
      renderer.domElement.removeEventListener("lostpointercapture", up); renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      instances.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); sun.shadow.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
