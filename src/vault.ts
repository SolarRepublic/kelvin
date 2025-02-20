
import type {ConnectConfig, KelvinConfig} from './api';
import type {GenericItemController} from './controller';
import type {RuntimeItem} from './item-proto';
import type {AcceptablePartTuples, PartFields, StructuredSchema} from './schema-types';
import type {KelvinKeyValueStore, KelvinKeyValueWriter} from './store';
import type {SerVaultHub, SerVaultBase, SerVaultHashParams, BucketKey, SerBucket, DomainLabel} from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {NaiveBase64, NaiveBase93, Dict, Promisable} from '@blake.regalia/belt';
import type {AesGcmDecryptionError, RuntimeKeyHandle} from '@solar-republic/crypto';

import {base64_to_bytes, bytes_to_base64, bytes_to_json, F_NOOP, is_dict_es, entries, text_to_bytes, defer, json_to_bytes, ATU8_NIL, concat2, __UNDEFINED, bytes, is_array, import_key, try_sync, is_undefined, subtle_export_key} from '@blake.regalia/belt';

import {aes_gcm_decrypt, aes_gcm_encrypt, random_bytes, runtime_key_access, runtime_key_destroy} from '@solar-republic/crypto';

import {derive_cipher_key, derive_tandem_root_keys, generate_root_signature, verify_root_key} from './auth';
import {B_VERBOSE, G_DEFAULT_HASHING_PARAMS, NB_CACHE_LIMIT_DEFAULT, NB_HUB_GROWTH, NB_HUB_MINIMUM, NB_SHA256_SALT, N_SYSTEM_VERSION, XB_CHAR_PAD, XB_NONCE_PREFIX_VERSION, XT_CONFIRMATION_TIMEOUT} from './constants';
import {write_nonce_for_entry, create_cipher_nonce, read_nonce_for_entry, rotate_root_key} from './crypto';
import {ConnectionState} from './enums';
import {Bug, InvalidPassphraseError, InvalidSessionError, RecoverableVaultError, RefuseDestructiveActionError, StorageError, VaultClosedError, VaultCorruptedError} from './errors';
import {VaultHub} from './hub';
import {SI_KEY_STORAGE_BASE, SI_KEY_STORAGE_HUB, SI_KEY_SESSION_ROOT, SI_KEY_SESSION_VECTOR, SI_KEY_SESSION_AUTH} from './ids';
import type { Kelvin } from './kelvin';

export type VaultConfig<n_version extends number=number> = KelvinConfig & ConnectConfig<n_version>;

type SerSessionRootKey = number[];


// the private fields of a Vault instance
type VaultFields = {
	dk_root: CryptoKey;
	dk_cipher?: CryptoKey;
	atu8_vector?: Uint8Array;
	atu8_auth?: Uint8Array;
};

export type SchemaContent = {
	[SI_KEY_STORAGE_BASE]: SerVaultBase;
	[SI_KEY_STORAGE_HUB]: NaiveBase93;
} & {
	[si in BucketKey]: NaiveBase93;
};

export type SchemaSession = {
	[SI_KEY_SESSION_ROOT]: NaiveBase64;
	[SI_KEY_SESSION_VECTOR]: NaiveBase64;
	[SI_KEY_SESSION_AUTH]: NaiveBase64;
};

type StoreContent = KelvinKeyValueStore<KelvinKeyValueWriter, SchemaContent>;
type StoreSession = KelvinKeyValueStore<KelvinKeyValueWriter, SchemaSession>;

export type Migrator = {
	domain(si_domain: string): void;
};

export type Migration = (k_migrator: Migrator) => Promisable<void>;

export type ZeroToNRange = {
	0: never;
	1: 0;
	2: 0 | 1;
	3: 0 | 1 | 2;
	4: 0 | 1 | 2 | 3;
	5: 0 | 1 | 2 | 3 | 4;
	6: 0 | 1 | 2 | 3 | 4 | 5;
	7: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	8: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	9: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
	10: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	11: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
	12: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
	13: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	14: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
	15: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
	16: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
	17: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
	18: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
	19: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
	20: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;
	21: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
	22: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21;
	23: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22;
	24: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
	25: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;
	26: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25;
	27: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26;
	28: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27;
	29: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28;
	30: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29;
	31: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30;
	32: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31;
	33: number;
};

export type MigrationRouter<n_db_version extends number=number> = {
	[i_version in n_db_version extends keyof ZeroToNRange? ZeroToNRange[n_db_version]: number]: Migration
};


// stores the private fields of an Vault instance
const hm_privates = new WeakMap<Vault, VaultFields>();

