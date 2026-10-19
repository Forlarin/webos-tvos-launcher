// Household state: profiles and their preferences, plus device-wide settings.
// Persisted in localStorage (private to this app on the TV). Older single-user configs
// (launcher-config-v1) are migrated into the first profile.

import {STORAGE_KEY, STORAGE_KEY_V1} from '../config/constants';
import {DEFAULT_APP_IDS} from '../config/catalog';
import {DEFAULT_WALLPAPER_ID} from './wallpapers';

export type Rotation = 'off' | 'hourly' | 'daily' | 'seasonal';
export type LayoutDensity = 'spacious' | 'compact';
export type Appearance = 'dark' | 'light';

export interface Profile {
	id: string;
	name: string;
	/** index into AVATARS */
	avatar: number;
	accent: string;
	wallpaperId: string;
	favoriteWallpapers: string[];
	rotation: Rotation;
	/** ordered app IDs for the dock */
	appIds: string[];
	/** ordered input appIds; null → all inputs */
	sourceIds: string[] | null;
	appearance: Appearance;
	/** 0–70: how much the wallpaper is darkened behind the interface */
	dim: number;
	/** simplified home, no settings, PIN to leave (launcher-level only) */
	kids: boolean;
}

export interface Household {
	profiles: Profile[];
	activeId: string;
	defaultId: string;
	/** show "Who's Watching?" when the launcher opens */
	askOnLaunch: boolean;
	/** 4-digit PIN for leaving a Kids profile and opening settings from one; '' → none */
	pin: string;
	density: LayoutDensity;
	/** slow wallpaper drift and twinkle */
	motion: boolean;
	/** frosted-glass panels (backdrop blur); off on slow TVs */
	glass: boolean;
	/** minutes of no key presses before the in-app screensaver; 0 → never */
	screensaverMinutes: number;
	clockStyle: 'thin' | 'bold';
	/** read the live app list through the Homebrew Channel (root). Off by default. */
	useHomebrew: boolean;
}

export const ACCENTS = ['#7aa6ff', '#ff8a7a', '#5ad0a0', '#ffc65a', '#c08aff', '#5ad0e0', '#ff7ac0', '#d0d0d8'];

let idCounter = 0;
export function newId (): string {
	idCounter += 1;
	return `p${Date.now().toString(36)}${idCounter}`;
}

export function makeProfile (name: string, index: number, extra: Partial<Profile> = {}): Profile {
	return {
		id: newId(),
		name,
		avatar: index % 17,     // AVATARS in components/Avatar.tsx
		accent: ACCENTS[index % ACCENTS.length],
		wallpaperId: DEFAULT_WALLPAPER_ID,
		favoriteWallpapers: [],
		rotation: 'off',
		appIds: DEFAULT_APP_IDS.slice(),
		sourceIds: null,
		appearance: 'dark',
		dim: 25,
		kids: false,
		...extra
	};
}

function defaultHousehold (): Household {
	const me = makeProfile('Me', 0);
	return {
		profiles: [me],
		activeId: me.id,
		defaultId: me.id,
		askOnLaunch: true,
		pin: '',
		density: 'spacious',
		motion: true,
		glass: true,
		screensaverMinutes: 10,
		clockStyle: 'thin',
		useHomebrew: false
	};
}

function sanitizeProfile (p: Partial<Profile>, i: number): Profile {
	const base = makeProfile(typeof p.name === 'string' && p.name ? p.name : `Profile ${i + 1}`, i);
	// Profiles still on the original default scene move to the NASA photo default.
	if (p.wallpaperId === 'mtn-blue-hour') p = {...p, wallpaperId: DEFAULT_WALLPAPER_ID};
	return {
		...base,
		...p,
		id: typeof p.id === 'string' ? p.id : base.id,
		appIds: Array.isArray(p.appIds) ? p.appIds : base.appIds,
		sourceIds: Array.isArray(p.sourceIds) ? p.sourceIds : null,
		favoriteWallpapers: Array.isArray(p.favoriteWallpapers) ? p.favoriteWallpapers : []
	};
}

export function loadHousehold (): Household {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Household>;
			const fallback = defaultHousehold();
			const profiles = Array.isArray(parsed.profiles) && parsed.profiles.length
				? parsed.profiles.map(sanitizeProfile)
				: fallback.profiles;
			const has = (id: unknown) => profiles.some((p) => p.id === id);
			return {
				...fallback,
				...parsed,
				profiles,
				activeId: has(parsed.activeId) ? parsed.activeId as string : profiles[0].id,
				defaultId: has(parsed.defaultId) ? parsed.defaultId as string : profiles[0].id
			};
		}
		// Migrate the original single-user config.
		const v1 = localStorage.getItem(STORAGE_KEY_V1);
		const household = defaultHousehold();
		if (v1) {
			const old = JSON.parse(v1) as {appIds?: string[]; sourceIds?: string[] | null; useHomebrew?: boolean};
			const me = household.profiles[0];
			if (Array.isArray(old.appIds)) me.appIds = old.appIds;
			if (Array.isArray(old.sourceIds)) me.sourceIds = old.sourceIds;
			household.useHomebrew = old.useHomebrew === true;
		}
		return household;
	} catch {
		return defaultHousehold();
	}
}

export function saveHousehold (h: Household): void {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); }
	catch { /* nothing sensible to do on a TV */ }
}

export function activeProfile (h: Household): Profile {
	for (const p of h.profiles) if (p.id === h.activeId) return p;
	return h.profiles[0];
}

export function updateProfile (h: Household, id: string, patch: Partial<Profile>): Household {
	return {...h, profiles: h.profiles.map((p) => (p.id === id ? {...p, ...patch} : p))};
}

/** Toggle an ID in an ordered list: remove if present, else append. */
export function toggleId (ids: string[], id: string): string[] {
	return ids.indexOf(id) === -1 ? ids.concat(id) : ids.filter((x) => x !== id);
}
