// Adapters from data (apps, inputs) to what the Tile component draws.

import type {AppEntry} from './apps';
import type {InputSource} from './inputs';
import type {TileModel} from '../components/Tile';

const INPUT_ICON_DIR = 'icons/inputs/';

export function appTile (app: AppEntry): TileModel {
	return {key: app.id, label: app.title, imageUrl: app.iconUrl, color: app.color, fg: app.fg, brand: app.brand, subtitle: app.tagline};
}

export function inputTile (input: InputSource): TileModel {
	return {key: input.appId, label: input.label, glyphImageUrl: INPUT_ICON_DIR + input.icon, subtitle: input.appId === 'com.webos.app.livetv' ? 'Antenna and cable' : input.connected ? 'Connected' : 'Nothing connected'};
}

/** Order `items` by an ID list, dropping IDs that no longer exist. */
export function pickInOrder<T> (items: T[], ids: string[], idOf: (item: T) => string): T[] {
	const byId: Record<string, T> = {};
	for (const item of items) byId[idOf(item)] = item;
	return ids.map((id) => byId[id]).filter((x): x is T => x !== undefined);
}

/** Apps in the order of a saved ID list. Saved IDs match any of an app's aliases, so a
 *  dock saved with one ID still finds the app when the TV has it under another. */
export function pickAppsInOrder (apps: AppEntry[], ids: string[]): AppEntry[] {
	const byId: Record<string, AppEntry> = {};
	for (const app of apps) for (const alias of app.aliases.concat(app.id)) byId[alias] = app;
	const seen: Record<string, boolean> = {};
	const out: AppEntry[] = [];
	for (const id of ids) {
		const app = byId[id];
		if (app && !seen[app.id]) { seen[app.id] = true; out.push(app); }
	}
	return out;
}