// pattern for executing list of awaiter callbacks
const callback_awaiters = <w_value>(a_awaiters_src: ((w_value: w_value) => void)[], w_value: w_value) => {
	// copy list before calling to avoid possible infinite recursion
	const a_awaiters_copy = a_awaiters_src.slice();

	// clear awaiters list
	a_awaiters_src.length = 0;

	// start calling
	for(const fk_opened of a_awaiters_copy) {
		fk_opened(w_value);
	}
};

// pattern for getting awaiter
const awaiter_from = <w_value>(a_awaiters: ((w_value: w_value) => void)[]) => {
	// get deferred promise
	const [dp_open, fk_resolve] = defer();

	// push resolver to list
	a_awaiters.push(fk_resolve);

	// return promise
	return dp_open;
};


export type UnlockConfig = {
	passphrase: Uint8Array;
	recovery?: boolean;
	info?: ((s_state: string) => void);
};


/**
 * 
 * Storage key prefixes:
 *   - "@": reserved key, plaintext value
 *   - "#": reserved key, ciphertext value
 *   - "_": arbitrary key, ciphertext value
 * 
 * Reserved entries:
 *   - "@base": stores encryption metadata
 *   - "@params": tunable parameters to password hashing function
 */
export class Vault<n_version extends number=number> {
	
// 	/**
// 	 * Connects to the given database
// 	 * @param si_database - id of the database
// 	 * @returns 
// 	 */
// 	async connect<
// 	n_db_version extends number,
// >(gc_connect: ConnectConfig<n_db_version>): Promise<this> {

	static async create(k_kelvin: Kelvin, gc_vault: VaultConfig): Promise<Vault> {
		// create,initialize, and return new Vault instance
		return await new Vault(k_kelvin, gc_vault)._init();
	}

	protected _k_kelvin: Kelvin;

	// storage
	protected _k_content: StoreContent;
	protected _k_session: StoreSession;

	// connection state
	protected _sc_connection = ConnectionState.NOT_CONNECTED;

	// database name
	protected _si_id!: string;

	// database version
	protected _n_db_version: n_version;

	// migrations
	protected _h_migrations: MigrationRouter = {};

	// unmarshalled base
	protected _atu8_entropy!: Uint8Array;
	protected _xg_nonce!: bigint;
	protected _atu8_signature!: Uint8Array;
	protected _atu8_salt!: Uint8Array;
	protected _g_params!: SerVaultHashParams;

	// once the vault is opened, the hub can be accessed
	protected _k_hub!: VaultHub;

	// awaiters
	protected _a_awaiting_open: ((k_hub: VaultHub) => any)[] = [];
	protected _a_awaiting_base: ((g_base: SerVaultBase) => any)[] = [];
	protected _a_awaiting_hub_change: (() => any)[] = [];
	protected _h_awaiting_bucket: Record<BucketKey, (() => any)[]> = {};

	// for removing change event listeners
	protected _fk_unlisten_base: () => void = F_NOOP;
	protected _fk_unlisten_hub: () => void = F_NOOP;
	protected _fk_unlisten_buckets: () => void = F_NOOP;

	// confirmation timeout
	protected _xt_confirmation_timeout: number;

	// dirty indicator
	protected _b_dirty = false;

	// cache
	protected _h_bucket_cache: Dict<[SerBucket, number]> = {};
	protected _nb_cache = 0;
	protected _nb_cache_limit: number;

	// scopes storage keys
	protected _f_scoper = (si_prefix: string) => `${si_prefix}.${this._si_id}`;

	constructor(
		k_kelvin: Kelvin,
		gc_vault: VaultConfig<n_version>
	) {
		this._k_kelvin = k_kelvin;
		this._k_content = gc_vault.content as StoreContent;
		this._k_session = gc_vault.session as StoreSession;
		this._nb_cache_limit = gc_vault.cacheLimit ?? NB_CACHE_LIMIT_DEFAULT;
		this._xt_confirmation_timeout = gc_vault.confirmationTimeout ?? XT_CONFIRMATION_TIMEOUT;

		this._si_id = gc_vault.id;
		this._n_db_version = gc_vault.version;
	}

	get kelvin(): Kelvin {
		return this._k_kelvin;
	}

	/**
	 * Fetches the current database info
	 * @returns 
	 */
	get databaseInfo(): {id: string; version: number} {
		return {
			id: this._si_id,
			version: this._n_db_version,
		};
	}

	get databaseTag(): `${string}:v${n_version}` {
		return `${this._si_id}:v${this._n_db_version}`;
	}

