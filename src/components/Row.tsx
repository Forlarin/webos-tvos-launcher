import {LAYOUT} from '../theme/tokens';
import {clamp} from '../hooks/useKeys';
import {Tile, type TileModel} from './Tile';

interface Props {
	label: string;
	items: TileModel[];
	focused: boolean;
	selected: number;
	emptyText?: string;
	/** dock-sized tiles */
	large?: boolean;
	/** 16:9 cards */
	wide?: boolean;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

const VIEWPORT_WIDTH = LAYOUT.screenWidth - 2 * LAYOUT.edgePadding;

/** Horizontal strip of tiles. Centred when it fits; otherwise a carousel that keeps
 *  the selected tile in the middle (clamped at the ends). In a focused row the
 *  selected tile's neighbours lift slightly too, like a magnifying dock. */
export function Row ({label, items, focused, selected, emptyText, large, wide, onSelect, onActivate}: Props) {
	const size = large ? LAYOUT.dockTileSize : wide ? LAYOUT.wideTileWidth : LAYOUT.tileSize;
	const step = size + LAYOUT.tileGap;
	const total = items.length * step - LAYOUT.tileGap;
	const fits = total <= VIEWPORT_WIDTH;
	const offset = fits ? 0 : clamp(selected * step + size / 2 - VIEWPORT_WIDTH / 2, 0, total - VIEWPORT_WIDTH);

	return (
		<section class={`row${focused ? ' row--focused' : ''}${large ? ' row--large' : ''}${wide ? ' row--wide' : ''}`}>
			<h2 class="row__label">{label}</h2>
			<div class="row__viewport">
				{items.length === 0
					? <div class="row__empty">{emptyText || 'Nothing here yet'}</div>
					: <div class={`row__track${fits ? ' row__track--centered' : ''}`} style={{transform: `translateX(${-offset}px)`}}>
						{items.map((item, i) => (
							<Tile
								key={item.key}
								model={item}
								focused={focused && i === selected}
								near={focused && Math.abs(i - selected) === 1}
								onHover={() => onSelect(i)}
								onActivate={() => onActivate(i)}
							/>
						))}
					</div>}
			</div>
		</section>
	);
}
