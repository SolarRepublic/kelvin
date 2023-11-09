import type {KelvinKeyValueStore} from './store';
import type {ItemCode, SerShape} from './types';
import type {VaultClient} from './vault-client';
import type {VaultHub} from './vault-hub';
import type {JsonArray, JsonObject} from '@blake.regalia/belt';

export class Reader {
	protected _k_vault: VaultClient;
	protected _k_content: KelvinKeyValueStore;

	constructor(protected _k_hub: VaultHub) {
		const k_vault = this._k_vault = _k_hub.vault;

		this._k_content = k_vault.contentStore;
	}

	async getItemContent(i_code: ItemCode): Promise<[SerShape, JsonArray]> {
		// locate which bucket the item is stored in
		const si_bucket = this._k_hub.getItemBucket(i_code);

		// load the bucket
		const g_bucket = await this._k_vault.readBucket(si_bucket);

		// return as tuple
		return [g_bucket.shape, g_bucket.items[i_code]];
	}
}
