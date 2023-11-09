import type {LockTarget_StorageLocal} from './ids';
import type {JsonKeyValueStore} from './store';
import type {SerVaultHub, SerVaultBase, SerVaultHashParams, LockSpecifier, BucketKey, SerBucket} from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {AesGcmDecryptionError} from '@solar-republic/crypto';

import {base64_to_buffer, base93_to_buffer, bigint_to_buffer_be, buffer_to_base64, buffer_to_json, F_NOOP, is_dict_es, ode, type NaiveBase64, type NaiveBase93, buffer, text_to_buffer, buffer_to_base93, defer, type JsonValue, type JsonObject, json_to_buffer, buffer_to_text, ATU8_NIL, concat2, concat, buffer_to_bigint_be} from '@blake.regalia/belt';

import {aes_gcm_decrypt, aes_gcm_encrypt, random_bytes} from '@solar-republic/crypto';
import {sha256_sync} from '@solar-republic/crypto/sha256';


import {derive_cipher_key, derive_tandem_root_keys, generate_root_signature, import_key, verify_root_key, type RootKeyStruct, derive_cipher_nonce, test_encryption_integrity, nonce_for_storage_entry} from './auth';
import {ATU8_DUMMY_PHRASE, G_DEFAULT_HASHING_PARAMS, NB_RECRYPTION_THRESHOLD, NB_SHA256_SALT, N_SYSTEM_VERSION} from './constants';
import {Bug, InvalidPassphraseError, InvalidSessionError, RecoverableVaultError, RefuseDestructiveActionError, VaultClosedError, VaultCorruptedError, VaultDamagedError} from './errors';
import {SI_KEY_STORAGE_BASE, SI_KEY_STORAGE_HUB, SI_KEY_SESSION_ROOT, SI_KEY_SESSION_VECTOR, SI_KEY_SESSION_AUTH, SI_LOCK_SESSION_ALL, SI_LOCK_CONTENT_ALL} from './ids';
import {SingleThreadedLockManager, type SimpleLockManager} from './locks';
import {VaultHub} from './vault-hub';


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

type StoreContent = JsonKeyValueStore<SchemaContent>;
type StoreSession = JsonKeyValueStore<SchemaSession>;

// stores the private fields of an Vault instance
const hm_privates = new WeakMap<VaultClient, VaultFields>();

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
export class VaultClient {
	static async connect(
		k_storage: JsonKeyValueStore,
		k_session: JsonKeyValueStore,
		y_locks: LockManager
	): Promise<VaultClient> {
		return new VaultClient(k_storage as StoreContent, k_session as StoreSession, y_locks).connect();
	}

	// storage
	protected _k_content: StoreContent;
	protected _k_session: StoreSession;

	// connection state
	protected _xc_connection = ConnectionState.NOT_CONNECTED;

	// unmarshalled base
	protected _atu8_entropy!: Uint8Array;
	protected _xg_nonce!: bigint;
	protected _atu8_signature!: Uint8Array;
	protected _atu8_salt!: Uint8Array;
	protected _g_params!: SerVaultHashParams;

	// once the vault is opened, the hub can be accessed
	protected _k_hub!: VaultHub;

	protected _a_awaiting_open: ((k_hub: VaultHub) => any)[] = [];

	// for removing change event listeners
	protected _fk_unlisten_base: () => void = F_NOOP;
	protected _fk_unlisten_hub: () => void = F_NOOP;

	// dirty indicator
	protected _b_dirty = false;

	constructor(
		k_content: JsonKeyValueStore,
		k_session: JsonKeyValueStore,
		protected _y_locks: SimpleLockManager=new SingleThreadedLockManager()
	) {
		this._k_content = k_content as StoreContent;
		this._k_session = k_session as StoreSession;

		// monitor changes to base
		this._fk_unlisten_base = this._k_content.onEntryChanged(SI_KEY_STORAGE_BASE, (g_new, g_old) => {
			// read as json
			const g_base = g_new.asJson<SerVaultBase>();

			// base was deleted
			if(!g_base) {
				throw new VaultCorruptedError(`base was deleted. in case this was an accident, the previous value can be restored using the following JSON:\n${JSON.stringify(g_old)}`);
			}

			// load base
			this._load_base(g_base);
		});
	}

	// access the raw lock manager
	get lockManager(): SimpleLockManager {
		return this._y_locks;
	}

