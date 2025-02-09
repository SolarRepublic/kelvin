import type {ConnectConfig, KelvinConfig} from './api';

import {Vault} from './vault';


export class Kelvin {
	constructor(
		protected _gc_kelvin: KelvinConfig
	) {

	}

	/**
	 * Connects to the given database
	 * @param si_database - id of the database
	 * @returns 
	 */
	async connect<n_db_version extends number>(gc_connect: ConnectConfig<n_db_version>): Promise<Vault> {
		// destructure kelvin config
		const {
			content: _k_content,
			session: _k_session,
		} = this._gc_kelvin;

		// destructure connection params
		const {
			id: _si_name,
			version: _n_db_version,
			migrations: _h_migrations,
		} = gc_connect;

		// create new Vault instance
		const k_vault = await Vault.create({
			...this._gc_kelvin,
			...gc_connect,
		});

		// done
		return k_vault;
	}
}
