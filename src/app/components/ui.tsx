import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { RARITY_LABEL, type Rarity } from '@/core/types';
import { drawFind } from '@/engine/render/object';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';

export function Btn({
  children,
  onClick,
  variant = 'default',
  wide,
  small,
  disabled,
  sound = 'tap',
  className = '',
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  wide?: boolean;
  small?: boolean;
  disabled?: boolean;
  sound?: 'tap' | 'back' | 'open' | 'none';
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      {...rest}
      data-ui="true"
      disabled={disabled}
      className={[
        'btn',
        variant !== 'default' ? `btn--${variant}` : '',
        wide ? 'btn--wide' : '',
        small ? 'btn--sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => {
        // Re-attempt unlock/resume on every tap, not just the first: iOS
        // suspends the AudioContext on backgrounding, and this is the
        // cheapest guaranteed-real user gesture to recover it from.
        audio.unlock();
        if (sound !== 'none') audio.ui(sound);
        haptics.tap();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className={`rarity rarity--${rarity}`}>{RARITY_LABEL[rarity]}</span>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill =
    color ??
    (value > 0.75 ? 'var(--good)' : value > 0.45 ? 'var(--gold)' : 'var(--danger)');
  return (
    <div className="meter" role="presentation">
      <div className="meter__fill" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}

/** Canvas thumbnail / hero of a find, drawn from its silhouette. */
export function FindArt({
  silhouette,
  condition = 100,
  size,
  className,
  animate = false,
  soiling = 0,
}: {
  silhouette: string;
  condition?: number;
  size?: number;
  className?: string;
  animate?: boolean;
  soiling?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const time = (now - start) / 1000;
      drawFind(ctx, silhouette, w / 2, h / 2, Math.min(w, h) * 0.36, {
        condition,
        soiling,
        time: animate ? time : 1.4,
        rotation: animate ? Math.sin(time * 0.4) * 0.06 : 0,
      });
      if (animate) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [silhouette, condition, animate, soiling]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    />
  );
}

export function TopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="topbar__title">{title}</h1>
        {subtitle ? <p className="topbar__sub">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}
