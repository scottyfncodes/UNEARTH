import type { DetectorDef, ToolDef } from '@/core/types';

/**
 * Progression is equipment and knowledge, not experience points.
 * Funds come only from the field value of real finds — junk pays nothing.
 *
 * "Detector" here means CK's collar — the same signal model, worn instead of
 * carried. Upgrading it is buying a better collar, not a better gadget in
 * your own hands; you have paws, not hands.
 */
export const DETECTORS: DetectorDef[] = [
  {
    id: 'det_starter',
    name: 'Old Leather Collar',
    tagline: "The one he already had. Honest about metal, vague about everything else.",
    reach: 62,
    depthCapacity: 22,
    discrimination: 0.35,
    stability: 0.45,
    coilWidth: 26,
    price: 0,
  },
  {
    id: 'det_field',
    name: 'Field Collar',
    tagline: 'Deeper ground, steadier hum. The obvious first upgrade.',
    reach: 74,
    depthCapacity: 29,
    discrimination: 0.5,
    stability: 0.62,
    coilWidth: 30,
    price: 140,
  },
  {
    id: 'det_precision',
    name: 'Precision Collar',
    tagline: 'A tighter band of signal. Tells you where, not just whether.',
    reach: 70,
    depthCapacity: 31,
    discrimination: 0.72,
    stability: 0.8,
    coilWidth: 22,
    price: 420,
  },
  {
    id: 'det_deep',
    name: 'Deep-Range Collar',
    tagline: 'A wider coil, woven in, for deep iron and deeper oddities.',
    reach: 96,
    depthCapacity: 42,
    discrimination: 0.55,
    stability: 0.68,
    coilWidth: 38,
    price: 900,
  },
  {
    id: 'det_advanced',
    name: "Archaeologist's Collar",
    tagline: 'His own spare, tuned properly. Depth, discrimination, a hum you can trust.',
    reach: 92,
    depthCapacity: 46,
    discrimination: 0.9,
    stability: 0.92,
    coilWidth: 30,
    price: 1800,
  },
];

export const TOOLS: ToolDef[] = [
  {
    id: 'tool_scoop',
    name: 'Paw',
    kind: 'scoop',
    tagline: 'Moves dirt fast. Does not care what it hits.',
    power: 1,
    risk: 1,
    radius: 26,
    price: 0,
  },
  {
    id: 'tool_brush',
    name: 'Tail',
    kind: 'brush',
    tagline: 'Slow, safe, and the only thing you should use near an edge.',
    power: 0.55,
    risk: 0.012,
    radius: 18,
    price: 0,
  },
  {
    id: 'tool_pick',
    name: 'Claw',
    kind: 'pick',
    tagline: 'Breaks up packed ground in a small area. Sharp end, sharp consequences.',
    power: 1.45,
    risk: 1.35,
    radius: 13,
    price: 70,
  },
  {
    id: 'tool_fine_brush',
    name: 'Whiskers',
    kind: 'brush',
    tagline: 'Lifts dirt off an artifact without ever touching it hard.',
    power: 0.82,
    risk: 0.004,
    radius: 20,
    price: 160,
  },
  {
    id: 'tool_pinpointer',
    name: 'Nose',
    kind: 'pinpointer',
    tagline: 'A close sniff. In the hole, it tells you which way to dig.',
    power: 0,
    risk: 0,
    radius: 0,
    price: 90,
  },
];

const DETECTOR_INDEX = new Map(DETECTORS.map((d) => [d.id, d]));
const TOOL_INDEX = new Map(TOOLS.map((t) => [t.id, t]));

export function getDetector(id: string): DetectorDef {
  return DETECTOR_INDEX.get(id) ?? DETECTORS[0]!;
}

export function getTool(id: string): ToolDef | undefined {
  return TOOL_INDEX.get(id);
}
