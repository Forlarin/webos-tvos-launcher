// NASA's Astronomy Picture of the Day, as the "Today's NASA Picture" wallpaper.
//
// APOD now lives on science.nasa.gov, and the old api.nasa.gov endpoint returns the NASA
// logo for every day (checked October 2026). So we read the APOD page and take its
// preview image (og:image), a 1280px rendition from NASA's APOD image store. Checked at
// most once a day when it works, cached, so the wallpaper still shows the last picture
// offline, and the built-in Cosmic Cliffs photo if nothing has ever been fetched.

const PAGE = 'https://science.nasa.gov/apod/';
const KEY = 'launcher-apod-v1';
const RETRY_MS = 3 * 60 * 60 * 1000;
export const APOD_FALLBACK = 'wallpapers/nasa-carina.jpg';

export interface Apod {
	/** NASA's date for the picture, YYYY-MM-DD */
	date: string;
	url: string;
	title: string;
	/** photographer credit when the picture isn't NASA's own */
	credit: string;
	lastAttempt: number;
}


export function cachedApod (): Apod | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? JSON.parse(raw) as Apod : null;
	} catch { return null; }
}

/** Only images from NASA's APOD image store count; anything else (logos, other sites)
 *  is not a wallpaper. */
export function isApodImage (url: string): boolean {
	return /^https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/cds\/apod\/[^"'<>\s]+\.(jpe?g|png)$/i.test(url);
}

function save (a: Apod): void {
	try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

function today (): string {
	const d = new Date();
	const p = (n: number) => (n < 10 ? `0${n}` : String(n));
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Image URL to show now. */
export function apodUrl (): string {
	const a = cachedApod();
	return a && a.url && isApodImage(a.url) ? a.url : APOD_FALLBACK;
}

/** Fetch today's picture if due. Resolves true when the picture changed (and the new
 *  image has already loaded, so switching to it never shows a blank screen). */
export function refreshApod (): Promise<boolean> {
	const prev = cachedApod();
	if (prev && prev.url && !isApodImage(prev.url)) { prev.url = ''; save(prev); }
	const since = prev ? Date.now() - prev.lastAttempt : Infinity;
	// Have a photo: refresh once a day (and not more than every few hours on failures).
	if (prev && prev.url && (prev.date === today() || since < RETRY_MS)) return Promise.resolve(false);
	// No photo yet: keep trying, but not more than every 15 minutes.
	if (prev && !prev.url && since < 15 * 60 * 1000) return Promise.resolve(false);
	const attempt = (prev ? {...prev, lastAttempt: Date.now()} : {date: '', url: '', title: '', credit: '', lastAttempt: Date.now()});
	save(attempt);
	return new Promise<boolean>((resolve) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', PAGE);
		xhr.timeout = 30000;
		xhr.onload = () => {
			const m = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(xhr.responseText || '');
			const url = m ? m[1] : '';
			if (xhr.status !== 200 || !isApodImage(url)) { resolve(false); return; }
			if (prev && prev.url === url) { save({...attempt, date: today()}); resolve(false); return; }
			const img = new Image();
			img.onload = () => {
				save({date: today(), url, title: 'Astronomy Picture of the Day', credit: '', lastAttempt: Date.now()});
				resolve(true);
			};
			img.onerror = () => resolve(false);
			img.src = url;
		};
		xhr.onerror = () => resolve(false);
		xhr.ontimeout = () => resolve(false);
		xhr.send();
	});
}
