import {useCallback, useMemo, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {CATEGORY_LABELS, CATEGORY_ORDER, WALLPAPERS, wallpapersIn, type Wallpaper} from '../lib/wallpapers';
import {useWallpaperImage} from '../hooks/useWallpaperImage';
import {LAYOUT} from '../theme/tokens';
import {rgba} from '../lib/color';

interface Props {
	currentId: string;
	favorites: string[];
	active: boolean;
	/** previewing hides the gallery so the scene shows full screen behind it */
	onPreview: (id: string | null) => void;
	onApply: (id: string) => void;
	onToggleFavorite: (id: string) => void;
	onClose: () => void;
}

interface Shelf { id: string; label: string; items: Wallpaper[]; }

type Zone = 'tabs' | 'shelf';

const HINT = {
	tabs: '◀ ▶ choose a collection · ▼ browse',
	shelf: 'OK previews full screen · Hold OK to favourite · Back returns home',
	preview: 'OK sets as wallpaper · ◀ ▶ next · Back returns to the gallery'
} as const;

/** Wallpaper gallery: collection tabs over a carousel of large cards. OK opens a full-screen
 *  preview (the real wallpaper, behind the hidden gallery), OK again applies it. */
export function Wallpapers ({currentId, favorites, active, onPreview, onApply, onToggleFavorite, onClose}: Props) {
	const shelves: Shelf[] = useMemo(() => {
		const list: Shelf[] = [];
		const favs = WALLPAPERS.filter((w) => favorites.indexOf(w.id) !== -1);
		if (favs.length) list.push({id: 'favorites', label: 'Favourites', items: favs});
		for (const c of CATEGORY_ORDER) list.push({id: c, label: CATEGORY_LABELS[c], items: wallpapersIn(c)});
		return list;
	}, [favorites]);

	const startShelf = Math.max(0, shelves.findIndex((s) => s.items.some((w) => w.id === currentId)));
	const [shelfIndex, setShelfIndex] = useState(startShelf);
	const [itemIndex, setItemIndex] = useState(() => Math.max(0, shelves[startShelf].items.findIndex((w) => w.id === currentId)));
	const [zone, setZone] = useState<Zone>('shelf');
	const [previewing, setPreviewing] = useState(false);

	const shelf = shelves[clamp(shelfIndex, 0, shelves.length - 1)];
	const items = shelf.items;
	const item = items[clamp(itemIndex, 0, items.length - 1)];

	const selectShelf = (i: number) => { setShelfIndex(i); setItemIndex(0); };
	const preview = (on: boolean) => { setPreviewing(on); onPreview(on && item ? item.id : null); };
	const step = (d: number) => {
		setItemIndex((i) => {
			const next = clamp(i + d, 0, items.length - 1);
			if (previewing && items[next]) onPreview(items[next].id);
			return next;
		});
	};

	useOkPress({
		onPress: () => {
			if (zone === 'tabs') { setZone('shelf'); return; }
			if (!item) return;
			if (previewing) { onApply(item.id); preview(false); }
			else preview(true);
		},
		onLongPress: () => { if (zone === 'shelf' && item && !previewing) onToggleFavorite(item.id); }
	}, active);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'enter') return true;
		if (key === 'back') {
			if (previewing) preview(false);
			else onClose();
			return true;
		}
		if (previewing) {
			if (key === 'left') step(-1);
			else if (key === 'right') step(1);
			return true;
		}
		if (zone === 'tabs') {
			if (key === 'left' || key === 'right') {
				setShelfIndex((i) => clamp(i + (key === 'left' ? -1 : 1), 0, shelves.length - 1));
				setItemIndex(0);
			}
			else if (key === 'down') setZone('shelf');
			return true;
		}
		if (key === 'left') step(-1);
		else if (key === 'right') step(1);
		else if (key === 'up') setZone('tabs');
		else if (key === 'down' && shelfIndex < shelves.length - 1) selectShelf(shelfIndex + 1);
		return true;
	}, [zone, shelfIndex, itemIndex, items, previewing, shelves, onClose]);

	useKeys(handleKey, active);

	const cardStep = LAYOUT.wallpaperCardWidth + LAYOUT.tileGap * 1.5;
	const viewport = LAYOUT.screenWidth - 2 * LAYOUT.edgePadding;
	const total = items.length * cardStep;
	const offset = total <= viewport ? 0 : clamp(itemIndex * cardStep - (viewport - cardStep) / 2, 0, total - viewport);

	return (
		<div class={`screen gallery${previewing ? ' gallery--previewing' : ''}`}>
			<div class="gallery__chrome">
				<h1 class="gallery__title">Wallpapers</h1>
				<p class="gallery__hint">{previewing ? HINT.preview : HINT[zone]}</p>
				<div class="gallery__tabs">
					{shelves.map((s, i) => (
						<div
							key={s.id}
							class={['ctab', i === shelfIndex && 'ctab--active', zone === 'tabs' && i === shelfIndex && 'ctab--focused'].filter(Boolean).join(' ')}
							onMouseEnter={() => { setZone('tabs'); selectShelf(i); }}
						>
							{s.label}
						</div>
					))}
				</div>
				<div class="gallery__viewport">
					<div class="gallery__track" style={{transform: `translateX(${-offset}px)`}}>
						{items.map((w, i) => {
							const focused = zone === 'shelf' && i === itemIndex;
							return (
								<div
									key={`${shelf.id}-${w.id}`}
									class={['wcard', focused && 'wcard--focused', zone === 'shelf' && Math.abs(i - itemIndex) === 1 && 'wcard--near'].filter(Boolean).join(' ')}
									onMouseEnter={() => { setZone('shelf'); setItemIndex(i); }}
									onClick={() => { setItemIndex(i); setZone('shelf'); preview(true); }}
								>
									<div class="wcard__frame" style={focused ? {boxShadow: `0 0 0 5px #fff, 0 30px 70px rgba(0,0,0,0.6), 0 0 90px ${rgba(w.accent, 0.33)}`} : undefined}>
										<CardImage id={w.id} />
										<div class="wcard__shine" />
										{w.id === currentId && <div class="wcard__badge">Current</div>}
										{favorites.indexOf(w.id) !== -1 && <div class="wcard__fav">♥</div>}
									</div>
									<div class="wcard__name">{w.name}</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
			{previewing && item && (
				<div class="gallery__preview-caption">
					<div class="gallery__preview-name">{item.name}</div>
					<div class="gallery__preview-hint">{HINT.preview}</div>
				</div>
			)}
		</div>
	);
}

function CardImage ({id}: {id: string}) {
	return <img class="wcard__img" src={useWallpaperImage(id, 720, 405)} alt="" />;
}
