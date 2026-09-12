import { go, type Route } from '@/core/gameState';
import { audio } from '@/engine/audio';
import { haptics } from '@/engine/haptics';

const ITEMS: { route: Route; label: string }[] = [
  { route: 'map', label: 'Map' },
  { route: 'journal', label: 'Journal' },
  { route: 'equipment', label: 'Kit' },
];

export function Nav({ active }: { active: Route }) {
  return (
    <nav className="nav" data-ui="true">
      {ITEMS.map((item) => (
        <button
          key={item.route}
          className={`nav__item ${active === item.route ? 'nav__item--active' : ''}`}
          onClick={() => {
            audio.ui('tap');
            haptics.tap();
            go(item.route);
          }}
        >
          <span className="nav__dot" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
