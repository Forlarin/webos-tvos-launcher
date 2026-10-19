import {clamp} from '../hooks/useKeys';

export interface OptionItem {
	id: string;
	label: string;
	description: string;
	/** boolean → switch; string → current choice, OK cycles; null → an action button */
	value: boolean | string | null;
	/** section heading shown above this option */
	section?: string;
}

interface Props {
	options: OptionItem[];
	focused: boolean;
	selected: number;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

const VIEWPORT = 700;
const ROW = 128;

/** Vertical list of options. Scrolls to keep the focused option in view. */
export function OptionList ({options, focused, selected, onSelect, onActivate}: Props) {
	const total = options.length * ROW;
	const offset = total <= VIEWPORT ? 0 : clamp(selected * ROW - (VIEWPORT - ROW) / 2, 0, total - VIEWPORT + 40);
	return (
		<div class="options">
			<div class="options__track" style={{transform: `translateY(${-offset}px)`}}>
				{options.map((o, i) => (
					<div key={o.id}>
						{o.section && <div class="options__section">{o.section}</div>}
						<div
							class={`option${focused && i === selected ? ' option--focused' : ''}`}
							onMouseEnter={() => onSelect(i)}
							onClick={() => onActivate(i)}
						>
							<div class="option__text">
								<div class="option__label">{o.label}</div>
								<div class="option__description">{o.description}</div>
							</div>
							{typeof o.value === 'boolean'
								? <div class={`switch${o.value ? ' switch--on' : ''}`} role="switch" aria-checked={o.value}><div class="switch__knob" /></div>
								: typeof o.value === 'string'
									? <div class="option__choice">{o.value}</div>
									: <div class="option__go">›</div>}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
