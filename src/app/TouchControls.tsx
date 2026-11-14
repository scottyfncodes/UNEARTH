import type React from 'react';
import { audio } from '@/engine/audio';
import type { Direction } from '@/game/types';
import { canHop, digAffordance, pawAffordance } from '@/game/affordance';
import { MAPS } from '@/content/maps';
import { pressDig, pressDirection, pressInteract, pressJump, releaseDirection } from './controls';
import { useGameState } from './useGameState';
import { isoActive } from '@/core/preview';

/**
 * The d-pad walks (tap a new direction to turn on the spot first — that is
 * how you sweep the collar around), and three action buttons do everything
 * else: Dig, Hop, and Paw.
 *
 * The buttons also say what they would do right now, which is the game's
 * whole tutorial: Paw reads "Talk" in front of someone and "Read" in front
 * of a carving, Hop dims when there is nothing to hop, and Dig warms up
 * when the collar is locked on soft ground. Nothing is ever disabled — a
 * press always does *something*, even if that something is "too hard here".
 */
const CHEVRON_TURN: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 };

/** An arrow with a stem: unlike a solid triangle or a bare chevron, it still reads as a direction once the pad is turned 45°. */
function Chevron({ direction }: { direction: Direction }) {
  return (
    <svg className="dpad__chevron" viewBox="0 0 20 20" aria-hidden="true" style={{ transform: `rotate(${CHEVRON_TURN[direction]}deg)` }}>
      <path d="M10 16.5 V4.5 M5 9.5 L10 4.5 L15 9.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

function DirButton({ direction, label, className }: { direction: Direction; label: React.ReactNode; className: string }) {
  const release = () => releaseDirection(direction);
  return (
    <button
      className={`dpad__btn ${className}`}
      aria-label={`Move ${direction}`}
      onPointerDown={(e) => {
        e.preventDefault();
        audio.unlock();
        pressDirection(direction);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {label}
    </button>
  );
}

function TapButton({ onTap, label, className, ariaLabel }: { onTap: () => void; label: string; className: string; ariaLabel: string }) {
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        audio.unlock();
        onTap();
      }}
    >
      <span className="action-btn__label" key={label}>
        {label}
      </span>
    </button>
  );
}

export function TouchControls() {
  const state = useGameState();
  const paw = pawAffordance(MAPS, state);
  const hop = canHop(MAPS, state);
  const dig = digAffordance(MAPS, state);
  const pawLabel = paw && paw.verb !== 'Sniff' ? paw.verb : 'Paw';
  const iso = isoActive(state.mapId);

  return (
    <div className="touch-controls">
      {/* In the isometric view the grid's directions are the screen's diagonals, so the pad turns with them. */}
      <div className={`dpad ${iso ? 'dpad--iso' : ''}`}>
        <DirButton direction="up" label={iso ? <Chevron direction="up" /> : '▲'} className="dpad__btn--up" />
        <DirButton direction="left" label={iso ? <Chevron direction="left" /> : '◀'} className="dpad__btn--left" />
        <DirButton direction="right" label={iso ? <Chevron direction="right" /> : '▶'} className="dpad__btn--right" />
        <DirButton direction="down" label={iso ? <Chevron direction="down" /> : '▼'} className="dpad__btn--down" />
      </div>
      <div className="action-cluster">
        <TapButton
          onTap={pressDig}
          label="Dig"
          className={`action-btn action-btn--dig ${dig === 'hot' ? 'action-btn--hot' : dig === 'none' ? 'action-btn--quiet' : ''}`}
          ariaLabel="Dig"
        />
        <TapButton onTap={pressJump} label="Hop" className={`action-btn action-btn--hop ${hop ? '' : 'action-btn--quiet'}`} ariaLabel="Hop" />
        <TapButton
          onTap={pressInteract}
          label={pawLabel}
          className={`action-btn action-btn--interact ${paw && paw.verb !== 'Sniff' ? 'action-btn--ready' : ''} ${paw?.fresh ? 'action-btn--fresh' : ''}`}
          ariaLabel="Interact"
        />
      </div>
    </div>
  );
}
