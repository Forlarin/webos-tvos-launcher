import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {Home, type HomeRow, type TopAction} from './screens/Home';
import {Settings, type SettingsTab} from './screens/Settings';
import {WhosWatching} from './screens/WhosWatching';
import {Wallpapers} from './screens/Wallpapers';
import {Profiles} from './screens/Profiles';
import {AllApps} from './screens/AllApps';
import type {OptionItem} from './components/OptionList';
import {Toast, type ToastMessage} from './components/Toast';
import {Backdrop} from './components/Backdrop';
import {Avatar} from './components/Avatar';
import {PinPad} from './components/PinPad';
import {Screensaver} from './components/Screensaver';
import type {TileModel} from './components/Tile';
import {listApps, type AppEntry} from './lib/apps';
import {listInputs, MOCK_INPUTS, type InputSource} from './lib/inputs';
import {launchApp, launchLgHome} from './lib/launch';
import {isWebOS} from './lib/luna';
import {hidePointerOnForeground} from './lib/pointer';
import {getDeviceInfo, type DeviceInfo} from './lib/device';
import {LITE} from './lib/perf';
import {getNetwork, type NetworkState} from './lib/network';
import {refreshApod} from './lib/apod';
import {describeDevMode, readDevModeState, renewDevModeIfDue, type DevModeState} from './lib/devmode';
import {greeting} from './lib/clock';
import {
	activeProfile, loadHousehold, saveHousehold, toggleId, updateProfile,
	type Household, type Profile, type Rotation
} from './lib/storage';
import {DAILY_ID, dailyIndex, findWallpaper, seasonalWallpaperId, wallpaperUrl, WALLPAPERS} from './lib/wallpapers';
import {alignGlass, glassImage} from './lib/glass';
import {appTile, inputTile, pickAppsInOrder, pickInOrder} from './lib/tiles';
import {DEFAULT_APP_IDS} from './config/catalog';
import {SYSTEM_APP, TIMING} from './config/constants';

type Screen = 'picker' | 'welcome' | 'home' | 'settings' | 'wallpapers' | 'profiles' | 'apps';

const ROW = {apps: 'apps', sources: 'sources'} as const;
const ACTION = {apps: 'apps', network: 'network', lgHome: 'lg-home', wallpapers: 'wallpapers', settings: 'settings', profile: 'profile'} as const;

const ROTATION_ORDER: Rotation[] = ['off', 'hourly', 'daily', 'seasonal'];
const ROTATION_LABEL: Record<Rotation, string> = {off: 'Off', hourly: 'Every hour', daily: 'Daily', seasonal: 'Seasonal'};
const DIM_STEPS = [0, 15, 25, 40, 55, 70];
const SAVER_STEPS = [0, 5, 10, 20, 30, 60];

interface PinRequest {
	title: string;
	subtitle?: string;
	/** check the entered PIN; return true to close */
	check: (pin: string) => boolean;
}

const LAST_SEEN_KEY = 'launcher-last-seen';

/** When the launcher was last on screen (epoch ms; 0 if never). */
function lastSeen (): number {
	try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0; } catch { return 0; }
}

function markSeen (): void {
	try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
}

/** Screensaver slideshow: the profile's favourites when there are two or more,
 *  otherwise the NASA photos; whatever is on screen now comes first. */
function saverIds (p: Profile, current: string): string[] {
	const pool = p.favoriteWallpapers.length > 1 ? p.favoriteWallpapers : WALLPAPERS.filter((w) => w.photo).map((w) => w.id);
	return [current].concat(pool.filter((id) => id !== current));
}

function nextOf<T> (list: T[], current: T): T {
	const i = list.indexOf(current);
	return list[(i + 1) % list.length];
}

/** The wallpaper a profile shows right now, honouring its rotation setting. */
function effectiveWallpaper (p: Profile, now: Date): string {
	// Favourites when there are two or more; otherwise the NASA photos.
	const pool = p.favoriteWallpapers.length > 1 ? p.favoriteWallpapers : WALLPAPERS.filter((w) => w.photo).map((w) => w.id);
	switch (p.rotation) {
		case 'daily': return pool[dailyIndex(now, pool.length)];
		case 'hourly': return pool[(dailyIndex(now, pool.length) + now.getHours()) % pool.length];
		case 'seasonal': return seasonalWallpaperId(now);
		default: return p.wallpaperId;
	}
}

