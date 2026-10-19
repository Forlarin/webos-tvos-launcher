import {useEffect, useState} from 'preact/hooks';
import {wallpaperBitmap, wallpaperUrl} from '../lib/wallpapers';
import {LITE} from '../lib/perf';

/** Image URL for a wallpaper: the SVG on capable TVs; on lite TVs a JPEG rendered once
 *  (the SVG shows for the moment it takes to render). */
export function useWallpaperImage (id: string, width = 1920, height = 1080): string {
	const [url, setUrl] = useState(() => wallpaperUrl(id));
	useEffect(() => {
		setUrl(wallpaperUrl(id));
		if (!LITE) return;
		let live = true;
		wallpaperBitmap(id, width, height).then((u) => { if (live) setUrl(u); });
		return () => { live = false; };
	}, [id, width, height]);
	return url;
}