	// access the raw content storage instance
	get contentStore(): KelvinKeyValueStore {
		return this._k_content;
	}

	// access the raw session storage instance
	get sessionStore(): KelvinKeyValueStore {
		return this._k_session;
	}

	protected async _init(): Promise<this> {
		// destructure fields
		const {
			_k_content,
			_k_session,
			_f_scoper,
		} = this;

		// set connection state
		this._sc_connection = ConnectionState.CONNECTING;

		// start monitoring changes to base
		this._fk_unlisten_base = _k_content.onEntryChanged(_f_scoper(SI_KEY_STORAGE_BASE), async(g_new, g_old) => {
			// read as json
			const g_base_new = g_new.asJson<SerVaultBase>();

			// base was deleted
			if(!g_base_new) {
				// update existence
				this._sc_connection = ConnectionState.NON_EXISTANT;

				// throw
				throw new VaultCorruptedError(`base was deleted. in case this was an accident, the previous value can be restored using the following JSON:\n${JSON.stringify(g_old)}`);
			}

			// load base
			this._load_base(g_base_new);
		});

		// fetch base object
		const g_base = await _k_content.getJson<SerVaultBase>(_f_scoper(SI_KEY_STORAGE_BASE));

		// database exists
		if(g_base) {
			// load the base object
			this._load_base(g_base);

			// fetch root key
			const a_root_key = await _k_session.getJson<SerSessionRootKey>(_f_scoper(SI_KEY_SESSION_ROOT));

			// load the root key
			await this._load_root_key(a_root_key);

			// set connection state
			this._sc_connection = ConnectionState.CONNECTED;
		}
		// not exists
		else {
			this._sc_connection = ConnectionState.NON_EXISTANT;
		}

		return this;
	}

	protected _next_base_update(): Promise<void> {
		// return new awaiter
		return awaiter_from(this._a_awaiting_base);
	}

	// unmarshall base properties
	protected _load_base(g_base: SerVaultBase): void {
		// attempt to decode entropy
		const [atu8_entropy, e_entropy] = try_sync(base64_to_bytes, g_base.entropy);
		if(!atu8_entropy || e_entropy) throw new VaultCorruptedError('unable to decode entropy');

		// attempt to decode nonce
		const [xg_nonce, e_nonce] = try_sync(() => BigInt(g_base.nonce));
		if(is_undefined(xg_nonce) || e_nonce) throw new VaultCorruptedError('unable to decode nonce');

		// attempt to decode signature
		const [atu8_signature, e_signature] = try_sync(base64_to_bytes, g_base.signature);
		if(!atu8_signature || e_signature) throw new VaultCorruptedError('unable to decode signature');

		// attempt to decode salt
		const [atu8_salt, e_salt] = try_sync(base64_to_bytes, g_base.salt);
		if(!atu8_salt || e_salt) throw new VaultCorruptedError('unable to decode salt');

		// attempt to read params
		const g_params = this._g_params = g_base.params;
		if(g_params && !is_dict_es(g_params)) {
			throw new VaultCorruptedError('invalid hash params value');
		}

		// save fields
		this._atu8_entropy = atu8_entropy;
		this._xg_nonce = xg_nonce;
		this._atu8_signature = atu8_signature;
		this._atu8_salt = atu8_salt;

		// update success
		callback_awaiters(this._a_awaiting_base, g_base);
	}

	// load the root key from session
	protected async _load_root_key(a_root_key: SerSessionRootKey): Promise<void> {
		// not unlocked
		if(!a_root_key) return;

		// invalid root key
		if(!is_array(a_root_key)) {
			throw new InvalidSessionError('root key not an array');
		}

		// invalid length
		if(!a_root_key.length) {
			throw new InvalidSessionError('root key length invalid: '+a_root_key.length);
		}

		// not numbers or invalid range
		if(!a_root_key.every(xb => Number.isInteger(xb) && xb > 0 && xb < 256)) {
			throw new InvalidSessionError('root key not all valid uints in range');
		}

		// import to buffer
		const atu8_data = Uint8Array.from(a_root_key);

		// import root key
		const dk_root = await import_key(atu8_data, 'HKDF', ['deriveKey']);

		// save/update private field
		hm_privates.set(this, {
			...hm_privates.get(this),
			dk_root,
		});
	}

