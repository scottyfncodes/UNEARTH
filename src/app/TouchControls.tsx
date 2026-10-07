import { audio } from '@/engine/audio';
import type { Direction } from '@/game/types';
import { canHop, digAffordance, pawAffordance } from '@/game/affordance';
import { MAPS } from '@/content/maps';
import { pressDig, pressDirection, pressInteract, pressJump, releaseDirection } from './controls';
import { useGameState } from './useGameState';

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
function DirButton({ direction, label, className }: { direction: Direction; label: string; className: string }) {
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

  return (
    <div className="touch-controls">
      <div className="dpad">
        <DirButton direction="up" label="▲" className="dpad__btn--up" />
        <DirButton direction="left" label="◀" className="dpad__btn--left" />
        <DirButton direction="right" label="▶" className="dpad__btn--right" />
        <DirButton direction="down" label="▼" className="dpad__btn--down" />
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
