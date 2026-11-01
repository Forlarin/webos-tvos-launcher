import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Avatar, AVATARS} from '../components/Avatar';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useKeyboardClose} from '../hooks/useKeyboardClose';
import {KEY} from '../config/constants';
import {ACCENTS, makeProfile, updateProfile, type Household, type Profile} from '../lib/storage';

interface Props {
	household: Household;
	/** profile to open on; a freshly added profile starts with its name being edited */
	initialId?: string;
	editNameFirst?: boolean;
	active: boolean;
	onChange: (h: Household) => void;
	onClose: () => void;
}

type FieldId = 'name' | 'avatar' | 'accent' | 'kids' | 'default' | 'delete';

interface Field { id: FieldId; label: string; }

const FIELDS: Field[] = [
	{id: 'name', label: 'Name'},
	{id: 'avatar', label: 'Avatar'},
	{id: 'accent', label: 'Accent colour'},
	{id: 'kids', label: 'Kids profile'},
	{id: 'default', label: 'Default profile'},
	{id: 'delete', label: 'Delete profile'}
];

const MAX_PROFILES = 8;
const ADD_KEY = '__add__';

/** Profile management: a row of profiles (plus Add), and the selected profile's settings.
 *  ◀ ▶ on Avatar and Accent cycle the choices in place; OK on Name opens the TV keyboard. */
