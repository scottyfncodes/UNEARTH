import type { SiteDef } from './types';
import { HOME } from './home';
import { SILENT_COURT } from './silentCourt';

export type { SiteDef } from './types';

/**
 * Every first-person site, keyed by id. A second site is a new content file
 * of this shape plus one line here — no new engine code.
 */
export const SITES: SiteDef[] = [HOME, SILENT_COURT];

const SITE_INDEX = new Map(SITES.map((s) => [s.id, s]));

export function getSite(id: string): SiteDef | undefined {
  return SITE_INDEX.get(id);
}