	// load the hub from storage and decrypt it
	protected async _load_hub(atu8_hub_cipher: Uint8Array): Promise<SerVaultHub> {
		// destruct private fields
		const {
			dk_cipher,
			atu8_vector,
		} = hm_privates.get(this)!;

		// decrypt entry. let if fail if cipher key is wrongl
		const atu8_hub_plain = await this._decrypt_entry(this._f_scoper(SI_KEY_STORAGE_HUB), atu8_hub_cipher, atu8_vector, dk_cipher);

		// attempt to decode
		let g_hub: SerVaultHub;
		try {
			g_hub = bytes_to_json(atu8_hub_plain) as unknown as SerVaultHub;
		}
		// corrupted hub
		catch(e_) {
			throw new VaultCorruptedError('unable to decode hub json');
		}

		// return hub
		return g_hub;
	}

	// decrypt an entry
	protected async _decrypt_entry(
		si_key: string,
		atu8_value: Uint8Array,
		atu8_vector?: Uint8Array,
		dk_cipher?: CryptoKey
	): Promise<Uint8Array> {
		// save/update private field
		const g_privates = hm_privates.get(this)!;

		// derive the nonce
		const [atu8_nonce, atu8_cipher] = await read_nonce_for_entry(si_key, atu8_value, atu8_vector || g_privates.atu8_vector!);

		// decrypt the value
		return await aes_gcm_decrypt(atu8_cipher, dk_cipher || g_privates.dk_cipher!, atu8_nonce);
	}

	// encrypt an entry
	protected async _encrypt_entry(
		si_key: string,
		atu8_plain: Uint8Array,
		atu8_vector?: Uint8Array,
		dk_cipher?: CryptoKey
	): Promise<Uint8Array> {
		// save/update private field
		const g_privates = hm_privates.get(this)!;

		// derive the nonce
		const [atu8_nonce, atu8_prefix] = await write_nonce_for_entry(si_key, atu8_vector || g_privates.atu8_vector!);

		// encrypt the value
		const atu8_cipher = await aes_gcm_encrypt(atu8_plain, dk_cipher || g_privates.dk_cipher!, atu8_nonce);

		// concat if prefix exists
		return atu8_prefix? concat2(atu8_prefix, atu8_cipher): atu8_cipher;
	}


	/**
	 * Checks whether or not the vault exists
	 * @returns `true` if it exists, `false` otherwise
	 */
	exists(): boolean {
		// depending on connection state
		switch(this._sc_connection) {
			// busy or not yet started
			case ConnectionState.CONNECTING:
			case ConnectionState.NOT_CONNECTED: {
				throw Error('Attempted to call `exists()` on Vault before it finished connecting somehow');
			}

			// non-existant
			case ConnectionState.NON_EXISTANT: return false;

			// ok
			case ConnectionState.CONNECTED: return true;

			// not handled
			default: {
				throw Error(`Unhandled connection state: ${this._sc_connection as string}`);
			}
		}
	}

	/**
	 * 
	 * @returns 
	 */
	async onceExists(): Promise<void> {
		// not yet connected; wait for next base update
		if(ConnectionState.CONNECTED !== this._sc_connection) {
			await this._next_base_update();
		}
	}

	/**
	 * Check if the vault is already unlocked, i.e., if it is ready to be opened.
	 * @returns `true` if it is connected and unlocked, `false` otherwise
	 */
	isUnlocked(): boolean {
		// not connected
		if(ConnectionState.CONNECTED !== this._sc_connection) {
			// throw Error(`Cannot access vault which is not connected: ${this._sc_connection}`);
			console.warn(`kelvin: Cannot access vault which is not connected: ${this._sc_connection}`);
			return false;
		}

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// root key's presence indicates unlocked status
		return !!g_privates?.dk_root;
	}

	/**
	 * Check if the vault is already opened
	 * @returns `true` if it is opened, `false` otherwise
	 */
	isOpened(): boolean {
		return !!this._k_hub;
	}

