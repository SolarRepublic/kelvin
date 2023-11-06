import type {LockTarget_StorageLocal} from './ids';
import type {JsonKeyValueStore, SerVaultHub, SerVaultBase, SerVaultHashParams, LockSpecifier} from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {AesGcmDecryptionError} from '@solar-republic/crypto';

import {base64_to_buffer, base93_to_buffer, bigint_to_buffer_be, buffer_to_base64, buffer_to_json, F_NOOP, is_dict_es, ode, type NaiveBase64, type NaiveBase93, buffer, text_to_buffer, buffer_to_base93, defer} from '@blake.regalia/belt';

import {aes_gcm_decrypt, aes_gcm_encrypt} from '@solar-republic/crypto';
import {sha256_sync} from '@solar-republic/crypto/sha256';


import {derive_cipher_key, derive_tandem_root_keys, generate_root_signature, import_key, verify_root_key, type RootKeyStruct, derive_cipher_nonce, test_encryption_integrity} from './auth';
import {ATU8_DUMMY_PHRASE, NB_NONCE, NB_RECRYPTION_THRESHOLD} from './constants';
import {InvalidPassphraseError, InvalidSessionError, RecoverableVaultError, VaultClosedError, VaultCorruptedError, VaultDamagedError} from './errors';
import {SI_KEY_STORAGE_BASE, SI_KEY_STORAGE_HUB, SI_KEY_SESSION_ROOT, SI_KEY_SESSION_VECTOR, SI_KEY_SESSION_AUTH, SI_LOCK_SESSION_ALL, SI_LOCK_LOCAL_ALL} from './ids';
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
};

export type SchemaLocal = {
	[SI_KEY_STORAGE_BASE]: SerVaultBase;
	[SI_KEY_STORAGE_HUB]: NaiveBase93;
};

export type SchemaSession = {
	[SI_KEY_SESSION_ROOT]: NaiveBase64;
	[SI_KEY_SESSION_VECTOR]: NaiveBase64;
	[SI_KEY_SESSION_AUTH]: NaiveBase64;
};

