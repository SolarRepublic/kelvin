import type {DomainCode, DomainLabel} from './types';

import {index_to_b92} from './data';
import {LockTarget_StorageLocal, SI_KEY_STORAGE_HUB} from './ids';
import {VaultHub} from './vault-hub';


export class WritableHub extends VaultHub {
	protected async _save_hub() {
		// isolate
		const g_hub = this._isolate();

		// serialize to JSON
		const sx_hub = JSON.stringify(g_hub);

		// overwrite in store
		await this._encrypt_and_write(i_lock, SI_KEY_STORAGE_HUB, sx_hub);
	}

	/**
	 * Adds the given name to the domain sequence if it does not yet exist.
	 * @param si_domain - the domain name
	 * @returns the domain key
	 */
	addDomain(si_domain: DomainLabel): Promise<DomainCode> {
		// acquire write lock
		return this._k_vault.acquireStorageLocal([LockTarget_StorageLocal.HUB], async(i_lock) => {
			// check if domain already exists
			const sb92_domain_existing = this.encodeDomain(si_domain);

			// domain exists; done
			if(sb92_domain_existing) return sb92_domain_existing;

			// append to domain sequence
			const i_domain = this._a_domains.push(si_domain) - 1;

			// update lookup cache and capture new domain code
			const sb92_domain = this._h_domains[si_domain] = index_to_b92(i_domain) as DomainCode;

			// 
			await this._save_hub(i_lock);

			// return new domain code
			return sb92_domain;
		});
	}
}
