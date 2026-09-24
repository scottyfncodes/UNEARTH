import { useEffect, useState } from 'react';

/**
 * A destructive button that asks twice, in the page itself: the first tap
 * arms it ("Tap again to erase progress"), the second does it. Browser
 * confirm() dialogs are blocked in some embeds, so the game never uses them.
 */
export function ConfirmButton({ label, armedLabel, onConfirm, className }: { label: string; armedLabel: string; onConfirm: () => void; className: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`${className} ${armed ? 'confirm--armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? armedLabel : label}
    </button>
  );
}
