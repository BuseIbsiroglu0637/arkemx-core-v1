"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ModelViewerProps = {
  modelUrl?: string;
  title?: string;
};

type ModelPreset = "industrial" | "light-steel" | "hybrid";

const presetLabels: Record<ModelPreset, string> = {
  industrial: "Çelik Endüstri",
  "light-steel": "Hafif Çelik Konut",
  hybrid: "Karma Sistem",
};

function addMember(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const member = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  member.position.set(...position);
  member.castShadow = true;
  member.receiveShadow = true;
  group.add(member);
}

function createStructuralFrame() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb96839, metalness: 0.72, roughness: 0.3 });
  const secondary = new THREE.MeshStandardMaterial({ color: 0x9eabb4, metalness: 0.62, roughness: 0.38 });
  const slab = new THREE.MeshStandardMaterial({ color: 0xdfe5e8, metalness: 0.05, roughness: 0.78 });

  addMember(group, [11.8, 0.18, 7.8], [0, 0.05, 0], slab);
  const xs = [-5, 0, 5];
  const zs = [-3, 3];
  xs.forEach((x) => zs.forEach((z) => addMember(group, [0.22, 4.6, 0.22], [x, 2.35, z], steel)));
  zs.forEach((z) => addMember(group, [10.3, 0.24, 0.24], [0, 4.65, z], steel));
  xs.forEach((x) => addMember(group, [0.2, 0.2, 6.2], [x, 4.65, 0], secondary));
  [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75].forEach((x) => addMember(group, [0.12, 0.12, 6.1], [x, 5.3, 0], secondary));
  [-2.4, -1.2, 0, 1.2, 2.4].forEach((z) => {
    const left = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.16, 0.16), secondary);
    left.position.set(-2.5, 5.18, z);
    left.rotation.z = 0.25;
    left.castShadow = true;
    group.add(left);
    const right = left.clone();
    right.position.x = 2.5;
    right.rotation.z = -0.25;
    group.add(right);
  });
  group.rotation.y = -0.18;
  return group;
}

function createLightSteelFrame() {
  const group = new THREE.Group();
  const galvanized = new THREE.MeshStandardMaterial({ color: 0xb9c6cd, metalness: 0.78, roughness: 0.27 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb96839, metalness: 0.62, roughness: 0.34 });
  const slab = new THREE.MeshStandardMaterial({ color: 0xdce3e6, metalness: 0.04, roughness: 0.8 });
  addMember(group, [10.8, 0.2, 7.2], [0, 0.05, 0], slab);
  const wallLines: { alongX: boolean; fixed: number; from: number; to: number }[] = [
    { alongX: true, fixed: -3, from: -4.8, to: 4.8 }, { alongX: true, fixed: 3, from: -4.8, to: 4.8 },
    { alongX: false, fixed: -4.8, from: -3, to: 3 }, { alongX: false, fixed: 4.8, from: -3, to: 3 },
  ];
  wallLines.forEach((wall) => {
    for (let value = wall.from; value <= wall.to + .01; value += .6) {
      addMember(group, [.09, 3.25, .09], wall.alongX ? [value, 1.72, wall.fixed] : [wall.fixed, 1.72, value], galvanized);
    }
    const length = wall.to - wall.from;
    addMember(group, wall.alongX ? [length, .1, .12] : [.12, .1, length], wall.alongX ? [0, .15, wall.fixed] : [wall.fixed, .15, 0], copper);
    addMember(group, wall.alongX ? [length, .1, .12] : [.12, .1, length], wall.alongX ? [0, 3.35, wall.fixed] : [wall.fixed, 3.35, 0], copper);
  });
  for (let x = -4.8; x <= 4.8; x += .6) {
    const left = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, 4.25), galvanized);
    left.position.set(x, 4.05, -1.45);
    left.rotation.x = -.38;
    left.castShadow = true;
    group.add(left);
    const right = left.clone();
    right.position.z = 1.45;
    right.rotation.x = .38;
    group.add(right);
  }
  addMember(group, [10.2, .14, .14], [0, 4.82, 0], copper);
  group.rotation.y = -.18;
  return group;
}

function createHybridFrame() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb96839, metalness: .72, roughness: .3 });
  const secondary = new THREE.MeshStandardMaterial({ color: 0xaebcc4, metalness: .58, roughness: .38 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xc8c7c2, metalness: .02, roughness: .86 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x4f88a7, transparent: true, opacity: .3, roughness: .12, metalness: .05 });
  addMember(group, [11.8, .18, 7.8], [0, .05, 0], concrete);
  addMember(group, [2.25, 6.4, 2.25], [-3.7, 3.25, 0], concrete);
  [-.8, 2.3, 5].forEach((x) => [-3, 3].forEach((z) => addMember(group, [.24, 5.5, .24], [x, 2.8, z], steel)));
  [2.7, 5.55].forEach((y) => {
    [-3, 3].forEach((z) => addMember(group, [6.1, .25, .25], [2.1, y, z], steel));
    [-.8, 2.3, 5].forEach((x) => addMember(group, [.2, .2, 6.2], [x, y, 0], secondary));
    addMember(group, [6.1, .12, 6.1], [2.1, y + .12, 0], glass);
  });
  [-1.5, 0, 1.5].forEach((z) => addMember(group, [6.1, .12, .12], [2.1, 6.25, z], secondary));
  group.rotation.y = -.2;
  return group;
}

