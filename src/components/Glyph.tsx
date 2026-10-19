// Inline SVG line icons used by tiles, pills and the settings badge.

export type GlyphName = 'house' | 'gear' | 'image' | 'people' | 'input' | 'switch' | 'moon' | 'heart' | 'lock' | 'grid' | 'wifi' | 'offline';

const PATHS: Record<GlyphName, string> = {
	house: '<path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8M10 20v-6h4v6"/>',
	gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
	image: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>',
	people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.2c2.4.2 4.2 1.7 5 4.3"/>',
	input: '<rect x="3" y="6" width="18" height="11" rx="2"/><path d="M8 20h8M12 17v3"/>',
	switch: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
	moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
	heart: '<path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z"/>',
	grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
	wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 15.9a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.2"/>',
	offline: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M3 3l18 18"/>',
	lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
};

/** `raw` returns just the paths, for embedding in an <svg> the caller sizes itself. */
export function Glyph ({name, raw}: {name: GlyphName; raw?: boolean}) {
	if (raw) return <g dangerouslySetInnerHTML={{__html: PATHS[name]}} />;
	return <svg class="tile__glyph" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{__html: PATHS[name]}} />;
}

export function CheckMark () {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	);
}
