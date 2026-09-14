import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getSite } from '@/content/sites';
import type { DetectorDig, SiteInteractable } from '@/content/sites/types';
import { LOCATIONS } from '@/content/locations';
import { getTarget } from '@/content/targets';
import {
  addSiteFlag,
  beginDig,
  completeObservation,
  currentDetector,
  game,
  leaveSite,
  notice,
} from '@/core/gameState';
import type { PlacedTarget, TargetDef } from '@/core/types';
import { clamp01 } from '@/core/rng';
import { beepInterval, digTolerance, targetSignal, toneOf } from '@/systems/detection';
import {
  buildColliders,
  isInteractableAvailable,
  nearestInteractable,
  type Collider,
  type PlayerState,
  stepPlayer,
} from '@/systems/explore';
import { buildSiteScene } from '@/engine/scene3d/build';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { LookController, MoveController } from '@/engine/input';
import { startLoop } from '@/engine/loop';
import { publishExploreFrame } from '@/core/debug';
import { useGameState } from '../useGame';
import { Btn } from '../components/ui';

const WALK_SPEED = 2.15; // m/s — a comfortable, unhurried walking pace
const EYE_HEIGHT = 1.66;

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

function ExploreScreenImpl() {
  useGameState(); // subscribe so notice()/save changes re-render the overlay
  const activeSiteId = game.get().activeSite;
  const site = activeSiteId ? getSite(activeSiteId) : undefined;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moveZoneRef = useRef<HTMLDivElement>(null);
  const lookZoneRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef(new MoveController());
  const lookRef = useRef(new LookController());
  const promptRef = useRef<Prompt | null>(null);

  const [hud, setHud] = useState<{ promptLabel: string | null; showIntro: boolean }>({
    promptLabel: null,
    showIntro: true,
  });

  useEffect(() => {
    if (!site) {
      leaveSite();
      return;
    }
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const moveZone = moveZoneRef.current;
    const lookZone = lookZoneRef.current;
    if (!canvas || !host || !moveZone || !lookZone) return;

    const hostLocation = LOCATIONS.find((l) => l.siteId === site.id);
    const hostLocationId = hostLocation?.id ?? site.id;

    const built = buildSiteScene(site);
    const colliders: Collider[] = buildColliders(site.props);
    const player: PlayerState = { x: site.spawn.x, z: site.spawn.z, yaw: site.spawnYaw, pitch: 0 };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Far plane comfortably past the sky dome (built at a fixed radius of 320)
    // so it never gets near-clipped away, even though fog hides real geometry
    // long before that distance.
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
    camera.rotation.order = 'YXZ';

    const refreshVisibility = () => {
      const s = game.get().save;
      const state = { siteProgress: s.siteProgress, discovered: s.discoveries.map((d) => d.targetId) };
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

    const detachMove = moveRef.current.attach(moveZone);
    const detachLook = lookRef.current.attach(lookZone);
    audio.unlock();
    audio.ambience(site.ambience);

    let lastW = 0;
    let lastH = 0;
    let lastBeep = 0;
    let bobPhase = 0;
    let lastHazardWarnAt = -10;
    let lastPromptLabel: string | null = null;

    const loop = startLoop((dt, elapsed) => {
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

      if (result.hazard && elapsed - lastHazardWarnAt > 3.2) {
        lastHazardWarnAt = elapsed;
        notice(result.hazard.warning);
        haptics.danger();
      }

      bobPhase += dt * (move.magnitude > 0.05 ? 7.2 : 0);
      const bob = move.magnitude > 0.05 ? Math.sin(bobPhase) * 0.028 : 0;

      camera.position.set(player.x, EYE_HEIGHT + bob, player.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      const state = { siteProgress: currentSave.siteProgress, discovered };
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
      loop.stop();
      detachMove();
      detachLook();
      renderer.dispose();
      built.dispose();
      audio.ambience(null);
      promptRef.current = null;
    };
    // The loop owns its own state; it must not be torn down on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  if (!site) return null;

  return (
    <div className="screen screen--world" ref={hostRef}>
      <canvas ref={canvasRef} className="world" data-testid="explore-canvas" />
      <div ref={moveZoneRef} style={{ position: 'absolute', inset: 0, width: '44%', touchAction: 'none' }} />
      <div ref={lookZoneRef} style={{ position: 'absolute', inset: 0, left: '44%', touchAction: 'none' }} />

      <div className="world-ui">
        <div className="world-top">
          <div className="chip">{site.name}</div>
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
          ) : null}
        </div>

        {hud.showIntro ? (
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
            {site.intro.map((line, i) => (
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
                onClick={() => setHud((prev) => ({ ...prev, showIntro: false }))}
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

// Default export so this screen — and the Three.js it pulls in — can be code-split
// with React.lazy: nobody pays for the 3D engine until they actually walk into a site.
export default ExploreScreenImpl;
