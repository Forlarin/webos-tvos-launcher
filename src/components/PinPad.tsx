import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';

interface Props {
	title: string;
	subtitle?: string;
	active: boolean;
	/** returns false to reject (wrong PIN): the dots shake and clear */
	onDone: (pin: string) => boolean;
	onCancel: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const LENGTH = 4;

/** Four-digit PIN entry. Number keys on the remote work directly; otherwise ◀ ▶ pick a
 *  digit and OK enters it. */
export function PinPad ({title, subtitle, active, onDone, onCancel}: Props) {
	const [pin, setPin] = useState('');
	const [index, setIndex] = useState(0);
	const [shake, setShake] = useState(false);

	const push = (d: string) => {
		const next = (pin + d).slice(0, LENGTH);
		setPin(next);
		if (next.length === LENGTH) {
			window.setTimeout(() => {
				if (!onDone(next)) {
					setShake(true);
					window.setTimeout(() => { setShake(false); setPin(''); }, 450);
				}
			}, 120);
		}
	};

	// Number keys 0–9 (remote, main row and keypad). One subscription that always calls
	// the latest `push`, so quick presses never land on a stale PIN.
	const latestPush = useRef(push);
	const isActive = useRef(active);
	latestPush.current = push;
	isActive.current = active;
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!isActive.current) return;
			const c = e.keyCode;
			const digit = c >= 48 && c <= 57 ? c - 48 : c >= 96 && c <= 105 ? c - 96 : /^[0-9]$/.test(e.key) ? Number(e.key) : -1;
			if (digit < 0) return;
			e.preventDefault();
			latestPush.current(String(digit));
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'left') setIndex((i) => clamp(i - 1, 0, DIGITS.length - 1));
		else if (key === 'right') setIndex((i) => clamp(i + 1, 0, DIGITS.length - 1));
		else if (key === 'enter') push(DIGITS[index]);
		else if (key === 'back') { if (pin) setPin(pin.slice(0, -1)); else onCancel(); }
		return true;
	}, [index, pin, onCancel]);

	useKeys(handleKey, active);

	return (
		<div class="overlay">
			<div class="pin">
				<div class="pin__title">{title}</div>
				{subtitle && <div class="pin__subtitle">{subtitle}</div>}
				<div class={`pin__dots${shake ? ' pin__dots--shake' : ''}`}>
					{[0, 1, 2, 3].map((i) => <div key={i} class={`pin__dot${i < pin.length ? ' pin__dot--on' : ''}`} />)}
				</div>
				<div class="pin__digits">
					{DIGITS.map((d, i) => (
						<div key={d} class={`pin__digit${i === index ? ' pin__digit--focused' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => push(d)}>{d}</div>
					))}
				</div>
				<div class="pin__hint">Number keys or ◀ ▶ and OK · Back deletes or cancels</div>
			</div>
		</div>
	);
}
