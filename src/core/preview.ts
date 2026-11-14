/**
 * The isometric prototype is a preview, not the game: it only exists when
 * the page is opened with `?iso`, it keeps its own save so it can never
 * touch a player's real progress, and it only re-draws the rooms listed
 * here. Every other room, and every visit without the flag, is the
 * ordinary game, unchanged.
 */
export const ISO_PREVIEW: boolean = (() => {
  try {
    // A preview build can be baked with the flag on, for hosts where a query string can't be passed.
    if (import.meta.env?.VITE_ISO_PREVIEW === '1') return true;
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('iso');
  } catch {
    return false;
  }
})();

/** Rooms the isometric renderer has been built for. */
export const ISO_ROOM_IDS: ReadonlySet<string> = new Set(['temple1']);

export function isoActive(mapId: string): boolean {
  return ISO_PREVIEW && ISO_ROOM_IDS.has(mapId);
}
