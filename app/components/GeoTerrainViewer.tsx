"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildingFootprint, geoCentroid, localBounds, toLocalMeters, type GeoPoint } from "../lib/geo";
import { analyzeTerrain } from "../lib/terrain-analysis";
import {
  createTerrainContours,
  createTerrainElevationSampler,
  type TerrainLayerVisibility,
  type TerrainModel,
} from "../lib/terrain-model";

type Props = {
  parcel: GeoPoint[];
  buildingWidth: number;
  buildingDepth: number;
  floors: number;
  rotation: number;
  offsetEast: number;
  offsetNorth: number;
  slope: number;
  exaggeration: number;
  layers: TerrainLayerVisibility;
  terrainModel: TerrainModel;
};

function addLineLoop(scene: THREE.Scene, points: THREE.Vector3[], color: number) {
  if (points.length < 2) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color }));
  scene.add(line);
}

export function GeoTerrainViewer({
  parcel,
  buildingWidth,
  buildingDepth,
  floors,
  rotation,
  offsetEast,
  offsetNorth,
  slope,
  exaggeration,
  layers,
  terrainModel,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const analysis = analyzeTerrain(parcel, slope, buildingWidth, buildingDepth, rotation);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || parcel.length < 3) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) {
      const errorFrame = requestAnimationFrame(() => setWebglError(true));
      return () => cancelAnimationFrame(errorFrame);
    }

    const bounds = localBounds(parcel);
    const sampler = createTerrainElevationSampler(parcel, slope);
    const contours = createTerrainContours(parcel, slope);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071c2b);
    scene.fog = new THREE.Fog(0x071c2b, 120, 330);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 800);
    const span = Math.max(70, bounds.width, bounds.depth);
    camera.position.set(span * .85, span * .72, span * .94);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      const errorFrame = requestAnimationFrame(() => setWebglError(true));
      return () => cancelAnimationFrame(errorFrame);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Parsel sınırı, kot verisi, eş yükselti çizgileri ve yapı kütlesinin ortak arazi modelindeki etkileşimli üç boyutlu görünümü");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.target.set(0, 4, 0);
    controls.maxPolarAngle = Math.PI * .49;
    controls.minDistance = span * .35;
    controls.maxDistance = span * 3.2;

    scene.add(new THREE.HemisphereLight(0xcde9f6, 0x273422, 2.5));
    const sun = new THREE.DirectionalLight(0xffdfc6, 4.2);
    sun.position.set(-span, span * 1.6, span * .6);
    sun.castShadow = true;
    scene.add(sun);

    const terrainWidth = Math.max(70, bounds.width * 1.35);
    const terrainDepth = Math.max(70, bounds.depth * 1.35);
    const terrainGeometry = new THREE.PlaneGeometry(terrainWidth, terrainDepth, 48, 48);
    const position = terrainGeometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      position.setZ(index, sampler.relativeAt(position.getX(index), position.getY(index)) * exaggeration);
    }
    terrainGeometry.computeVertexNormals();
    terrainGeometry.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ color: 0x49675b, roughness: .92, metalness: 0, side: THREE.DoubleSide }));
    terrain.receiveShadow = true;
    terrain.visible = layers["terrain-surface"];
    scene.add(terrain);
    const terrainWire = new THREE.Mesh(terrainGeometry.clone(), new THREE.MeshBasicMaterial({ color: 0x6f9687, wireframe: true, transparent: true, opacity: .16 }));
    terrainWire.position.y = .04;
    terrainWire.visible = layers["terrain-surface"];
    scene.add(terrainWire);

    const sceneElevationAt = (east: number, north: number) => sampler.relativeAt(east, north) * exaggeration;
    if (layers.contours && contours.length) {
      const contourGeometry = new THREE.BufferGeometry().setFromPoints(contours.flatMap((segment) => [
        new THREE.Vector3(segment.start.east, sceneElevationAt(segment.start.east, segment.start.north) + .08, -segment.start.north),
        new THREE.Vector3(segment.end.east, sceneElevationAt(segment.end.east, segment.end.north) + .08, -segment.end.north),
      ]));
      scene.add(new THREE.LineSegments(contourGeometry, new THREE.LineBasicMaterial({ color: 0xb9d6c9, transparent: true, opacity: .38 })));
    }

    const parcelLoop = parcel.map((point) => {
      const local = toLocalMeters(point, bounds.origin);
      return new THREE.Vector3(local.east, sceneElevationAt(local.east, local.north) + .22, -local.north);
    });
    if (layers["parcel-boundary"]) addLineLoop(scene, parcelLoop, 0xf2945f);

    if (layers["elevation-points"]) {
      parcel.forEach((point) => {
        if (!Number.isFinite(point.alt)) return;
        const local = toLocalMeters(point, bounds.origin);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(.62, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffc09b, emissive: 0x5d1f08 }));
        marker.position.set(local.east, sceneElevationAt(local.east, local.north) + .3, -local.north);
        scene.add(marker);
      });
    }

    if (layers["building-mass"]) {
      const center = geoCentroid(parcel);
      const footprint = buildingFootprint(center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth);
      const baseElevation = sceneElevationAt(offsetEast, offsetNorth);
      const height = Math.max(3.2, floors * 3.2);
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(buildingWidth, height, buildingDepth),
        new THREE.MeshPhysicalMaterial({ color: 0xb96839, transparent: true, opacity: .78, roughness: .4, metalness: .26 }),
      );
      building.position.set(offsetEast, baseElevation + height / 2 + .12, -offsetNorth);
      building.rotation.y = -(rotation * Math.PI) / 180;
      building.castShadow = true;
      scene.add(building);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(building.geometry), new THREE.LineBasicMaterial({ color: 0xffd7bf }));
      edges.position.copy(building.position);
      edges.rotation.copy(building.rotation);
      scene.add(edges);

      const footprintLoop = footprint.map((point) => {
        const local = toLocalMeters(point, center);
        return new THREE.Vector3(local.east, sceneElevationAt(local.east, local.north) + .35, -local.north);
      });
      addLineLoop(scene, footprintLoop, 0xffffff);
    }

    const northArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-terrainWidth * .39, 1.5, terrainDepth * .39), 10, 0xf2945f, 2.4, 1.4);
    scene.add(northArrow);

    let frame = 0;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const heightValue = Math.max(1, host.clientHeight);
      renderer.setSize(width, heightValue, false);
      camera.aspect = width / heightValue;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const readyFrame = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(readyFrame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineLoop || object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [parcel, buildingWidth, buildingDepth, floors, rotation, offsetEast, offsetNorth, slope, exaggeration, layers]);

  return <div className="geo-terrain-viewer">
    <div ref={hostRef} className="geo-terrain-canvas">{webglError && <div className="geo-viewer-fallback"><b>WebGL kullanılamıyor</b><p>3B görünüm için güncel bir tarayıcı veya donanım hızlandırması gerekir.</p></div>}</div>
    <div className="geo-terrain-overlay"><span><i className={ready ? "ready" : ""}></i>{ready ? "3B SAHNE HAZIR" : "3B SAHNE HAZIRLANIYOR"}</span><b>WGS84 → Yerel ENU çalışma düzlemi</b></div>
    <aside className="geo-terrain-analysis" aria-label="V82 / ARAZİ PERFORMANS TARAMASI"><span>V111 / BÜTÜNLEŞİK ARAZİ MODELİ</span><div><p><small>VERİ TEMELİ</small><b>{terrainModel.basis === "measured-z" ? "Ölçülmüş Z girdisi" : "Parametrik eğim"}</b></p><p><small>KOT FARKI</small><b>{terrainModel.elevation.range.toFixed(2)} m</b></p><p><small>YAPI ALTI Δ</small><b>{analysis.buildingLevelDifference.toFixed(2)} m</b></p><p><small>ÖN HAFRİYAT</small><b>≈ {analysis.indicativeEarthwork.toFixed(0)} m³</b></p></div><em>{terrainModel.trust === "verified" ? "Yetkili ölçüm beyanı · proje kontrolü gerekli" : terrainModel.basis === "measured-z" ? "Kaynak dosya kotları · düşey datum doğrulanmalı" : "Kavramsal gösterge · zemin etüdü ve plankote değildir"}</em></aside>
    <div className="geo-terrain-help">SOL: döndür · SAĞ: kaydır · TEKER: yaklaş</div><div className="geo-north">N<br />↑</div>
  </div>;
}
