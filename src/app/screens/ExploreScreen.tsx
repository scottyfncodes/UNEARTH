import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getSite } from '@/content/sites';
import type { DetectorDig, SiteInteractable } from '@/content/sites/types';
import { LOCATIONS, getLocation } from '@/content/locations';
import { getTarget } from '@/content/targets';
import {
  addSiteFlag,
  beginDig,
  bumpStat,
  completeObservation,
  currentDetector,
  enterLocation,
  game,
  leaveSite,
  notice,
  savePlayerPosition,
} from '@/core/gameState';
import type { PlacedTarget, SceneryClue, TargetDef } from '@/core/types';
import { clamp01, lerp } from '@/core/rng';
import { beepInterval, digTolerance, readout, sampleField, targetSignal, toneOf } from '@/systems/detection';
import {
  buildColliders,
  headTurnToward,
  isInteractableAvailable,
  nearestInteractable,
  resolveSitePose,
  sweepCoilPosition,
  thirdPersonCameraPose,
  type Collider,
  type PlayerState,
  stepPlayer,
} from '@/systems/explore';
import { activeCatRoute } from '@/systems/traversal';
import { buildSiteScene } from '@/engine/scene3d/build';
import { buildCK } from '@/engine/scene3d/ck';
import { buildFieldScene, fieldToWorld, worldToField } from '@/engine/scene3d/buildField';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { capturePointer, LookController, MoveController } from '@/engine/input';
import { startLoop } from '@/engine/loop';
import { publishDetectorFrame, publishExploreFrame } from '@/core/debug';
import { useGameState } from '../useGame';
import { Btn } from '../components/ui';

// One pace, one collar, everywhere — a field and an authored site should
// never feel like different games wearing the same UI.
const WALK_SPEED = 2.15; // m/s
const SWEEP_RATE = 2.35; // rad/s
const SWEEP_WIDTH = 0.46; // metres either side at full amplitude
const COIL_FORWARD = 0.62; // metres ahead of the player
const MARK_LIFETIME = 6; // seconds a pinpoint mark stays diggable after release

// Third-person chase camera, orbiting behind and above CK. Reuses the same
// yaw/pitch the old first-person eye camera used — look input still turns
// where CK faces, it just no longer puts the lens at CK's eye.
const CAM_DISTANCE = 2.5; // metres behind CK
const CAM_HEIGHT = 1.15; // base height above the ground
const CAM_PITCH_MIN = -0.45; // looking down at CK from above
const CAM_PITCH_MAX = 0.55; // dipping low, behind and below eye height
const CAM_LOOK_HEIGHT = 0.45; // roughly CK's head height, the look-at target

interface Dominant {
  dig: DetectorDig;
  def: TargetDef;
  strength: number;
  distCm: number;
}

interface Prompt {
  label: string;
  act: () => void;
}

interface FieldActions {
  setPinpoint(on: boolean): void;
  dig(): void;
}

interface Hud {
  /** The single contextual button: an interactable (site) or a scenery clue (field). */
  promptLabel: string | null;
  showIntro: boolean;
  pinpointing: boolean;
  marked: boolean;
  remaining: number;
  hint: string | null;
}

/** Site ids whose intro has already been dismissed this page session — see ExploreScreenImpl's hud init. */
const introSeenSites = new Set<string>();

/**
 * CK's last known pose per site, this page session only — see
 * resolveSitePose. A dig detours through the 'excavate' and 'discovery'
 * routes, which fully unmounts this screen; without this, every dig would
 * drop CK back at the site's front door instead of where he was digging.
 * Keyed by site id so moving between different authored sites can never
 * inherit another site's position.
 */
const siteExplorePoses = new Map<string, PlayerState>();

