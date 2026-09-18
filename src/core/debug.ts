/**
 * Read-only introspection hook. Off by default; enabled in dev, or in any
 * build with `?debug=1`, where it exposes `window.__unearth` for tests.
 */
import { dispatch, game } from './game';

export const DEBUG_ENABLED: boolean = (() => {
  try {
    if (import.meta.env?.DEV) return true;
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
  } catch {
    return false;
  }
})();

export function installDebug(): void {
  if (!DEBUG_ENABLED) return;
  (window as unknown as Record<string, unknown>).__unearth = {
    state: () => game.get(),
    dispatch,
  };
}
