import {useEffect, useRef} from 'preact/hooks';

/** Calls `onClose` when the webOS on-screen keyboard is dismissed while `active`.
 *
 *  Hiding the keyboard leaves the text field focused, and arrows then only move the caret,
 *  so a screen that waits for OK or Back to leave the field gets stuck. webOS reports the
 *  keyboard on `document` as a `keyboardStateChange` event; desktop browsers never fire it. */
export function useKeyboardClose (onClose: () => void, active: boolean): void {
	const latest = useRef(onClose);
	latest.current = onClose;
	useEffect(() => {
		if (!active) return;
		const onChange = (e: Event) => {
			const detail = (e as CustomEvent<{visibility?: boolean}>).detail;
			if (detail && detail.visibility === false) latest.current();
		};
		document.addEventListener('keyboardStateChange', onChange);
		return () => document.removeEventListener('keyboardStateChange', onChange);
	}, [active]);
}
