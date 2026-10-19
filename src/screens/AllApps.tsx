import {useState} from 'preact/hooks';
import {Grid} from '../components/Grid';
import type {TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {LAYOUT} from '../theme/tokens';

interface Props {
	items: TileModel[];
	active: boolean;
	onOpen: (item: TileModel) => void;
	onClose: () => void;
}

/** Every installed app the launcher can see, in a grid. OK opens; Back returns home.
 *  Choosing which ones sit in the dock lives in Settings → Favourites. */
export function AllApps ({items, active, onOpen, onClose}: Props) {
	const [index, setIndex] = useState(0);
	const cols = LAYOUT.gridColumns;
	const count = items.length;

	useKeys((key: NavKey) => {
		switch (key) {
			case 'left': setIndex((i) => clamp(i - 1, 0, count - 1)); break;
			case 'right': setIndex((i) => clamp(i + 1, 0, count - 1)); break;
			case 'up': setIndex((i) => (i >= cols ? i - cols : i)); break;
			case 'down': setIndex((i) => (i + cols < count ? i + cols : i)); break;
			case 'enter': if (items[index]) onOpen(items[index]); break;
			case 'back': onClose(); break;
		}
		return true;
	}, active);

	return (
		<div class="screen">
			<div class="settings">
				<h1 class="settings__title">All Apps</h1>
				<p class="settings__hint">OK opens an app · Choose your dock in Settings → Favourites · Back returns home</p>
				<div class="allapps">
					{count === 0
						? <p class="settings__hint">No apps found yet.</p>
						: <Grid
							items={items}
							mode="reorder"
							checkedKeys={[]}
							liftedIndex={-1}
							focused
							selected={clamp(index, 0, count - 1)}
							onSelect={setIndex}
							onActivate={(i) => { if (items[i]) onOpen(items[i]); }}
						/>}
				</div>
			</div>
		</div>
	);
}
