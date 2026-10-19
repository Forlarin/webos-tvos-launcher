// Profile pictures: real NASA photographs of planets, moons, the Sun and deep space
// (public domain; IDs in public/wallpapers/CREDITS.txt), cropped round.

export interface AvatarChoice {
	name: string;
	file: string;
}

export const AVATARS: AvatarChoice[] = [
	{name: 'Earth', file: 'earth.jpg'},
	{name: 'Moon', file: 'moon.jpg'},
	{name: 'Mars', file: 'mars.jpg'},
	{name: 'Jupiter', file: 'jupiter.jpg'},
	{name: 'Saturn', file: 'saturn.jpg'},
	{name: 'Neptune', file: 'neptune.jpg'},
	{name: 'Uranus', file: 'uranus.jpg'},
	{name: 'Mercury', file: 'mercury.jpg'},
	{name: 'Pluto', file: 'pluto.jpg'},
	{name: 'The Sun', file: 'sun.jpg'},
	{name: 'Io', file: 'io.jpg'},
	{name: 'Titan', file: 'titan.jpg'},
	{name: 'Callisto', file: 'callisto.jpg'},
	{name: 'Cosmic Cliffs', file: 'carina.jpg'},
	{name: 'Helix Nebula', file: 'helix.jpg'},
	{name: 'Galaxy', file: 'galaxy.jpg'},
	{name: 'Aurora', file: 'aurora.jpg'}
];

export function avatarAt (index: number): AvatarChoice {
	return AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length];
}

export function Avatar ({index, size, name}: {index: number; size: number; name?: string}) {
	const a = avatarAt(index);
	return (
		<div class="avatar" style={{width: `${size}px`, height: `${size}px`}} aria-label={name || a.name}>
			<img class="avatar__img" src={`avatars/${a.file}`} alt="" />
		</div>
	);
}
