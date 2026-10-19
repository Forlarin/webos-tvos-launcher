// The TV's network, for the Wi-Fi pill on the home screen. connectionmanager/getStatus is
// callable from a sideloaded web app (checked on webOS 4.5).

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall, type LunaResponse} from './luna';

export interface NetworkState {
	kind: 'wifi' | 'wired' | 'offline';
	/** Wi-Fi network name, "Ethernet", or "Not connected" */
	label: string;
}

interface StatusResponse extends LunaResponse {
	wired?: {state?: string};
	wifi?: {state?: string; ssid?: string; displayName?: string};
}

export function getNetwork (): Promise<NetworkState> {
	if (!isWebOS()) return Promise.resolve({kind: 'wifi', label: 'Home Wi-Fi'});
	return lunaCall<StatusResponse>(LUNA.networkStatus, {})
		.then((r): NetworkState => {
			if (r.wired && r.wired.state === 'connected') return {kind: 'wired', label: 'Ethernet'};
			if (r.wifi && r.wifi.state === 'connected') return {kind: 'wifi', label: r.wifi.displayName || r.wifi.ssid || 'Wi-Fi'};
			return {kind: 'offline', label: 'Not connected'};
		})
		.catch((): NetworkState => ({kind: 'offline', label: 'Network'}));
}
