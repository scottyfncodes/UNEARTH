import { ROOM_LAYOUT, roomLinks, roomProgress, type RoomProgress } from '@/content/worldMap';
import type { GameState } from '@/game/types';

/**
 * The journal's map: every room CK has been to, laid out the way the
 * journey goes down, with what's still waiting in each. Rooms CK hasn't
 * reached yet show only as a question mark next to somewhere CK has been —
 * enough to know there's more, not enough to spoil what.
 */
const CELL_W = 104;
const CELL_H = 50;
const GAP_X = 14;
const GAP_Y = 16;

function shortName(name: string): string {
  const dash = name.indexOf('—');
  return dash >= 0 ? name.slice(dash + 1).trim() : name.replace(/^The /, '').replace("CK's ", '');
}

export function WorldMap({ state }: { state: GameState }) {
  const rooms = roomProgress(state);
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const links = roomLinks();
  const known = new Set(rooms.filter((r) => r.visited).map((r) => r.id));
  // A room is hinted at once a room next to it has been visited.
  for (const [a, b] of links) {
    if (byId.get(a)?.visited) known.add(b);
    if (byId.get(b)?.visited) known.add(a);
  }
  const cols = Object.values(ROOM_LAYOUT).map((p) => p.col);
  const rows = Object.values(ROOM_LAYOUT).map((p) => p.row);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const maxRow = Math.max(...rows.filter((_, i) => known.has(Object.keys(ROOM_LAYOUT)[i]!)));
  const width = (maxCol - minCol + 1) * (CELL_W + GAP_X) - GAP_X + 8;
  const height = (maxRow + 1) * (CELL_H + GAP_Y) - GAP_Y + 8;
  const at = (id: string) => {
    const p = ROOM_LAYOUT[id]!;
    return { x: 4 + (p.col - minCol) * (CELL_W + GAP_X), y: 4 + p.row * (CELL_H + GAP_Y) };
  };

  const totals = rooms.reduce(
    (t, r) => ({ visited: t.visited + (r.visited ? 1 : 0), complete: t.complete + (r.visited && r.complete ? 1 : 0) }),
    { visited: 0, complete: 0 },
  );

  return (
    <div className="world-map">
      <p className="world-map__summary">
        {totals.visited} of {rooms.length} places visited · {totals.complete} picked clean
      </p>
      <svg className="world-map__svg" viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Map of the places CK has been">
        {links
          .filter(([a, b]) => known.has(a) && known.has(b))
          .map(([a, b]) => {
            const pa = at(a);
            const pb = at(b);
            const both = byId.get(a)!.visited && byId.get(b)!.visited;
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x + CELL_W / 2}
                y1={pa.y + CELL_H / 2}
                x2={pb.x + CELL_W / 2}
                y2={pb.y + CELL_H / 2}
                className={both ? 'world-map__link' : 'world-map__link world-map__link--faint'}
              />
            );
          })}
        {rooms
          .filter((r) => known.has(r.id))
          .map((r) => (
            <Room key={r.id} room={r} {...at(r.id)} />
          ))}
      </svg>
      <p className="world-map__legend">✦ shinies · ◆ secret nooks</p>
    </div>
  );
}

function Room({ room, x, y }: { room: RoomProgress; x: number; y: number }) {
  if (!room.visited) {
    return (
      <g className="world-map__room world-map__room--unknown">
        <rect x={x} y={y} width={CELL_W} height={CELL_H} rx={8} />
        <text x={x + CELL_W / 2} y={y + CELL_H / 2 + 5} textAnchor="middle">
          ?
        </text>
      </g>
    );
  }
  const cls = ['world-map__room', room.current ? 'world-map__room--here' : '', room.complete ? 'world-map__room--done' : ''].join(' ');
  return (
    <g className={cls}>
      <rect x={x} y={y} width={CELL_W} height={CELL_H} rx={8} />
      <text x={x + 9} y={y + 19} className="world-map__name">
        {shortName(room.name)}
      </text>
      <text x={x + 9} y={y + 38} className="world-map__counts">
        {room.shiniesTotal > 0 ? `✦ ${room.shinies}/${room.shiniesTotal}` : ''}
        {room.shiniesTotal > 0 && room.secretsTotal > 0 ? '   ' : ''}
        {room.secretsTotal > 0 ? `◆ ${room.secrets}/${room.secretsTotal}` : ''}
        {room.shiniesTotal === 0 && room.secretsTotal === 0 ? '—' : ''}
      </text>
      {room.current ? <circle cx={x + CELL_W - 12} cy={y + 12} r={4} className="world-map__you" /> : null}
      {room.complete && !room.current ? (
        <text x={x + CELL_W - 10} y={y + 17} textAnchor="end" className="world-map__check">
          ✓
        </text>
      ) : null}
    </g>
  );
}
