import { readFileSync } from 'node:fs';
import { freezeJson } from './hash.mjs';

export const THEME_CONTRACT = freezeJson(JSON.parse(readFileSync(new URL('../../contracts/storyweave-theme/v1/contract.json', import.meta.url), 'utf8')));
export const PAGE_ROLES = Object.freeze([...THEME_CONTRACT.page_roles]);
export const LAYOUT_ZONES = Object.freeze([...THEME_CONTRACT.layout_zones]);
export const LAYOUT_DENSITIES = Object.freeze([...THEME_CONTRACT.layout_densities]);