	async _unlock_subroutine(
		kw_content: KelvinKeyValueWriter,
		gk_root_new: RuntimeKeyHandle,
		dk_root: CryptoKey,
		dk_cipher: CryptoKey,
		atu8_vector: Uint8Array,
		atu8_entropy: Uint8Array,
		xg_nonce_new: bigint,
		atu8_salt: Uint8Array,
		f_info: ((s_state: string) => void)=F_NOOP
	): Promise<void> {
		// update session
		{
			// verbose
			f_info('Updating session');

			// create session auth private key
			const atu8_auth = random_bytes(32);

			// save/update to private fields
			hm_privates.set(this, {
				...hm_privates.get(this)!,
				dk_root,
				dk_cipher,
				atu8_vector,
				atu8_auth,
			});

			// export new root key
			const sb64_root_new = await runtime_key_access(gk_root_new, atu8 => bytes_to_base64(atu8));

			// save to session storage
			await this._k_session.lockAll(kw_session => kw_session.setStringMany({
				[this._f_scoper(SI_KEY_SESSION_ROOT)]: sb64_root_new,
				[this._f_scoper(SI_KEY_SESSION_VECTOR)]: bytes_to_base64(atu8_vector),
				[this._f_scoper(SI_KEY_SESSION_AUTH)]: bytes_to_base64(atu8_auth),
			}));
		}

		// verbose
		f_info('Generating signature');

		// generate signature
		const atu8_signature = await generate_root_signature(dk_root, atu8_salt);

		// verbose
		f_info('Saving to storage');

		// serialize the new base
		const g_base: SerVaultBase = {
			version: N_SYSTEM_VERSION,
			entropy: bytes_to_base64(atu8_entropy),
			nonce: `${xg_nonce_new}`,
			signature: bytes_to_base64(atu8_signature),
			salt: bytes_to_base64(atu8_salt),
			params: G_DEFAULT_HASHING_PARAMS,
		};

		// start waiting for next update
		const dp_update = this._next_base_update();

		// write to storage (this will trigger a change and call _load_base)
		await kw_content.setJson(this._f_scoper(SI_KEY_STORAGE_BASE), g_base);

		// verbose
		f_info('Waiting for confirmation');

		// wait for that update
		await dp_update;
	}

	/**
	 * Attempt to unlock the vault. If successful, the root key will be rotated.
	 * @param atu8_phrase - secret passphrase, text should be normalized before encoded
	 * @param b_recovering - caller acknowledges this is a recovery effort (storage is partially transcrypted)
	 * @param f_info - optional callback to provide with update messages during the process
	 * @returns 
	 */
	async unlock(atu8_phrase: Uint8Array, b_recovering=false, f_info: ((s_state: string) => void)=F_NOOP): Promise<void> {
		// already unlocked
		if(this.isUnlocked()) return;

		// destructure fields
		const {
			_atu8_salt,
			_atu8_entropy,
			_xg_nonce,
			_g_params,
			_atu8_signature,
			_k_session,
		} = this;

		// // destructure config
		// const {
		// 	passphrase: atu8_phrase,
		// 	migrations: h_migrations,
		// 	recovery: b_recovering=false,
		// 	info: f_info=F_NOOP,
		// } = gc_unlock;

		// TODO: bind to session root key changes

		// verbose
		f_info('Waiting for session lock');

		// obtain write lock to session
		await this._k_content.lockAll(async(kw_content) => {
			// verbose
			f_info('Deriving root keys');

			// derive root keys
			const {
				old: g_root_old,
				new: g_root_new,
				export: gk_root_new,
			} = await derive_tandem_root_keys(atu8_phrase, _atu8_entropy, _xg_nonce, _g_params, true);

			// invalid old root key
			if(!await verify_root_key(g_root_old.key, _atu8_salt, _atu8_signature)) {
				// new root does not work either; bad passphrase
				if(!await verify_root_key(g_root_new.key, _atu8_salt, _atu8_signature)) {
					throw new InvalidPassphraseError();
				}
				// program was for closed amid recryption
				else if(!b_recovering) {
					throw new RecoverableVaultError();
				}
			}

			// whether success or failure
			try {
				// rotate root key
				const dk_cipher = await rotate_root_key(kw_content, g_root_old, g_root_new, _atu8_salt, f_info);

				// 
				await this._unlock_subroutine(
					kw_content,
					gk_root_new,
					g_root_new.key,
					dk_cipher,
					g_root_new.vector,
					_atu8_entropy,
					g_root_new.nonce,
					_atu8_salt,
					f_info
				);
			}
			// zeroize root key material
			finally {
				runtime_key_destroy(gk_root_new);
			}

			// verbose
			f_info('Done');
		});
	}

