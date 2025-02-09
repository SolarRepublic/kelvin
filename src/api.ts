import type {KelvinKeyValueStore} from './store';
import type {MigrationRouter} from './vault';


export type KelvinConfig = {
	content: KelvinKeyValueStore;
	session: KelvinKeyValueStore;

	/**
	 * Limit how much memory is consumed by the bucket cache by specifying the maximum size in bytes
	 * which is calculated using the plaintext serialized JSON in UTF-8. Actual memory footprint
	 * is the deserialized data structs in memory, which will be different than this value, so it's
	 * important to understand this is only a proxy. Defaults to {@link NB_CACHE_LIMIT_DEFAULT}
	 */
	cacheLimit?: number;

	/**
	 * Specify the maximum amount of time to wait for a confirmation of a write/delete operation
	 * from the storage backend. Defaults to {@link XT_CONFIRMATION_TIMEOUT}.
	 */
	confirmationTimeout?: number;
};

export type ConnectConfig<n_db_version extends number> = {
	id: string;
	version: n_db_version;
	migrations: MigrationRouter<n_db_version>;
};
