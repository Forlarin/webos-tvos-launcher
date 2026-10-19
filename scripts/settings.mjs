// Back up or restore the launcher's profiles and settings, over the TV's web inspector
// (Developer Mode, port 9998). The launcher keeps everything in its local storage, which
// is lost if the app is removed (for example when a Developer Mode session lapses).
//
//   node scripts/settings.mjs backup            -> backups/settings-YYYY-MM-DD-HHMM.json
//   node scripts/settings.mjs restore <file>    -> writes it back and reloads the launcher
//
// The TV address comes from TV_HOST, or the `tv` device set up with ares-setup-device.
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const APP_ID = 'works.partridge.webos-launcher';
const PREFIX = 'launcher-';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tvHost () {
	if (process.env.TV_HOST) return process.env.TV_HOST;
	const out = execSync('npx ares-setup-device --list', {cwd: root, encoding: 'utf8'});
	const m = /^tv\s+\S+@([\d.]+):/m.exec(out);
	if (!m) throw new Error("No 'tv' device: run ares-setup-device, or set TV_HOST");
	return m[1];
}

async function page (host) {
	const fetchList = async () => (await (await fetch(`http://${host}:9998/json`)).json()).find((p) => /webos-launcher/.test(p.url));
	// Never open the launcher ourselves: someone may be watching something.
	const p = await fetchList().catch(() => undefined);
	if (!p) throw new Error(`Open the launcher on the TV first (it isn't on screen), then run this again. App id: ${APP_ID}`);
	return p.webSocketDebuggerUrl;
}

async function evaluate (wsUrl, expression) {
	const ws = new WebSocket(wsUrl);
	await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
	const result = await new Promise((resolve) => {
		ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d.result); };
		ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression, returnByValue: true}}));
	});
	ws.close();
	if (result.exceptionDetails) throw new Error('Evaluation failed on the TV');
	return result.result.value;
}

const [cmd, file] = process.argv.slice(2);
const ws = await page(tvHost());

if (cmd === 'backup') {
	const json = await evaluate(ws, `JSON.stringify(Object.keys(localStorage).filter(function(k){return k.indexOf(${JSON.stringify(PREFIX)})===0}).reduce(function(o,k){o[k]=localStorage.getItem(k);return o},{}))`);
	const data = JSON.parse(json);
	const d = new Date();
	const p2 = (n) => String(n).padStart(2, '0');
	const out = path.join(root, 'backups', `settings-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`);
	fs.mkdirSync(path.dirname(out), {recursive: true});
	fs.writeFileSync(out, JSON.stringify(data, null, 2));
	const profiles = data['launcher-household-v2'] ? JSON.parse(data['launcher-household-v2']).profiles.map((p) => p.name).join(', ') : 'none';
	console.log(`Saved ${Object.keys(data).length} items (profiles: ${profiles}) to ${path.relative(root, out)}`);
} else if (cmd === 'restore' && file) {
	const data = JSON.parse(fs.readFileSync(file, 'utf8'));
	const keys = Object.keys(data).filter((k) => k.startsWith(PREFIX));
	if (!keys.length) throw new Error('No launcher settings in that file');
	await evaluate(ws, `(function(d){Object.keys(d).forEach(function(k){localStorage.setItem(k,d[k])});setTimeout(function(){location.reload()},100);return true})(${JSON.stringify(Object.fromEntries(keys.map((k) => [k, data[k]])))})`);
	console.log(`Restored ${keys.length} items from ${file}; the launcher reloaded.`);
} else {
	console.log('usage: node scripts/settings.mjs backup | restore <file>');
	process.exit(1);
}