function ExploreScreenImpl() {
  const { save } = useGameState(); // subscribe so notice()/save changes re-render the overlay
  const activeSiteId = game.get().activeSite;
  const site = activeSiteId ? getSite(activeSiteId) : undefined;
  const field = !site ? save.field : null;
  const location = field ? getLocation(field.locationId) : undefined;
  const mode: 'site' | 'field' | null = site ? 'site' : field && location ? 'field' : null;
  const teaching = !save.flags.tutorialFound;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moveZoneRef = useRef<HTMLDivElement>(null);
  const lookZoneRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef(new MoveController());
  const lookRef = useRef(new LookController());
  const promptRef = useRef<Prompt | null>(null);
  const fieldActionsRef = useRef<FieldActions | null>(null);

  const [hud, setHud] = useState<Hud>(() => ({
    promptLabel: null,
    // A dig inside a site detours through the 'excavate' and 'discovery'
    // routes, which fully unmounts this screen — remounting on the way back
    // must not re-show the intro card the player already dismissed a moment
    // ago. introSeenSites is session-only (module scope, not saved) on
    // purpose: entering fresh from the map still shows it, same as always.
    showIntro: !!site && !introSeenSites.has(site.id),
    pinpointing: false,
    marked: false,
    remaining: 0,
    hint: null,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const moveZone = moveZoneRef.current;
    const lookZone = lookZoneRef.current;
    if (!canvas || !host || !moveZone || !lookZone) return;
    if (mode === null) {
      leaveSite();
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Far plane comfortably past the sky dome (built at a fixed radius of 320)
    // so it never gets near-clipped away, even though fog hides real geometry
    // long before that distance.
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);

    // CK is carried everywhere — same rig, same collar, whether you're
    // crossing open ground or standing in an authored ruin. The camera trails
    // behind him; see thirdPersonCameraPose for how yaw/pitch place it.
    const ck = buildCK();

    const detachMove = moveRef.current.attach(moveZone);
    const detachLook = lookRef.current.attach(lookZone);
    audio.unlock();

    let lastW = 0;
    let lastH = 0;
    let loop: { stop(): void };
    let disposeScene: () => void;

    if (mode === 'site' && site) {
      const hostLocation = LOCATIONS.find((l) => l.siteId === site.id);
      const hostLocationId = hostLocation?.id ?? site.id;

      const built = buildSiteScene(site);
      built.scene.add(camera);
      built.scene.add(ck.root);
      disposeScene = built.dispose;
      const colliders: Collider[] = buildColliders(site.props);
      const player: PlayerState = resolveSitePose(siteExplorePoses.get(site.id), site.spawn, site.spawnYaw, site.radius);
      let currentCatRouteId: string | null = null;

      const refreshVisibility = () => {
        const s = game.get().save;
        const state = {
          siteProgress: s.siteProgress,
          discovered: s.discoveries.map((d) => d.targetId),
          adventuresComplete: Object.entries(s.adventures)
            .filter(([, status]) => status === 'complete')
            .map(([id]) => id),
        };
        for (const it of site.interactables) {
          const mesh = built.interactableMeshes.get(it.id);
          if (mesh) mesh.visible = isInteractableAvailable(it, state);
        }
      };
      refreshVisibility();

      const interact = (it: SiteInteractable) => {
        audio.ui('tap');
        haptics.tap();
        if (it.kind === 'observe' || it.kind === 'pickup') {
          const def = it.targetId ? getTarget(it.targetId) : undefined;
          if (def) completeObservation({ def, locationId: hostLocationId });
          return;
        }
        if (it.kind === 'notice') {
          if (it.flavor) notice(it.flavor, 6500);
          if (it.setsFlagOnUse) addSiteFlag(it.setsFlagOnUse);
          refreshVisibility();
          return;
        }
        if (it.kind === 'fit') {
          const ready = it.requiresTargetId
            ? game.get().save.discoveries.some((d) => d.targetId === it.requiresTargetId)
            : true;
          if (ready) {
            if (it.setsFlagOnUse) addSiteFlag(it.setsFlagOnUse);
            if (it.flavor) notice(it.flavor, 6500);
            audio.mechanism();
            haptics.contact();
          } else {
            notice('Nothing to fit here yet.');
          }
          refreshVisibility();
        }
      };

      const digHere = (d: Dominant) => {
        audio.unlock();
        const tol = digTolerance(d.def, currentDetector());
        beginDig({
          locationId: hostLocationId,
          targetUid: `site_${d.dig.id}`,
          targetId: d.dig.targetId,
          accuracy: clamp01(1 - d.distCm / tol) * 0.9 + 0.1,
          offsetAngle: Math.atan2(
            d.dig.position.z * 100 - player.z * 100,
            d.dig.position.x * 100 - player.x * 100,
          ),
          baseCondition: d.dig.baseCondition,
          depthCm: d.dig.depthCm,
          digX: player.x * 100,
          digY: player.z * 100,
          seed: `${site.id}_${d.dig.id}`,
        });
      };

      audio.ambience(site.ambience);

      let lastBeep = 0;
      let lastHazardWarnAt = -10;
      let lastPromptLabel: string | null = null;

      loop = startLoop((dt, elapsed) => {
        const rect = host.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        if (w !== lastW || h !== lastH) {
          lastW = w;
          lastH = h;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }

        const currentSave = game.get().save;
        const discovered = currentSave.discoveries.map((d) => d.targetId);

        const move = moveRef.current;
        const look = lookRef.current.consume(dt);

        const result = stepPlayer(player, {
          dt,
          moveX: move.magnitude > 0.02 ? move.vector.x : 0,
          moveY: move.magnitude > 0.02 ? -move.vector.y : 0,
          yawDelta: look.yaw,
          pitchDelta: look.pitch,
          speed: WALK_SPEED,
          colliders,
          bounds: site.radius,
          hazards: site.hazards,
          siteProgress: currentSave.siteProgress,
        });

        if (result.hazard) {
          if (result.hazard.setsFlagOnTrigger && !currentSave.siteProgress.includes(result.hazard.setsFlagOnTrigger)) {
            addSiteFlag(result.hazard.setsFlagOnTrigger);
            refreshVisibility();
          }
          if (elapsed - lastHazardWarnAt > 3.2) {
            lastHazardWarnAt = elapsed;
            notice(result.hazard.warning);
            haptics.danger();
          }
        }

        const catRoute = activeCatRoute(player.x, player.z, site.catRoutes ?? [], currentCatRouteId);
        currentCatRouteId = catRoute?.id ?? null;
        if (catRoute && !currentSave.siteProgress.includes(catRoute.grantsFlag)) {
          addSiteFlag(catRoute.grantsFlag);
          if (catRoute.note) notice(catRoute.note, 6000);
        }

        let nearestHazardDist = Infinity;
        let nearestHazardPos: { x: number; z: number } | null = null;
        for (const hz of site.hazards) {
          if (hz.disarmedByFlag && currentSave.siteProgress.includes(hz.disarmedByFlag)) continue;
          const dist = Math.hypot(player.x - hz.position.x, player.z - hz.position.z) - hz.radius;
          if (dist < nearestHazardDist) {
            nearestHazardDist = dist;
            nearestHazardPos = { x: hz.position.x, z: hz.position.z };
          }
        }
        const wary = nearestHazardPos ? clamp01(1 - nearestHazardDist / 3) : 0;

        const adventuresComplete = Object.entries(currentSave.adventures)
          .filter(([, status]) => status === 'complete')
          .map(([id]) => id);
        const state = { siteProgress: currentSave.siteProgress, discovered, adventuresComplete };
        const target = nearestInteractable(player.x, player.z, player.yaw, site.interactables, state);

        const detector = currentDetector();
        let dominant: Dominant | null = null;
        for (const dig of site.detectorDigs) {
          if (discovered.includes(dig.targetId)) continue;
          const def = getTarget(dig.targetId);
          if (!def) continue;
          const placed: PlacedTarget = {
            uid: dig.id,
            targetId: dig.targetId,
            x: dig.position.x * 100,
            y: dig.position.z * 100,
            depth: dig.depthCm,
            baseCondition: dig.baseCondition,
            dug: false,
          };
          const strength = targetSignal(player.x * 100, player.z * 100, placed, def, detector);
          const distCm = Math.hypot(dig.position.x * 100 - player.x * 100, dig.position.z * 100 - player.z * 100);
          if (!dominant || strength > dominant.strength) dominant = { dig, def, strength, distCm };
        }

        if (dominant && dominant.strength > 0.02) {
          const interval = beepInterval(dominant.strength);
          const nowMs = elapsed * 1000;
          if (Number.isFinite(interval) && nowMs - lastBeep >= interval) {
            lastBeep = nowMs;
            audio.beep(toneOf(dominant.def.material), dominant.strength);
            haptics.signal(dominant.strength);
          }
        }

        const canDig =
          !!dominant && dominant.strength > 0.3 && dominant.distCm <= digTolerance(dominant.def, detector) * 1.1;

        // What's worth CK's attention right now, in priority order: a thing
        // he can act on, a strong signal, or — failing those — a hazard he's
        // giving a wide berth. Drives both ear-perk/interest and the head turn.
        let attentionDx = 0;
        let attentionDz = 0;
        let interest = 0;
        if (target) {
          attentionDx = target.position.x - player.x;
          attentionDz = target.position.z - player.z;
          interest = 1;
        } else if (dominant && dominant.strength > 0.15) {
          attentionDx = dominant.dig.position.x - player.x;
          attentionDz = dominant.dig.position.z - player.z;
          interest = dominant.strength;
        } else if (nearestHazardPos && wary > 0.3) {
          attentionDx = nearestHazardPos.x - player.x;
          attentionDz = nearestHazardPos.z - player.z;
        }
        const headTurn =
          interest > 0 || wary > 0.3 ? headTurnToward(player.yaw, attentionDx, attentionDz) : 0;

        ck.root.position.set(player.x, 0, player.z);
        ck.root.rotation.y = player.yaw;
        ck.update(dt, {
          moving: move.magnitude > 0.05,
          effort: move.magnitude,
          signal: dominant?.strength ?? 0,
          interest,
          wary,
          headTurn,
          traversal: catRoute?.kind === 'squeeze' || catRoute?.kind === 'crawl' ? catRoute.kind : 'none',
        });

        const camPose = thirdPersonCameraPose(player.x, player.z, player.yaw, player.pitch, {
          distance: CAM_DISTANCE,
          height: CAM_HEIGHT,
          lookHeight: CAM_LOOK_HEIGHT,
          pitchMin: CAM_PITCH_MIN,
          pitchMax: CAM_PITCH_MAX,
        });
        camera.position.set(camPose.x, camPose.y, camPose.z);
        camera.lookAt(camPose.lookX, camPose.lookY, camPose.lookZ);

        let promptLabel: string | null = null;
        if (target) {
          promptLabel = target.prompt;
          promptRef.current = { label: target.prompt, act: () => interact(target) };
        } else if (canDig && dominant) {
          promptLabel = 'Dig here';
          const snapshot = dominant;
          promptRef.current = { label: 'Dig here', act: () => digHere(snapshot) };
        } else {
          promptRef.current = null;
        }

        if (promptLabel !== lastPromptLabel) {
          lastPromptLabel = promptLabel;
          setHud((prev) => (prev.promptLabel === promptLabel ? prev : { ...prev, promptLabel }));
        }

        publishExploreFrame({ x: player.x, z: player.z, yaw: player.yaw, promptLabel });

        renderer.render(built.scene, camera);
      });

      return () => {
        // Session-local only — see siteExplorePoses' own comment. Saved on
        // every unmount (not just a real "leave"), since a dig's route
        // detour unmounts this screen the exact same way leaving does.
        siteExplorePoses.set(site.id, { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch });
        loop.stop();
        detachMove();
        detachLook();
        renderer.dispose();
        disposeScene();
        audio.ambience(null);
        promptRef.current = null;
      };
    } else if (location && field) {
      const built = buildFieldScene(location, field.seed);
      built.scene.add(camera);
      built.scene.add(ck.root);
      disposeScene = built.dispose;
      const player: PlayerState = {
        x: fieldToWorld(field.playerX, built.halfWidth),
        z: fieldToWorld(field.playerY, built.halfHeight),
        yaw: 0,
        pitch: 0,
      };

      let sweepPhase = 0;
      let sweepAmp = 1;
      let lastSweepSign = 1;
      let signal = 0;
      let pinpointing = false;
      let mark: { x: number; y: number; at: number } | null = null;
      let coilXcm = field.playerX;
      let coilYcm = field.playerY;
      let dominantUid: string | null = null;
      const loudTargets = new Set<string>();

      const setPinpoint = (on: boolean) => {
        pinpointing = on;
        if (on) {
          audio.unlock();
          haptics.tap();
        }
        setHud((prev) => ({ ...prev, pinpointing: on, marked: on ? true : prev.marked }));
      };

      const digHere = () => {
        const detector = currentDetector();
        const digXcm = mark ? mark.x : coilXcm;
        const digYcm = mark ? mark.y : coilYcm;

        let best: { uid: string; targetId: string; dist: number; tolerance: number } | null = null;
        for (const t of field.targets) {
          if (t.dug) continue;
          const def = getTarget(t.targetId);
          if (!def) continue;
          const dist = Math.hypot(t.x - digXcm, t.y - digYcm);
          const tolerance = digTolerance(def, detector);
          if (dist > tolerance) continue;
          if (!best || dist < best.dist) best = { uid: t.uid, targetId: t.targetId, dist, tolerance };
        }

        audio.unlock();
        if (!best) {
          beginDig({
            locationId: field.locationId,
            targetUid: null,
            targetId: null,
            accuracy: 0,
            offsetAngle: 0,
            baseCondition: 100,
            depthCm: 0,
            digX: digXcm,
            digY: digYcm,
            seed: `${field.seed}_${Math.round(digXcm)}_${Math.round(digYcm)}`,
          });
          return;
        }

        const placed = field.targets.find((t) => t.uid === best!.uid)!;
        beginDig({
          locationId: field.locationId,
          targetUid: placed.uid,
          targetId: placed.targetId,
          accuracy: clamp01(1 - best.dist / best.tolerance) * 0.9 + 0.1,
          offsetAngle: Math.atan2(placed.y - digYcm, placed.x - digXcm),
          baseCondition: placed.baseCondition,
          depthCm: placed.depth,
          digX: digXcm,
          digY: digYcm,
          seed: `${placed.uid}_${Math.round(digXcm)}`,
          ...(placed.tutorial ? { tutorial: true } : {}),
        });
      };

      fieldActionsRef.current = { setPinpoint, dig: digHere };

      audio.ambience(location.ambience);

      let lastBeep = 0;
      let lastSave = 0;
      let lastPromptLabel: string | null = null;
      let hudAccumulator = 0;

      loop = startLoop((dt, elapsed) => {
        const rect = host.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        if (w !== lastW || h !== lastH) {
          lastW = w;
          lastH = h;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }

        const move = moveRef.current;
        const look = lookRef.current.consume(dt);
        const speed = WALK_SPEED * (pinpointing ? 0.42 : 1);

        stepPlayer(player, {
          dt,
          moveX: move.magnitude > 0.02 ? move.vector.x : 0,
          moveY: move.magnitude > 0.02 ? -move.vector.y : 0,
          yawDelta: look.yaw,
          pitchDelta: look.pitch,
          speed,
          colliders: [],
          bounds: { halfWidth: built.halfWidth, halfHeight: built.halfHeight },
          hazards: [],
          siteProgress: [],
        });

        // ── sweep ─────────────────────────────────────────────────────
        sweepAmp = lerp(sweepAmp, pinpointing ? 0.06 : 1, dt * 6);
        sweepPhase += dt * SWEEP_RATE * (pinpointing ? 0.3 : 1);
        const sign = Math.sign(Math.cos(sweepPhase)) || 1;
        if (sign !== lastSweepSign) {
          lastSweepSign = sign;
          if (!pinpointing) bumpStat('sweeps');
        }

        const coilWorld = sweepCoilPosition(player.x, player.z, player.yaw, sweepPhase, {
          forward: COIL_FORWARD,
          width: SWEEP_WIDTH,
          amp: sweepAmp,
        });
        coilXcm = worldToField(coilWorld.x, built.halfWidth);
        coilYcm = worldToField(coilWorld.z, built.halfHeight);

        if (pinpointing) {
          mark = { x: coilXcm, y: coilYcm, at: elapsed };
        } else if (mark) {
          const stale = elapsed - mark.at > MARK_LIFETIME;
          const walkedOff = Math.hypot(coilXcm - mark.x, coilYcm - mark.y) > 180;
          if (stale || walkedOff) mark = null;
        }

        // ── signal ────────────────────────────────────────────────────
        const detector = currentDetector();
        const sample = sampleField(field, coilXcm, coilYcm, detector, elapsed, { pinpointing });
        signal = lerp(signal, sample.noisy, clamp01(dt * 14));
        const read = sample.dominant ? readout(sample.dominant, detector, signal) : null;
        const tone = read?.tone ?? 'iron';

        const interval = beepInterval(signal);
        const nowMs = elapsed * 1000;
        if (Number.isFinite(interval) && nowMs - lastBeep >= interval) {
          lastBeep = nowMs;
          audio.beep(tone, signal);
          haptics.signal(signal);
        }

        if (sample.dominant && signal > 0.55 && !loudTargets.has(sample.dominant.target.uid)) {
          loudTargets.add(sample.dominant.target.uid);
          bumpStat('signalsFound');
        }
        dominantUid = sample.dominant?.target.uid ?? null;

        // ── CK + chase camera ────────────────────────────────────────
        let fieldHeadTurn = 0;
        if (sample.dominant && signal > 0.15) {
          const tx = fieldToWorld(sample.dominant.target.x, built.halfWidth);
          const tz = fieldToWorld(sample.dominant.target.y, built.halfHeight);
          fieldHeadTurn = headTurnToward(player.yaw, tx - player.x, tz - player.z);
        }
        ck.root.position.set(player.x, 0, player.z);
        ck.root.rotation.y = player.yaw;
        ck.update(dt, {
          moving: move.magnitude > 0.05 && !pinpointing,
          effort: move.magnitude,
          signal,
          interest: signal,
          headTurn: fieldHeadTurn,
        });

        const camPose = thirdPersonCameraPose(player.x, player.z, player.yaw, player.pitch, {
          distance: CAM_DISTANCE,
          height: CAM_HEIGHT,
          lookHeight: CAM_LOOK_HEIGHT,
          pitchMin: CAM_PITCH_MIN,
          pitchMax: CAM_PITCH_MAX,
        });
        camera.position.set(camPose.x, camPose.y, camPose.z);
        camera.lookAt(camPose.lookX, camPose.lookY, camPose.lookZ);

        // ── scenery clues: the OBSERVE half of the field ────────────────
        const discoveredIds = game.get().save.discoveries.map((d) => d.targetId);
        let nearestClue: SceneryClue | null = null;
        let nearestDist = Infinity;
        for (const clue of location.sceneryClues ?? []) {
          if (discoveredIds.includes(clue.targetId)) continue;
          const wx = fieldToWorld(clue.x, built.halfWidth);
          const wz = fieldToWorld(clue.y, built.halfHeight);
          const dx = wx - player.x;
          const dz = wz - player.z;
          const dist = Math.hypot(dx, dz);
          if (dist > clue.range) continue;
          if (dist > 0.6) {
            const angleToTarget = Math.atan2(dx, -dz);
            let diff = Math.abs(angleToTarget - player.yaw);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff > 0.95) continue;
          }
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestClue = clue;
          }
        }

        let promptLabel: string | null = null;
        if (nearestClue) {
          promptLabel = 'Look closer';
          const clue = nearestClue;
          promptRef.current = {
            label: 'Look closer',
            act: () => {
              audio.ui('tap');
              haptics.tap();
              const def = getTarget(clue.targetId);
              if (def) completeObservation({ def, locationId: location.id });
            },
          };
        } else {
          promptRef.current = null;
        }
        if (promptLabel !== lastPromptLabel) {
          lastPromptLabel = promptLabel;
          setHud((prev) => (prev.promptLabel === promptLabel ? prev : { ...prev, promptLabel }));
        }

        publishExploreFrame({ x: player.x, z: player.z, yaw: player.yaw, promptLabel });
        publishDetectorFrame({
          x: worldToField(player.x, built.halfWidth),
          y: worldToField(player.z, built.halfHeight),
          coilX: coilXcm,
          coilY: coilYcm,
          facing: player.yaw,
          signal,
          pinpointing,
          dominant: dominantUid,
        });

        // ── throttled HUD + persistence ──────────────────────────────
        hudAccumulator += dt;
        if (hudAccumulator > 0.12) {
          hudAccumulator = 0;
          const remaining = field.targets.filter((t) => !t.dug).length;
          const marked = !!mark;
          const hint = teaching ? teachingHint(signal, pinpointing) : null;
          setHud((prev) =>
            prev.remaining === remaining && prev.marked === marked && prev.hint === hint
              ? prev
              : { ...prev, remaining, marked, hint },
          );
        }

        if (elapsed - lastSave > 2) {
          lastSave = elapsed;
          savePlayerPosition(worldToField(player.x, built.halfWidth), worldToField(player.z, built.halfHeight));
        }

        renderer.render(built.scene, camera);
      });

      return () => {
        loop.stop();
        detachMove();
        detachLook();
        renderer.dispose();
        disposeScene();
        savePlayerPosition(worldToField(player.x, built.halfWidth), worldToField(player.z, built.halfHeight));
        audio.ambience(null);
        promptRef.current = null;
        fieldActionsRef.current = null;
      };
    } else {
      // Neither branch could actually build a scene (e.g. field/location
      // mismatch) — bail out to the map rather than render a blank canvas.
      leaveSite();
      return;
    }
    // The loop owns its own state; it must not be torn down on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, site?.id, field?.locationId, field?.seed]);

  if (mode === null) return null;

  const worldName = mode === 'site' ? site!.name : location!.name;

  return (
    <div className="screen screen--world" ref={hostRef}>
      <canvas ref={canvasRef} className="world" data-testid="explore-canvas" />
      <div ref={moveZoneRef} style={{ position: 'absolute', inset: 0, width: '44%', touchAction: 'none' }} />
      <div ref={lookZoneRef} style={{ position: 'absolute', inset: 0, left: '44%', touchAction: 'none' }} />

      <div className="world-ui">
        <div className="world-top">
          <div className="chip">{worldName}</div>
          <div style={{ flex: 1 }} />
          <Btn small variant="ghost" sound="back" onClick={() => leaveSite()}>
            Leave
          </Btn>
        </div>

        {game.get().notice ? (
          <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="notice" data-testid="notice">
              {game.get().notice}
            </div>
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: hud.promptLabel ? 10 : 6,
              height: hud.promptLabel ? 10 : 6,
              borderRadius: '50%',
              background: hud.promptLabel ? 'rgba(240,230,210,0.92)' : 'rgba(240,230,210,0.4)',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
              transition: 'width 0.15s, height 0.15s, background 0.15s',
            }}
          />
        </div>

        <div className="world-bottom">
          {mode === 'field' && hud.remaining === 0 ? (
            <div className="readout" data-ui="true">
              <div className="label">Ground cleared</div>
              <p className="card__sub" style={{ margin: '4px 0 10px' }}>
                Nothing left down there that the collar can hear.
              </p>
              <Btn
                small
                variant="primary"
                wide
                onClick={() => {
                  enterLocation(location!.id, true);
                  notice('Fresh ground.');
                }}
              >
                Search fresh ground
              </Btn>
            </div>
          ) : null}

          {hud.promptLabel ? (
            <Btn
              variant="primary"
              wide
              sound="none"
              onClick={() => promptRef.current?.act()}
              data-testid="site-interact"
            >
              {hud.promptLabel}
            </Btn>
          ) : mode === 'field' && hud.hint ? (
            <div className="notice" data-testid="hint">
              {hud.hint}
            </div>
          ) : null}

          {mode === 'field' ? (
            <div className="controls">
              <button
                className="btn hold"
                data-ui="true"
                data-testid="pinpoint"
                onPointerDown={(e) => {
                  fieldActionsRef.current?.setPinpoint(true);
                  capturePointer(e.currentTarget, e.pointerId);
                }}
                onPointerUp={() => fieldActionsRef.current?.setPinpoint(false)}
                onPointerCancel={() => fieldActionsRef.current?.setPinpoint(false)}
                onPointerLeave={() => fieldActionsRef.current?.setPinpoint(false)}
              >
                {hud.pinpointing ? 'Holding' : 'Pinpoint'}
              </button>
              <Btn
                variant={hud.marked ? 'primary' : 'default'}
                onClick={() => fieldActionsRef.current?.dig()}
                sound="none"
                data-testid="dig"
              >
                {hud.marked ? 'Dig the mark' : 'Dig here'}
              </Btn>
            </div>
          ) : null}
        </div>

        {mode === 'site' && hud.showIntro ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(8,9,7,0.85)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '28px 26px',
            }}
          >
            {site!.intro.map((line, i) => (
              <p
                key={i}
                className="serif"
                style={{
                  color: '#cfc7b2',
                  fontSize: i === 0 ? 22 : 16,
                  textAlign: i === 0 ? 'center' : 'left',
                  letterSpacing: i === 0 ? '0.08em' : 'normal',
                }}
              >
                {line}
              </p>
            ))}
            <div style={{ marginTop: 20 }}>
              <Btn
                variant="primary"
                wide
                data-testid="explore-begin"
                onClick={() => {
                  if (site) introSeenSites.add(site.id);
                  setHud((prev) => ({ ...prev, showIntro: false }));
                }}
              >
                Begin
              </Btn>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function teachingHint(signal: number, pinpointing: boolean): string | null {
  if (signal < 0.18) return "Walk. Watch CK's ears — the collar talks through him.";
  if (signal < 0.45) return "Something's down there. Keep going.";
  if (!pinpointing) return 'Hold PINPOINT to stop and narrow it down.';
  return 'Strongest point wins. DIG HERE.';
}

// Default export so this screen — and the Three.js it pulls in — can be code-split
// with React.lazy: nobody pays for the 3D engine until they actually walk into a site.
export default ExploreScreenImpl;
