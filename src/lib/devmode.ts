// Keeps LG Developer Mode alive from the TV itself. Without root, a sideloaded app is
// removed when the Developer Mode session (50 hours) runs out. The Developer Mode app's
// "Extend" button asks LG's server to reset that timer for a session token; this does the
// same, whenever the launcher is running and at most every RENEW_EVERY_MS. So as long as
// the launcher is opened at least once every couple of days, the session never ends.
//
// The token is written into devmode.json by scripts/install-tv.sh at install time (read
// from the TV over the Developer Mode connection). It is git-ignored and never leaves the
// TV except to LG's own renewal endpoint.

const TOKEN_FILE = 'devmode.json';
const RENEW_URL = 'https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=';
const RENEW_EVERY_MS = 12 * 60 * 60 * 1000;
const STATE_KEY = 'launcher-devmode-v1';

export interface DevModeState {
	/** epoch ms of the last attempt */
	lastAttempt: number;
	/** epoch ms of the last confirmed (or sent) renewal */
	lastRenewed: number;
	/** 'ok' confirmed by LG; 'sent' delivered but the reply was unreadable (cross-origin);
	 *  'error' failed; 'no-token' installed without a token */
	result: 'ok' | 'sent' | 'error' | 'no-token' | 'never';
}

export function readDevModeState (): DevModeState {
	try {
		const raw = localStorage.getItem(STATE_KEY);
		if (raw) return JSON.parse(raw) as DevModeState;
	} catch { /* fall through */ }
	return {lastAttempt: 0, lastRenewed: 0, result: 'never'};
}

function save (state: DevModeState): DevModeState {
	try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
	return state;
}

function readToken (): Promise<string | null> {
	return new Promise((resolve) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', TOKEN_FILE);
		xhr.onload = () => {
			try {
				const token = (JSON.parse(xhr.responseText) as {token?: string}).token;
				resolve(token && /^[A-Za-z0-9._-]+$/.test(token) ? token : null);
			} catch { resolve(null); }
		};
		xhr.onerror = () => resolve(null);
		xhr.send();
	});
}

/** Renew if due. Resolves with the new state; never rejects. */
export function renewDevModeIfDue (force = false): Promise<DevModeState> {
	const state = readDevModeState();
	if (!force && Date.now() - state.lastAttempt < RENEW_EVERY_MS && (state.result === 'ok' || state.result === 'sent')) return Promise.resolve(state);
	return readToken().then((token) => {
		const now = Date.now();
		if (!token) return save({...state, lastAttempt: now, result: 'no-token'});
		const url = RENEW_URL + encodeURIComponent(token);
		return new Promise<DevModeState>((resolve) => {
			// A readable reply needs LG's server to allow our origin. When it doesn't, the
			// request has still been delivered, so fall back to a no-cors fetch and record
			// it as sent.
			const xhr = new XMLHttpRequest();
			xhr.open('GET', url);
			xhr.timeout = 20000;
			xhr.onload = () => {
				const ok = xhr.status === 200 && /success/i.test(xhr.responseText);
				resolve(save({lastAttempt: now, lastRenewed: ok ? now : state.lastRenewed, result: ok ? 'ok' : 'error'}));
			};
			const fallback = () => {
				if (typeof fetch !== 'function') { resolve(save({...state, lastAttempt: now, result: 'error'})); return; }
				fetch(url, {mode: 'no-cors', cache: 'no-store'})
					.then(() => resolve(save({lastAttempt: now, lastRenewed: now, result: 'sent'})))
					.catch(() => resolve(save({...state, lastAttempt: now, result: 'error'})));
			};
			xhr.onerror = fallback;
			xhr.ontimeout = () => resolve(save({...state, lastAttempt: now, result: 'error'}));
			xhr.send();
		});
	});
}

/** One line for Settings → System. */
export function describeDevMode (s: DevModeState): string {
	const ago = (t: number) => {
		const h = Math.round((Date.now() - t) / 3600000);
		return h < 1 ? 'less than an hour ago' : h === 1 ? '1 hour ago' : `${h} hours ago`;
	};
	switch (s.result) {
		case 'ok': return `Session renewed ${ago(s.lastRenewed)}. Open the launcher at least every two days to keep it going.`;
		case 'sent': return `Renewal sent ${ago(s.lastRenewed)}. Open the launcher at least every two days to keep it going.`;
		case 'error': return s.lastRenewed ? `Last renewal failed; the previous one was ${ago(s.lastRenewed)}. Retrying while the launcher is open.` : 'Renewal failed. Check the TV is online, or press Extend in the Developer Mode app.';
		case 'no-token': return 'Not set up: reinstall with scripts/install-tv.sh, or press Extend in the Developer Mode app every two days.';
		default: return 'Not renewed yet.';
	}
}
