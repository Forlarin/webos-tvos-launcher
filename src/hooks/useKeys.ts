import {useEffect, useRef} from 'preact/hooks';
import {KEY} from '../config/constants';

export type NavKey = 'left' | 'right' | 'up' | 'down' | 'enter' | 'back';

const CODE_TO_KEY: Record<number, NavKey> = {
	[KEY.left]: 'left', [KEY.right]: 'right', [KEY.up]: 'up', [KEY.down]: 'down',
	[KEY.enter]: 'enter', [KEY.back]: 'back', [KEY.escape]: 'back'
};

/** Subscribes to remote-control keys while `active`. The handler returns true when it
 *  consumed the key (stops the TV's default handling, e.g. Back closing the app).
 *
 *  The latest handler is kept in a ref that is updated during render. Effects run after
 *  paint, so re-subscribing on every render (or whenever `active` changes) would let a
 *  quick second key press, or a held key's auto-repeat, reach a stale handler or none. */
export function useKeys (handler: (key: NavKey, event: KeyboardEvent) => boolean | void, active = true): void {
	const latest = useRef(handler);
	const isActive = useRef(active);
	latest.current = handler;
	isActive.current = active;
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!isActive.current) return;
			const key = CODE_TO_KEY[e.keyCode];
			if (!key) return;
			if (latest.current(key, e) !== false) e.preventDefault();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);
}

/** Clamp helper shared by the navigation code. */
export function clamp (n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}
