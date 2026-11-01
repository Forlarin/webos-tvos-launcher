// Liquid Glass without backdrop-filter.
//
// Real frosted glass blurs whatever is behind it every frame (backdrop-filter), which
// webOS 4's Chrome 53 doesn't support and slower TVs can't afford. The only thing behind
// our glass is the wallpaper, so we blur and brighten a small copy of it once per
// wallpaper change, then paint that copy into each glass surface, lined up with the
// screen (see alignGlass). A 192×108 copy upscaled by the browser is already soft, and a
// blur on top hides any blockiness: about 4 KB and no per-frame cost.

const cache: Record<string, string> = {};
const pending: Record<string, Promise<string | null> | undefined> = {};

/** Blurred, vivid copy of an image, as a data URL; null if the image can't be read. */
export function glassImage (src: string): Promise<string | null> {
	if (cache[src]) return Promise.resolve(cache[src]);
	const inFlight = pending[src];
	if (inFlight) return inFlight;
	const job = new Promise<string | null>((resolve) => {
		const img = new Image();
		if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = 192;
				canvas.height = 108;
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('no 2d context');
				// The vibrancy is what makes it read as glass rather than fog.
				if ('filter' in ctx) (ctx as CanvasRenderingContext2D & {filter: string}).filter = 'blur(3px) saturate(1.3) brightness(1.06)';
				ctx.drawImage(img, -8, -8, 208, 124);   // overscan, so blurred edges don't darken
				const url = canvas.toDataURL('image/jpeg', 0.85);
				cache[src] = url;
				resolve(url);
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = src;
	});
	pending[src] = job;
	return job;
}

/** Surfaces that get the glass treatment (see .app--liquid in global.css). */
export const GLASS_SELECTOR = '.dock, .pill, .panel, .settings, .editor, .pin, .row--wide .tile__box';

/** Line each glass surface's copy of the wallpaper up with the real one behind it.
 *  Cheap (a handful of elements), and only run when the layout can have changed. */
export function alignGlass (root: HTMLElement): void {
	const els = root.querySelectorAll(GLASS_SELECTOR);
	for (let i = 0; i < els.length; i++) {
		const el = els[i] as HTMLElement;
		const r = el.getBoundingClientRect();
		// layers: sheen, tint, wallpaper copy
		el.style.backgroundPosition = `0 0, 0 0, ${-Math.round(r.left)}px ${-Math.round(r.top)}px`;
	}
}
