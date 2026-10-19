// Wallpapers, of two kinds:
//  - Photos: real NASA images (public domain; see public/wallpapers/CREDITS.txt), shipped
//    in the package as 1920×1080 JPEGs.
//  - Scenes: original vector paintings generated here, a few KB of SVG each, seeded so
//    the same id always draws the same picture.
//
// A wallpaper also carries an accent colour, used for the ambient glow and focus tint so
// the interface takes on the mood of the background.

export type WallpaperCategory =
	| 'nasa' | 'aerial' | 'mountains' | 'ocean' | 'underwater' | 'space'
	| 'city' | 'forest' | 'gradient' | 'minimal' | 'seasonal';

export interface Wallpaper {
	id: string;
	name: string;
	category: WallpaperCategory;
	/** ambient accent derived from the scene */
	accent: string;
	/** draws better with slow motion (stars, water) when animations are on */
	motion?: 'drift' | 'twinkle';
	/** a photo under public/wallpapers/ … */
	photo?: string;
	/** … or a generated vector scene */
	svg?: () => string;
}

export const CATEGORY_LABELS: Record<WallpaperCategory, string> = {
	nasa: 'NASA',
	aerial: 'Aerial',
	mountains: 'Mountains',
	ocean: 'Ocean',
	underwater: 'Underwater',
	space: 'Space',
	city: 'Cities at Night',
	forest: 'Forests',
	gradient: 'Gradients',
	minimal: 'Minimal Dark',
	seasonal: 'Seasonal'
};

export const CATEGORY_ORDER: WallpaperCategory[] = [
	'nasa', 'aerial', 'mountains', 'ocean', 'underwater', 'space', 'city', 'forest', 'gradient', 'minimal', 'seasonal'
];

import {apodUrl} from './apod';

const W = 1920;
const H = 1080;

// ---------- small helpers ----------

/** Deterministic PRNG (mulberry32) so a scene never changes between renders. */
function rng (seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function svg (defs: string, body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
}

function linear (id: string, stops: [number, string][], vertical = true): string {
	const dir = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="1"';
	return `<linearGradient id="${id}" ${dir}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

function radial (id: string, cx: number, cy: number, r: number, stops: [number, string, number?][]): string {
	return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a === undefined ? 1 : a}"/>`).join('')}</radialGradient>`;
}

const rect = (fill: string, opacity = 1) => `<rect width="${W}" height="${H}" fill="${fill}" opacity="${opacity}"/>`;

/** A ridge line across the screen: fractal midpoint displacement, closed to the bottom. */
function ridge (seed: number, baseY: number, amplitude: number, roughness: number, fill: string, opacity = 1): string {
	const rand = rng(seed);
	const n = 64;
	const pts: number[] = new Array(n + 1);
	pts[0] = baseY + (rand() - 0.5) * amplitude;
	pts[n] = baseY + (rand() - 0.5) * amplitude;
	let step = n;
	let amp = amplitude;
	while (step > 1) {
		const half = step / 2;
		for (let i = half; i < n; i += step) {
			pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rand() - 0.5) * amp;
		}
		amp *= roughness;
		step = half;
	}
	let d = `M0 ${H} L0 ${pts[0].toFixed(1)}`;
	for (let i = 1; i <= n; i++) d += ` L${(i * W / n).toFixed(1)} ${pts[i].toFixed(1)}`;
	d += ` L${W} ${H} Z`;
	return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
}

/** Smooth rolling hills / dunes / waves using quadratic curves. */
function wave (seed: number, baseY: number, amplitude: number, segments: number, fill: string, opacity = 1): string {
	const rand = rng(seed);
	const seg = W / segments;
	let d = `M0 ${H} L0 ${baseY}`;
	for (let i = 0; i < segments; i++) {
		const cx = i * seg + seg / 2;
		const cy = baseY + (rand() - 0.5) * 2 * amplitude;
		d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${((i + 1) * seg).toFixed(1)} ${baseY + (rand() - 0.5) * amplitude * 0.4}`;
	}
	d += ` L${W} ${H} Z`;
	return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
}

