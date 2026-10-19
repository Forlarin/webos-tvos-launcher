import {useCallback, useState} from 'preact/hooks';
import {Avatar} from '../components/Avatar';
import {glow} from './Home';
import {ProfileEditor} from './ProfileEditor';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import type {Profile} from '../lib/storage';

interface Props {
	profiles: Profile[];
	initialId: string;
	active: boolean;
	onPick: (id: string) => void;
	onAdd: () => void;
	onEdit: (id: string, patch: {name: string; avatar: number}) => void;
	/** Back from the picker: return to whoever was watching (absent on first launch) */
	onCancel?: () => void;
}

const ADD_KEY = '__add__';

/** "Who's Watching?": large avatar cards in a centred row, plus Add Profile.
 *  The focused card lifts and glows in the profile's accent; its neighbours lift a
 *  little, like a magnifying dock. OK watches. An Edit button sits under the focused
 *  profile (Down to reach it; holding OK on the card opens it too) and opens the editor
 *  for the name and the space picture. */
export function WhosWatching ({profiles, initialId, active, onPick, onAdd, onEdit, onCancel}: Props) {
	const keys = profiles.map((p) => p.id).concat(ADD_KEY);
	const [index, setIndex] = useState(() => Math.max(0, keys.indexOf(initialId)));
	const [onEditButton, setOnEditButton] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const count = keys.length;
	const focusedProfile = profiles[index];
	const editingProfile = editingId ? profiles.find((p) => p.id === editingId) : undefined;
	const listening = active && !editingProfile;

	const activate = (i: number) => {
		if (keys[i] === ADD_KEY) onAdd();
		else onPick(keys[i]);
	};

	useOkPress({
		onPress: () => {
			if (onEditButton) { if (focusedProfile) setEditingId(focusedProfile.id); }
			else activate(index);
		},
		onLongPress: () => { if (focusedProfile) setEditingId(focusedProfile.id); }
	}, listening);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'enter') return true;   // press vs hold handled by useOkPress
		if (key === 'left' || key === 'right') {
			setIndex((i) => clamp(i + (key === 'left' ? -1 : 1), 0, count - 1));
			setOnEditButton(false);
		} else if (key === 'down') {
			if (focusedProfile) setOnEditButton(true);
		} else if (key === 'up') {
			setOnEditButton(false);
		} else if (key === 'back') {
			if (onEditButton) setOnEditButton(false);
			else if (onCancel) onCancel();
		}
		return true;
	}, [count, onCancel, focusedProfile, onEditButton]);

	useKeys(handleKey, listening);

	return (
		<div class="screen picker">
			<div class="picker__glow" style={{background: glow(focusedProfile ? focusedProfile.accent : '#ffffff'), opacity: focusedProfile ? 0.35 : 0.12}} />
			<h1 class="picker__title">Who’s Watching?</h1>
			<p class="picker__hint">OK to watch · ▼ Edit to change a name or picture</p>
			<div class="picker__row">
				{keys.map((key, i) => {
					const p = profiles[i];
					const distance = Math.abs(i - index);
					const cardFocused = distance === 0 && !onEditButton;
					const cls = ['pcard', distance === 0 && 'pcard--focused', distance === 1 && 'pcard--near'].filter(Boolean).join(' ');
					return (
						<div key={key} class={cls} onMouseEnter={() => { setIndex(i); setOnEditButton(false); }} onClick={() => activate(i)}>
							<div class="pcard__ring" style={p ? {boxShadow: cardFocused ? `0 0 0 6px #fff, 0 24px 80px ${p.accent}` : undefined} : undefined}>
								{p
									? <Avatar index={p.avatar} size={200} name={p.name} />
									: <div class="pcard__add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></div>}
							</div>
							<div class="pcard__name">{p ? p.name : 'Add Profile'}</div>
							{p && p.kids && <div class="pcard__tag">Kids</div>}
							{p && (
								<div
									class={`pcard__edit${distance === 0 ? ' pcard__edit--shown' : ''}${distance === 0 && onEditButton ? ' pcard__edit--focused' : ''}`}
									onMouseEnter={() => { setIndex(i); setOnEditButton(true); }}
									onClick={(e) => { e.stopPropagation(); setEditingId(p.id); }}
								>
									✎ Edit
								</div>
							)}
						</div>
					);
				})}
			</div>
			{editingProfile && (
				<ProfileEditor
					profile={editingProfile}
					active={active}
					onSave={(patch) => { onEdit(editingProfile.id, patch); setEditingId(null); setOnEditButton(false); }}
					onClose={() => setEditingId(null)}
				/>
			)}
		</div>
	);
}