type StoreLocal = JsonKeyValueStore<SchemaLocal>;
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
		return new VaultClient(k_storage as StoreLocal, k_session as StoreSession, y_locks)._init();
	}

	// connection state
	protected _xc_connection = ConnectionState.NOT_CONNECTED;

	// unmarshalled base
	protected _atu8_entropy!: Uint8Array;
	protected _xg_nonce!: bigint;
	protected _atu8_signature!: Uint8Array;
	protected _atu8_salt!: Uint8Array;
	protected _g_params!: SerVaultHashParams;

	protected _k_hub!: VaultHub;

	protected _a_awaiting_open: ((k_hub: VaultHub) => any)[] = [];

	// dirty indicator
	protected _b_dirty = false;

	constructor(
		protected _k_local: StoreLocal,
		protected _k_session: StoreSession,
		protected _y_locks: LockManager=navigator.locks
	) {
		_k_local.onChange<SerVaultBase>(SI_KEY_STORAGE_BASE, (g_base) => {
			this._load_base(g_base);
		});
	}

	// access the raw lock manager
	get lockManager(): LockManager {
		return this._y_locks;
	}

	// initialize the connection
	protected async _init(): Promise<this> {
		// set connection state
		this._xc_connection = ConnectionState.CONNECTING;

		// fetch base object
		const g_base = await this._k_local.get<SerVaultBase>(SI_KEY_STORAGE_BASE);

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
		const a_root_key = await this._k_session.get<SerSessionRootKey>(SI_KEY_SESSION_ROOT);

		// load the root root
		await this._load_root_key(a_root_key);

		// done
		return this;
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
		const g_privates = hm_privates.get(this);
		hm_privates.set(this, {
			...g_privates,
			dk_root,
		});
	}

	// load the hub from storage and decrypt it
	protected async _load_hub(sb93_hub: NaiveBase93, dk_root: CryptoKey): Promise<SerVaultHub> {
		// attempt to decode hub
		let atu8_hub_cipher: Uint8Array;
		try {
			atu8_hub_cipher = base93_to_buffer(sb93_hub);
		}
		// corrupted hub
		catch(e_decode) {
			throw new VaultCorruptedError('unable to decode hub bytes');
		}

		// derive cipher key
		const dk_cipher = await derive_cipher_key(dk_root, this._atu8_salt);

		// prep nonce
		const atu8_nonce = bigint_to_buffer_be(this._xg_nonce, NB_NONCE);

		// decrypt. let it fail if root key is wrong
		const atu8_hub_plain = await aes_gcm_decrypt(atu8_hub_cipher, dk_cipher, atu8_nonce);

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

	protected async _rotate_root_key(
		g_root_old: RootKeyStruct,
		g_root_new: RootKeyStruct,
		f_update: ((s_state: string) => void)=F_NOOP
	) {
		// destructure fields
		const {
			_atu8_salt,
			_y_locks,
			_k_local,
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

		// update
		f_update('Rotating root key');

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
		{
			// prepare nonces
			const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
				derive_cipher_nonce(atu8_vector_old, sha256_sync(text_to_buffer('dummy')), 96),
				derive_cipher_nonce(atu8_vector_new, sha256_sync(text_to_buffer('dummy')), 96),
			]);

			// derive temporary old cipher key capable of encrypting, scoped to this block only
			const dk_aes_old_tmp = await derive_cipher_key(dk_root_old, _atu8_salt, true);

			// run integrity tests
			await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_old_tmp, atu8_nonce_old);
			await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_new, atu8_nonce_new);
		}

		// obtain write lock to local
		await _y_locks.request(SI_LOCK_LOCAL_ALL, {mode:'exclusive'}, async() => {
			// load everything
			const h_local = await _k_local.getAll();

			// each key
			for(const [si_key, w_value] of ode(h_local)) {
				// not an encrypted entry; skip
				if(!/^[#_]/.test(si_key) || !w_value) continue;

				// invalid value
				if('string' !== typeof w_value) {
					throw new VaultDamagedError(`non-string value at "${si_key}"`);
				}

				// attempt to decode the value
				let atu8_cipher: Uint8Array;
				try {
					atu8_cipher = base93_to_buffer(w_value);
				}
				// not decodeable
				catch(e_decode) {
					throw new VaultDamagedError(`cannot decode value at "${si_key}"`);
				}

				// prepare nonces
				const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
					derive_cipher_nonce(atu8_vector_old, sha256_sync(text_to_buffer(si_key)), 96),
					derive_cipher_nonce(atu8_vector_new, sha256_sync(text_to_buffer(si_key)), 96),
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
					await _k_local.set(si_key, buffer_to_base93(atu8_replace));

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
		});
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
	 * @param f_update - optional callback to provide with update messages during the process
	 * @returns 
	 */
	async unlock(
		atu8_phrase: Uint8Array,
		b_recovering=false,
		f_update: ((s_state: string) => void)=F_NOOP
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

		// update
		f_update('Waiting for session lock');

		// obtain write lock to session
		await _y_locks.request(SI_LOCK_SESSION_ALL, {mode:'exclusive'}, async() => {
			// update
			f_update('Deriving root keys');

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

				// create session auth private key
				const atu8_auth = crypto.getRandomValues(buffer(32));

				// set session
				await _k_session.setMany({
					[SI_KEY_SESSION_ROOT]: buffer_to_base64(kn_root_new!.data),
					[SI_KEY_SESSION_VECTOR]: buffer_to_base64(g_root_new.vector),
					[SI_KEY_SESSION_AUTH]: buffer_to_base64(atu8_auth),
				});

				// wipe root key material
				kn_root_new?.wipe();

				// rotate root key
				await this._rotate_root_key(g_root_old, g_root_new, f_update);

				// update
				f_update('Done');
			}
			// before throwing, zero-out key material
			finally {
				kn_root_new?.wipe();
			}
		});

		return this.open();
	}


	/**
	 * Attempt to open the unlocked vault. Throws {@link AesGcmDecryptionError} if passphrase is wrong
	 * @returns a {@link VaultHub}
	 */
	async open(): Promise<void> {
		// destructure fields
		const {
			_k_local,
		} = this;

		// get root key from private field
		const g_privates = hm_privates.get(this);

		// no root key
		if(!g_privates?.dk_root) {
			throw Error('Cannot open a locked vault without authenticating');
		}

		// bind to hub changes
		_k_local.onChange(SI_KEY_STORAGE_HUB, () => {

		});

		// fetch the hub data
		const sb93_hub = await _k_local.get(SI_KEY_STORAGE_HUB);

		// no hub
		if(!sb93_hub) {
			throw new VaultCorruptedError('hub was missing');
		}

		// load hub
		const g_hub = await this._load_hub(sb93_hub, g_privates.dk_root);

		// create hub
		const k_hub = this._k_hub = VaultHub.create(this, g_hub);

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
	 * Directly and synchronously access the hub, assuming the vault has already been opened
	 */
	hub(): VaultHub {
		if(!this._k_hub) {
			throw new VaultClosedError('attempted to access hub prematurely');
		}

		return this._k_hub;
	}


	acquire<w_return>(a_specifiers: LockSpecifier[], f_use: () => Promise<w_return>): Promise<w_return> {
		const a_ids: LockId[] = [];

		for(const si_specifier of a_specifiers) {
			si_specifier;
		}
	}

	acquireStorageLocal<w_return>(a_targets: LockTarget_StorageLocal[], f_use: () => Promise<w_return>): Promise<w_return> {
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
}