function stars (seed: number, count: number, maxY = H, color = '#ffffff'): string {
	const rand = rng(seed);
	let out = '';
	for (let i = 0; i < count; i++) {
		const r = rand() < 0.92 ? 0.6 + rand() * 0.9 : 1.6 + rand() * 1.4;
		out += `<circle cx="${(rand() * W).toFixed(1)}" cy="${(rand() * maxY).toFixed(1)}" r="${r.toFixed(2)}" fill="${color}" opacity="${(0.3 + rand() * 0.7).toFixed(2)}"/>`;
	}
	return `<g class="wp-stars">${out}</g>`;
}

/** Conifer silhouettes along a line. */
function pines (seed: number, baseY: number, count: number, minH: number, maxH: number, fill: string, opacity = 1): string {
	const rand = rng(seed);
	let out = '';
	for (let i = 0; i < count; i++) {
		const x = rand() * W;
		const h = minH + rand() * (maxH - minH);
		const w = h * (0.28 + rand() * 0.1);
		const y = baseY + rand() * 40;
		out += `<path d="M${x.toFixed(1)} ${(y - h).toFixed(1)} L${(x + w / 2).toFixed(1)} ${y.toFixed(1)} L${(x - w / 2).toFixed(1)} ${y.toFixed(1)} Z"/>`;
	}
	return `<g fill="${fill}" opacity="${opacity}">${out}<rect x="0" y="${baseY + 30}" width="${W}" height="${H}"/></g>`;
}

