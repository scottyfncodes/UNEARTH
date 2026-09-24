import { audio } from '@/engine/audio';
import type { Direction } from '@/game/types';
import { pressDig, pressDirection, pressInteract, pressJump, releaseDirection } from './controls';

/**
 * The d-pad walks (tap a new direction to turn on the spot first — that is
 * how you sweep the collar around), and three action buttons do everything
 * else: Dig, Hop, and Paw.
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
      {label}
    </button>
  );
}

export function TouchControls() {
  return (
    <div className="touch-controls">
      <div className="dpad">
        <DirButton direction="up" label="▲" className="dpad__btn--up" />
        <DirButton direction="left" label="◀" className="dpad__btn--left" />
        <DirButton direction="right" label="▶" className="dpad__btn--right" />
        <DirButton direction="down" label="▼" className="dpad__btn--down" />
      </div>
      <div className="action-cluster">
        <TapButton onTap={pressDig} label="Dig" className="action-btn action-btn--dig" ariaLabel="Dig" />
        <TapButton onTap={pressJump} label="Hop" className="action-btn action-btn--hop" ariaLabel="Hop" />
        <TapButton onTap={pressInteract} label="Paw" className="action-btn action-btn--interact" ariaLabel="Interact" />
      </div>
    </div>
  );
}
