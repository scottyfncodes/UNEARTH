import { useEffect, useRef, useState } from 'react';
import { getLocation } from '@/content/locations';
import { getTarget } from '@/content/targets';
import {
  beginDig,
  bumpStat,
  currentDetector,
  enterLocation,
  game,
  go,
  notice,
  savePlayerPosition,
} from '@/core/gameState';
import { clamp, clamp01, lerp } from '@/core/rng';
import { publishDetectorFrame } from '@/core/debug';
import { beepInterval, digTolerance, readout, sampleField, type Readout } from '@/systems/detection';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { capturePointer, fitCanvas, MoveController } from '@/engine/input';
import { startLoop } from '@/engine/loop';
import { WorldRenderer, type Pulse, type WorldView } from '@/engine/render/world';
import { useGameState } from '../useGame';
import { Btn } from '../components/ui';

const WALK_SPEED = 108; // cm/s
const SWEEP_RATE = 2.35; // rad/s
const SWEEP_WIDTH = 46; // cm either side
const COIL_FORWARD = 62; // cm ahead of the player
/** Seconds a pinpoint mark stays diggable after the button is released. */
const MARK_LIFETIME = 6;

interface Session {
  x: number;
  y: number;
  facing: number;
  sweepPhase: number;
  sweepAmp: number;
  coilX: number;
  coilY: number;
  signal: number;
  trail: { x: number; y: number }[];
  pulses: Pulse[];
  lastBeep: number;
  pinpointing: boolean;
  lastSave: number;
  lastSweepSign: number;
  loudTargets: Set<string>;
  /** Where the player last pinpointed. Digging uses this, not the live coil. */
  mark: { x: number; y: number; at: number } | null;
}