/** City skyline with lit windows. */
function skyline (seed: number, baseY: number, fill: string, windowColor: string, density: number): string {
	const rand = rng(seed);
	let x = -20;
	let blocks = '';
	let lights = '';
	while (x < W) {
		const w = 40 + rand() * 90;
		const h = 120 + rand() * 380 * (rand() < 0.15 ? 1.6 : 1);
		const top = baseY - h;
		blocks += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(H - top).toFixed(1)}"/>`;
		if (rand() < 0.25) blocks += `<rect x="${(x + w / 2 - 2).toFixed(1)}" y="${(top - 40).toFixed(1)}" width="4" height="40"/>`;
		for (let wy = top + 14; wy < baseY - 10; wy += 18) {
			for (let wx = x + 8; wx < x + w - 10; wx += 14) {
				if (rand() < density) lights += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="6" height="8" opacity="${(0.35 + rand() * 0.65).toFixed(2)}"/>`;
			}
		}
		x += w + 4 + rand() * 10;
	}
	return `<g fill="${fill}">${blocks}</g><g fill="${windowColor}">${lights}</g>`;
}

function sun (cx: number, cy: number, r: number, core: string, glow: string, glowR: number): string {
	return `<circle cx="${cx}" cy="${cy}" r="${glowR}" fill="url(#${glow})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${core}"/>`;
}

function glowDef (id: string, color: string, strength = 0.55): string {
	return radial(id, 0.5, 0.5, 0.5, [[0, color, strength], [0.4, color, strength * 0.35], [1, color, 0]]);
}

/** Soft vignette so UI text stays readable on any scene. */
const VIGNETTE_DEF = radial('vig', 0.5, 0.45, 0.75, [[0.55, '#000', 0], [1, '#000', 0.55]]);
const vignette = () => `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;

// ---------- scenes ----------

/** Changes daily: NASA's Astronomy Picture of the Day (see lib/apod.ts). */
export const DAILY_ID = 'nasa-daily';

const PHOTOS: Wallpaper[] = [
	{id: DAILY_ID, name: 'Today’s NASA Picture', category: 'nasa', accent: '#8ab0ff', photo: 'daily'},
	{id: 'nasa-carina', name: 'Cosmic Cliffs', category: 'nasa', accent: '#e0a060', photo: 'nasa-carina.jpg'},
	{id: 'nasa-aurora', name: 'Aurora from the ISS', category: 'nasa', accent: '#4ad8a0', photo: 'nasa-aurora.jpg'},
	{id: 'nasa-bluemarble', name: 'Blue Marble', category: 'nasa', accent: '#5aa8ff', photo: 'nasa-bluemarble.jpg'},
	{id: 'nasa-eagle', name: 'Eagle Nebula', category: 'nasa', accent: '#d8c040', photo: 'nasa-eagle.jpg'},
	{id: 'nasa-helix', name: 'Helix Nebula', category: 'nasa', accent: '#8ab0ff', photo: 'nasa-helix.jpg'},
	{id: 'nasa-galaxy', name: 'Spiral Galaxy', category: 'nasa', accent: '#9ab8ff', photo: 'nasa-galaxy.jpg'}
];

const SCENES: Wallpaper[] = [
	// Aerial
	{
		id: 'aerial-dunes', name: 'Golden Dunes', category: 'aerial', accent: '#e0a060',
		svg: () => svg(
			linear('sky', [[0, '#2a1a3a'], [0.45, '#c46a4a'], [0.7, '#f0b070'], [1, '#f6d6a0']]) + glowDef('g', '#ffd9a0') + VIGNETTE_DEF,
			rect('url(#sky)') + sun(1340, 560, 70, '#fff1d0', 'g', 420) +
			wave(11, 640, 70, 5, '#b8693e', 0.85) + wave(12, 740, 90, 4, '#8f4a2c', 0.95) +
			wave(13, 860, 80, 3, '#5e2c1c') + wave(14, 980, 50, 3, '#341610') + vignette()
		)
	},
	{
		id: 'aerial-clouds', name: 'Above the Clouds', category: 'aerial', accent: '#9fb8ff',
		svg: () => svg(
			linear('sky', [[0, '#0b1438'], [0.5, '#3d4f9a'], [0.78, '#e7a9b8'], [1, '#ffe3c8']]) + glowDef('g', '#ffe8d0', 0.7) + VIGNETTE_DEF,
			rect('url(#sky)') + sun(960, 760, 50, '#fff6e8', 'g', 520) +
			wave(21, 720, 60, 7, '#c9b7d6', 0.75) + wave(22, 800, 70, 6, '#a89ac4', 0.9) +
			wave(23, 900, 60, 5, '#7b72a6') + wave(24, 1000, 40, 5, '#4e4a80') + stars(25, 60, 300) + vignette()
		)
	},
	{
		id: 'aerial-coast', name: 'Coastline', category: 'aerial', accent: '#5ec4c8',
		svg: () => svg(
			linear('sea', [[0, '#0a3b52'], [0.6, '#11697a'], [1, '#2aa3a0']], false) + glowDef('g', '#bff6ff', 0.3) + VIGNETTE_DEF,
			rect('url(#sea)') + `<circle cx="600" cy="300" r="700" fill="url(#g)"/>` +
			ridge(31, 360, 380, 0.55, '#d8c79c', 0.9) + ridge(32, 400, 360, 0.55, '#5d7a3e') + ridge(33, 470, 300, 0.6, '#3b5a2a') + vignette()
		)
	},

	// Mountains
	{
		id: 'mtn-alpenglow', name: 'Alpenglow', category: 'mountains', accent: '#f08a7a',
		svg: () => svg(
			linear('sky', [[0, '#1b2350'], [0.5, '#7a4f8a'], [0.8, '#f08a7a'], [1, '#ffc49a']]) + VIGNETTE_DEF,
			rect('url(#sky)') + stars(41, 90, 380) +
			ridge(42, 520, 380, 0.52, '#c8a0c0', 0.55) + ridge(43, 620, 320, 0.55, '#5a3f6e') +
			ridge(44, 760, 220, 0.55, '#33264a') + ridge(45, 900, 140, 0.6, '#1a1428') + vignette()
		)
	},
	{
		id: 'mtn-blue-hour', name: 'Blue Hour', category: 'mountains', accent: '#7aa6ff',
		svg: () => svg(
			linear('sky', [[0, '#050b1e'], [0.6, '#1d3a78'], [1, '#6b8fd0']]) + glowDef('g', '#e6efff', 0.6) + VIGNETTE_DEF,
			rect('url(#sky)') + stars(51, 220, 600) + sun(1420, 240, 34, '#f4f7ff', 'g', 220) +
			ridge(52, 560, 420, 0.5, '#2c4a86', 0.8) + ridge(53, 700, 300, 0.55, '#172c5c') +
			ridge(54, 860, 160, 0.6, '#0b1734') + vignette()
		),
		motion: 'twinkle'
	},
	{
		id: 'mtn-misty', name: 'Misty Peaks', category: 'mountains', accent: '#a8c4b8',
		svg: () => svg(
			linear('sky', [[0, '#d8e4e0'], [1, '#8fa8a0']]) + VIGNETTE_DEF,
			rect('url(#sky)') + ridge(61, 420, 360, 0.5, '#7e9890', 0.5) + ridge(62, 540, 320, 0.52, '#5f7a72', 0.7) +
			ridge(63, 680, 260, 0.55, '#3f5a52', 0.85) + ridge(64, 820, 180, 0.6, '#253b35') + ridge(65, 960, 90, 0.6, '#14221e') + vignette()
		)
	},

	// Ocean
	{
		id: 'ocean-sunset', name: 'Pacific Sunset', category: 'ocean', accent: '#ff9a5a',
		svg: () => svg(
			linear('sky', [[0, '#1a1036'], [0.45, '#b24a5a'], [0.62, '#ff9a5a']]) + linear('sea', [[0, '#4a2a4a'], [1, '#0a0a1a']]) + glowDef('g', '#ffd08a', 0.8) + VIGNETTE_DEF,
			rect('url(#sky)') + sun(960, 640, 90, '#ffe2b0', 'g', 600) +
			`<rect y="660" width="${W}" height="${H - 660}" fill="url(#sea)"/>` +
			`<rect x="900" y="660" width="120" height="420" fill="#ffb878" opacity="0.18"/>` +
			wave(71, 760, 10, 12, '#2a1830', 0.5) + wave(72, 880, 14, 10, '#160c1e', 0.6) + vignette()
		),
		motion: 'drift'
	},
	{
		id: 'ocean-storm', name: 'North Sea', category: 'ocean', accent: '#7e9cb0',
		svg: () => svg(
			linear('sky', [[0, '#1c252e'], [0.6, '#4a5a68'], [1, '#2a3640']]) + VIGNETTE_DEF,
			rect('url(#sky)') + wave(81, 600, 30, 9, '#34444f') + wave(82, 700, 40, 8, '#26343e') +
			wave(83, 820, 50, 7, '#1a252d') + wave(84, 950, 50, 6, '#10181e') + vignette()
		),
		motion: 'drift'
	},

	// Underwater
	{
		id: 'under-reef', name: 'Light Shafts', category: 'underwater', accent: '#3fc8d8',
		svg: () => {
			const rand = rng(91);
			let rays = '';
			for (let i = 0; i < 9; i++) {
				const x = 200 + rand() * 1500;
				const w = 40 + rand() * 120;
				rays += `<path d="M${x} 0 L${x + w} 0 L${x + w * 3 + 200} ${H} L${x + 120} ${H} Z" opacity="${(0.04 + rand() * 0.08).toFixed(2)}"/>`;
			}
			let bubbles = '';
			for (let i = 0; i < 40; i++) bubbles += `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * H).toFixed(0)}" r="${(2 + rand() * 6).toFixed(1)}" fill="none" stroke="#bff" stroke-opacity="${(0.15 + rand() * 0.3).toFixed(2)}"/>`;
			return svg(
				linear('w', [[0, '#1aa0b8'], [0.5, '#06506e'], [1, '#021628']]) + VIGNETTE_DEF,
				rect('url(#w)') + `<g fill="#dffcff">${rays}</g>` + bubbles +
				ridge(92, 940, 120, 0.6, '#04202e') + ridge(93, 1010, 80, 0.6, '#020e18') + vignette()
			);
		},
		motion: 'drift'
	},
	{
		id: 'under-deep', name: 'The Deep', category: 'underwater', accent: '#4a7cff',
		svg: () => svg(
			radial('w', 0.5, 0.1, 0.9, [[0, '#1b4f9a'], [0.5, '#071c44'], [1, '#01040e']]) + VIGNETTE_DEF,
			rect('url(#w)') + stars(101, 120, H, '#7fc8ff') + vignette()
		),
		motion: 'twinkle'
	},

	// Space
	{
		id: 'space-nebula', name: 'Nebula', category: 'space', accent: '#c06aff',
		svg: () => svg(
			radial('n1', 0.35, 0.4, 0.5, [[0, '#c06aff', 0.55], [1, '#c06aff', 0]]) +
			radial('n2', 0.68, 0.6, 0.45, [[0, '#ff6a9a', 0.45], [1, '#ff6a9a', 0]]) +
			radial('n3', 0.55, 0.35, 0.35, [[0, '#6ad0ff', 0.35], [1, '#6ad0ff', 0]]) + VIGNETTE_DEF,
			rect('#04030c') + rect('url(#n1)') + rect('url(#n2)') + rect('url(#n3)') + stars(111, 420) + vignette()
		),
		motion: 'twinkle'
	},
	{
		id: 'space-planet', name: 'Earthrise', category: 'space', accent: '#5aa8ff',
		svg: () => svg(
			radial('p', 0.4, 0.3, 0.75, [[0, '#7fc0ff'], [0.55, '#1f5aa8'], [1, '#061430']]) +
			radial('atm', 0.5, 0.5, 0.5, [[0.86, '#7fc8ff', 0], [0.93, '#7fc8ff', 0.5], [1, '#7fc8ff', 0]]) + VIGNETTE_DEF,
			rect('#020208') + stars(121, 380) +
			`<circle cx="960" cy="1700" r="980" fill="url(#atm)"/><circle cx="960" cy="1700" r="900" fill="url(#p)"/>` + vignette()
		),
		motion: 'twinkle'
	},
	{
		id: 'space-milkyway', name: 'Milky Way', category: 'space', accent: '#d8c8ff',
		svg: () => {
			const rand = rng(131);
			let band = '';
			for (let i = 0; i < 900; i++) {
				const t = rand();
				const x = t * W;
				const y = 900 - t * 800 + (rand() - 0.5) * 260 * (0.5 + rand());
				band += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + rand() * 1.2).toFixed(2)}" opacity="${(0.2 + rand() * 0.7).toFixed(2)}"/>`;
			}
			return svg(
				linear('sky', [[0, '#05040e'], [1, '#141030']]) + VIGNETTE_DEF,
				rect('url(#sky)') + stars(132, 260) + `<g fill="#efe8ff">${band}</g>` +
				ridge(133, 960, 90, 0.6, '#040308') + vignette()
			);
		},
		motion: 'twinkle'
	},
	{
		id: 'space-blackhole', name: 'Black Hole', category: 'space', accent: '#ffb060',
		svg: () => svg(
			radial('disk', 0.5, 0.5, 0.5, [[0, '#ffffff', 0], [0.58, '#ffe6b0', 0], [0.7, '#ffce80', 0.95], [0.82, '#ff8a3a', 0.6], [1, '#ff6a2a', 0]]) +
			radial('halo', 0.5, 0.5, 0.5, [[0, '#ffe6c0', 0.5], [0.5, '#ffad5a', 0.12], [1, '#ffad5a', 0]]) + VIGNETTE_DEF,
			rect('#02020a') + stars(301, 340) +
			`<circle cx="960" cy="540" r="560" fill="url(#halo)"/>` +
			`<circle cx="960" cy="540" r="300" fill="none" stroke="#ffe6b0" stroke-width="10" stroke-opacity="0.55"/>` +
			`<ellipse cx="960" cy="540" rx="440" ry="150" fill="url(#disk)"/>` +
			`<circle cx="960" cy="540" r="150" fill="#000000"/>` +
			`<circle cx="960" cy="540" r="150" fill="none" stroke="#ffd9a0" stroke-width="3" stroke-opacity="0.6"/>` +
			vignette()
		),
		motion: 'twinkle'
	},
	{
		id: 'space-galaxy', name: 'Spiral Galaxy', category: 'space', accent: '#9a8cff',
		svg: () => {
			const rand = rng(311);
			const cx = 960;
			const cy = 540;
			let arms = '';
			for (let a = 0; a < 2; a++) {
				for (let i = 0; i < 520; i++) {
					const t = i / 520;
					const ang = a * Math.PI + t * Math.PI * 3.1;
					const r = 26 + t * 580;
					const x = cx + Math.cos(ang) * r * 1.45 + (rand() - 0.5) * 44;
					const y = cy + Math.sin(ang) * r * 0.72 + (rand() - 0.5) * 26;
					const col = t < 0.3 ? '#ffffff' : t < 0.62 ? '#bcd0ff' : '#8a7aff';
					arms += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + rand() * 1.6).toFixed(2)}" fill="${col}" opacity="${(0.22 + rand() * 0.6).toFixed(2)}"/>`;
				}
			}
			return svg(
				radial('core', 0.5, 0.5, 0.5, [[0, '#ffffff', 1], [0.2, '#ffe9c0', 0.9], [0.5, '#ffb060', 0.3], [1, '#ffb060', 0]]) +
				radial('ghalo', 0.5, 0.5, 0.5, [[0, '#9a8cff', 0.32], [1, '#9a8cff', 0]]) + VIGNETTE_DEF,
				rect('#03030e') + stars(312, 280) +
				`<ellipse cx="960" cy="540" rx="780" ry="430" fill="url(#ghalo)"/>` +
				`<g>${arms}</g>` +
				`<ellipse cx="960" cy="540" rx="230" ry="150" fill="url(#core)"/>` + vignette()
			);
		},
		motion: 'twinkle'
	},
	{
		id: 'space-cosmos', name: 'Cosmic Cloud', category: 'space', accent: '#4ad0ff',
		svg: () => svg(
			radial('k1', 0.3, 0.65, 0.55, [[0, '#2a7aff', 0.6], [1, '#2a7aff', 0]]) +
			radial('k2', 0.7, 0.4, 0.5, [[0, '#ff4aa0', 0.5], [1, '#ff4aa0', 0]]) +
			radial('k3', 0.5, 0.5, 0.4, [[0, '#4ad0c0', 0.4], [1, '#4ad0c0', 0]]) +
			radial('k4', 0.85, 0.8, 0.4, [[0, '#ffd06a', 0.3], [1, '#ffd06a', 0]]) + VIGNETTE_DEF,
			rect('#04020e') + rect('url(#k1)') + rect('url(#k2)') + rect('url(#k3)') + rect('url(#k4)') +
			stars(321, 500) + vignette()
		),
		motion: 'twinkle'
	},

	// City
	{
		id: 'city-midnight', name: 'Midnight City', category: 'city', accent: '#ffb84a',
		svg: () => svg(
			linear('sky', [[0, '#05070f'], [0.7, '#1a2040'], [1, '#3a2a40']]) + glowDef('g', '#ff9a4a', 0.35) + VIGNETTE_DEF,
			rect('url(#sky)') + stars(141, 60, 400) + `<ellipse cx="960" cy="980" rx="1200" ry="320" fill="url(#g)"/>` +
			skyline(142, 900, '#141828', '#ffcf7a', 0.22) + skyline(143, 1000, '#0a0c16', '#ffd890', 0.3) + vignette()
		)
	},
	{
		id: 'city-neon', name: 'Neon Rain', category: 'city', accent: '#ff4ad0',
		svg: () => svg(
			linear('sky', [[0, '#0a0418'], [0.7, '#3a0a4a'], [1, '#ff3aa0']]) + VIGNETTE_DEF,
			rect('url(#sky)') + skyline(151, 880, '#1a0a2a', '#7af0ff', 0.18) + skyline(152, 1000, '#08030f', '#ff7ae0', 0.24) + vignette()
		)
	},

	// Forest
	{
		id: 'forest-dawn', name: 'Pine Dawn', category: 'forest', accent: '#9ad08a',
		svg: () => svg(
			linear('sky', [[0, '#1c3040'], [0.55, '#8ab0a0'], [1, '#f0e0b0']]) + glowDef('g', '#fff0c0', 0.6) + VIGNETTE_DEF,
			rect('url(#sky)') + sun(1300, 600, 50, '#fff8e0', 'g', 420) +
			pines(161, 640, 70, 120, 220, '#5a7a6a', 0.55) + pines(162, 760, 60, 180, 320, '#2c4a3c', 0.85) +
			pines(163, 900, 40, 280, 480, '#12241c') + vignette()
		)
	},
	{
		id: 'forest-night', name: 'Northern Lights', category: 'forest', accent: '#4affb0',
		svg: () => svg(
			linear('sky', [[0, '#020812'], [1, '#0a1e2a']]) +
			radial('a1', 0.3, 0.35, 0.45, [[0, '#4affb0', 0.5], [1, '#4affb0', 0]]) +
			radial('a2', 0.7, 0.25, 0.4, [[0, '#7a6aff', 0.4], [1, '#7a6aff', 0]]) + VIGNETTE_DEF,
			rect('url(#sky)') + stars(171, 260, 700) + rect('url(#a1)') + rect('url(#a2)') +
			pines(172, 860, 80, 160, 300, '#030a10') + vignette()
		),
		motion: 'twinkle'
	},

	// Gradients
	{
		id: 'grad-aurora', name: 'Aurora', category: 'gradient', accent: '#6a8cff',
		svg: () => svg(
			radial('a', 0.2, 0.2, 0.8, [[0, '#6a8cff', 0.9], [1, '#6a8cff', 0]]) +
			radial('b', 0.85, 0.8, 0.8, [[0, '#ff6ab0', 0.8], [1, '#ff6ab0', 0]]) +
			radial('c', 0.7, 0.15, 0.6, [[0, '#4ad8c8', 0.6], [1, '#4ad8c8', 0]]),
			rect('#0a0a18') + rect('url(#a)') + rect('url(#b)') + rect('url(#c)')
		)
	},
	{
		id: 'grad-ember', name: 'Ember', category: 'gradient', accent: '#ff7a3a',
		svg: () => svg(
			radial('a', 0.75, 0.85, 0.9, [[0, '#ff7a3a', 0.95], [0.5, '#a0203a', 0.6], [1, '#a0203a', 0]]),
			rect('#0c0408') + rect('url(#a)')
		)
	},
	{
		id: 'grad-lagoon', name: 'Lagoon', category: 'gradient', accent: '#3ad0c0',
		svg: () => svg(
			radial('a', 0.3, 0.75, 0.9, [[0, '#3ad0c0', 0.85], [1, '#3ad0c0', 0]]) +
			radial('b', 0.8, 0.2, 0.7, [[0, '#3a6aff', 0.7], [1, '#3a6aff', 0]]),
			rect('#03101a') + rect('url(#a)') + rect('url(#b)')
		)
	},

	// Minimal dark
	{
		id: 'min-graphite', name: 'Graphite', category: 'minimal', accent: '#9a9aa8',
		svg: () => svg(radial('a', 0.5, 0.42, 0.7, [[0, '#26262c'], [0.6, '#0e0e12'], [1, '#000']]), rect('url(#a)'))
	},
	{
		id: 'min-midnight', name: 'Midnight Blue', category: 'minimal', accent: '#5a7aca',
		svg: () => svg(radial('a', 0.5, 0.35, 0.8, [[0, '#18223e'], [0.7, '#070a14'], [1, '#000']]), rect('url(#a)'))
	},
	{
		id: 'min-black', name: 'True Black', category: 'minimal', accent: '#8a8a8a',
		svg: () => svg('', rect('#000'))
	},

	// Seasonal
	{
		id: 'season-autumn', name: 'Autumn', category: 'seasonal', accent: '#e8843a',
		svg: () => svg(
			linear('sky', [[0, '#3a2030'], [0.6, '#d8703a'], [1, '#f8c070']]) + VIGNETTE_DEF,
			rect('url(#sky)') + wave(181, 700, 50, 4, '#a0401e', 0.8) + pines(182, 800, 50, 140, 260, '#5a1e10', 0.9) +
			wave(183, 920, 40, 3, '#2a0e08') + vignette()
		)
	},
	{
		id: 'season-winter', name: 'First Snow', category: 'seasonal', accent: '#cfe4ff',
		svg: () => svg(
			linear('sky', [[0, '#3a4a6a'], [0.7, '#a8bcd8'], [1, '#e8f0fa']]) + VIGNETTE_DEF,
			rect('url(#sky)') + stars(191, 260, H, '#ffffff') +
			ridge(192, 640, 260, 0.55, '#d8e4f2', 0.9) + pines(193, 840, 50, 160, 300, '#3a4a5e', 0.9) +
			wave(194, 940, 30, 4, '#f4f8fc') + vignette()
		),
		motion: 'twinkle'
	},
	{
		id: 'season-spring', name: 'Spring Meadow', category: 'seasonal', accent: '#f0a0c8',
		svg: () => svg(
			linear('sky', [[0, '#7aa0d8'], [0.7, '#f0c8d8'], [1, '#fff0e8']]) + VIGNETTE_DEF,
			rect('url(#sky)') + wave(201, 700, 60, 4, '#9ac88a', 0.8) + wave(202, 820, 60, 3, '#5a9a5a') +
			wave(203, 950, 50, 3, '#2e6a3a') + vignette()
		)
	},
	{
		id: 'season-summer', name: 'Summer Haze', category: 'seasonal', accent: '#ffd06a',
		svg: () => svg(
			linear('sky', [[0, '#3a8ad8'], [0.7, '#9ad0f0'], [1, '#fff4d0']]) + glowDef('g', '#fff8d0', 0.8) + VIGNETTE_DEF,
			rect('url(#sky)') + sun(1500, 260, 60, '#fffbe8', 'g', 380) +
			wave(211, 780, 30, 6, '#e8d8a0') + wave(212, 860, 20, 8, '#3aa0c8') + wave(213, 960, 20, 8, '#1a6a9a') + vignette()
		)
	}
];