	// access the raw content storage instance
	get contentStore(): JsonKeyValueStore {
		return this._k_content;
	}

	// access the raw session storage instance
	get sessionStore(): JsonKeyValueStore {
		return this._k_session;
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
		const atu8_hub_plain = await this._decrypt_entry(SI_KEY_STORAGE_HUB, atu8_hub_cipher, atu8_vector, dk_cipher);

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

	// test encryption integrity
	protected async _test_integrity(
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
	protected _create_cipher_nonce(
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
	protected async _read_nonce_for_entry(
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
			if(atu8_value[0] > 0) {
				throw new VaultCorruptedError(`Database was encoded using a newer version of the software (${atu8_ent[0]}) or it is corrupted. Unable to decode`);
			}

			// get extra entropy from beginning of value
			atu8_ent = atu8_value.subarray(1, 17);

			// adjust ciphertext
			atu8_cipher = atu8_value.subarray(17);
		}

		// derive nonce
		const atu8_nonce = await this._create_cipher_nonce(si_key, atu8_ent, atu8_vector);

		// return nonce and cipher
		return [atu8_nonce, atu8_cipher];
	}

	// consistent method for producing the nonce to use when encrypting
	protected async _write_nonce_for_entry(
		si_key: string,
		atu8_cipher: Uint8Array,
		atu8_vector: Uint8Array
	): Promise<[
		atu8_nonce: Uint8Array,
		atu8_value: Uint8Array,
	]> {
		// extra entropy if needed
		let atu8_ent = ATU8_NIL;

		// output value (default to ciphertext)
		let atu8_value = atu8_cipher;

		// key is plaintext
		if('#' === si_key[0]) {
			// create extra entropy
			atu8_ent = random_bytes(16);

			// prepend entropy to output value
			atu8_value = concat2(atu8_ent, atu8_cipher);

			// prepend version byte
			atu8_value = concat2(Uint8Array.from([0]), atu8_value);
		}

		// derive nonce
		const atu8_nonce = await this._create_cipher_nonce(si_key, atu8_ent, atu8_vector);

		// return nonce and value
		return [atu8_nonce, atu8_value];
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
		const [atu8_nonce, atu8_cipher] = await this._read_nonce_for_entry(si_key, atu8_value, atu8_vector || g_privates.atu8_vector!);

		// decrypt the value
		return await aes_gcm_decrypt(atu8_cipher, dk_cipher || g_privates.dk_cipher!, atu8_nonce);
	}

	// encrypt an entry
	protected async _encrypt_entry(
		si_key: string,
		atu8_cipher: Uint8Array,
		atu8_vector?: Uint8Array,
		dk_cipher?: CryptoKey
	): Promise<Uint8Array> {
		// save/update private field
		const g_privates = hm_privates.get(this)!;

		// derive the nonce
		const [atu8_nonce, atu8_value] = await this._write_nonce_for_entry(si_key, atu8_cipher, atu8_vector || g_privates.atu8_vector!);

		// decrypt the value
		return await aes_gcm_encrypt(atu8_value, dk_cipher || g_privates.dk_cipher!, atu8_nonce);
	}

	/**
	 * @internal
	 * @param g_root_old 
	 * @param g_root_new 
	 * @param f_info 
	 * @returns new cipher key
	 */
	async _rotate_root_key(
		g_root_old: RootKeyStruct,
		g_root_new: RootKeyStruct,
		f_info: ((s_state: string) => void)=F_NOOP
	): Promise<Uint8Array> {
		// destructure fields
		const {
			_atu8_salt,
			_y_locks,
			_k_content,
		} = this;

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
		await this._test_integrity(dk_root_old, atu8_vector_old, atu8_vector_new, _atu8_salt, dk_aes_new);

		// get keys of encrypted entries
		const a_keys = (await _k_content.getAllKeys()).filter(si_key => /^[#_]/.test(si_key));

		// load entries
		const h_entries = await _k_content.getBytesMany(a_keys);

		// each entry
		for(const [si_key, atu8_value] of ode(h_entries)) {
			// prepare old and new nonces
			const [[atu8_nonce_old, atu8_cipher], [atu8_nonce_new]] = await Promise.all([
				this._read_nonce_for_entry(si_key, atu8_value, atu8_vector_old),
				this._read_nonce_for_entry(si_key, atu8_value, atu8_vector_new),
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
				await _k_content.setBytes(si_key, atu8_replace);

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
	}


	// initialize the connection
	async connect(): Promise<this> {
		// set connection state
		this._xc_connection = ConnectionState.CONNECTING;

		// fetch base object
		const g_base = await this._k_content.getJson<SerVaultBase>(SI_KEY_STORAGE_BASE);

		// not exists
		if(!g_base) {
			// update state
			this._xc_connection = ConnectionState.NON_EXISTANT;

			// exit
			return this;
		}

		// load the base object
		this._load_base(g_base);

		// fetch root key
		const a_root_key = await this._k_session.getJson<SerSessionRootKey>(SI_KEY_SESSION_ROOT);

		// load the root root
		await this._load_root_key(a_root_key);

		// done
		return this;
	}


	/**
	 * Checks whether or not the vault exists
	 * @returns `true` if it exists, `false` otherwise
	 */
	exists(): boolean {
		// depending on connection state
		switch(this._xc_connection) {
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
				throw Error(`Unhandled connection state: ${this._xc_connection as string}`);
			}
		}
	}


	/**
	 * Check if the vault is already unlocked
	 * @returns `true` if it is unlocked, `false` otherwise
	 */
	isUnlocked(): boolean {
		// not connected
		if(ConnectionState.CONNECTED !== this._xc_connection) {
			throw Error(`Cannot access vault which is not connected: ${this._xc_connection}`);
		}

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// root key's presence indicates unlocked status
		return !!g_privates?.dk_root;
	}


	/**
	 * Attempt to unlock the vault. If successful, the root key will be rotated.
	 * @param atu8_phrase - secret passphrase, text should be normalized before encoded
	 * @param b_recovering - caller acknowledges this is a recovery effort (storage is partially transcrypted)
	 * @param f_info - optional callback to provide with update messages during the process
	 * @returns 
	 */
	async unlock(
		atu8_phrase: Uint8Array,
		b_recovering=false,
		f_info: ((s_state: string) => void)=F_NOOP
	): Promise<void> {
		// destructure fields
		const {
			_atu8_salt,
			_atu8_entropy,
			_xg_nonce,
			_g_params,
			_atu8_signature,
			_y_locks,
			_k_session,
		} = this;

		// bind to session root key changes

		// verbose
		f_info('Waiting for session lock');

		// obtain write lock to session
		await _y_locks.request(SI_LOCK_SESSION_ALL, {mode:'exclusive'}, async() => {
			// verbose
			f_info('Deriving root keys');

			// derive root keys
			const {
				old: g_root_old,
				new: g_root_new,
				export: kn_root_new,
			} = await derive_tandem_root_keys(atu8_phrase, _atu8_entropy, _xg_nonce, _g_params, true);

			// in case of failure, zero out key material
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

				// set new root key in session
				await _k_session.setStringMany({
					[SI_KEY_SESSION_ROOT]: buffer_to_base64(kn_root_new!.data),
				});
			}
			// before throwing, zero-out key material
			finally {
				kn_root_new?.wipe();
			}

			// rotate root key
			await this._rotate_root_key(g_root_old, g_root_new, f_info);

			// update session
			{
				// verbose
				f_info('Updating session');

				// create session auth private key
				const atu8_auth = random_bytes(32);

				// save/update to private field
				hm_privates.set(this, {
					...hm_privates.get(this)!,
					dk_cipher: g_root_new.key,
					atu8_vector: g_root_new.vector,
					atu8_auth,
				});

				// save to session storage
				await this._k_session.setStringMany({
					[SI_KEY_SESSION_VECTOR]: buffer_to_base64(g_root_new.vector),
					[SI_KEY_SESSION_AUTH]: buffer_to_base64(atu8_auth),
				});
			}

			// verbose
			f_info('Generating signature');

			// generate new signature
			const atu8_signature_new = await generate_root_signature(g_root_new.key, _atu8_salt);

			// verbose
			f_info('Saving to storage');

			// serialize the new base
			const g_base: SerVaultBase = {
				version: N_SYSTEM_VERSION,
				entropy: buffer_to_base64(_atu8_entropy),
				nonce: `${g_root_new.nonce}`,
				signature: buffer_to_base64(atu8_signature_new),
				salt: buffer_to_base64(_atu8_salt),
				params: _g_params,
			};

			// write to storage (this will trigger a change and call _load_base again -- that's fine)
			await this._k_content.setJson(SI_KEY_STORAGE_BASE, g_base);

			// verbose
			f_info('Done');
		});
	}

	async register(
		atu8_phrase: Uint8Array,
		f_info: ((s_state: string) => void)=F_NOOP
	) {
		// cannot create on database that already exists
		if(this.exists()) {
			throw new RefuseDestructiveActionError('attempted to register new vault where one already exists');
		}

		// acquire write lock
		return this._y_locks.request(SI_LOCK_CONTENT_ALL, {mode:'exclusive'}, async() => {
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
					nonce: xg_nonce_new,
				},
			} = await derive_tandem_root_keys(atu8_phrase, atu8_entropy, xg_nonce_init);

			// verbose
			f_info('Generating signature');

			// create salt
			const atu8_salt = this._atu8_salt = random_bytes(NB_SHA256_SALT);

			// generate signature
			const atu8_signature = await generate_root_signature(dk_root_new, atu8_salt);

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

			// write to storage (this will trigger a change and call _load_base)
			await this._k_content.setJson(SI_KEY_STORAGE_BASE, g_base);
		});
	}

	/**
	 * Attempt to open the unlocked vault. Throws {@link AesGcmDecryptionError} if passphrase is wrong
	 * @returns a {@link VaultHub}
	 */
	async open(): Promise<VaultHub> {
		// vault is already open
		if(this._k_hub) return this._k_hub;

		// destructure fields
		const {
			_k_content,
		} = this;

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// no root key
		if(!g_privates?.dk_root) {
			throw Error('Cannot open a locked vault without authenticating');
		}

		// listen for hub changes
		this._fk_unlisten_hub = _k_content.onEntryChanged(SI_KEY_STORAGE_HUB, async(g_new) => {
			// resolve value as bytes
			const atu8_hub = g_new.asBytes();

			// hub changed
			if(atu8_hub) {
				// decrypt
				const g_hub = await this._load_hub(atu8_hub);

				// update hub
				this._k_hub._update(g_hub);
			}
			// value was deleted
			else {
				throw new VaultCorruptedError('hub was deleted');
			}
		});

		// TODO: obtian a read lock?

		// fetch the hub data
		const atu8_hub = await _k_content.getBytes(SI_KEY_STORAGE_HUB);

		// load hub
		const g_hub = await this._load_hub(atu8_hub);

		// create hub
		const k_hub = this._k_hub = new VaultHub(this, g_hub);

		// queue calling back awaiters
		queueMicrotask(() => {
			// copy list before calling to avoid possible infinite recursion
			const a_awaiters = this._a_awaiting_open.slice();

			// clear awaiters list
			this._a_awaiting_open.length = 0;

			// start calling
			for(const fk_opened of a_awaiters) {
				fk_opened(k_hub);
			}
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

		// get deferred promise
		const [dp_open, fk_resolve] = defer();

		// push resolver to list
		this._a_awaiting_open.push(fk_resolve);

		// return promise
		return dp_open;
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


	/**
	 * @internal
	 * @param a_specifiers 
	 * @param f_use 
	 */
	acquire<w_return>(a_specifiers: LockSpecifier[], f_use: () => Promise<w_return>): Promise<w_return> {
		const a_ids: LockId[] = [];

		for(const si_specifier of a_specifiers) {
			si_specifier;
		}
	}

	acquireStorageLocal<w_return>(a_targets: LockTarget_StorageLocal[], f_use: () => Promise<w_return>): Promise<w_return> {
		// 
		// this._y_locks.request()
		/*
			storage:local:hub:indexes:msg.type
			storage:local:hub:indexes:*
			storage:local:hub:*
			storage:local
		*/

		for(const si_specifier of a_specifiers) {
			const a_parts = si_specifier.split(':');
		}
	}


	async readBucket(si_key: BucketKey): Promise<SerBucket> {
		// no cipher key
		if(!this._dk_cipher) {
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

	writeBucket(si_key: BucketKey, w_contents: SerBucket): Promise<void> {
		// obtain write lock
		return this._y_locks.request(SI_LOCK_CONTENT_ALL, async() => {
			// no cipher key
			if(!this._dk_cipher) {
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

			// encrypt
			const atu8_value = await this._encrypt_entry(si_key, atu8_bucket_plain);

			// attempt to encode bucket contents & write to storage
			try {
				await this._k_content.setBytes(si_key, atu8_value);
			}
			catch(e_encode) {
				throw new Bug('unable to encode/write ciphertext bucket contents');
			}
		});
	}
}
