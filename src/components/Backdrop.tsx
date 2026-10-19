import {useEffect, useRef, useState} from 'preact/hooks';
import {findWallpaper} from '../lib/wallpapers';
import {useWallpaperImage} from '../hooks/useWallpaperImage';
import {LITE} from '../lib/perf';
import {TIMING} from '../config/constants';

interface Props {
	wallpaperId: string;
	/** 0–70 % darkening */
	dim: number;
	motion: boolean;
	/** extra blur behind sub-screens (settings, galleries) */
	blurred?: boolean;
	light?: boolean;
}

interface Layer { id: string; key: number; }

/** Full-screen wallpaper. A change cross-fades the new scene over the old one; with motion
 *  on, the picture drifts very slowly (a GPU transform, so it costs no layout). */
export function Backdrop ({wallpaperId, dim, motion, blurred, light}: Props) {
	const [layers, setLayers] = useState<Layer[]>([{id: wallpaperId, key: 0}]);
	const counter = useRef(0);

	useEffect(() => {
		const top = layers[layers.length - 1];
		if (top && top.id === wallpaperId) return;
		counter.current += 1;
		const next = {id: wallpaperId, key: counter.current};
		setLayers((l) => l.slice(-1).concat(next));
		const t = window.setTimeout(() => setLayers([next]), TIMING.wallpaperFadeMs + 50);
		return () => window.clearTimeout(t);
	}, [wallpaperId]);

	const wp = findWallpaper(wallpaperId);
	const motionClass = motion && !LITE ? (wp.motion === 'twinkle' ? ' backdrop__img--twinkle' : ' backdrop__img--drift') : '';

	return (
		<div class={`backdrop${blurred ? ' backdrop--blurred' : ''}`}>
			{layers.map((l, i) => (
				<div key={l.key} class={`backdrop__layer${i > 0 ? ' backdrop__layer--entering' : ''}`}>
					<BackdropImage id={l.id} className={`backdrop__img${motionClass}`} />
				</div>
			))}
			<div class="backdrop__dim" style={{opacity: light ? dim / 200 : dim / 100}} />
			<div class="backdrop__scrim" />
		</div>
	);
}

function BackdropImage ({id, className}: {id: string; className: string}) {
	return <img class={className} src={useWallpaperImage(id)} alt="" />;
}
