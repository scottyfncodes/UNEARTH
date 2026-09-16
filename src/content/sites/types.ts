/**
 * First-person site schema.
 *
 * A site is a small, bounded, hand-composed 3D archaeological space. It is
 * still data — everything the 3D engine draws and everything the player can
 * do comes from a SiteDef, the same "content is data" discipline the rest of
 * the game follows. A second site is a new file of this shape plus one line
 * in index.ts, not new engine code.
 */
import type { AmbienceKind } from '@/engine/audio';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Static dressing geometry. Solid props block the player's movement. */
export type PropKind =
  | 'wall'
  | 'column'
  | 'columnBroken'
  | 'rubble'
  | 'rock'
  | 'archway'
  | 'cliff'
  | 'crate'
  | 'stairStep'
  | 'statueBody';

export interface SiteProp {
  id: string;
  kind: PropKind;
  position: Vec3;
  /** Radians. */
  rotationY?: number;
  scale?: [number, number, number];
  /** Defaults to true for every kind except stairStep. */
  solid?: boolean;
}

/** Extra shapes an interactable can render itself as, beyond a PropKind. */
export type InteractableVisual =
  | PropKind
  | 'carving'
  | 'potteryShard'
  | 'handFragment'
  | 'footprints'
  | 'relicPedestal'
  | 'serpentIdol';

export type InteractionKind = 'observe' | 'pickup' | 'fit' | 'notice';

export interface SiteInteractable {
  id: string;
  kind: InteractionKind;
  /** Contextual button label, e.g. "Look closer", "Take it", "Fit the hand". */
  prompt: string;
  position: Vec3;
  /** How close the player must stand, in metres. */
  range: number;
  visual: InteractableVisual;
  rotationY?: number;
  scale?: [number, number, number];
  /** For 'observe' / 'pickup' / 'notice': the TargetDef this grants. */
  targetId?: string;
  /** For 'fit': the target id that must already be discovered to enable this. */
  requiresTargetId?: string;
  /** Interactable only appears/works once this site-progress flag is set. */
  requiresFlag?: string;
  /** Interactable disappears once this site-progress flag is set. */
  hideOnFlag?: string;
  /** Interactable only appears/works once every one of these adventures is complete. */
  requiresAdventuresComplete?: string[];
  /** On successful use, this flag is added to save.siteProgress. */
  setsFlagOnUse?: string;
  /** Short diegetic line shown over the world on use (not a discovery). */
  flavor?: string;
}

/**
 * Purely cosmetic/readability classification — every hazard triggers the same
 * way underneath (see systems/explore.ts's stepPlayer). `kind` just tells the
 * renderer which decal to draw and gives content a vocabulary, the same way
 * `InteractableVisual` does for interactables.
 */
export type HazardKind =
  | 'pressurePlate'
  | 'tripwire'
  | 'fallingStone'
  | 'dart'
  | 'collapsingFloor'
  | 'swinging'
  | 'unstable';

export interface HazardZone {
  id: string;
  /** Cosmetic only; omit for the plain unmarked hazard (e.g. a hidden cistern). */
  kind?: HazardKind;
  /** Centre of the danger area. */
  position: Vec3;
  /** Radius in metres. */
  radius: number;
  /** While this site-progress flag is set, the hazard no longer triggers. */
  disarmedByFlag?: string;
  /**
   * Set the first time the hazard actually fires (the player gets pushed back
   * out of it) — lets a trap being sprung, deliberately or not, open up
   * something else, the same way an interactable's setsFlagOnUse does.
   */
  setsFlagOnTrigger?: string;
  /** Shown when the player is pushed back out. */
  warning: string;
}

/** What CK's posture/animation should read as while inside a CatRouteZone. */
export type CatRouteKind = 'squeeze' | 'crawl' | 'ledge';

/**
 * A passage authored to be CK's alone: a gap too narrow for the archaeologist
 * who built this place, a low crawl, a ledge only a cat would bother jumping
 * onto. Physically it's just ground CK can walk through like any other —
 * there's no human character to mechanically block, so `clearWidthM` is
 * authored narrative metadata (see systems/traversal.ts's isCatOnlyGap) used
 * to keep that claim honest and testable rather than just a comment.
 */
export interface CatRouteZone {
  id: string;
  kind: CatRouteKind;
  position: Vec3;
  /** How close CK must be for this route to be "in use", metres. */
  radius: number;
  /** The authored clear width of the passage, metres — see systems/traversal.ts. */
  clearWidthM: number;
  /** Site-progress flag set the first time CK uses this route. */
  grantsFlag: string;
  /** Shown once, the first time CK uses this route. */
  note?: string;
}

/** A buried, metal-detector-findable object placed at a fixed spot. */
export interface DetectorDig {
  id: string;
  position: Vec3;
  targetId: string;
  depthCm: number;
  baseCondition: number;
}

export interface SiteDef {
  id: string;
  name: string;
  subtitle: string;
  /** Half-extent of the walkable ground, metres, centred at the origin. */
  radius: number;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  groundColor: string;
  groundDetail: string;
  ambience: AmbienceKind;
  spawn: Vec3;
  /** Radians; 0 faces -Z. */
  spawnYaw: number;
  props: SiteProp[];
  interactables: SiteInteractable[];
  hazards: HazardZone[];
  detectorDigs: DetectorDig[];
  /** Cat-only passages — optional, most sites have none. */
  catRoutes?: CatRouteZone[];
  /** Shown once, briefly, the first time the player enters. */
  intro: string[];
}
