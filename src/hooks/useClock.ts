import {useEffect, useState} from 'preact/hooks';

/** Current time, re-rendered on each minute boundary. Nothing shows seconds, and on slow
 *  TVs a once-a-second re-render of the home screen is measurable. */
export function useClock (): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		let timer = 0;
		const schedule = () => {
			const d = new Date();
			timer = window.setTimeout(() => { setNow(new Date()); schedule(); }, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
		};
		schedule();
		// Catch up straight away when coming back (timers may have been paused).
		const onVisible = () => { if (!document.hidden) setNow(new Date()); };
		document.addEventListener('visibilitychange', onVisible);
		return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
	}, []);
	return now;
}