export function DetectScreen() {
  const { save } = useGameState();
  const field = save.field;
  const location = field ? getLocation(field.locationId) : undefined;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const moveRef = useRef(new MoveController());
  const rendererRef = useRef(new WorldRenderer());

  const [hud, setHud] = useState<{
    signal: number;
    readout: Readout | null;
    pinpointing: boolean;
    marked: boolean;
  }>({ signal: 0, readout: null, pinpointing: false, marked: false });

  const remaining = field ? field.targets.filter((t) => !t.dug).length : 0;
  const teaching = !save.flags.tutorialFound;

  // Bail out cleanly if somebody lands here without a field.
  useEffect(() => {
    if (!field || !location) go('map');
  }, [field, location]);

  useEffect(() => {
    if (!field || !location) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const session: Session = {
      x: field.playerX,
      y: field.playerY,
      facing: -Math.PI / 2,
      sweepPhase: 0,
      sweepAmp: 1,
      coilX: field.playerX,
      coilY: field.playerY - COIL_FORWARD,
      signal: 0,
      trail: [],
      pulses: [],
      lastBeep: 0,
      pinpointing: false,
      lastSave: 0,
      lastSweepSign: 1,
      loudTargets: new Set(),
      mark: null,
    };
    sessionRef.current = session;

    const detach = moveRef.current.attach(host);
    audio.ambience(location.ambience);

    let hudAccumulator = 0;
    let lastHudKey = '';

    const loop = startLoop((dt, elapsed) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h, dpr } = fitCanvas(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── movement ────────────────────────────────────────────────────
      const move = moveRef.current;
      const speed = WALK_SPEED * (session.pinpointing ? 0.42 : 1);
      if (move.magnitude > 0.02) {
        session.x = clamp(session.x + move.vector.x * speed * dt, 20, location.bounds.w - 20);
        session.y = clamp(session.y + move.vector.y * speed * dt, 20, location.bounds.h - 20);
        const targetFacing = Math.atan2(move.vector.y, move.vector.x);
        session.facing = turnTowards(session.facing, targetFacing, dt * 7);
      }

      // ── sweep ───────────────────────────────────────────────────────
      session.sweepAmp = lerp(session.sweepAmp, session.pinpointing ? 0.06 : 1, dt * 6);
      session.sweepPhase += dt * SWEEP_RATE * (session.pinpointing ? 0.3 : 1);
      const lateral = Math.sin(session.sweepPhase) * SWEEP_WIDTH * session.sweepAmp;
      const sign = Math.sign(Math.cos(session.sweepPhase)) || 1;
      if (sign !== session.lastSweepSign) {
        session.lastSweepSign = sign;
        if (!session.pinpointing) bumpStat('sweeps');
      }

      const forward = COIL_FORWARD * (session.pinpointing ? 0.8 : 1);
      session.coilX = session.x + Math.cos(session.facing) * forward - Math.sin(session.facing) * lateral;
      session.coilY = session.y + Math.sin(session.facing) * forward + Math.cos(session.facing) * lateral;

      // While pinpointing, the coil position is continuously marked so the
      // player can release the button and still dig the spot they found.
      if (session.pinpointing) {
        session.mark = { x: session.coilX, y: session.coilY, at: elapsed };
      } else if (session.mark) {
        const stale = elapsed - session.mark.at > MARK_LIFETIME;
        const walkedOff = Math.hypot(session.x - session.mark.x, session.y - session.mark.y) > 180;
        if (stale || walkedOff) session.mark = null;
      }

      // ── signal ──────────────────────────────────────────────────────
      const detector = currentDetector();
      const sample = sampleField(field, session.coilX, session.coilY, detector, elapsed, {
        pinpointing: session.pinpointing,
      });
      // Smooth so the audio doesn't chatter, but stay responsive.
      session.signal = lerp(session.signal, sample.noisy, clamp01(dt * 14));

      const read = sample.dominant ? readout(sample.dominant, detector, session.signal) : null;
      const tone = read?.tone ?? 'iron';

      // ── beeps, ripples, haptics ─────────────────────────────────────
      const interval = beepInterval(session.signal);
      const nowMs = elapsed * 1000;
      if (Number.isFinite(interval) && nowMs - session.lastBeep >= interval) {
        session.lastBeep = nowMs;
        audio.beep(tone, session.signal);
        haptics.signal(session.signal);
        session.pulses.push({ x: session.coilX, y: session.coilY, age: 0, strength: session.signal });
      }
      for (let i = session.pulses.length - 1; i >= 0; i--) {
        const pulse = session.pulses[i]!;
        pulse.age += dt;
        if (pulse.age > 0.9) session.pulses.splice(i, 1);
      }

      if (sample.dominant && session.signal > 0.55 && !session.loudTargets.has(sample.dominant.target.uid)) {
        session.loudTargets.add(sample.dominant.target.uid);
        bumpStat('signalsFound');
      }

      // ── trail ───────────────────────────────────────────────────────
      session.trail.push({ x: session.coilX, y: session.coilY });
      if (session.trail.length > 26) session.trail.shift();

      // ── draw ────────────────────────────────────────────────────────
      const view: WorldView = {
        location,
        playerX: session.x,
        playerY: session.y,
        facing: session.facing,
        coilX: session.coilX,
        coilY: session.coilY,
        trail: session.trail,
        signal: session.signal,
        tone,
        pinpointing: session.pinpointing,
        pulses: session.pulses,
        holes: field.holes,
        elapsed,
        shake: 0,
        mark: session.mark
          ? {
              x: session.mark.x,
              y: session.mark.y,
              age: session.pinpointing ? 0 : elapsed - session.mark.at,
              life: MARK_LIFETIME,
            }
          : null,
      };
      rendererRef.current.draw(ctx, w, h, view);

      publishDetectorFrame({
        x: session.x,
        y: session.y,
        coilX: session.coilX,
        coilY: session.coilY,
        facing: session.facing,
        signal: session.signal,
        pinpointing: session.pinpointing,
        dominant: sample.dominant?.target.uid ?? null,
      });

      // ── HUD, throttled so React isn't in the frame budget ───────────
      hudAccumulator += dt;
      if (hudAccumulator > 0.1) {
        hudAccumulator = 0;
        const quantised = Math.round(session.signal * 24) / 24;
        // The pinpoint state has to be part of the key, or a rock-steady
        // signal would leave the readout and the hints frozen.
        const key = `${quantised}|${sample.dominant?.target.uid ?? ''}|${session.pinpointing}|${!!session.mark}`;
        if (key !== lastHudKey) {
          lastHudKey = key;
          setHud({
            signal: quantised,
            readout: session.pinpointing ? read : null,
            pinpointing: session.pinpointing,
            marked: !!session.mark,
          });
        }
      }

      // ── persist position occasionally ───────────────────────────────
      if (elapsed - session.lastSave > 2) {
        session.lastSave = elapsed;
        savePlayerPosition(session.x, session.y);
      }
    });

    return () => {
      loop.stop();
      detach();
      savePlayerPosition(session.x, session.y);
      audio.ambience(null);
      sessionRef.current = null;
    };
    // The loop owns its own state; it must not be torn down on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.locationId, field?.seed]);

  const setPinpoint = (on: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    session.pinpointing = on;
    if (on) {
      audio.unlock();
      haptics.tap();
    }
    setHud((prev) => ({
      ...prev,
      pinpointing: on,
      readout: on ? prev.readout : null,
      marked: on ? true : prev.marked,
    }));
  };

  const dig = () => {
    const session = sessionRef.current;
    if (!session || !field) return;
    const detector = currentDetector();
    // Dig where the player pinpointed; fall back to the live coil if they
    // never stopped the sweep.
    const digX = session.mark ? session.mark.x : session.coilX;
    const digY = session.mark ? session.mark.y : session.coilY;

    // Which buried target — if any — is actually under this hole?
    let best: { uid: string; targetId: string; dist: number; tolerance: number } | null = null;
    for (const target of field.targets) {
      if (target.dug) continue;
      const def = getTarget(target.targetId);
      if (!def) continue;
      const dist = Math.hypot(target.x - digX, target.y - digY);
      const tolerance = digTolerance(def, detector);
      if (dist > tolerance) continue;
      if (!best || dist < best.dist) best = { uid: target.uid, targetId: target.targetId, dist, tolerance };
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
        digX,
        digY,
        seed: `${field.seed}_${Math.round(digX)}_${Math.round(digY)}`,
      });
      return;
    }

    const placed = field.targets.find((t) => t.uid === best!.uid)!;
    beginDig({
      locationId: field.locationId,
      targetUid: placed.uid,
      targetId: placed.targetId,
      accuracy: clamp01(1 - best.dist / best.tolerance) * 0.9 + 0.1,
      offsetAngle: Math.atan2(placed.y - digY, placed.x - digX),
      baseCondition: placed.baseCondition,
      depthCm: placed.depth,
      digX,
      digY,
      seed: `${placed.uid}_${Math.round(digX)}`,
      ...(placed.tutorial ? { tutorial: true } : {}),
    });
  };

  if (!field || !location) return null;

  const hint = teaching ? teachingHint(hud.signal, hud.pinpointing) : null;
  const strong = hud.signal > 0.42;

  return (
    <div className="screen screen--world" ref={hostRef}>
      <canvas ref={canvasRef} className="world" data-testid="world-canvas" />

      <div className="world-ui">
        <div className="world-top">
          <div className="chip" data-ui="true">
            {location.name}
          </div>
          <div style={{ flex: 1 }} />
          <Btn
            small
            variant="ghost"
            sound="back"
            onClick={() => {
              go('map');
            }}
          >
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

        <div className="world-bottom">
          {remaining === 0 ? (
            <div className="readout" data-ui="true">
              <div className="label">Ground cleared</div>
              <p className="card__sub" style={{ margin: '4px 0 10px' }}>
                Nothing left down there that this coil can hear.
              </p>
              <Btn
                small
                variant="primary"
                wide
                onClick={() => {
                  enterLocation(location.id, true);
                  notice('Fresh ground.');
                }}
              >
                Search fresh ground
              </Btn>
            </div>
          ) : null}

          {hud.readout ? (
            <div className="readout" data-ui="true" data-testid="readout">
              <div className="row row--between">
                <span className="label">Signal</span>
                <span className="mono tiny">{Math.round(hud.signal * 100)}%</span>
              </div>
              <div className="grid2" style={{ marginTop: 8 }}>
                <div>
                  <div className="stat__label">Material</div>
                  <div className="stat__value">{hud.readout.label}</div>
                </div>
                <div>
                  <div className="stat__label">Depth</div>
                  <div className="stat__value">{hud.readout.depthLabel}</div>
                </div>
                <div>
                  <div className="stat__label">Size</div>
                  <div className="stat__value">{hud.readout.sizeLabel}</div>
                </div>
                <div>
                  <div className="stat__label">Confidence</div>
                  <div className="stat__value">
                    {hud.readout.confidence > 0.75
                      ? 'High'
                      : hud.readout.confidence > 0.45
                        ? 'Fair'
                        : 'Low'}
                  </div>
                </div>
              </div>
            </div>
          ) : hint ? (
            <div className="notice" data-testid="hint">
              {hint}
            </div>
          ) : null}

          <div className="controls">
            <button
              className="btn hold"
              data-ui="true"
              data-testid="pinpoint"
              onPointerDown={(e) => {
                setPinpoint(true);
                capturePointer(e.currentTarget, e.pointerId);
              }}
              onPointerUp={() => setPinpoint(false)}
              onPointerCancel={() => setPinpoint(false)}
              onPointerLeave={() => setPinpoint(false)}
            >
              {hud.pinpointing ? 'Holding' : 'Pinpoint'}
            </button>
            <Btn
              variant={strong || hud.marked ? 'primary' : 'default'}
              onClick={dig}
              sound="none"
              data-testid="dig"
            >
              {hud.marked ? 'Dig the mark' : 'Dig here'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function teachingHint(signal: number, pinpointing: boolean): string | null {
  if (signal < 0.18) return 'Walk. Listen for the beeps to quicken.';
  if (signal < 0.45) return "Something's down there. Keep going.";
  if (!pinpointing) return 'Hold PINPOINT to stop the sweep and narrow it down.';
  return 'Strongest point wins. DIG HERE.';
}

/** Shortest-path angle turn. */
function turnTowards(current: number, target: number, amount: number): number {
  let delta = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const step = clamp(delta, -amount, amount);
  return current + step;
}