export const WALLPAPERS: Wallpaper[] = PHOTOS.concat(SCENES);
export const DEFAULT_WALLPAPER_ID = DAILY_ID;

const cache: Record<string, string> = {};
const bitmaps: Record<string, string> = {};
const pending: Record<string, Promise<string> | undefined> = {};

/** The scene as an image URL (rendered once, then cached for the session). */
export function wallpaperUrl (id: string): string {
	if (id === DAILY_ID) return apodUrl();
	if (cache[id]) return cache[id];
	const wp = findWallpaper(id);
	const url = wp.photo
		? `wallpapers/${wp.photo}`
		: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wp.svg ? wp.svg() : '')}`;
	cache[id] = url;
	return url;
}

export function findWallpaper (id: string): Wallpaper {
	for (const w of WALLPAPERS) if (w.id === id) return w;
	for (const w of WALLPAPERS) if (w.id === DEFAULT_WALLPAPER_ID) return w;
	return WALLPAPERS[0];
}

export function wallpapersIn (category: WallpaperCategory): Wallpaper[] {
	return WALLPAPERS.filter((w) => w.category === category);
}

/** Seasonal scene for today's date (northern hemisphere). */
export function seasonalWallpaperId (date: Date): string {
	const m = date.getMonth();
	if (m >= 2 && m <= 4) return 'season-spring';
	if (m >= 5 && m <= 7) return 'season-summer';
	if (m >= 8 && m <= 10) return 'season-autumn';
	return 'season-winter';
}

/** Index of the wallpaper for a given day, stable for the whole day. */
export function dailyIndex (date: Date, count: number): number {
	const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
	return ((day * 7919) % count + count) % count;
}

/** The scene rendered once to a JPEG of the given size. A bitmap costs the GPU far less
 *  to show than SVG (which the engine may re-rasterise when anything around it changes),
 *  which matters on slow TVs. Falls back to the SVG URL if canvas rendering fails. */
export function wallpaperBitmap (id: string, width: number, height: number): Promise<string> {
	// Photos are already bitmaps; nothing to render.
	if (findWallpaper(id).photo) return Promise.resolve(wallpaperUrl(id));
	const key = `${id}@${width}x${height}`;
	if (bitmaps[key]) return Promise.resolve(bitmaps[key]);
	const inFlight = pending[key];
	if (inFlight) return inFlight;
	const job = new Promise<string>((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('no 2d context');
				ctx.drawImage(img, 0, 0, width, height);
				const url = canvas.toDataURL('image/jpeg', 0.86);
				bitmaps[key] = url;
				resolve(url);
			} catch {
				resolve(wallpaperUrl(id));
			}
		};
		img.onerror = () => resolve(wallpaperUrl(id));
		img.width = width;
		img.height = height;
		img.src = wallpaperUrl(id);
	});
	pending[key] = job;
	return job;
}
