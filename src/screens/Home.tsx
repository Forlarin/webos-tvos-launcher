import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Row} from '../components/Row';
import {Avatar} from '../components/Avatar';
import {Glyph, type GlyphName} from '../components/Glyph';
import type {TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useClock} from '../hooks/useClock';
import {useTimeFormat} from '../hooks/useTimeFormat';
import {dateText, dayName, greeting, timeParts} from '../lib/clock';
import type {Profile} from '../lib/storage';
import {rgba} from '../lib/color';
import {LITE} from '../lib/perf';

export interface HomeRow {
	id: string;
	label: string;
	items: TileModel[];
	emptyText?: string;
	/** the dock: larger tiles on a frosted band */
	dock?: boolean;
	/** 16:9 cards with the name on the card (inputs) */
	wide?: boolean;
}

export interface TopAction {
	key: string;
	label: string;
	glyph: GlyphName;
}

interface Props {
	profile: Profile;
	rows: HomeRow[];
	actions: TopAction[];
	active: boolean;
	clockStyle: 'thin' | 'bold';
	onActivate: (rowId: string, item: TileModel) => void;
	onAction: (key: string) => void;
}

const TOP = -1;

/** Top-shelf wash: brand colour from the upper left, fading out across the screen. */
function heroWash (color: string): string {
	// Lite: a pool around the title, in a smaller box (see .app--lite .home__hero). On the
	// UM7300 a full-screen repaint per focus move cost ~40 ms; this box costs nothing.
	if (LITE) return `radial-gradient(ellipse farthest-side at 0% 45%, ${rgba(color, 0.45)} 0%, ${rgba(color, 0.18)} 50%, ${rgba(color, 0)} 100%)`;
	return `linear-gradient(100deg, ${rgba(color, 0.42)} 0%, ${rgba(color, 0.16)} 34%, ${rgba(color, 0)} 62%)`;
}

/** A soft pool of colour. A gradient rather than a blurred shape: blur is costly on TV
 *  GPUs and webOS 4 can't blur a background at all. */
export function glow (color: string): string {
	return `radial-gradient(ellipse closest-side, ${rgba(color, 1)} 0%, ${rgba(color, 0.35)} 45%, ${rgba(color, 0)} 100%)`;
}


/** Home: clock and greeting top-left, quick actions and the profile top-right, the
 *  focused item's name as a large title, then the dock and the sources row.
 *  Up/Down move one row (Up from the first row reaches the top actions); each row
 *  remembers its column. */
