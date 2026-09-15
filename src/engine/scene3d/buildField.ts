/**
 * Turns a detecting LocationDef into a THREE.Scene — the open-field sibling
 * of build.ts's buildSiteScene. No buried target is ever rendered (that
 * would defeat the entire point of sweeping for one); only the ground,
 * light scatter dressing, and any fixed scenery clues are real geometry.
 *
 * World space is centred on the plot: PlacedTarget/SceneryClue coordinates
 * (centimetres, origin at one corner, same space the old top-down field
 * used) map to world metres via `/100 - half-extent`.
 */
import * as THREE from 'three';
import type { LocationDef } from '@/core/types';
import type { SiteProp } from '@/content/sites/types';
import { getTarget } from '@/content/targets';
import { mulberry32, range } from '@/core/rng';
import { billboardMesh, buildProp, disposeObject } from './build';
import { findSprite, siteGroundTexture, skyGradientTexture, stoneTexture } from './textures';

export interface BuiltField {
  scene: THREE.Scene;
  halfWidth: number;
  halfHeight: number;
  /** Scenery clue id -> its mesh, for a subtle interacted/consumed state later if ever needed. */
  sceneryMeshes: Map<string, THREE.Object3D>;
  dispose(): void;
}

/** cm (field space, origin at a corner) -> metres (world space, origin at plot centre). */
export function fieldToWorld(cm: number, halfExtent: number): number {
  return cm / 100 - halfExtent;
}

/** The inverse of fieldToWorld — world metres back to field centimetres. */
export function worldToField(metres: number, halfExtent: number): number {
  return (metres + halfExtent) * 100;
}

export function buildFieldScene(location: LocationDef, seed: number): BuiltField {
  const halfWidth = location.bounds.w / 200;
  const halfHeight = location.bounds.h / 200;
  const palette = location.ground;

  const scene = new THREE.Scene();
  const fogSpan = Math.max(halfWidth, halfHeight);
  scene.fog = new THREE.Fog(new THREE.Color(palette.haze).getHex(), fogSpan * 0.8, fogSpan * 2.1);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyGradientTexture(palette.sky, palette.haze), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(new THREE.Color(palette.sky), new THREE.Color(palette.base), 1.0));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.05);
  sun.position.set(-9, 15, 7);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  const groundW = halfWidth * 2;
  const groundH = halfHeight * 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, groundH),
    new THREE.MeshStandardMaterial({
      map: siteGroundTexture(palette.base, palette.detail, Math.max(4, Math.round(Math.max(groundW, groundH) / 3))),
      roughness: 1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Sparse, deterministic scatter dressing — decoration only, no collision,
  // so a busy field never traps the player against something invisible.
  const stoneMaterial = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.96, metalness: 0.02 });
  const rng = mulberry32(seed >>> 0);
  for (let i = 0; i < 16; i++) {
    const x = range(rng, -halfWidth * 0.92, halfWidth * 0.92);
    const z = range(rng, -halfHeight * 0.92, halfHeight * 0.92);
    if (Math.hypot(x, z) < 2.2) continue; // keep the spawn area clear
    const prop: SiteProp = {
      id: `scatter_${i}`,
      kind: rng() < 0.55 ? 'rock' : 'rubble',
      position: { x, y: 0, z },
      rotationY: rng() * Math.PI * 2,
      scale: [0.55 + rng() * 0.75, 0.5 + rng() * 0.8, 0.55 + rng() * 0.75],
    };
    buildProp(scene, prop, stoneMaterial);
  }

  const sceneryMeshes = new Map<string, THREE.Object3D>();
  for (const clue of location.sceneryClues ?? []) {
    const def = getTarget(clue.targetId);
    if (!def) continue;
    const mesh = billboardMesh(findSprite(def.silhouette), 1.0);
    mesh.position.set(fieldToWorld(clue.x, halfWidth), 1.1, fieldToWorld(clue.y, halfHeight));
    scene.add(mesh);
    sceneryMeshes.set(clue.id, mesh);
  }

  return {
    scene,
    halfWidth,
    halfHeight,
    sceneryMeshes,
    dispose: () => disposeObject(scene),
  };
}