	/**
	 * Registers a new vault
	 * @param atu8_phrase 
	 * @param f_info 
	 * @returns 
	 */
	async register(
		atu8_phrase: Uint8Array,
		f_info: ((s_state: string) => void)=F_NOOP
	): Promise<void> {
		// cannot create on database that already exists
		if(this.exists()) {
			throw new RefuseDestructiveActionError(`attempted to register new vault "${this._si_id}" where one already exists`);
		}

		// verbose
		f_info('Awaiting write lock');

		// acquire write lock
		return this._k_content.lockAll(async(kw_content) => {
			// select 128 bits of entropy at random
			const atu8_entropy = random_bytes(16);

			// select initial uint128 nonce at random 
			const dv_random = new DataView(random_bytes(16).buffer);

			// create uint128 by bit-shifting then OR'ing 64-tets into place
			const xg_nonce_init_hi = dv_random.getBigUint64(0, false);
			const xg_nonce_init_lo = dv_random.getBigUint64(8, false);
			const xg_nonce_init = (xg_nonce_init_hi << 64n) | xg_nonce_init_lo;

			// import base key from passphrase and derive the new root key
			const {
				new: {
					key: dk_root_new,
					vector: atu8_vector,
					nonce: xg_nonce_new,
				},
				export: gk_root_new,
			} = await derive_tandem_root_keys(atu8_phrase, atu8_entropy, xg_nonce_init, G_DEFAULT_HASHING_PARAMS, true);

			// create salt
			const atu8_salt = this._atu8_salt = random_bytes(NB_SHA256_SALT);

			// derive aes cipher key
			const dk_cipher = await derive_cipher_key(dk_root_new, atu8_salt, true);

			// unlock the vault
			await this._unlock_subroutine(
				kw_content,
				gk_root_new,
				dk_root_new,
				dk_cipher,
				atu8_vector,
				atu8_entropy,
				xg_nonce_new,
				atu8_salt,
				f_info
			);

			// set connection state
			this._sc_connection = ConnectionState.CONNECTED;

			// verbose
			f_info('Done');
		});
	}

	/**
	 * Attempt to open the unlocked vault. Throws {@link AesGcmDecryptionError} if passphrase is wrong
	 * @param h_migrations - dict of migrations keyed by database version number. only optional for
	 * 	cases when the caller is guaranteed to only ever access an already unlocked vault.
	 * @returns a {@link VaultHub}
	 */
	async open(): Promise<VaultHub> {
		// destructure field(s)
		const {
			_k_content,
			_k_hub,
			_h_bucket_cache,
			_f_scoper,
		} = this;

		// vault is already open
		if(_k_hub) return _k_hub;

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// no root key
		if(!g_privates?.dk_root) {
			throw Error('Cannot open a locked vault without authenticating');
		}

		// listen for hub changes
		this._fk_unlisten_hub = _k_content.onEntryChanged(_f_scoper(SI_KEY_STORAGE_HUB), async(g_new) => {
			// resolve value as bytes
			const atu8_hub = g_new.asBytes();

			// hub changed
			if(atu8_hub) {
				// decrypt
				const g_hub = await this._load_hub(atu8_hub);

				// update hub
				this._k_hub.load(g_hub);
			}
			// value was deleted
			else {
				throw new VaultCorruptedError('hub was deleted');
			}

			// callback awaiters
			callback_awaiters(this._a_awaiting_hub_change, void 0);
		});

		// listen for bucket changes
		this._fk_unlisten_buckets = _k_content.onChanged((h_changes) => {
			// each change
			for(const si_key_changed in h_changes) {
				// entry is a local bucket and bucket is cached
				if(si_key_changed in _h_bucket_cache) {
					// get new value as bytes
					const atu8_new = h_changes[si_key_changed].newValue.asBytes();

					// bucket was removed
					if(!atu8_new) {
						// destructure cache entry to get its size
						const [, nb_entry] = _h_bucket_cache[si_key_changed];

						// delete from cache
						delete _h_bucket_cache[si_key_changed];

						// update cache size
						this._nb_cache -= nb_entry;
					}
					// bucket changed?!
					else {
						debugger;

						throw new Bug(`Buckets should be immutable, but a cached entry seems to have changed`);
					}
				}
			}
		});

		// TODO: obtain a read lock?

		// create hub
		const k_hub = this._k_hub = new VaultHub(this, this._k_kelvin.controllers);

		// fetch the hub data
		const atu8_hub = await _k_content.getBytes(_f_scoper(SI_KEY_STORAGE_HUB));

		// obtain a write lock
		await this._k_content.lockAll(async(kw_content) => {
			// hub exists
			if(atu8_hub) {
				// load hub data
				const g_hub = await this._load_hub(atu8_hub);

				// load into hub instance
				k_hub.load(g_hub);
			}
			// hub does not exist
			else {
				// save it to storage from hub's initialization
				// await this._k_content.lockAll(kw_content => this._k_hub._write_hub(kw_content));
				await this._k_hub._write_hub(kw_content);
			}

			// initialize hub
			await k_hub._init(kw_content, this._h_migrations);
		});

		// queue calling back awaiters
		queueMicrotask(() => {
			callback_awaiters(this._a_awaiting_open, k_hub);
		});

		// return hub
		return k_hub;
	}

