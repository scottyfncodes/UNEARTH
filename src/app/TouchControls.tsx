import { useRef } from 'react';
import { dispatch } from '@/core/game';
import { audio } from '@/engine/audio';
import type { Direction } from '@/game/types';

function useHoldRepeat(onFire: () => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    audio.unlock();
    onFire();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onFire, 140);
    }, 260);
  };

  return { onPointerDown: start, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear };
}

function DirButton({ direction, label, className }: { direction: Direction; label: string; className: string }) {
  const handlers = useHoldRepeat(() => dispatch({ type: 'move', direction }));
  return (
    <button className={`dpad__btn ${className}`} aria-label={`Move ${direction}`} {...handlers}>
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
        <TapButton
          onTap={() => dispatch({ type: 'toggleTool' })}
          label="🔁"
          className="action-btn action-btn--tool"
          ariaLabel="Switch tool"
        />
        <TapButton onTap={() => dispatch({ type: 'dig' })} label="⛏" className="action-btn action-btn--dig" ariaLabel="Dig" />
        <TapButton
          onTap={() => dispatch({ type: 'interact' })}
          label="✋"
          className="action-btn action-btn--interact"
          ariaLabel="Interact"
        />
      </div>
    </div>
  );
}
