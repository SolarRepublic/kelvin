import type {N} from 'ts-toolbelt';

import type {GenericItemController, ItemController} from './controller';
import type {KelvinKeyValueStore, KelvinKeyValueWriter} from './store';
import type {SerVaultHub, SerVaultBase, SerVaultHashParams, BucketKey, SerBucket, DomainLabel, SerSchema} from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {AesGcmDecryptionError, SensitiveBytes} from '@solar-republic/crypto';

import {base64_to_buffer, buffer_to_base64, buffer_to_json, F_NOOP, is_dict_es, ode, type NaiveBase64, type NaiveBase93, text_to_buffer, defer, json_to_buffer, ATU8_NIL, concat2, __UNDEFINED, type Dict, type Promisable, buffer} from '@blake.regalia/belt';

import {aes_gcm_decrypt, aes_gcm_encrypt, random_bytes} from '@solar-republic/crypto';
import {sha256_sync} from '@solar-republic/crypto/sha256';


import {derive_cipher_key, derive_tandem_root_keys, generate_root_signature, import_key, verify_root_key, type RootKeyStruct, derive_cipher_nonce, test_encryption_integrity} from './auth';
import {ATU8_DUMMY_PHRASE, G_DEFAULT_HASHING_PARAMS, NB_HUB_GROWTH, NB_HUB_MINIMUM, NB_RECRYPTION_THRESHOLD, NB_SHA256_SALT, N_SYSTEM_VERSION, XB_CHAR_PAD, XB_NONCE_PREFIX_VERSION} from './constants';
import {Bug, InvalidPassphraseError, InvalidSessionError, RecoverableVaultError, RefuseDestructiveActionError, VaultClosedError, VaultCorruptedError} from './errors';
import {VaultHub} from './hub';
import {SI_KEY_STORAGE_BASE, SI_KEY_STORAGE_HUB, SI_KEY_SESSION_ROOT, SI_KEY_SESSION_VECTOR, SI_KEY_SESSION_AUTH} from './ids';


type SerSessionRootKey = number[];

enum ConnectionState {
	NOT_CONNECTED='not-connected',
	CONNECTING='connecting',
	NON_EXISTANT='non-existant',
	CONNECTED='connected',
}

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

export type MigrationRouter<n_db_version extends number> = {
	[i_version in n_db_version extends keyof ZeroToNRange? ZeroToNRange[n_db_version]: number]: Migration
};

export type UnlockConfig<n_db_version extends number> = {
	passphrase: Uint8Array;
	recovery?: boolean;
	info?: ((s_state: string) => void);
	migrations: MigrationRouter<n_db_version>;
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


// test encryption integrity
async function _test_integrity(
	dk_root_old: CryptoKey,
	atu8_vector_old: Uint8Array,
	atu8_vector_new: Uint8Array,
	atu8_salt: Uint8Array,
	dk_aes_new: CryptoKey
) {
	// prepare nonces
	const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
		derive_cipher_nonce(atu8_vector_old, sha256_sync(text_to_buffer('dummy')), 96),
		derive_cipher_nonce(atu8_vector_new, sha256_sync(text_to_buffer('dummy')), 96),
	]);

	// derive temporary old cipher key capable of encrypting, scoped to this block only
	const dk_aes_old_tmp = await derive_cipher_key(dk_root_old, atu8_salt, true);

	// run integrity tests
	await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_old_tmp, atu8_nonce_old);
	await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_new, atu8_nonce_new);
}

// creates cipher nonce for the given key
function _create_cipher_nonce(
	si_key: string,
	atu8_ent: Uint8Array,
	atu8_vector: Uint8Array
): Promise<Uint8Array> {
	// create salt
	const atu8_salt = sha256_sync(concat2(text_to_buffer(si_key), atu8_ent));

	// derive nonce for aes
	return derive_cipher_nonce(atu8_vector, atu8_salt, 96);
}