	/**
	 * Returns a Promise that resolves once the vault has been opened.
	 * Returns resolved Promise if already open
	 */
	untilOpened(): Promise<VaultHub> {
		// already open
		if(this._k_hub) return Promise.resolve(this._k_hub);

		// return new awaiter
		return awaiter_from(this._a_awaiting_open);
	}

	/**
	 * Synchronously access the hub. Requires the vault to have been opened
	 */
	hub(): VaultHub {
		if(!this._k_hub) {
			throw new VaultClosedError('attempted to access hub prematurely');
		}

		return this._k_hub;
	}

	async writeHub(g_hub: SerVaultHub, kw_content: KelvinKeyValueWriter): Promise<void> {
		// verbose
		if(B_VERBOSE) {
			console.info(`✏️  Writing to hub: ${JSON.stringify(g_hub)}`);
		}

		// attempt to encode
		let atu8_hub_plain: Uint8Array;
		try {
			atu8_hub_plain = text_to_bytes(JSON.stringify(g_hub));
		}
		// bug in hub json?
		catch(e_encode) {
			throw new Bug('unable to encode hub', e_encode);
		}

		// pad with spaces
		let nb_out = NB_HUB_MINIMUM;
		for(; nb_out<atu8_hub_plain.length; nb_out+=NB_HUB_GROWTH);
		const atu8_hub_padded = bytes(nb_out);
		atu8_hub_padded.fill(XB_CHAR_PAD, atu8_hub_plain.length);
		atu8_hub_padded.set(atu8_hub_plain, 0);

		// construct hub key
		const si_key_hub = this._f_scoper(SI_KEY_STORAGE_HUB);

		// encrypt entry
		const atu8_hub_value = await this._encrypt_entry(si_key_hub, atu8_hub_padded);

		// TODO: add confirmation timeout

		// prep awaiter
		const dp_written = awaiter_from(this._a_awaiting_hub_change);

		// write to storage
		await kw_content.setBytes(si_key_hub, atu8_hub_value);

		// wait for change to be captured
		await dp_written;
	}


	async readBucket(si_key: BucketKey): Promise<SerBucket> {
		// destructure field(s)
		const {_h_bucket_cache, _nb_cache_limit} = this;

		// no cipher key
		const dk_cipher = hm_privates.get(this)?.dk_cipher;
		if(!dk_cipher) {
			throw new VaultClosedError('unable to read bucket');
		}

		// entry is cached
		if(si_key in _h_bucket_cache) {
			console.info(`🎯 Cache hit reading bucket key: ${si_key}`);

			return _h_bucket_cache[si_key][0];
		}

		if(B_VERBOSE) {
			console.info(`🟢 Reading bucket contents: ${si_key}`);
		}

		// attempt to read bucket contents from storage
		let atu8_value: Uint8Array;
		try {
			if(!(atu8_value = await this._k_content.getBytes(si_key))) {
				throw new Error('bucket having target key does not exist');
			}
		}
		// corrupted hub
		catch(e_decode) {
			throw new VaultCorruptedError('unable to read/decode bucket contents', e_decode);
		}

		// decrypt
		const atu8_bucket_plain = await this._decrypt_entry(si_key, atu8_value);

		// record its size
		const nb_bucket_plain = atu8_bucket_plain.length;

		// attempt to decode
		let w_contents: SerBucket;
		try {
			w_contents = bytes_to_json(atu8_bucket_plain) as SerBucket;
		}
		// corrupted hub
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode hub json', e_decode);
		}

		// reached cache limit
		if((this._nb_cache += nb_bucket_plain) >= _nb_cache_limit) {
			// drop oldest entries from cache
			for(const [si_entry, [, nb_plain]] of entries(_h_bucket_cache)) {
				// drop entry
				delete _h_bucket_cache[si_entry];

				// updated size is now below threshold; break cache clearing loop
				if((this._nb_cache -= nb_plain) < _nb_cache_limit) break;
			}
		}

		// save to cache
		_h_bucket_cache[si_key] = [w_contents, nb_bucket_plain];