export function ThreeModelViewer({ modelUrl, title = "Etkileşimli taşıyıcı sistem modeli" }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<ModelPreset>("industrial");
  const [loading, setLoading] = useState(Boolean(modelUrl));
  const [notice, setNotice] = useState(modelUrl ? "3B model yükleniyor" : "Temsili sistem modeli");
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const probe = document.createElement("canvas");
    const webgl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!webgl) {
      const frame = requestAnimationFrame(() => {
        setWebglUnavailable(true);
        setLoading(false);
        setNotice("3B görünüm bu tarayıcıda desteklenmiyor");
      });
      return () => cancelAnimationFrame(frame);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071b2a);
    scene.fog = new THREE.Fog(0x071b2a, 18, 38);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(11, 8.2, 13.5);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      const frame = requestAnimationFrame(() => {
        setWebglUnavailable(true);
        setLoading(false);
        setNotice("3B görünüm bu tarayıcıda desteklenmiyor");
      });
      return () => cancelAnimationFrame(frame);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", title);
    renderer.domElement.setAttribute("role", "img");
    host.prepend(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 2.5, 0);
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xb8d8ea, 0x16232c, 2.1));
    const key = new THREE.DirectionalLight(0xffe1c9, 4.2);
    key.position.set(7, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7ac7ef, 2.4);
    rim.position.set(-10, 6, -8);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ color: 0x0a2537, roughness: 0.92 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(36, 36, 0x31536a, 0x17384d);
    grid.position.y = -0.04;
    scene.add(grid);

    let loadedModel: THREE.Object3D | null = null;
    if (modelUrl) {
      new GLTFLoader().load(modelUrl, (gltf) => {
        loadedModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 10 / Math.max(size.x, size.y, size.z, 1);
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        scene.add(gltf.scene);
        setLoading(false);
        setNotice("3B model hazır");
      }, undefined, () => {
        loadedModel = createStructuralFrame();
        scene.add(loadedModel);
        setLoading(false);
        setNotice("Model açılamadı; temsili sistem gösteriliyor");
      });
    } else {
      loadedModel = activePreset === "light-steel" ? createLightSteelFrame() : activePreset === "hybrid" ? createHybridFrame() : createStructuralFrame();
      scene.add(loadedModel);
    }

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      controlsRef.current = null;
      cameraRef.current = null;
    };
  }, [activePreset, modelUrl, title]);

  const resetView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(11, 8.2, 13.5);
    controls.target.set(0, 2.5, 0);
    controls.update();
  };

  const toggleRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    if (controlsRef.current) {
      controlsRef.current.autoRotate = next;
      controlsRef.current.autoRotateSpeed = 1.15;
    }
  };

  const fullscreen = () => hostRef.current?.requestFullscreen?.();

  const selectPreset = (preset: ModelPreset) => {
    setActivePreset(preset);
    setAutoRotate(false);
    setNotice(`${presetLabels[preset]} · temsili model`);
  };

  return <div className="model-viewer-shell">
    <div className="model-viewer" ref={hostRef}>
      <div className="model-viewer-status"><span className={loading ? "is-loading" : ""}></span>{notice}</div>
      {!modelUrl&&!webglUnavailable&&<div className="model-viewer-presets" aria-label="Temsili yapı modeli seçimi">{(Object.keys(presetLabels) as ModelPreset[]).map((preset)=><button type="button" key={preset} aria-pressed={activePreset===preset} onClick={()=>selectPreset(preset)}>{presetLabels[preset]}</button>)}</div>}
      {webglUnavailable&&<div className="model-viewer-fallback"><img src="/portfolio/bim-engineering.webp" alt="BIM ve taşıyıcı sistem modelinin temsili görünümü"/><div><b>3B görünüm kullanılamıyor</b><p>Bu tarayıcı WebGL özelliğini kapatmış. Model desteklenen telefon ve bilgisayar tarayıcılarında etkileşimli olarak açılır.</p></div></div>}
      {!webglUnavailable&&<><div className="model-viewer-controls" aria-label="3B model kontrolleri">
        <button type="button" onClick={resetView}>Görünümü sıfırla</button>
        <button type="button" onClick={toggleRotate} aria-pressed={autoRotate}>{autoRotate ? "Döndürmeyi durdur" : "Otomatik döndür"}</button>
        <button type="button" onClick={fullscreen}>Tam ekran</button>
      </div>
      <p className="model-viewer-help">Döndürmek için sürükleyin · Yakınlaşmak için kaydırın</p></>}
    </div>
  </div>;
}
