import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SEALED_CHAMBER } from '@/content/adventure/sealedChamber';
import { getTarget } from '@/content/targets';
import {
  adventureStatus,
  completeExtraction,
  go,
  setAdventureStatus,
} from '@/core/gameState';
import { clamp } from '@/core/rng';
import {
  brushPlate,
  createMechanism,
  drainMechanismEvents,
  holdClamp,
  liftArtifact,
  nextExpectedOrder,
  releaseHold,
  stepMechanism,
  touchRim,
  type MechanismState,
} from '@/systems/mechanism';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';
import { capturePointer, fitCanvas } from '@/engine/input';
import { startLoop } from '@/engine/loop';
import { MechanismRenderer } from '@/engine/render/mechanism';
import { Btn, Meter, TopBar } from '../components/ui';

type Stage = 'intro' | 'beat' | 'puzzle' | 'mechanism' | 'escape' | 'outro' | 'revisit';

const ADV = SEALED_CHAMBER;

export function AdventureScreen() {
  const complete = adventureStatus(ADV.id) === 'complete';
  const [stage, setStage] = useState<Stage>(complete ? 'revisit' : 'intro');
  const [beatId, setBeatId] = useState(ADV.startBeat);
  const [dials, setDials] = useState<number[]>([...ADV.puzzle.start]);
  const [conditionAfterMechanism, setConditionAfterMechanism] = useState(100);
  const [escapeCondition, setEscapeCondition] = useState(100);

  const beat = ADV.beats.find((b) => b.id === beatId) ?? ADV.beats[0]!;

  useEffect(() => {
    audio.unlock();
    audio.ambience('chamber');
    return () => {
      audio.danger(false);
      audio.ambience(null);
    };
  }, []);

  const solved = useMemo(
    () => dials.every((value, index) => value === ADV.puzzle.solution[index]),
    [dials],
  );

  if (stage === 'revisit') {
    return (
      <div className="screen">
        <TopBar title={ADV.title} subtitle="Already emptied" />
        <div className="scroll">
          {ADV.outro.map((line, i) => (
            <p key={i} className="serif" style={{ color: '#cfc7b2' }}>
              {line}
            </p>
          ))}
          <p className="card__sub">
            The jaws of the mechanism are open and there is nothing left in them. Whatever else is
            down here, it is not in this room.
          </p>
          <Btn variant="ghost" wide onClick={() => go('map')} sound="back">
            Back to the map
          </Btn>
        </div>
      </div>
    );
  }

  if (stage === 'intro') {
    return (
      <TextStage
        title={ADV.title}
        subtitle="Beneath the north-west spur"
        lines={ADV.intro}
        actionLabel="Go in"
        onAction={() => setStage('beat')}
      />
    );
  }

  if (stage === 'beat') {
    return (
      <div className="screen">
        <TopBar title={beat.heading} subtitle={ADV.title} />
        <div className="scroll">
          {beat.lines.map((line, i) => (
            <p key={i} className="serif" style={{ color: '#cfc7b2', fontSize: 16 }}>
              {line}
            </p>
          ))}
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {beat.choices.map((choice) => (
              <button
                key={choice.label}
                className="card"
                style={{ marginBottom: 0 }}
                onClick={() => {
                  audio.ui('tap');
                  haptics.tap();
                  if (choice.to === 'puzzle') setStage('puzzle');
                  else setBeatId(choice.to);
                }}
              >
                <strong className="serif">{choice.label}</strong>
                {choice.note ? <p className="card__sub">{choice.note}</p> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'puzzle') {
    return (
      <DialPuzzleStage
        dials={dials}
        solved={solved}
        onTurn={(index) => {
          setDials((prev) =>
            prev.map((value, i) => (i === index ? (value + 1) % ADV.puzzle.positions : value)),
          );
          audio.mechanism();
          haptics.tap();
        }}
        onContinue={() => setStage('mechanism')}
      />
    );
  }

  if (stage === 'mechanism') {
    return (
      <MechanismStage
        onDone={(condition) => {
          setConditionAfterMechanism(condition);
          setEscapeCondition(condition);
          setStage('escape');
        }}
      />
    );
  }

  if (stage === 'escape') {
    return (
      <EscapeStage
        startCondition={conditionAfterMechanism}
        onDone={(condition) => {
          setEscapeCondition(condition);
          setStage('outro');
        }}
      />
    );
  }

  // outro
  return (
    <TextStage
      title="Out"
      subtitle={ADV.title}
      lines={ADV.outro}
      actionLabel="Look at what you have"
      onAction={() => {
        const def = getTarget(ADV.artifactTargetId);
        if (!def) {
          go('map');
          return;
        }
        setAdventureStatus(ADV.id, 'complete');
        completeExtraction({
          def,
          condition: escapeCondition,
          depthCm: 0,
          locationId: ADV.locationId,
        });
      }}
    />
  );
}

function TextStage({
  title,
  subtitle,
  lines,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  lines: string[];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="screen">
      <TopBar title={title} subtitle={subtitle} />
      <div className="scroll">
        {lines.map((line, i) => (
          <p key={i} className="serif" style={{ color: '#cfc7b2', fontSize: 16 }}>
            {line}
          </p>
        ))}
        <div style={{ marginTop: 24 }}>
          <Btn variant="primary" wide onClick={onAction} data-testid="adventure-continue">
            {actionLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function DialPuzzleStage({
  dials,
  solved,
  onTurn,
  onContinue,
}: {
  dials: number[];
  solved: boolean;
  onTurn: (index: number) => void;
  onContinue: () => void;
}) {
  const step = 360 / ADV.puzzle.positions;
  return (
    <div className="screen">
      <TopBar title="The Door" subtitle="Three rings, one symbol" />
      <div className="scroll">
        <p className="serif" style={{ color: '#cfc7b2', fontSize: 16 }}>
          {ADV.puzzle.prompt}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            margin: '26px 0',
          }}
        >
          {dials.map((value, index) => (
            <button
              key={index}
              data-testid={`dial-${index}`}
              onClick={() => onTurn(index)}
              style={{
                width: 92,
                height: 92,
                borderRadius: '50%',
                border: '1px solid var(--line-strong)',
                background: 'radial-gradient(circle at 35% 30%, #4a4038, #1c1816)',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `rotate(${value * step}deg)`,
                  transition: 'transform 0.25s cubic-bezier(0.3,0.9,0.3,1)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 8,
                    width: 6,
                    height: 30,
                    marginLeft: -3,
                    borderRadius: 3,
                    background: 'linear-gradient(180deg, #f0cf6a, #8a6a2c)',
                  }}
                />
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 16,
                  height: 16,
                  marginLeft: -8,
                  marginTop: -8,
                  borderRadius: '50%',
                  background: '#2a2420',
                  border: '1px solid var(--line)',
                }}
              />
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="label">
            {solved ? 'The rings are seated' : 'Rays: ' + dials.map((d) => d).join(' · ')}
          </div>
        </div>

        {solved ? (
          <>
            <p className="serif" style={{ color: '#cfc7b2', marginTop: 22 }}>
              {ADV.puzzle.solvedText}
            </p>
            <Btn variant="primary" wide onClick={onContinue} data-testid="puzzle-continue">
              Step inside
            </Btn>
          </>
        ) : (
          <p className="tiny" style={{ textAlign: 'center', marginTop: 20 }}>
            The token shows three rays, evenly spaced. Nothing else fits.
          </p>
        )}
      </div>
    </div>
  );
}

function MechanismStage({ onDone }: { onDone: (condition: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MechanismState>(createMechanism(ADV.mechanism));
  const rendererRef = useRef(new MechanismRenderer());
  const activeClampRef = useRef<string | null>(null);
  const flashRef = useRef(0);
  const shakeRef = useRef(0);
  const collapseRef = useRef(0);
  const brushRef = useRef<{ down: boolean; x: number; y: number }>({ down: false, x: 0, y: 0 });

  const [hud, setHud] = useState({
    tension: 0,
    condition: 100,
    dust: 1,
    released: 0,
    free: false,
    collapsing: false,
    orderKnown: false,
  });
  const [positions, setPositions] = useState<{ id: string; left: string; top: string }[]>([]);

  const finish = useCallback(
    (forced: boolean) => {
      const condition = liftArtifact(stateRef.current, forced);
      audio.reveal(true);
      haptics.reveal();
      onDone(condition);
    },
    [onDone],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const state = stateRef.current;

    // Brushing the plate + the pressure rim live on the host, not on buttons.
    const localPoint = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
    };

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ui="true"]')) return;
      const { x, y, rect } = localPoint(e);
      const plate = Math.min(rect.width - 20, rect.height - 20);
      const R = plate * 0.44;
      const dist = Math.hypot(x - rect.width / 2, y - rect.height / 2);
      if (dist > R * 0.88 && dist < R * 1.06) {
        touchRim(state);
        return;
      }
      brushRef.current = { down: true, x, y };
    };

    const onMove = (e: PointerEvent) => {
      if (!brushRef.current.down) return;
      const { x, y, rect } = localPoint(e);
      const travel = Math.hypot(x - brushRef.current.x, y - brushRef.current.y) / rect.width;
      brushRef.current = { down: true, x, y };
      if (travel > 0.001) {
        brushPlate(state, travel * 0.55);
        audio.brush(0.6);
      }
    };

    const onUp = () => {
      brushRef.current.down = false;
    };

    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    let hudTick = 0;
    let posTick = 0;

    const loop = startLoop((dt, elapsed) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h, dpr } = fitCanvas(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (activeClampRef.current) holdClamp(state, activeClampRef.current, dt);
      stepMechanism(state, dt);

      for (const event of drainMechanismEvents(state)) {
        switch (event.kind) {
          case 'click':
            audio.mechanism();
            haptics.strike();
            flashRef.current = 1;
            shakeRef.current = 9;
            break;
          case 'thunk':
            audio.strike();
            haptics.strike();
            flashRef.current = 0.7;
            shakeRef.current = 6;
            break;
          case 'release':
            audio.confirm();
            haptics.contact();
            break;
          case 'free':
            audio.reveal(true);
            haptics.reveal();
            break;
          case 'collapse':
            audio.danger(true);
            haptics.danger();
            shakeRef.current = 16;
            break;
        }
      }

      if (state.tension > 55 && !state.collapsing) audio.danger(true);
      if (state.collapsing) collapseRef.current = Math.min(1, collapseRef.current + dt * 0.35);

      flashRef.current = Math.max(0, flashRef.current - dt * 2);
      shakeRef.current = Math.max(0, shakeRef.current - dt * 22);
      if (state.collapsing) shakeRef.current = Math.max(shakeRef.current, 6);

      rendererRef.current.draw(ctx, w, h, {
        state,
        time: elapsed,
        shake: shakeRef.current,
        flash: flashRef.current,
        activeClamp: activeClampRef.current,
        collapseProgress: collapseRef.current,
      });

      posTick += dt;
      if (posTick > 0.3) {
        posTick = 0;
        setPositions(
          state.clamps.map((c) => ({
            id: c.id,
            ...MechanismRenderer.clampPosition(c.angle, c.released, w, h),
          })),
        );
      }

      hudTick += dt;
      if (hudTick > 0.1) {
        hudTick = 0;
        setHud((prev) => {
          const next = {
            tension: Math.round(state.tension),
            condition: Math.round(state.condition),
            dust: Math.round(state.dust * 20) / 20,
            released: state.released,
            free: state.free,
            collapsing: state.collapsing,
            orderKnown: state.orderKnown,
          };
          return prev.tension === next.tension &&
            prev.condition === next.condition &&
            prev.dust === next.dust &&
            prev.released === next.released &&
            prev.free === next.free &&
            prev.collapsing === next.collapsing &&
            prev.orderKnown === next.orderKnown
            ? prev
            : next;
        });
      }

      // The room comes down whether the artifact is loose or not.
      if (state.collapsing && collapseRef.current >= 1) {
        loop.stop();
        finish(true);
      }
    });

    return () => {
      loop.stop();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      audio.danger(false);
    };
  }, [finish]);

  const expected = nextExpectedOrder(stateRef.current);

  return (
    <div className="screen screen--world" ref={hostRef}>
      <canvas ref={canvasRef} className="world" data-testid="mechanism-canvas" />

      <div className="world-ui">
        <div className="world-top">
          <div className="chip">Sealed Chamber</div>
          <div style={{ flex: 1 }} />
        </div>

        <div style={{ padding: '10px 16px 0' }}>
          <div className="readout">
            <div className="row row--between">
              <span className="label">Mechanism tension</span>
              <span className="mono tiny" data-testid="tension">
                {hud.tension}%
              </span>
            </div>
            <div style={{ marginTop: 6 }}>
              <Meter
                value={hud.tension / 100}
                color={hud.tension > 70 ? 'var(--danger)' : hud.tension > 35 ? 'var(--gold)' : 'var(--good)'}
              />
            </div>
            <div className="row row--between" style={{ marginTop: 10 }}>
              <span className="label">Artifact condition</span>
              <span className="mono tiny">{hud.condition}%</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <Meter value={hud.condition / 100} />
            </div>
          </div>
        </div>

        {/* Clamp hotspots, positioned over the rendered arms. */}
        {positions.map((pos) => {
          const clamp_ = stateRef.current.clamps.find((c) => c.id === pos.id)!;
          return (
            <button
              key={pos.id}
              data-ui="true"
              data-testid={`clamp-${pos.id}`}
              disabled={clamp_.released || hud.free || hud.collapsing}
              onPointerDown={(e) => {
                activeClampRef.current = pos.id;
                capturePointer(e.currentTarget, e.pointerId);
              }}
              onPointerUp={() => {
                releaseHold(stateRef.current, pos.id);
                activeClampRef.current = null;
              }}
              onPointerCancel={() => {
                releaseHold(stateRef.current, pos.id);
                activeClampRef.current = null;
              }}
              onPointerLeave={() => {
                releaseHold(stateRef.current, pos.id);
                activeClampRef.current = null;
              }}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                transform: 'translate(-50%, -50%)',
                width: 74,
                height: 74,
                borderRadius: '50%',
                border: clamp_.released ? '1px solid var(--line)' : '1px solid var(--line-strong)',
                background: clamp_.released ? 'rgba(20,24,21,0.3)' : 'rgba(20,24,21,0.55)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: clamp_.released ? 'var(--faint)' : 'var(--text)',
              }}
            >
              {clamp_.released ? 'Off' : 'Hold'}
            </button>
          );
        })}

        <div className="world-bottom">
          {hud.free ? (
            <>
              <div className="notice">It is loose. Take it and go.</div>
              <Btn variant="primary" wide data-testid="lift-artifact" onClick={() => finish(false)}>
                Take the disc
              </Btn>
            </>
          ) : hud.collapsing ? (
            <div className="notice" style={{ borderColor: 'var(--danger)' }}>
              The chamber is coming down.
            </div>
          ) : (
            <div className="notice">
              {hud.dust > 0.25
                ? 'Brush the plate. The dust is hiding something.'
                : hud.orderKnown
                  ? `Release clamp ${'I'.repeat(Math.min(3, expected))} — hold it steady.`
                  : 'Numerals. The clamps come off in order.'}
            </div>
          )}
          <p className="tiny" style={{ textAlign: 'center', margin: 0 }}>
            Drag to brush · hold a clamp to release it · keep off the outer rim
          </p>
        </div>
      </div>
    </div>
  );
}

function EscapeStage({
  startCondition,
  onDone,
}: {
  startCondition: number;
  onDone: (condition: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(ADV.escape[0]!.window);
  const [feedback, setFeedback] = useState<string | null>(null);
  const conditionRef = useRef(startCondition);
  const resolvedRef = useRef(false);

  const beat = ADV.escape[index];

  const advance = useCallback(
    (hit: boolean) => {
      if (resolvedRef.current || !beat) return;
      resolvedRef.current = true;
      if (hit) {
        audio.confirm();
        haptics.contact();
        setFeedback(beat.success);
      } else {
        audio.strike();
        haptics.strike();
        conditionRef.current = clamp(conditionRef.current - 6, 5, 100);
        setFeedback(beat.failure);
      }
      setTimeout(() => {
        const next = index + 1;
        if (next >= ADV.escape.length) {
          audio.danger(false);
          onDone(Math.round(conditionRef.current));
          return;
        }
        resolvedRef.current = false;
        setFeedback(null);
        setIndex(next);
        setRemaining(ADV.escape[next]!.window);
      }, 900);
    },
    [beat, index, onDone],
  );

  useEffect(() => {
    audio.danger(true);
    return () => audio.danger(false);
  }, []);

  useEffect(() => {
    if (!beat) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRemaining((prev) => {
        const next = prev - dt;
        if (next <= 0 && !resolvedRef.current) advance(false);
        return Math.max(0, next);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beat, advance]);

  if (!beat) return null;

  return (
    <div
      className="screen"
      style={{
        background: 'radial-gradient(90% 60% at 50% 40%, rgba(140,43,32,0.35), #0b0908)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div className="label" style={{ letterSpacing: '0.3em' }}>
        Get out
      </div>
      <h2 className="serif" style={{ fontSize: 26, margin: '10px 20px 22px' }}>
        {feedback ?? beat.prompt}
      </h2>

      {!feedback ? (
        <>
          <div style={{ width: '70%', maxWidth: 280 }}>
            <Meter value={remaining / beat.window} color="var(--danger)" />
          </div>
          <div style={{ marginTop: 26 }}>
            <Btn variant="primary" onClick={() => advance(true)} data-testid="escape-action" sound="none">
              Now
            </Btn>
          </div>
        </>
      ) : (
        <p className="tiny">
          {index + 1} / {ADV.escape.length}
        </p>
      )}
    </div>
  );
}
