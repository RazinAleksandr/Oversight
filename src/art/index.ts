/**
 * Art module — every visual asset is generated as an SVG string (no image files, no external refs).
 *
 *   icon(name, size)                 24-grid line icons in currentColor (see ICON_NAMES)
 *   countryEmblem(id, size)          heraldic shields for the four nations
 *   companyLogo(seed, color, arch)   seeded procedural brand marks on a dark tile
 *   portrait(seed, {size, role, hue})  seeded bust portraits (face depends on seed only)
 *   gameLogo(width)                  title wordmark, 5:1
 *   endingArt(tone, width)           16:9 ending illustrations
 *   worldMap(player, width)          2:1 map; `.region` groups recolourable via CSS
 *
 * Icons, emblems, logos and portraits contain no <defs>, so identical inputs give identical strings.
 * The logo, scenes and map use gradients/filters whose ids are unique per call (safe to repeat on a page).
 * Presentation-only: imports engine *types* (and the shared ICON_NAMES list), no engine runtime.
 */
import type { ArtAPI } from '../engine/types';
import { countryEmblem } from './emblems';
import { icon, iconNames } from './icons';
import { gameLogo } from './logo';
import { companyLogo } from './logos';
import { worldMap } from './map';
import { portrait } from './portraits';
import { endingArt } from './scenes';

export const art: ArtAPI = {
  icon,
  iconNames,
  countryEmblem,
  companyLogo,
  portrait,
  gameLogo,
  endingArt,
  worldMap,
};

export default art;