export function Profiles ({household, initialId, editNameFirst, active, onChange, onClose}: Props) {
	const profiles = household.profiles;
	const keys = profiles.map((p) => p.id).concat(profiles.length < MAX_PROFILES ? [ADD_KEY] : []);
	const [index, setIndex] = useState(() => Math.max(0, keys.indexOf(initialId || household.activeId)));
	const [zone, setZone] = useState<'profiles' | 'fields'>(editNameFirst ? 'fields' : 'profiles');
	const [fieldIndex, setFieldIndex] = useState(0);
	const [editing, setEditing] = useState(!!editNameFirst);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const selected: Profile | undefined = profiles[clamp(index, 0, profiles.length - 1)];
	const onAdd = keys[index] === ADD_KEY;

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	useEffect(() => { setConfirmDelete(false); }, [index, fieldIndex, zone]);

	const patch = (p: Partial<Profile>) => { if (selected) onChange(updateProfile(household, selected.id, p)); };

	const addProfile = () => {
		const p = makeProfile(`Profile ${profiles.length + 1}`, profiles.length);
		onChange({...household, profiles: profiles.concat(p)});
		setIndex(profiles.length);
		setZone('fields');
		setFieldIndex(0);
		setEditing(true);
	};

	const cycle = (field: FieldId, d: number) => {
		if (!selected) return;
		if (field === 'avatar') patch({avatar: (selected.avatar + d + AVATARS.length) % AVATARS.length});
		if (field === 'accent') {
			const i = ACCENTS.indexOf(selected.accent);
			patch({accent: ACCENTS[(i + d + ACCENTS.length) % ACCENTS.length]});
		}
	};

	const activateField = (field: FieldId) => {
		if (!selected) return;
		switch (field) {
			case 'name': setEditing(true); break;
			case 'avatar': case 'accent': cycle(field, 1); break;
			case 'kids': patch({kids: !selected.kids}); break;
			case 'default': onChange({...household, defaultId: selected.id}); break;
			case 'delete': {
				if (profiles.length <= 1) return;
				if (!confirmDelete) { setConfirmDelete(true); return; }
				const rest = profiles.filter((p) => p.id !== selected.id);
				onChange({
					...household,
					profiles: rest,
					activeId: household.activeId === selected.id ? rest[0].id : household.activeId,
					defaultId: household.defaultId === selected.id ? rest[0].id : household.defaultId
				});
				setIndex(0);
				setZone('profiles');
				break;
			}
		}
	};

	const commitName = () => {
		const value = inputRef.current ? inputRef.current.value.trim().slice(0, 20) : '';
		if (value) patch({name: value});
		setEditing(false);
	};

	useKeyboardClose(commitName, editing);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') {
			if (zone === 'fields') setZone('profiles');
			else onClose();
			return true;
		}
		if (zone === 'profiles') {
			if (key === 'left') setIndex((i) => clamp(i - 1, 0, keys.length - 1));
			else if (key === 'right') setIndex((i) => clamp(i + 1, 0, keys.length - 1));
			else if (key === 'enter') { if (onAdd) addProfile(); else setZone('fields'); }
			else if (key === 'down' && !onAdd) setZone('fields');
			return true;
		}
		const field = FIELDS[fieldIndex].id;
		if (key === 'up') { if (fieldIndex === 0) setZone('profiles'); else setFieldIndex(fieldIndex - 1); }
		else if (key === 'down') setFieldIndex(clamp(fieldIndex + 1, 0, FIELDS.length - 1));
		else if (key === 'left') cycle(field, -1);
		else if (key === 'right') cycle(field, 1);
		else if (key === 'enter') activateField(field);
		return true;
	}, [zone, index, keys, onAdd, fieldIndex, selected, household, confirmDelete]);

	useKeys(handleKey, active && !editing);

	const valueOf = (field: FieldId) => {
		if (!selected) return null;
		switch (field) {
			case 'name': return editing
				? <input
					ref={inputRef}
					class="field__input"
					defaultValue={selected.name}
					maxLength={20}
					onKeyDown={(e) => {
						if (e.keyCode === KEY.enter || e.keyCode === KEY.up || e.keyCode === KEY.down) { e.preventDefault(); commitName(); }
						else if (e.keyCode === KEY.back || e.keyCode === KEY.escape) { e.preventDefault(); setEditing(false); }
					}}
					onBlur={commitName}
				/>
				: <span>{selected.name}</span>;
			case 'avatar': return <span class="field__cycle">◀ <Avatar index={selected.avatar} size={48} /> ▶</span>;
			case 'accent': return <span class="field__cycle">◀ <span class="swatch" style={{background: selected.accent}} /> ▶</span>;
			case 'kids': return <div class={`switch${selected.kids ? ' switch--on' : ''}`}><div class="switch__knob" /></div>;
			case 'default': return <span>{household.defaultId === selected.id ? 'Yes' : 'Set as default'}</span>;
			case 'delete': return <span class="field__danger">{profiles.length <= 1 ? 'Keep at least one profile' : confirmDelete ? 'Press OK again to delete' : ''}</span>;
		}
	};

	return (
		<div class="screen panel-screen">
			<div class="panel">
				<h1 class="panel__title">Profiles</h1>
				<p class="panel__hint">
					{zone === 'profiles'
						? 'Choose a profile to edit, or add one · Back returns home'
						: editing ? 'Type a name, then press OK' : '◀ ▶ change · OK selects · Back returns to profiles'}
				</p>
				<div class="prow">
					{keys.map((key, i) => {
						const p = profiles[i];
						const focused = zone === 'profiles' && i === index;
						return (
							<div
								key={key}
								class={['prow__item', focused && 'prow__item--focused', i === index && 'prow__item--selected'].filter(Boolean).join(' ')}
								onMouseEnter={() => { setZone('profiles'); setIndex(i); }}
								onClick={() => { if (key === ADD_KEY) addProfile(); else setZone('fields'); }}
							>
								{p ? <Avatar index={p.avatar} size={112} /> : <div class="pcard__add pcard__add--small"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></div>}
								<div class="prow__name">{p ? p.name : 'Add Profile'}</div>
							</div>
						);
					})}
				</div>
				{selected && !onAdd && (
					<div class="fields">
						{FIELDS.map((f, i) => (
							<div
								key={f.id}
								class={['field', zone === 'fields' && i === fieldIndex && 'field--focused', f.id === 'delete' && 'field--delete'].filter(Boolean).join(' ')}
								onMouseEnter={() => { setZone('fields'); setFieldIndex(i); }}
								onClick={() => activateField(f.id)}
							>
								<div class="field__label">{f.label}</div>
								<div class="field__value">{valueOf(f.id)}</div>
							</div>
						))}
						{selected.kids && (
							<p class="fields__note">
								Kids profiles show only the apps chosen for them and need the household PIN to leave.
								This is a launcher setting, not device-wide parental control: for that, use LG’s
								Settings → General → Safety.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