// consistent method for producing the nonce to use when decrypting
async function _read_nonce_for_entry(
	si_key: string,
	atu8_value: Uint8Array,
	atu8_vector: Uint8Array
): Promise<[
	atu8_nonce: Uint8Array,
	atu8_cipher: Uint8Array,
]> {
	// extra entropy if needed
	let atu8_ent = ATU8_NIL;

	// output ciphertext (default to contents)
	let atu8_cipher = atu8_value;

	// key is plaintext
	if('#' === si_key[0]) {
		// check version byte
		if(atu8_value[0] > XB_NONCE_PREFIX_VERSION) {
			throw new VaultCorruptedError(`Database was encoded using a newer version of the software (${atu8_ent[0]}) or it is corrupted. Unable to decode`);
		}

		// get extra entropy from beginning of value
		atu8_ent = atu8_value.subarray(1, 17);

		// adjust ciphertext
		atu8_cipher = atu8_value.subarray(17);
	}

	// derive nonce
	const atu8_nonce = await _create_cipher_nonce(si_key, atu8_ent, atu8_vector);

	// return nonce and cipher
	return [atu8_nonce, atu8_cipher];
}

// consistent method for producing the nonce to use when encrypting
async function _write_nonce_for_entry(
	si_key: string,
	atu8_vector: Uint8Array
): Promise<[
	atu8_nonce: Uint8Array,
	atu8_prefix: Uint8Array | undefined,
]> {
	// extra entropy if needed
	let atu8_ent = ATU8_NIL;

	// prefix value
	let atu8_prefix: Uint8Array | undefined;

	// key is plaintext
	if('#' === si_key[0]) {
		// create extra entropy
		atu8_ent = random_bytes(16);

		// construct prefix as version byte plus entropy
		atu8_prefix = concat2(Uint8Array.from([XB_NONCE_PREFIX_VERSION]), atu8_ent);
	}

	// derive nonce
	const atu8_nonce = await _create_cipher_nonce(si_key, atu8_ent, atu8_vector);

	// return nonce and value
	return [atu8_nonce, atu8_prefix];
}


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
export class Vault <
	n_db_version extends number=number,