		// return decrypted value
		return w_contents;
	}

	async writeBucket(si_key: BucketKey, w_contents: SerBucket, nb_bucket_target: number, kw_content: KelvinKeyValueWriter): Promise<number> {
		// no cipher key
		const dk_cipher = hm_privates.get(this)?.dk_cipher;
		if(!dk_cipher) {
			throw new VaultClosedError('unable to write bucket');
		}

		// verbose
		if(B_VERBOSE) {
			console.info(`📘 Encrypting bucket contents: ${JSON.stringify(w_contents)}`);
		}

		// attempt to encode bucket contents
		let atu8_bucket_plain: Uint8Array;
		try {
			atu8_bucket_plain = json_to_bytes(w_contents);
		}
		catch(e_encode) {
			throw new Bug('unable to encode plaintext bucket contents while writing');
		}

		// pad with spaces
		const nb_out = Math.max(atu8_bucket_plain.length, nb_bucket_target);
		const atu8_bucket_padded = bytes(nb_out);
		atu8_bucket_padded.fill(XB_CHAR_PAD, atu8_bucket_plain.length);
		atu8_bucket_padded.set(atu8_bucket_plain, 0);

		// encrypt
		const atu8_value = await this._encrypt_entry(si_key, atu8_bucket_padded);

		// prep awaiter
		const [dp_bucket_change, fke_bucket_change] = defer();

		// create confirmation timeout
		const i_confirmation = setTimeout(() => {
			fke_bucket_change(null, new StorageError('timed out while waiting for confirmation of bucket write'));
		}, this._xt_confirmation_timeout);

		// listen for bucket changes
		const fk_unlisten_bucket = this._k_content.onEntryChanged(si_key, () => {
			// cancel confirmation timeout
			clearTimeout(i_confirmation);

			// remove listener
			fk_unlisten_bucket();

			// resolve
			fke_bucket_change(void 0);
		});

		// verbose
		if(B_VERBOSE) {
			console.info(`✏️  Writing encrypted bucket contents to: ${si_key}, ${atu8_value.length} bytes`);
		}

		// attempt to encode bucket contents & write to storage
		try {
			await kw_content.setBytes(si_key, atu8_value);
		}
		catch(e_encode) {
			throw new Bug('unable to encode/write ciphertext bucket contents');
		}

		// wait for confirmation
		await dp_bucket_change;

		// return the plaintext length of the bucket's contents before padding
		return atu8_bucket_plain.length;
	}

	/**
	 * Delete a set of buckets by their keys, ensuring any cached entries are deleted.
	 * @param as_keys - the set of bucket keys to delete
	 * @param kw_content 
	 */
	async deleteBuckets(as_keys: Iterable<BucketKey>, kw_content: KelvinKeyValueWriter) {
		// copy set
		const as_remaining = new Set(as_keys);

		// defer async
		const [dp_stasis, fke_buckets_removed] = defer();

		// create confirmation timeout
		const i_confirmation = setTimeout(() => {
			fke_buckets_removed(null, new StorageError('timed out while waiting for confirmation of deleted bucket(s)'));
		}, this._xt_confirmation_timeout);

		// listen for bucket changes
		const fk_unlisten_bucket = this._k_content.onChanged((h_changes) => {
			// each change
			for(const si_key_changed in h_changes) {
				// remove from set of remaining if its there
				as_remaining.delete(si_key_changed as BucketKey);
			}

			// all expected buckets have been deleted
			if(!as_remaining.size) {
				// clear confirmation timeout
				clearTimeout(i_confirmation);

				// remove listener
				fk_unlisten_bucket();

				// resolve
				fke_buckets_removed(void 0);
			}
		});

		// verbose
		if(B_VERBOSE) {
			console.info(`⛔️ Deleting buckets: ${[...as_keys].map(s => `"${s}"`).join(', ')}`);
		}

		// remove bucket entries
		await kw_content.removeMany([...as_keys]);

		// await for stasis to be reached
		await dp_stasis;
	}

	/**
	 * Obtains an exclusive write lock in order to conduct a transaction
	 * @param f_use 
	 * @returns 
	 */
	async withExclusive(f_use: (k_writer: KelvinKeyValueWriter, y_lock: Lock | null) => Promisable<any>): Promise<ReturnType<typeof f_use>> {
		return await this._k_content.lockAll(f_use);
	}


	/**
	 * Encrypts an arbitrary byte sequence
	 * @param si_key - a key to associate with this piece of data
	 * @param atu8_plain - the plaintext data
	 * @returns ciphertext
	 */
	async encryptBytes(
		si_key: string,
		atu8_plain: Uint8Array
	): Promise<Uint8Array> {
		// encrypt entry
		return await this._encrypt_entry('#'+si_key, atu8_plain);
	}

	/**
	 * Decrypts an arbitrary byte sequence
	 * @param si_key - the key associated with this piece of data
	 * @param atu8_cipher - the ciphertext data
	 * @returns plaintext
	 */
	async decryptBytes(
		si_key: string,
		atu8_value: Uint8Array
	): Promise<Uint8Array> {
		// decrypt entry
		return await this._decrypt_entry('#'+si_key, atu8_value);
	}
}
