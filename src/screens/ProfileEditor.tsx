import {useEffect, useRef, useState} from 'preact/hooks';
import {Avatar, AVATARS} from '../components/Avatar';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useKeyboardClose} from '../hooks/useKeyboardClose';
import {KEY} from '../config/constants';
import type {Profile} from '../lib/storage';

interface Props {
	profile: Profile;
	active: boolean;
	onSave: (patch: {name: string; avatar: number}) => void;
	onClose: () => void;
}

type Zone = 'name' | 'grid' | 'done';

const COLS = 9;

/** Edit a profile from "Who's Watching?": its name (TV keyboard) and its picture, chosen
 *  from real NASA photos of planets, moons and deep space. Done saves; Back discards. */
export function ProfileEditor ({profile, active, onSave, onClose}: Props) {
	const [name, setName] = useState(profile.name);
	const [avatar, setAvatar] = useState(clamp(profile.avatar, 0, AVATARS.length - 1));
	const [zone, setZone] = useState<Zone>('grid');
	const [editing, setEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const count = AVATARS.length;
	const rows = Math.ceil(count / COLS);

	useEffect(() => {
		if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
	}, [editing]);

	const finishName = () => {
		const v = inputRef.current ? inputRef.current.value.trim().slice(0, 20) : '';
		if (v) setName(v);
		setEditing(false);
	};

	useKeyboardClose(finishName, editing);

	useKeys((key: NavKey) => {
		if (key === 'back') { onClose(); return true; }
		if (zone === 'name') {
			if (key === 'enter') setEditing(true);
			else if (key === 'down') setZone('grid');
			return true;
		}
		if (zone === 'done') {
			if (key === 'enter') onSave({name, avatar});
			else if (key === 'up') setZone('grid');
			return true;
		}
		const row = Math.floor(avatar / COLS);
		switch (key) {
			case 'left': setAvatar((i) => clamp(i - 1, 0, count - 1)); break;
			case 'right': setAvatar((i) => clamp(i + 1, 0, count - 1)); break;
			case 'up': if (row === 0) setZone('name'); else setAvatar((i) => i - COLS); break;
			case 'down': if (row === rows - 1 || avatar + COLS >= count) setZone('done'); else setAvatar((i) => i + COLS); break;
			case 'enter': setZone('done'); break;
		}
		return true;
	}, active && !editing);

	return (
		<div class="overlay">
			<div class="editor">
				<div class="editor__head">
					<Avatar index={avatar} size={140} />
					<div class="editor__meta">
						<div class="editor__title">Edit Profile</div>
						<div
							class={`editor__name${zone === 'name' ? ' editor__name--focused' : ''}`}
							onMouseEnter={() => setZone('name')}
							onClick={() => setEditing(true)}
						>
							{editing
								? <input
									ref={inputRef}
									class="editor__input"
									defaultValue={name}
									maxLength={20}
									onKeyDown={(e) => {
										if (e.keyCode === KEY.enter) { e.preventDefault(); finishName(); }
										else if (e.keyCode === KEY.down) { e.preventDefault(); finishName(); setZone('grid'); }
										else if (e.keyCode === KEY.up) { e.preventDefault(); finishName(); }
										else if (e.keyCode === KEY.back || e.keyCode === KEY.escape) { e.preventDefault(); setEditing(false); }
									}}
									onBlur={finishName}
								/>
								: <><span>{name}</span><span class="editor__edit">✎ Rename</span></>}
						</div>
					</div>
				</div>
				<div class="editor__label">Choose a picture · {AVATARS[avatar].name}</div>
				<div class="editor__grid">
					{AVATARS.map((a, i) => (
						<div
							key={a.file}
							class={['editor__pick', i === avatar && 'editor__pick--chosen', zone === 'grid' && i === avatar && 'editor__pick--focused'].filter(Boolean).join(' ')}
							onMouseEnter={() => { setZone('grid'); setAvatar(i); }}
							onClick={() => setAvatar(i)}
						>
							<Avatar index={i} size={104} />
						</div>
					))}
				</div>
				<div class="editor__actions">
					<div class={`editor__done${zone === 'done' ? ' editor__done--focused' : ''}`} onMouseEnter={() => setZone('done')} onClick={() => onSave({name, avatar})}>Done</div>
					<div class="editor__hint">{editing ? 'Type a name, then press OK' : 'Arrows choose · OK on the name renames · Back cancels'}</div>
				</div>
			</div>
		</div>
	);
}