export function Home ({profile, rows, actions, active, clockStyle, onActivate, onAction}: Props) {
	const now = useClock();
	const format = useTimeFormat();
	const [rowIndex, setRowIndex] = useState(0);
	const [columns, setColumns] = useState<Record<string, number>>({});
	const [actionIndex, setActionIndex] = useState(actions.length - 1);

	const columnOf = (row: HomeRow) => clamp(columns[row.id] || 0, 0, Math.max(0, row.items.length - 1));
	const setColumn = (rowId: string, col: number) => setColumns((c) => ({...c, [rowId]: col}));
	/** Move along a row relative to the latest state, so quick repeated presses all count. */
	const stepColumn = (row: HomeRow, d: number) => setColumns((c) => ({
		...c,
		[row.id]: clamp(clamp(c[row.id] || 0, 0, Math.max(0, row.items.length - 1)) + d, 0, Math.max(0, row.items.length - 1))
	}));
	const stepAction = (d: number) => setActionIndex((i) => clamp(clamp(i, 0, actions.length - 1) + d, 0, actions.length - 1));
	const action = clamp(actionIndex, 0, actions.length - 1);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (rowIndex === TOP) {
			switch (key) {
				case 'left': stepAction(-1); break;
				case 'right': stepAction(1); break;
				case 'down': setRowIndex(0); break;
				case 'enter': if (actions[action]) onAction(actions[action].key); break;
			}
			return true;
		}
		const row = rows[rowIndex];
		if (!row) return false;
		switch (key) {
			case 'up': setRowIndex((r) => (r === 0 && actions.length ? TOP : clamp(r - 1, 0, rows.length - 1))); return true;
			case 'down': setRowIndex((r) => clamp(r + 1, 0, rows.length - 1)); return true;
			case 'left': stepColumn(row, -1); return true;
			case 'right': stepColumn(row, 1); return true;
			case 'enter': {
				const item = row.items[columnOf(row)];
				if (item) onActivate(row.id, item);
				return true;
			}
			case 'back': return true;   // swallow: Back on the home screen does nothing
		}
	}, [rows, rowIndex, columns, actions, action, onActivate, onAction]);

	useKeys(handleKey, active);

	// Number keys 1–9 open the app in that dock position (remote digits or keypad). One
	// subscription reading the latest rows, like useKeys.
	const latest = useRef({rows, active, onActivate});
	latest.current = {rows, active, onActivate};
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const {rows: r, active: on, onActivate: open} = latest.current;
			if (!on) return;
			const c = e.keyCode;
			const n = c >= 49 && c <= 57 ? c - 48 : c >= 97 && c <= 105 ? c - 96 : /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
			const dock = r.find((row) => row.dock);
			const item = n && dock ? dock.items[n - 1] : undefined;
			if (!item || !dock) return;
			e.preventDefault();
			open(dock.id, item);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const {time, period} = timeParts(now, format);
	const focusedRow = rowIndex === TOP ? null : rows[rowIndex];
	const focusedItem = focusedRow ? focusedRow.items[columnOf(focusedRow)] : null;
	const title = rowIndex === TOP ? (actions[action] ? actions[action].label : '') : focusedItem ? focusedItem.label : '';

	const subtitle = rowIndex === TOP || !focusedItem ? '' : focusedItem.subtitle || '';
	const brand = (focusedItem && (focusedItem.brand || focusedItem.color)) || profile.accent;

	return (
		<div class="screen home">
			<div class="home__ambient" style={{background: glow(brand)}} />
			{/* Top shelf: the focused app's colour washes in from the left behind its name.
			    Re-keyed per item so each change cross-fades in. */}
			<div class="home__hero" key={`hero-${title}`} style={{background: heroWash(brand)}} />

			<div class="home__clock">
				<div class={`home__time home__time--${clockStyle}`}>
					{time}{period && <span class="home__period">{period}</span>}
				</div>
				<div class="home__date">{dayName(now)}, {dateText(now)}</div>
				<div class="home__greeting">{greeting(now)}, {profile.name}</div>
			</div>

			<div class="home__top">
				{actions.map((a, i) => {
					const focused = rowIndex === TOP && i === action;
					const isProfile = a.key === 'profile';
					return (
						<div
							key={a.key}
							class={`pill${focused ? ' pill--focused' : ''}${isProfile ? ' pill--profile' : ''}`}
							onMouseEnter={() => { setRowIndex(TOP); setActionIndex(i); }}
							onClick={() => onAction(a.key)}
						>
							{isProfile
								? <><Avatar index={profile.avatar} size={44} /><span class="pill__label">{profile.name}</span></>
								: <><svg class="pill__glyph" viewBox="0 0 24 24"><Glyph name={a.glyph} raw /></svg><span class="pill__label">{a.label}</span></>}
						</div>
					);
				})}
			</div>

			<div class="home__title" key={title}>
				<div class="home__title-name">{title}</div>
				{subtitle && <div class="home__title-sub">{subtitle}</div>}
			</div>

			<div class="home__rows">
				{rows.map((row, i) => (
					<div key={row.id} class={row.dock ? 'dock' : 'shelf'}>
						<Row
							label={row.label}
							items={row.items}
							emptyText={row.emptyText}
							focused={i === rowIndex}
							selected={columnOf(row)}
							large={row.dock}
							wide={row.wide}
							onSelect={(col) => { setRowIndex(i); setColumn(row.id, col); }}
							onActivate={(col) => onActivate(row.id, row.items[col])}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
