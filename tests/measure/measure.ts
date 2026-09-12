import { getLocation } from '@/content/locations';
import { getTarget } from '@/content/targets';
import { getTool } from '@/content/equipment';
import { applyTool, createExcavation, type ExcavationState } from '@/systems/excavation';
import { writeSync } from 'node:fs';

/** Written straight to stdout so `npm run measure` prints it. */
const log = (line: string) => writeSync(1, line + '\n');

const scoop = getTool('tool_scoop')!;
const brush = getTool('tool_brush')!;

/**
 * Simulates a finger dragging in a spiral/raster across the pit at a realistic
 * speed, in frames of 16ms. Returns simulated seconds until 70% exposure.
 */
function simulate(
  state: ExcavationState,
  plan: (t: number, exposed: number) => { tool: typeof scoop; x: number; y: number } | null,
  limitSeconds = 90,
): { seconds: number; condition: number; exposed: number } {
  let t = 0;
  const dt = 1 / 60;
  while (t < limitSeconds) {
    const action = plan(t, state.exposed);
    if (action) applyTool(state, action.tool, action.x, action.y, dt, t * 1000);
    t += dt;
    if (state.exposed >= 0.7) break;
  }
  return { seconds: t, condition: state.condition, exposed: state.exposed };
}

/** Raster drag covering the pit every `period` seconds. */
function raster(period: number) {
  return (t: number) => {
    const u = (t % period) / period;
    const rows = 9;
    const row = Math.floor(u * rows);
    const along = (u * rows) % 1;
    const x = row % 2 === 0 ? along : 1 - along;
    return { x: Math.min(0.99, Math.max(0.01, x)), y: (row + 0.5) / rows };
  };
}

for (const [locId, targetId] of [
  ['loc_old_park', 'tgt_modern_coin'],
  ['loc_old_park', 'tgt_silver_coin'],
  ['loc_old_railway', 'tgt_medal'],
  ['loc_abandoned_mine', 'tgt_mechanism_part'],
] as const) {
  const loc = getLocation(locId)!;
  const def = getTarget(targetId)!;

  const mk = () =>
    createExcavation({ def, location: loc, accuracy: 1, offsetAngle: 0, baseCondition: 100, seed: 'm' });

  // Careless: scoop the whole time.
  const a = mk();
  const pathA = raster(4);
  const resA = simulate(a, (t) => ({ tool: scoop, ...pathA(t) }));

  // Brush only.
  const b = mk();
  const pathB = raster(4);
  const resB = simulate(b, (t) => ({ tool: brush, ...pathB(t) }));

  // Attentive: scoop until first contact, then brush.
  const c = mk();
  const pathC = raster(4);
  let switched = false;
  const resC = simulate(c, (t) => {
    const p = pathC(t);
    if (!switched) {
      const r = applyTool(c, scoop, p.x, p.y, 1 / 60, t * 1000);
      if (r.contact) switched = true;
      return null;
    }
    return { tool: brush, ...p };
  });

  log(
    `${loc.name} / ${def.name}: scoop ${resA.seconds.toFixed(1)}s cond ${resA.condition.toFixed(0)} | brush ${resB.seconds.toFixed(1)}s cond ${resB.condition.toFixed(0)} exp ${resB.exposed.toFixed(2)} | attentive ${resC.seconds.toFixed(1)}s cond ${resC.condition.toFixed(0)} exp ${resC.exposed.toFixed(2)}`,
  );
}
