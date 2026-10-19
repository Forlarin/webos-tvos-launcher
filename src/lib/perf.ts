// Lightweight mode for older, slower TVs.
//
// Measured on an LG UM7300 (webOS 4.5, Chrome 53, 1 GB): with the full effects the home
// screen idled at 10 fps and took ~300 ms to show a focus move. The costs were the
// drifting vector wallpaper (re-rasterised every frame), large animated glow shadows and
// full-screen fades on each move. Lite mode drops those and shows wallpapers as
// pre-rendered bitmaps. It is chosen by engine version, so newer TVs keep every effect.

function chromeMajor (): number {
	const m = /Chrome\/(\d+)/.exec(navigator.userAgent);
	return m ? Number(m[1]) : 999;
}

/** Engines before Chrome 68 (webOS 4.x and older). */
export const LITE = chromeMajor() < 68;