> {
	// storage
	protected _k_content: StoreContent;
	protected _k_session: StoreSession;

	// connection state
	protected _sc_connection = ConnectionState.NOT_CONNECTED;

	// database name
	protected _si_name!: string;

	// unmarshalled base
	protected _atu8_entropy!: Uint8Array;
	protected _xg_nonce!: bigint;
	protected _atu8_signature!: Uint8Array;
	protected _atu8_salt!: Uint8Array;
	protected _g_params!: SerVaultHashParams;

	// once the vault is opened, the hub can be accessed
	protected _k_hub!: VaultHub;

	protected _a_awaiting_open: ((k_hub: VaultHub) => any)[] = [];
	protected _a_awaiting_base: ((g_base: SerVaultBase) => any)[] = [];

	// for removing change event listeners
	protected _fk_unlisten_base: () => void = F_NOOP;
	protected _fk_unlisten_hub: () => void = F_NOOP;

	// dirty indicator
	protected _b_dirty = false;

	// controllers
	protected _h_controllers: Record<DomainLabel, GenericItemController> = {};

	constructor(
		protected _n_db_version: n_db_version,
		k_content: KelvinKeyValueStore,
		k_session: KelvinKeyValueStore
	) {
		this._k_content = k_content as StoreContent;
		this._k_session = k_session as StoreSession;
	}

	get dbVersion(): n_db_version {
		return this._n_db_version;
	}

	// access the raw content storage instance
	get contentStore(): KelvinKeyValueStore {
		return this._k_content;
	}

	// access the raw session storage instance
	get sessionStore(): KelvinKeyValueStore {
		return this._k_session;
	}

	protected _fixed_storage_key(si_target: string): string {
		return si_target+'.'+this._si_name;
	}

	protected _next_base_update(): Promise<void> {
		// return new awaiter
		return awaiter_from(this._a_awaiting_base);
	}

	// unmarshall base properties
	protected _load_base(g_base: SerVaultBase): void {
		// attempt to decode entropy
		try {
			this._atu8_entropy = base64_to_buffer(g_base.entropy);
		}
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode entropy');
		}

		// attempt to decode nonce
		try {
			this._xg_nonce = BigInt(g_base.nonce);
		}
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode nonce');
		}

		// attempt to decode signature
		try {
			this._atu8_signature = base64_to_buffer(g_base.signature);
		}
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode signature');
		}

		// attempt to decode salt
		try {
			this._atu8_salt = base64_to_buffer(g_base.salt);
		}
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode salt');
		}

		// attempt to read params
		const h_params = this._g_params = g_base.params;
		if(h_params && !is_dict_es(h_params)) {
			throw new VaultCorruptedError('invalid hash params value');
		}

		// update success
		callback_awaiters(this._a_awaiting_base, g_base);
	}

	// load the root key from session
	protected async _load_root_key(a_root_key: SerSessionRootKey): Promise<void> {
		// not unlocked
		if(!a_root_key) return;

		// invalid root key
		if(!Array.isArray(a_root_key)) {
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
		const atu8_hub_plain = await this._decrypt_entry(this._fixed_storage_key(SI_KEY_STORAGE_HUB), atu8_hub_cipher, atu8_vector, dk_cipher);

		// attempt to decode
		let g_hub: SerVaultHub;
		try {
			g_hub = buffer_to_json(atu8_hub_plain) as unknown as SerVaultHub;
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
		const [atu8_nonce, atu8_cipher] = await _read_nonce_for_entry(si_key, atu8_value, atu8_vector || g_privates.atu8_vector!);

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
		const [atu8_nonce, atu8_prefix] = await _write_nonce_for_entry(si_key, atu8_vector || g_privates.atu8_vector!);

		// encrypt the value
		const atu8_cipher = await aes_gcm_encrypt(atu8_plain, dk_cipher || g_privates.dk_cipher!, atu8_nonce);

		// concat if prefix exists
		return atu8_prefix? concat2(atu8_prefix, atu8_cipher): atu8_cipher;
	}

	/**
	 * @internal
	 * @param g_root_old 
	 * @param g_root_new 
	 * @param f_info 
	 */
	async _rotate_root_key(
		kw_content: KelvinKeyValueWriter,
		g_root_old: RootKeyStruct,
		g_root_new: RootKeyStruct,
		f_info: ((s_state: string) => void)=F_NOOP
	): Promise<CryptoKey> {
		// destructure field(s)
		const {_atu8_salt} = this;

		// ref reader
		const k_reader = kw_content.reader;

		// destructure old root key properties
		const {
			key: dk_root_old,
			vector: atu8_vector_old,
		} = g_root_old;

		// destructure new root key properties
		const {
			key: dk_root_new,
			vector: atu8_vector_new,
		} = g_root_new;

		// verbose
		f_info('Rotating root key');

		// prep list of async operations
		const a_promises: Array<Promise<void>> = [];

		// keep running total of bytes pending to be recrypted
		let cb_pending = 0;

		// derive aes keys
		const [
			dk_aes_old,
			dk_aes_new,
		] = await Promise.all([
			derive_cipher_key(dk_root_old, _atu8_salt, false),
			derive_cipher_key(dk_root_new, _atu8_salt, true),
		]);

		// test encryption integrity
		await _test_integrity(dk_root_old, atu8_vector_old, atu8_vector_new, _atu8_salt, dk_aes_new);

		// get keys of encrypted entries
		const a_keys = (await k_reader.getAllKeys()).filter(si_key => /^[#_]/.test(si_key));

		// load entries
		const h_entries = await k_reader.getBytesMany(a_keys);

		// each entry
		for(const [si_key, atu8_value] of ode(h_entries)) {
			// prepare old and new nonces
			const [[atu8_nonce_old, atu8_cipher], [atu8_nonce_new]] = await Promise.all([
				_read_nonce_for_entry(si_key, atu8_value, atu8_vector_old),
				_read_nonce_for_entry(si_key, atu8_value, atu8_vector_new),
			]);

			// add to cumulative byte length
			cb_pending += atu8_cipher.length;

			// enqueue async operation
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			a_promises.push((async() => {
				// attempt to decrypt the value
				let atu8_plain: Uint8Array;
				try {
					atu8_plain = await aes_gcm_decrypt(atu8_cipher, dk_aes_old, atu8_nonce_old);
				}
				// decryption failed; retry with new key (let it throw if it fails)
				catch(e_decrypt) {
					atu8_plain = await aes_gcm_decrypt(atu8_cipher, dk_aes_new, atu8_nonce_new);

					// already encrypted; clear bytes from pending then skip
					cb_pending -= atu8_plain.length;
					return;
				}

				// encrypt with new cipher key
				const atu8_replace = await aes_gcm_encrypt(atu8_plain, dk_aes_new, atu8_nonce_new);

				// save encrypted data back to store
				await kw_content.setBytes(si_key, atu8_replace);

				// done; clear bytes from pending
				cb_pending -= atu8_plain.length;
			})());

			// exceeded threshold
			if(cb_pending > NB_RECRYPTION_THRESHOLD) {
				// wait for operations to finish
				await Promise.all(a_promises);

				// continue
				a_promises.length = 0;
			}
		}

		// wait for all operations to finish
		await Promise.all(a_promises);

		// return new cipher key
		return dk_aes_new;
	}


	/**
	 * Connects to the given database
	 * @param si_database - id of the database
	 * @returns 
	 */
	async connect(si_database: string): Promise<this> {
		// destructure field(s)
		const {_k_content} = this;

		// invalid connection state
		if(![ConnectionState.NOT_CONNECTED, ConnectionState.NON_EXISTANT].includes(this._sc_connection)) {
			throw new RefuseDestructiveActionError(`vault instance is not accepting connection requests while in state: ${this._sc_connection}`);
		}

		// set connection state
		this._sc_connection = ConnectionState.CONNECTING;

		// accept name
		this._si_name = si_database;

		// start monitoring changes to base
		this._fk_unlisten_base = _k_content.onEntryChanged(this._fixed_storage_key(SI_KEY_STORAGE_BASE), (g_new, g_old) => {
			// read as json
			const g_base_new = g_new.asJson<SerVaultBase>();

			// base was deleted
			if(!g_base_new) {
				throw new VaultCorruptedError(`base was deleted. in case this was an accident, the previous value can be restored using the following JSON:\n${JSON.stringify(g_old)}`);
			}

			// load base
			this._load_base(g_base_new);
		});

		// fetch base object
		const g_base = await _k_content.getJson<SerVaultBase>(this._fixed_storage_key(SI_KEY_STORAGE_BASE));

		// not exists
		if(!g_base) {
			// update state
			this._sc_connection = ConnectionState.NON_EXISTANT;

			// exit
			return this;
		}

		// load the base object
		this._load_base(g_base);

		// fetch root key
		const a_root_key = await this._k_session.getJson<SerSessionRootKey>(this._fixed_storage_key(SI_KEY_SESSION_ROOT));

		// load the root key
		await this._load_root_key(a_root_key);

		// set connection state
		this._sc_connection = ConnectionState.CONNECTED;

		// done
		return this;
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
				throw Error('Attempted to call `exists()` on Vault before it finished connecting; Promises must be awaited');
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
	 * Check if the vault is already unlocked
	 * @returns `true` if it is unlocked, `false` otherwise
	 */
	isUnlocked(): boolean {
		// not connected
		if(ConnectionState.CONNECTED !== this._sc_connection) {
			throw Error(`Cannot access vault which is not connected: ${this._sc_connection}`);
		}

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// root key's presence indicates unlocked status
		return !!g_privates?.dk_root;
	}

	async _unlock_subroutine(
		kw_content: KelvinKeyValueWriter,
		kn_root: SensitiveBytes,
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

			// save to session storage
			await this._k_session.lockAll(kw_session => kw_session.setStringMany({
				[this._fixed_storage_key(SI_KEY_SESSION_ROOT)]: buffer_to_base64(kn_root.data),
				[this._fixed_storage_key(SI_KEY_SESSION_VECTOR)]: buffer_to_base64(atu8_vector),
				[this._fixed_storage_key(SI_KEY_SESSION_AUTH)]: buffer_to_base64(atu8_auth),
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
			entropy: buffer_to_base64(atu8_entropy),
			nonce: `${xg_nonce_new}`,
			signature: buffer_to_base64(atu8_signature),
			salt: buffer_to_base64(atu8_salt),
			params: G_DEFAULT_HASHING_PARAMS,
		};

		// start waiting for next update
		const dp_update = this._next_base_update();

		// write to storage (this will trigger a change and call _load_base)
		await kw_content.setJson(this._fixed_storage_key(SI_KEY_STORAGE_BASE), g_base);

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
	// async unlock(gc_unlock: UnlockConfig<n_db_version>): Promise<void> {
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
				export: kn_root_new,
			} = await derive_tandem_root_keys(atu8_phrase, _atu8_entropy, _xg_nonce, _g_params, true);

			// whether success or failure, zero out key material
			try {
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

				// rotate root key
				const dk_cipher = await this._rotate_root_key(kw_content, g_root_old, g_root_new, f_info);

				// 
				await this._unlock_subroutine(
					kw_content,
					kn_root_new!,
					g_root_new.key,
					dk_cipher,
					g_root_new.vector,
					_atu8_entropy,
					g_root_new.nonce,
					_atu8_salt,
					f_info
				);
			}
			// before throwing, zero-out key material
			finally {
				kn_root_new?.wipe();
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
			throw new RefuseDestructiveActionError(`attempted to register new vault "${this._si_name}" where one already exists`);
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
				export: kn_root,
			} = await derive_tandem_root_keys(atu8_phrase, atu8_entropy, xg_nonce_init, G_DEFAULT_HASHING_PARAMS, true);

			// create salt
			const atu8_salt = this._atu8_salt = random_bytes(NB_SHA256_SALT);

			// whether success or failure
			try {
				// derive aes cipher key
				const dk_cipher = await derive_cipher_key(dk_root_new, atu8_salt, true);

				// 
				await this._unlock_subroutine(
					kw_content,
					kn_root!,
					dk_root_new,
					dk_cipher,
					atu8_vector,
					atu8_entropy,
					xg_nonce_new,
					atu8_salt,
					f_info
				);
			}
			// zero-out rooy ket material
			finally {
				kn_root?.wipe();
			}

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
	async open(h_migrations?: MigrationRouter<n_db_version>): Promise<VaultHub> {
		// destructure field(s)
		const {_k_content, _k_hub} = this;

		// vault is already open
		if(_k_hub) return _k_hub;

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// no root key
		if(!g_privates?.dk_root) {
			throw Error('Cannot open a locked vault without authenticating');
		}

		// listen for hub changes
		this._fk_unlisten_hub = _k_content.onEntryChanged(this._fixed_storage_key(SI_KEY_STORAGE_HUB), async(g_new) => {
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
		});

		// TODO: obtain a read lock?

		// create hub
		const k_hub = this._k_hub = new VaultHub(this, this._h_controllers);

		// fetch the hub data
		const atu8_hub = await _k_content.getBytes(this._fixed_storage_key(SI_KEY_STORAGE_HUB));

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
			await k_hub._init(kw_content, h_migrations);
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
		// attempt to encode
		let atu8_hub_plain: Uint8Array;
		try {
			atu8_hub_plain = text_to_buffer(JSON.stringify(g_hub));
		}
		// bug in hub json?
		catch(e_encode) {
			throw new Bug('unable to encode hub', e_encode);
		}

		// pad with spaces
		let nb_out = NB_HUB_MINIMUM;
		for(; nb_out<atu8_hub_plain.length; nb_out+=NB_HUB_GROWTH);
		const atu8_hub_padded = buffer(nb_out);
		atu8_hub_padded.fill(XB_CHAR_PAD, atu8_hub_plain.length);
		atu8_hub_padded.set(atu8_hub_plain, 0);

		// construct hub key
		const si_key_hub = this._fixed_storage_key(SI_KEY_STORAGE_HUB);

		// encrypt entry
		const atu8_hub_value = await this._encrypt_entry(si_key_hub, atu8_hub_padded);

		// write to storage
		await kw_content.setBytes(si_key_hub, atu8_hub_value);
	}


	async readBucket(si_key: BucketKey): Promise<SerBucket> {
		// no cipher key
		const dk_cipher = hm_privates.get(this)?.dk_cipher;
		if(!dk_cipher) {
			throw new VaultClosedError('unable to read bucket');
		}

		// attempt to read bucket contents from storage
		let atu8_value: Uint8Array;
		try {
			atu8_value = await this._k_content.getBytes(si_key);
		}
		// corrupted hub
		catch(e_decode) {
			throw new VaultCorruptedError('unable to read/decode bucket contents', e_decode);
		}

		// decrypt
		const atu8_bucket_plain = await this._decrypt_entry(si_key, atu8_value);

		// attempt to decode
		let w_contents: SerBucket;
		try {
			w_contents = buffer_to_json(atu8_bucket_plain) as SerBucket;
		}
		// corrupted hub
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode hub json', e_decode);
		}

		// return decrypted value
		return w_contents;
	}

	async writeBucket(si_key: BucketKey, w_contents: SerBucket, nb_bucket_target: number, kw_content: KelvinKeyValueWriter): Promise<number> {
		// no cipher key
		const dk_cipher = hm_privates.get(this)?.dk_cipher;
		if(!dk_cipher) {
			throw new VaultClosedError('unable to write bucket');
		}

		// attempt to encode bucket contents
		let atu8_bucket_plain: Uint8Array;
		try {
			atu8_bucket_plain = json_to_buffer(w_contents);
		}
		catch(e_encode) {
			throw new Bug('unable to encode plaintext bucket contents while writing');
		}

		// pad with spaces
		const nb_out = Math.max(atu8_bucket_plain.length, nb_bucket_target);
		const atu8_bucket_padded = buffer(nb_out);
		atu8_bucket_padded.fill(XB_CHAR_PAD, atu8_bucket_plain.length);
		atu8_bucket_padded.set(atu8_bucket_plain, 0);

		// encrypt
		const atu8_value = await this._encrypt_entry(si_key, atu8_bucket_padded);

		// attempt to encode bucket contents & write to storage
		try {
			await kw_content.setBytes(si_key, atu8_value);
		}
		catch(e_encode) {
			throw new Bug('unable to encode/write ciphertext bucket contents');
		}

		// return the plaintext length of the bucket's contents before padding
		return atu8_bucket_plain.length;
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
	 * @internal
	 * Registers an item controller instance for its domain
	 */
	registerController(si_domain: DomainLabel, k_controller: GenericItemController): void {
		// destructure
		const {_h_controllers} = this;

		// already registered
		if(_h_controllers[si_domain]) {
			throw Error(`An item controller for the "${si_domain}" domain has already been registered`);
		}

		// accept
		_h_controllers[si_domain] = k_controller;
	}


	/**
	 * @internal
	 * Retrieves the registered (weakly typed) item controller for a given domain
	 */
	controllerFor(si_domain: DomainLabel): GenericItemController | undefined {
		return this._h_controllers[si_domain];
	}
}
