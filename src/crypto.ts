import type {RootKeyStruct} from './auth';
import type {KelvinKeyValueWriter} from './store';

import {ATU8_NIL, F_NOOP, concat2, entries, sha256, text_to_bytes} from '@blake.regalia/belt';
import {aes_gcm_decrypt, aes_gcm_encrypt, random_bytes, sha256_sync_wasm, sha256_sync_wasm_load} from '@solar-republic/crypto';

import {derive_cipher_key, derive_cipher_nonce, test_encryption_integrity} from './auth';
import {ATU8_DUMMY_PHRASE, NB_RECRYPTION_THRESHOLD, XB_NONCE_PREFIX_VERSION} from './constants';
import {VaultCorruptedError} from './errors';


// test encryption integrity
async function test_integrity(
	dk_root_old: CryptoKey,
	atu8_vector_old: Uint8Array,
	atu8_vector_new: Uint8Array,
	atu8_salt: Uint8Array,
	dk_aes_new: CryptoKey
) {
	// prep dummy vector
	const atu8_vector = await sha256(text_to_bytes('dummy'));

	// prepare nonces
	const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
		derive_cipher_nonce(atu8_vector_old, atu8_vector, 96),
		derive_cipher_nonce(atu8_vector_new, atu8_vector, 96),
	]);

	// derive temporary old cipher key capable of encrypting, scoped to this block only
	const dk_aes_old_tmp = await derive_cipher_key(dk_root_old, atu8_salt, true);

	// run integrity tests
	await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_old_tmp, atu8_nonce_old);
	await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_new, atu8_nonce_new);
}

// creates cipher nonce for the given key
export async function create_cipher_nonce(
	si_key: string,
	atu8_ent: Uint8Array,
	atu8_vector: Uint8Array
): Promise<Uint8Array> {
	// create salt
	const atu8_salt = await sha256(concat2(text_to_bytes(si_key), atu8_ent));

	// derive nonce for aes
	return derive_cipher_nonce(atu8_vector, atu8_salt, 96);
}

// consistent method for producing the nonce to use when decrypting
export async function read_nonce_for_entry(
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
	const atu8_nonce = await create_cipher_nonce(si_key, atu8_ent, atu8_vector);

	// return nonce and cipher
	return [atu8_nonce, atu8_cipher];
}


// consistent method for producing the nonce to use when encrypting
export async function write_nonce_for_entry(
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
	const atu8_nonce = await create_cipher_nonce(si_key, atu8_ent, atu8_vector);

	// return nonce and value
	return [atu8_nonce, atu8_prefix];
}


/**
 * @internal
 * @param g_root_old 
 * @param g_root_new 
 * @param f_info 
 */
export async function rotate_root_key(
	kw_content: KelvinKeyValueWriter,
	g_root_old: RootKeyStruct,
	g_root_new: RootKeyStruct,
	atu8_salt: Uint8Array,
	f_info: ((s_state: string) => void)=F_NOOP
): Promise<CryptoKey> {
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
		derive_cipher_key(dk_root_old, atu8_salt, false),
		derive_cipher_key(dk_root_new, atu8_salt, true),
	]);

	// test encryption integrity
	await test_integrity(dk_root_old, atu8_vector_old, atu8_vector_new, atu8_salt, dk_aes_new);

	// get keys of encrypted entries
	const a_keys = (await k_reader.getAllKeys()).filter(si_key => /^[#_]/.test(si_key));

	// load entries
	const h_entries = await k_reader.getBytesMany(a_keys);

	// each entry
	for(const [si_key, atu8_value] of entries(h_entries)) {
		// prepare old and new nonces
		const [[atu8_nonce_old, atu8_cipher], [atu8_nonce_new]] = await Promise.all([
			read_nonce_for_entry(si_key, atu8_value, atu8_vector_old),
			read_nonce_for_entry(si_key, atu8_value, atu8_vector_new),
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