export function App () {
	const [household, setHousehold] = useState<Household>(loadHousehold);
	// The TV may close the launcher in the background to free memory (1 GB sets do this
	// whenever an app opens), so a fresh start is often just a return from Netflix. Ask
	// "Who's Watching?" only after a long time away, measured from when we were last seen.
	const [screen, setScreen] = useState<Screen>(() => {
		if (!loadHousehold().askOnLaunch) return 'home';
		return Date.now() - lastSeen() > TIMING.pickerAfterAwayMs ? 'picker' : 'home';
	});
	const [apps, setApps] = useState<AppEntry[]>([]);
	const [inputs, setInputs] = useState<InputSource[]>([]);
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const [previewId, setPreviewId] = useState<string | null>(null);
	const [pinRequest, setPinRequest] = useState<PinRequest | null>(null);
	const [saver, setSaver] = useState(false);
	const [hour, setHour] = useState(() => new Date().getHours());
	const [device, setDevice] = useState<DeviceInfo | null>(null);
	const [devMode, setDevMode] = useState<DevModeState>(readDevModeState);
	const [network, setNetwork] = useState<NetworkState>({kind: 'wifi', label: 'Wi-Fi'});
	/** bumps when a new NASA picture of the day has loaded */
	const [apodVersion, setApodVersion] = useState(0);
	const [profilesEntry, setProfilesEntry] = useState<{id?: string; editName?: boolean; back: Screen}>({back: 'home'});
	const toastTimer = useRef(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const [glassImg, setGlassImg] = useState<string | null>(null);
	const lastInput = useRef(Date.now());

	const profile = activeProfile(household);

	const showToast = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
		window.clearTimeout(toastTimer.current);
		setToast({text, kind});
		toastTimer.current = window.setTimeout(() => setToast(null), TIMING.toastMs);
	}, []);

	const commit = useCallback((next: Household) => { setHousehold(next); saveHousehold(next); }, []);
	const patchProfile = (p: Partial<Profile>) => commit(updateProfile(household, profile.id, p));

	// Start in remote (5-way) mode: hide the Magic Remote pointer whenever we come to the front.
	useEffect(() => hidePointerOnForeground(), []);
	useEffect(() => { getDeviceInfo().then(setDevice); }, []);

	// NASA picture of the day: check at start, on return and hourly (fetches only when due).
	useEffect(() => {
		const check = () => { if (!document.hidden) refreshApod().then((changed) => { if (changed) setApodVersion((v) => v + 1); }); };
		check();
		document.addEventListener('visibilitychange', check);
		const id = window.setInterval(check, 60 * 60 * 1000);
		return () => { document.removeEventListener('visibilitychange', check); window.clearInterval(id); };
	}, []);

	// Network name for the Wi-Fi pill: at start, on return and every minute.
	useEffect(() => {
		const refresh = () => { if (!document.hidden) getNetwork().then(setNetwork); };
		refresh();
		document.addEventListener('visibilitychange', refresh);
		const id = window.setInterval(refresh, 60000);
		return () => { document.removeEventListener('visibilitychange', refresh); window.clearInterval(id); };
	}, []);

	// Keep Developer Mode alive: renew when due, at start, on return and hourly while open.
	useEffect(() => {
		if (!isWebOS()) return;
		const check = () => { if (!document.hidden) renewDevModeIfDue().then(setDevMode); };
		check();
		document.addEventListener('visibilitychange', check);
		const id = window.setInterval(check, 60 * 60 * 1000);
		return () => { document.removeEventListener('visibilitychange', check); window.clearInterval(id); };
	}, []);

	// Apps: at start and whenever the Homebrew option changes.
	useEffect(() => {
		listApps(household.useHomebrew)
			.then(({apps: list, source}) => {
				setApps(list);
				if (household.useHomebrew && source !== 'homebrew') showToast('Homebrew Channel not available, using the built-in app list', 'error');
			})
			.catch(() => showToast('Could not read the app list', 'error'));
	}, [household.useHomebrew, showToast]);

	// Inputs: refreshed whenever we come back to the foreground. Coming back after a long
	// time away also shows "Who's Watching?" again (never after a quick hop into an app).
	useEffect(() => {
		const refresh = () => {
			if (!isWebOS()) { setInputs(MOCK_INPUTS); return; }
			listInputs().then(setInputs).catch(() => showToast('Could not read the inputs', 'error'));
		};
		refresh();
		const onVisibility = () => {
			if (document.hidden) { markSeen(); setSaver(false); return; }
			refresh();
			lastInput.current = Date.now();
			const h = loadHousehold();
			if (h.askOnLaunch && Date.now() - lastSeen() > TIMING.pickerAfterAwayMs) setScreen('picker');
			markSeen();
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, [showToast]);

	// Idle → screensaver; and an hourly tick for wallpaper rotation.
	useEffect(() => {
		const onInput = () => { lastInput.current = Date.now(); };
		window.addEventListener('keydown', onInput, true);
		window.addEventListener('mousemove', onInput, true);
		const id = window.setInterval(() => {
			setHour(new Date().getHours());
			if (!document.hidden) markSeen();   // so a background kill still counts as "just here"
			const mins = loadHousehold().screensaverMinutes;
			if (mins > 0 && !document.hidden && Date.now() - lastInput.current > mins * 60000) setSaver(true);
		}, 20000);
		return () => {
			window.removeEventListener('keydown', onInput, true);
			window.removeEventListener('mousemove', onInput, true);
			window.clearInterval(id);
		};
	}, []);

	// Welcome → home after the greeting.
	useEffect(() => {
		if (screen !== 'welcome') return;
		const t = window.setTimeout(() => setScreen('home'), TIMING.welcomeMs);
		return () => window.clearTimeout(t);
	}, [screen]);

	/** Run `action` now, or after the household PIN when the active profile is a Kids one. */
	const guarded = (title: string, action: () => void) => {
		if (!profile.kids || !household.pin) { action(); return; }
		setPinRequest({
			title,
			subtitle: 'Enter the household PIN',
			check: (pin) => {
				if (pin !== household.pin) return false;
				action();
				return true;
			}
		});
	};

	// ----- derived rows -----
	const shownApps = useMemo(() => pickAppsInOrder(apps, profile.appIds), [apps, profile.appIds]);
	const shownInputs = useMemo(
		() => (profile.sourceIds ? pickInOrder(inputs, profile.sourceIds, (s) => s.appId) : inputs),
		[inputs, profile.sourceIds]
	);

	const rows: HomeRow[] = useMemo(() => {
		const list: HomeRow[] = [{id: ROW.apps, label: profile.kids ? 'My Apps' : 'Favourites', items: shownApps.map(appTile), emptyText: 'No apps yet. Add some in Settings.', dock: true}];
		if (!profile.kids) list.push({id: ROW.sources, label: 'Inputs', items: shownInputs.map(inputTile), emptyText: 'No inputs selected', wide: true});
		return list;
	}, [shownApps, shownInputs, profile.kids]);

	const actions: TopAction[] = profile.kids
		? [{key: ACTION.profile, label: 'Switch profile', glyph: 'people'}]
		: [
			{key: ACTION.apps, label: 'All Apps', glyph: 'grid'},
			{key: ACTION.wallpapers, label: 'Wallpapers', glyph: 'image'},
			{key: ACTION.network, label: network.label, glyph: network.kind === 'offline' ? 'offline' : 'wifi'},
			{key: ACTION.settings, label: 'Settings', glyph: 'gear'},
			{key: ACTION.profile, label: 'Switch profile', glyph: 'people'}
		];

	const tabs: SettingsTab[] = useMemo(() => [
		{id: ROW.apps, label: 'Favourites', noun: 'apps', items: apps.map(appTile), shown: shownApps.map(appTile)},
		{id: ROW.sources, label: 'Inputs', noun: 'inputs', items: inputs.map(inputTile), shown: shownInputs.map(inputTile)}
	], [apps, inputs, shownApps, shownInputs]);

	const options: OptionItem[] = [
		{id: 'rotation', section: `Appearance · ${profile.name}`, label: 'Wallpaper rotation', description: 'Change the wallpaper automatically: your favourites when you have two or more, otherwise the NASA photos.', value: ROTATION_LABEL[profile.rotation]},
		{id: 'dim', label: 'Wallpaper dimming', description: 'Darkens the wallpaper behind the interface.', value: `${profile.dim}%`},
		{id: 'appearance', label: 'Appearance', description: 'Dark keeps the interface deep and cinematic; Light softens the shading.', value: profile.appearance === 'dark' ? 'Dark' : 'Light'},
		{id: 'density', section: 'Home screen', label: 'Layout', description: 'Spacious uses larger dock icons; Compact fits more on screen.', value: household.density === 'spacious' ? 'Spacious' : 'Compact'},
		{id: 'clock', label: 'Clock style', description: 'The clock on the home screen.', value: household.clockStyle === 'thin' ? 'Thin' : 'Bold'},
		{id: 'motion', label: 'Animations', description: 'Slow wallpaper drift, twinkling stars and smooth transitions. Turn off on a slow TV.', value: household.motion},
		{id: 'glass', label: 'Liquid Glass', description: 'The dock, buttons, cards and panels look like glass, with the wallpaper glowing through. Off gives plain tinted panels.', value: household.glass},
		{id: 'restore', label: 'Restore default favourites', description: 'Puts this profile’s dock back to the original apps and order.', value: null},
		{id: 'manage', section: 'Profiles', label: 'Manage profiles', description: 'Add, rename and delete profiles; change avatars, colours, Kids mode and the default profile.', value: null},
		{id: 'ask', label: 'Ask “Who’s Watching?”', description: 'When the launcher opens, and when you come back after four hours away.', value: household.askOnLaunch},
		{id: 'pin', label: 'Household PIN', description: 'Needed to leave a Kids profile or open settings from one.', value: household.pin ? 'Change' : 'Set'},
		{id: 'saver', section: 'Screensaver', label: 'Start screensaver after', description: 'A slideshow of NASA photos (or your favourite wallpapers) with a drifting clock. Counts only while the launcher is on screen.', value: household.screensaverMinutes ? `${household.screensaverMinutes} min` : 'Never'},
		{id: 'devmode', section: 'System', label: 'Keep Developer Mode on', description: describeDevMode(devMode), value: null},
		{id: 'lg-home', label: 'LG Home', description: 'LG’s own home screen and app bar (the Home button on the remote opens it too).', value: null},
		{id: 'lg-settings', label: 'LG Settings', description: 'Picture, sound, network, inputs and everything else the TV controls.', value: null},
		{id: 'homebrew', label: 'Live app list via Homebrew Channel', description: 'Rooted TVs only. Lists every installed app with its real icon, using the Homebrew Channel, which runs commands as root.', value: household.useHomebrew},
		{id: 'about', label: 'About this TV', description: device ? `${device.model} · firmware ${device.firmware} · webOS SDK ${device.sdk}` : 'Model information is not available on this TV.', value: null}
	];

	// ----- actions -----
	const openApp = (id: string, label: string) => {
		launchApp(id).catch(() => showToast(`Couldn't open ${label}`, 'error'));
	};

	const onActivate = useCallback((_rowId: string, item: TileModel) => openApp(item.key, item.label), [showToast]);

	const onAction = (key: string) => {
		switch (key) {
			case ACTION.apps: setScreen('apps'); break;
			case ACTION.network: openApp(SYSTEM_APP.lgSettings, 'LG Settings'); break;
			case ACTION.lgHome: launchLgHome().catch(() => showToast("Couldn't open LG Home", 'error')); break;
			case ACTION.wallpapers: setScreen('wallpapers'); break;
			case ACTION.settings: guarded('Settings', () => setScreen('settings')); break;
			case ACTION.profile: setScreen('picker'); break;
		}
	};

	const onPick = (id: string) => {
		const go = () => { commit({...household, activeId: id}); setScreen('welcome'); };
		if (id !== profile.id && profile.kids && household.pin) guarded(`Leave ${profile.name}`, go);
		else go();
	};

	const onToggle = (tabId: string, key: string) => {
		if (tabId === ROW.apps) patchProfile({appIds: toggleId(profile.appIds, key)});
		else patchProfile({sourceIds: toggleId(profile.sourceIds || inputs.map((s) => s.appId), key)});
	};

	const onReorder = (tabId: string, keys: string[]) => {
		if (tabId === ROW.apps) patchProfile({appIds: keys});
		else patchProfile({sourceIds: keys});
	};

	const onOption = (id: string) => {
		switch (id) {
			case 'rotation': patchProfile({rotation: nextOf(ROTATION_ORDER, profile.rotation)}); break;
			case 'dim': patchProfile({dim: nextOf(DIM_STEPS, profile.dim)}); break;
			case 'appearance': patchProfile({appearance: profile.appearance === 'dark' ? 'light' : 'dark'}); break;
			case 'density': commit({...household, density: household.density === 'spacious' ? 'compact' : 'spacious'}); break;
			case 'clock': commit({...household, clockStyle: household.clockStyle === 'thin' ? 'bold' : 'thin'}); break;
			case 'motion': commit({...household, motion: !household.motion}); break;
			case 'glass': commit({...household, glass: !household.glass}); break;
			case 'restore': patchProfile({appIds: DEFAULT_APP_IDS.slice()}); showToast('Favourites restored'); break;
			case 'manage': setProfilesEntry({id: profile.id, back: 'settings'}); setScreen('profiles'); break;
			case 'ask': commit({...household, askOnLaunch: !household.askOnLaunch}); break;
			case 'saver': commit({...household, screensaverMinutes: nextOf(SAVER_STEPS, household.screensaverMinutes)}); break;
			case 'homebrew': commit({...household, useHomebrew: !household.useHomebrew}); break;
			case 'devmode':
				showToast('Renewing…');
				renewDevModeIfDue(true).then((st) => {
					setDevMode(st);
					const ok = st.result === 'ok' || st.result === 'sent';
					showToast(ok ? 'Developer Mode renewed' : 'Renewal failed', ok ? 'info' : 'error');
				});
				break;
			case 'lg-home': launchLgHome().catch(() => showToast("Couldn't open LG Home", 'error')); break;
			case 'lg-settings': openApp(SYSTEM_APP.lgSettings, 'LG Settings'); break;
			case 'pin': {
				const setNew = () => setPinRequest({
					title: 'New household PIN',
					subtitle: 'Four digits',
					check: (pin) => { commit({...household, pin}); showToast('PIN saved'); return true; }
				});
				if (!household.pin) { setNew(); break; }
				setPinRequest({
					title: 'Current PIN',
					check: (pin) => { if (pin !== household.pin) return false; window.setTimeout(setNew, 0); return true; }
				});
				break;
			}
		}
	};

	// ----- render -----
	const wallpaperId = previewId || effectiveWallpaper(profile, new Date(new Date().setHours(hour)));
	const ambient = findWallpaper(wallpaperId).accent;
	const sub = screen === 'settings' || screen === 'profiles' || screen === 'apps' || (screen === 'wallpapers' && !previewId);
	const overlayActive = !!pinRequest || saver;
	// Liquid Glass: a blurred copy of the wallpaper on screen (made once per wallpaper)
	useEffect(() => {
		if (!household.glass) { setGlassImg(null); return; }
		let live = true;
		glassImage(wallpaperUrl(wallpaperId)).then((url) => { if (live) setGlassImg(url); });
		return () => { live = false; };
	}, [wallpaperId, apodVersion, household.glass]);

	// …lined up behind each glass surface whenever the layout may have changed (and again
	// once screen-entry animations have settled).
	const liquid = household.glass && !!glassImg;
	useEffect(() => {
		if (!liquid || !rootRef.current) return;
		const root = rootRef.current;
		alignGlass(root);
		const t = window.setTimeout(() => alignGlass(root), 500);
		return () => window.clearTimeout(t);
	}, [liquid, glassImg, screen, profile.id, previewId, !!pinRequest, inputs.length, apps.length, network.label]);

	const rootClass = [
		'app',
		household.density === 'compact' && 'app--compact',
		!household.motion && 'app--still',
		LITE && 'app--lite',
		!household.glass && 'app--noglass',
		liquid && 'app--liquid',
		profile.appearance === 'light' && 'app--light'
	].filter(Boolean).join(' ');

	return (
		<div ref={rootRef} class={rootClass} style={{'--accent': profile.accent, '--ambient': ambient, '--glass-img': glassImg ? `url("${glassImg}")` : 'none'}}>
			<Backdrop key={wallpaperId === DAILY_ID ? `daily-${apodVersion}` : 'backdrop'} wallpaperId={wallpaperId} dim={screen === 'picker' ? Math.max(profile.dim, 45) : profile.dim} motion={household.motion} blurred={sub} light={profile.appearance === 'light'} />

			{/* Home stays mounted under the other screens so it keeps its focus position. */}
			{screen !== 'picker' && screen !== 'welcome' && (
				<div class={`layer${screen === 'home' ? '' : ' layer--behind'}`}>
					<Home
						key={profile.id}
						profile={profile}
						rows={rows}
						actions={actions}
						clockStyle={household.clockStyle}
						active={screen === 'home' && !overlayActive}
						onActivate={onActivate}
						onAction={onAction}
					/>
				</div>
			)}

			{screen === 'picker' && (
				<div class="layer layer--enter">
					<WhosWatching
						profiles={household.profiles}
						initialId={household.askOnLaunch ? household.defaultId : profile.id}
						active={!overlayActive}
						onPick={onPick}
						onAdd={() => { setProfilesEntry({editName: true, back: 'picker'}); setScreen('profiles'); }}
						onEdit={(id, patch) => commit(updateProfile(household, id, patch))}
						onCancel={() => setScreen('home')}
					/>
				</div>
			)}

			{screen === 'welcome' && (
				<div class="layer welcome">
					<Avatar index={profile.avatar} size={168} />
					<div class="welcome__text">{greeting(new Date())}, {profile.name}.</div>
					<div class="welcome__sub">Welcome back.</div>
				</div>
			)}

			{screen === 'settings' && (
				<div class="layer layer--enter">
					<Settings tabs={tabs} options={options} active={!overlayActive} onToggle={onToggle} onReorder={onReorder} onOption={onOption} onClose={() => setScreen('home')} />
				</div>
			)}

			{screen === 'wallpapers' && (
				<div class="layer layer--enter">
					<Wallpapers
						currentId={profile.wallpaperId}
						favorites={profile.favoriteWallpapers}
						active={!overlayActive}
						onPreview={setPreviewId}
						onApply={(id) => {
							patchProfile({wallpaperId: id, rotation: 'off'});
							showToast(`${findWallpaper(id).name} set for ${profile.name}`);
						}}
						onToggleFavorite={(id) => {
							const fav = profile.favoriteWallpapers.indexOf(id) === -1;
							patchProfile({favoriteWallpapers: toggleId(profile.favoriteWallpapers, id)});
							showToast(fav ? 'Added to favourites' : 'Removed from favourites');
						}}
						onClose={() => { setPreviewId(null); setScreen('home'); }}
					/>
				</div>
			)}

			{screen === 'apps' && (
				<div class="layer layer--enter">
					<AllApps items={apps.map(appTile)} active={!overlayActive} onOpen={(item) => openApp(item.key, item.label)} onClose={() => setScreen('home')} />
				</div>
			)}

			{screen === 'profiles' && (
				<div class="layer layer--enter">
					<Profiles
						household={household}
						initialId={profilesEntry.id}
						editNameFirst={profilesEntry.editName}
						active={!overlayActive}
						onChange={(h) => {
							// Adding from the picker: the new profile is the one being edited.
							commit(h);
						}}
						onClose={() => setScreen(profilesEntry.back)}
					/>
				</div>
			)}

			{pinRequest && (
				<PinPad
					title={pinRequest.title}
					subtitle={pinRequest.subtitle}
					active={!saver}
					onDone={(pin) => {
						const ok = pinRequest.check(pin);
						if (ok) setPinRequest(null);
						return ok;
					}}
					onCancel={() => setPinRequest(null)}
				/>
			)}

			{saver && (
				<Screensaver
					wallpaperIds={saverIds(profile, wallpaperId)}
					motion={household.motion}
					onWake={() => { lastInput.current = Date.now(); setSaver(false); }}
				/>
			)}

			<Toast message={toast} />
		</div>
	);
}
