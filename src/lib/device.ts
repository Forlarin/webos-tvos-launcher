// Model and firmware, for Settings → About. Best effort: the call is in the public group
// on the TVs we know of, but nothing depends on it.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall, type LunaResponse} from './luna';

export interface DeviceInfo {
	model: string;
	firmware: string;
	sdk: string;
}

interface SystemInfoResponse extends LunaResponse {
	modelName?: string;
	firmwareVersion?: string;
	sdkVersion?: string;
}

export function getDeviceInfo (): Promise<DeviceInfo | null> {
	if (!isWebOS()) return Promise.resolve({model: 'Desktop preview', firmware: '-', sdk: '-'});
	return lunaCall<SystemInfoResponse>(LUNA.systemInfo, {keys: ['modelName', 'firmwareVersion', 'sdkVersion']})
		.then((r) => ({model: r.modelName || 'LG TV', firmware: r.firmwareVersion || '?', sdk: r.sdkVersion || '?'}))
		.catch(() => null);
}
