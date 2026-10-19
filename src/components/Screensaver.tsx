import {useEffect, useState} from 'preact/hooks';
import {useClock} from '../hooks/useClock';
import {useTimeFormat} from '../hooks/useTimeFormat';
import {dateText, dayName, timeParts} from '../lib/clock';
import {useWallpaperImage} from '../hooks/useWallpaperImage';
import {LITE} from '../lib/perf';

interface Props {
	/** wallpapers to slide through; the first is shown first */
	wallpaperIds: string[];
	motion: boolean;
	onWake: () => void;
}

const SLIDE_MS = 90 * 1000;
const MOVE_MS = 60 * 1000;

/** Full-screen wallpaper slideshow with a large clock. The clock moves to a new spot every
 *  minute and the whole picture is dimmed, so nothing stays lit in one place on OLED. Any
 *  key wakes it (and the key is swallowed, so it doesn't also act on the home screen). */
export function Screensaver ({wallpaperIds, motion, onWake}: Props) {
	const now = useClock();
	const format = useTimeFormat();
	const [slide, setSlide] = useState(0);
	const [pos, setPos] = useState({x: 8, y: 62});

	useEffect(() => {
		const s = window.setInterval(() => setSlide((i) => i + 1), SLIDE_MS);
		const m = window.setInterval(() => setPos({x: 6 + Math.random() * 52, y: 12 + Math.random() * 60}), MOVE_MS);
		return () => { window.clearInterval(s); window.clearInterval(m); };
	}, []);

	useEffect(() => {
		const wake = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); onWake(); };
		// Capture phase, so no other handler sees the waking key.
		window.addEventListener('keydown', wake, true);
		window.addEventListener('keyup', wake, true);
		window.addEventListener('click', wake, true);
		return () => {
			window.removeEventListener('keydown', wake, true);
			window.removeEventListener('keyup', wake, true);
			window.removeEventListener('click', wake, true);
		};
	}, [onWake]);

	const ids = wallpaperIds.length ? wallpaperIds : ['min-black'];
	const id = ids[slide % ids.length];
	const {time, period} = timeParts(now, format);
	const image = useWallpaperImage(id);

	return (
		<div class="saver">
			<img key={id} class={`saver__img${motion && !LITE ? ' saver__img--drift' : ''}`} src={image} alt="" />
			<div class="saver__dim" />
			<div class="saver__clock" style={{left: `${pos.x}%`, top: `${pos.y}%`}}>
				<div class="saver__time">{time}{period && <span class="saver__period">{period}</span>}</div>
				<div class="saver__date">{dayName(now)}, {dateText(now)}</div>
			</div>
		</div>
	);
}
