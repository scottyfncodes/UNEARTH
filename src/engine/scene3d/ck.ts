/**
 * CK — Curious Kitten. The player character, built from primitives (no model
 * files, matching the rest of engine/scene3d). This is a world object now,
 * not a camera attachment: exploration is third person, so CK has to actually
 * be visible in the scene, not just implied by a floating detector.
 *
 * The collar (a simple ring + tag at the throat) is the detection system's
 * physical presence in the world — see systems/detection.ts for the signal
 * model this reacts to.
 */
import * as THREE from 'three';

export interface CKReactState {
  /** True while the player is actively moving the stick. */
  moving: boolean;
  /** 0..1 — how hard the stick is pushed, for walk vs. run. */
  effort: number;
  /** 0..1 — current collar signal strength, drives ear/tail urgency. */
  signal: number;
}

export interface CK {
  root: THREE.Group;
  /** World-space point the chase camera should look at (CK's head, roughly). */
  headTarget: THREE.Vector3;
  update(dt: number, state: CKReactState): void;
}

/** Builds CK and returns a handle for per-frame posing. Caller positions `root` each frame. */
export function buildCK(): CK {
  const root = new THREE.Group();
  root.name = 'CK';

  const fur = new THREE.MeshStandardMaterial({ color: 0xb9803f, roughness: 0.9 });
  const furDark = new THREE.MeshStandardMaterial({ color: 0x6e4526, roughness: 0.9 });
  const furLight = new THREE.MeshStandardMaterial({ color: 0xe8d3a8, roughness: 0.85 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0xa5312a, roughness: 0.55, metalness: 0.1 });
  const tagMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.4, emissive: 0x0a2a10 });

  // Everything but the ground contact point hangs off bodyPivot, so a walk
  // bob is one Y offset instead of four separate leg corrections.
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 4, 8), fur);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.24, 0.03);
  bodyPivot.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), furLight);
  chest.position.set(0, 0.16, -0.18);
  bodyPivot.add(chest);

  // ── head (its own group so ears/eyes/collar all move with it) ───────────
  const head = new THREE.Group();
  head.position.set(0, 0.33, -0.27);
  bodyPivot.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fur);
  skull.scale.set(1, 0.9, 1.02);
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), furLight);
  muzzle.position.set(0, -0.045, -0.1);
  muzzle.scale.set(1, 0.85, 0.9);
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.022, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a28 }));
  nose.position.set(0, -0.04, -0.155);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
    eye.position.set(side * 0.062, 0.01, -0.11);
    head.add(eye);
  }

  const earGeo = new THREE.ConeGeometry(0.05, 0.085, 4);
  const earPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.075, 0.11, 0.01);
    head.add(pivot);
    const ear = new THREE.Mesh(earGeo, fur);
    ear.position.y = 0.04;
    ear.rotation.z = side * -0.2;
    pivot.add(ear);
    earPivots.push(pivot);
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.013, 6, 16), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, -0.05, 0.03);
  head.add(collar);

  const tag = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), tagMat);
  tag.position.set(0, -0.13, 0.05);
  tag.rotation.x = -0.3;
  head.add(tag);

  // ── whiskers: a handful of thin lines, mostly for silhouette read ───────
  const whiskerMat = new THREE.LineBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.65 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = -0.03 + i * 0.012;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(side * 0.05, y, -0.13),
        new THREE.Vector3(side * 0.16, y - i * 0.006, -0.12 + i * 0.01),
      ]);
      head.add(new THREE.Line(geo, whiskerMat));
    }
  }

  // ── tail: a short chain of pivots so it can wag as a curve, not a rod ───
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.27, 0.24);
  tailRoot.rotation.x = -0.55; // curls up and back, not dragging on the ground
  bodyPivot.add(tailRoot);

  const tailSegments: THREE.Group[] = [];
  let tailParent: THREE.Object3D = tailRoot;
  const segLen = 0.1;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    if (i > 0) seg.position.z = segLen;
    seg.rotation.x = -0.35; // each link curls a little further than the last
    tailParent.add(seg);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(Math.max(0.01, 0.024 - i * 0.004), segLen * 0.7, 3, 6),
      i % 2 === 0 ? fur : furDark,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = segLen * 0.5;
    seg.add(mesh);
    tailSegments.push(seg);
    tailParent = seg;
  }

  // ── legs: simple cylinders, animated as a walk cycle rather than IK ─────
  const legGeo = new THREE.CylinderGeometry(0.026, 0.022, 0.22, 6);
  const legDefs: [number, number][] = [
    [-0.09, 0.14], // front-left
    [0.09, 0.14], // front-right
    [-0.09, -0.15], // back-left
    [0.09, -0.15], // back-right
  ];
  const legPivots = legDefs.map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.2, z);
    bodyPivot.add(pivot);
    const leg = new THREE.Mesh(legGeo, furDark);
    leg.position.y = -0.11;
    pivot.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), furLight);
    paw.position.y = -0.21;
    pivot.add(paw);
    return pivot;
  });

  const headTarget = new THREE.Vector3();

  let walkPhase = 0;
  let idlePhase = Math.random() * Math.PI * 2;
  let earPerk = 0;
  let tailUrgency = 0;

  function update(dt: number, s: CKReactState): void {
    const moveAmount = s.moving ? Math.max(0.35, s.effort) : 0;
    walkPhase += dt * (5.5 + moveAmount * 4.5);
    idlePhase += dt * 0.8;

    const bob = moveAmount > 0 ? Math.abs(Math.sin(walkPhase)) * 0.024 * moveAmount : Math.sin(idlePhase) * 0.006;
    bodyPivot.position.y = bob;
    bodyPivot.rotation.z = moveAmount > 0 ? Math.sin(walkPhase) * 0.02 * moveAmount : 0;

    for (let i = 0; i < legPivots.length; i++) {
      const diag = i === 0 || i === 3 ? 0 : Math.PI; // trot: opposite-corner legs in phase
      const swing = moveAmount > 0 ? Math.sin(walkPhase + diag) * 0.5 * moveAmount : 0;
      legPivots[i]!.rotation.x = swing;
    }

    // Ears rotate up and forward as the collar signal strengthens — this is
    // the main tell the design calls for: "the cat becomes the detector head".
    earPerk = THREE.MathUtils.damp(earPerk, s.signal, 6, dt);
    for (const pivot of earPivots) pivot.rotation.x = -earPerk * 0.6;

    tailUrgency = THREE.MathUtils.damp(tailUrgency, s.signal, 4, dt);
    const tailSpeed = 1 + tailUrgency * 7 + moveAmount * 1.2;
    const tailAmp = 0.18 + tailUrgency * 0.4;
    for (let i = 0; i < tailSegments.length; i++) {
      const seg = tailSegments[i]!;
      seg.rotation.y = Math.sin(walkPhase * 0.35 * tailSpeed + i * 0.7) * tailAmp;
    }

    head.getWorldPosition(headTarget);
  }

  return { root, headTarget, update };
}
