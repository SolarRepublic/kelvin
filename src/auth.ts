import type {SerVaultHashParams} from './types';

import {base93_to_bytes, bytes, bytes_to_base93, import_key, subtle_derive_bits, subtle_derive_key, subtle_export_key, subtle_sign, subtle_verify, zero_out, zeroize} from '@blake.regalia/belt';

import {ATU8_SHA256_STARSHELL, aes_gcm_decrypt, aes_gcm_encrypt, runtime_key_create, type RuntimeKeyHandle} from '@solar-republic/crypto';
import {argon2id_hash} from '@solar-republic/crypto/argon2';


import {GC_DERIVE_ROOT_CIPHER, GC_DERIVE_ROOT_SIGNING, GC_HKDF_COMMON, G_DEFAULT_HASHING_PARAMS, XG_UINT64_MAX} from './constants';
import {IntegrityCheckError} from './errors';


export interface RootKeyStruct {
	key: CryptoKey;
	vector: Uint8Array;
	nonce: bigint;
	params: SerVaultHashParams;
}

export interface RootKeysData {
	old: RootKeyStruct;
	new: RootKeyStruct;
	export: RuntimeKeyHandle;
}

/**
 * Derive a cipher key from a root key
 * @param dk_root - the root key
 * @param atu8_salt - some salt to use when deriving
 * @param b_encrypt - if `true`, enables the key to be used for encryption
 * @returns the derived cipher key able to decrypt (and possibly encrypt depending on arg)
 */
export const derive_cipher_key = async(
	dk_root: CryptoKey,
	atu8_salt: Uint8Array,
	b_encrypt=false
): Promise<CryptoKey> => subtle_derive_key({
	...GC_HKDF_COMMON,
	salt: atu8_salt,
}, dk_root, GC_DERIVE_ROOT_CIPHER, true, b_encrypt? ['encrypt', 'decrypt']: ['decrypt']);

/**
 * Derive a signing key from a root key
 * @param dk_root - the root key
 * @param atu8_salt - some salt to use when deriving
 * @param b_signer - if `true`, enables the key to be used for signing
 * @returns the derived signing key able to either sign or verify (depending on arg)
 */
export const derive_signing_key = async(
	dk_root: CryptoKey,
	atu8_salt: Uint8Array,
	b_signer: boolean
): Promise<CryptoKey> => subtle_derive_key({
	...GC_HKDF_COMMON,
	salt: atu8_salt,
}, dk_root, GC_DERIVE_ROOT_SIGNING, false, b_signer? ['sign']: ['verify']);


/**
 * Generate a root key's signature
 * @param dk_root - the root key
 * @param atu8_salt - some salt to use when deriving
 * @returns the signature bytes
 */
export const generate_root_signature = async(
	dk_root: CryptoKey,
	atu8_salt: Uint8Array
): Promise<Uint8Array> => {
	// derive key for signing
	const dk_sign = await derive_signing_key(dk_root, atu8_salt, true);

	// return signature
	return new Uint8Array(await subtle_sign('HMAC', dk_sign, ATU8_SHA256_STARSHELL));
};


/**
 * Verify a root key's authenticity
 */
export const verify_root_key = async(
	dk_root: CryptoKey,
	atu8_salt: Uint8Array,
	atu8_test: Uint8Array
): Promise<boolean> => {
	// derive key for verifying
	const dk_verify = await derive_signing_key(dk_root, atu8_salt, false);

	// return verification test result
	return await subtle_verify('HMAC', dk_verify, atu8_test, ATU8_SHA256_STARSHELL);
};


/**
 * Derive the root key bits using Argon2id to hash the given passphrase
 * @param atu8_phrase - the secret passphrase
 * @param atu8_nonce - the nonce bytes
 * @param g_params - hash params for Argon2id
 * @returns the root key as {@link SensitiveBytes}
 */
export async function derive_root_bits_argon2id(
	atu8_phrase: Uint8Array,
	atu8_nonce: Uint8Array,
	g_params: SerVaultHashParams,
): Promise<Uint8Array> {
	return await argon2id_hash({
		phrase: atu8_phrase,
		salt: atu8_nonce,
		iterations: g_params.iterations,
		memory: g_params.memory,
		parallelism: g_params.parallelism,
		hashLen: 32,  // 256 bits
	});
}


// /**
//  * Derive the root key
//  * @param atu8_phrase - the secret passphrase
//  * @param atu8_entropy - entropy for the vector
//  * @param xg_nonce - nonce for the vector
//  * @param g_params - hash params
//  * @returns the root key as a {@link CryptoKey}
//  */
// export async function derive_root_key(
// 	atu8_phrase: Uint8Array,
// 	atu8_entropy: Uint8Array,
// 	xg_nonce: bigint,
// 	g_params: SerVaultHashParams
// ): Promise<RootKeyStruct> {
// 	// prep array buffer (8 bytes for fixed entropy + 8 bytes for nonce)
// 	const atu8_vector = new Uint8Array(32);

// 	// set entropy into buffer at leading 16 bytes
// 	atu8_vector.set(atu8_entropy, 0);

// 	// set nonce into buffer at bottom 16 bytes
// 	const xg_nonce_hi = (xg_nonce >> 64n) & XG_UINT64_MAX;
// 	const xg_nonce_lo = xg_nonce & XG_UINT64_MAX;
// 	new DataView(atu8_vector.buffer).setBigUint64(16, xg_nonce_hi, false);
// 	new DataView(atu8_vector.buffer).setBigUint64(16+8, xg_nonce_lo, false);

// 	// derive key bits
// 	const kn_root = await derive_root_bits_argon2id(atu8_phrase, atu8_vector, g_params);

// 	// zero out passphrase data
// 	zero_out(atu8_phrase);

// 	// derive root key
// 	const dk_root = await import_key(kn_root.data, 'HKDF', ['deriveKey']);

// 	// wipe bits
// 	kn_root.wipe();

// 	return {
// 		key: dk_root,
// 		vector: atu8_vector,
// 		nonce: xg_nonce,
// 		params: g_params,
// 	};
// }


/**
 * Derives the old/new root keys used to decrypt/encrypt storage, respectively.
 * @param atu8_phrase - utf-8 encoded buffer of user's plaintext passphrase
 * @param atu8_entropy - static, 64-bit buffer (initially crypto-randomnly generated) unique to user's machine
 * @param xg_nonce_old - the 64-bit nonce that was used to encrypt storage during the previous session
 * @param b_export_new - if true, preserves and returns ref to new root key bytes; otherwise, wipes all key material
 * @returns old and new: root CryptoKey object, derivation vector bytes (entropy || nonce), and the nonce as a BigInt
 */
export async function derive_tandem_root_keys(
	atu8_phrase: Uint8Array,
	atu8_entropy: Uint8Array,
	xg_nonce_old: bigint,
	g_params_old: SerVaultHashParams=G_DEFAULT_HASHING_PARAMS,
	b_export_new=false
): Promise<RootKeysData> {
	// prep new nonce (this is intended to be reproducible in case program exits while rotating keys)
	const xg_nonce_new = (xg_nonce_old + 1n) % (2n ** 128n);

	// prep array buffer (8 bytes for fixed entropy + 8 bytes for nonce)
	const atu8_vector_old = new Uint8Array(32);
	const atu8_vector_new = new Uint8Array(32);

	// set entropy into buffer at leading 16 bytes
	atu8_vector_old.set(atu8_entropy, 0);
	atu8_vector_new.set(atu8_entropy, 0);

	// set nonce into buffer at bottom 16 bytes
	const xg_nonce_old_hi = (xg_nonce_old >> 64n) & XG_UINT64_MAX;
	const xg_nonce_old_lo = xg_nonce_old & XG_UINT64_MAX;
	new DataView(atu8_vector_old.buffer).setBigUint64(16, xg_nonce_old_hi, false);
	new DataView(atu8_vector_old.buffer).setBigUint64(16+8, xg_nonce_old_lo, false);

	// set nonce into buffer at bottom 16 bytes
	const xg_nonce_new_hi = (xg_nonce_new >> 64n) & XG_UINT64_MAX;
	const xg_nonce_new_lo = xg_nonce_new & XG_UINT64_MAX;
	new DataView(atu8_vector_new.buffer).setBigUint64(16, xg_nonce_new_hi, false);
	new DataView(atu8_vector_new.buffer).setBigUint64(16+8, xg_nonce_new_lo, false);

	// automatic migration; set new params from const
	const g_params_new: SerVaultHashParams = {
		...g_params_old,
		...G_DEFAULT_HASHING_PARAMS,
	};

	// derive the two root byte sequences for this session
	const [
		atu8_root_old,
		atu8_root_new,
	] = await Promise.all([
		derive_root_bits_argon2id(atu8_phrase, atu8_vector_old, g_params_old),
		derive_root_bits_argon2id(atu8_phrase, atu8_vector_new, g_params_new),
	]);

	// zeroize passphrase data
	zeroize(atu8_phrase);

	// import keys
	const [
		dk_root_old,
		dk_root_new,
	] = await Promise.all([
		import_key(atu8_root_old, {name:'HKDF'}, ['deriveKey']),
		import_key(atu8_root_new, {name:'HKDF'}, ['deriveKey']),
	]);

	// zeroize old root key
	zeroize(atu8_root_old);

	// create new runtime key (automatically zeroizes bytes)
	const gk_root_new = await runtime_key_create(atu8_root_new, 256);

	return {
		old: {
			key: dk_root_old,
			vector: atu8_vector_old,
			nonce: xg_nonce_old,
			params: g_params_old,
		},
		new: {
			key: dk_root_new,
			vector: atu8_vector_new,
			nonce: xg_nonce_new,
			params: g_params_new,
		},
		export: gk_root_new,
	};
}

/**
 * 
 * @param atu8_vector 
 * @param atu8_salt 
 * @param ni_bits 
 * @returns 
 */
export async function derive_cipher_nonce(
	atu8_vector: Uint8Array,
	atu8_salt: Uint8Array,
	ni_bits=96
): Promise<Uint8Array> {
	// import derivation key from vector
	const dk_derive = await import_key(atu8_vector, 'HKDF', ['deriveBits']);

	// derive nonce bytes
	return new Uint8Array(await subtle_derive_bits({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: atu8_salt,
		info: new Uint8Array(0),
	}, dk_derive, ni_bits));
}


/**
 * Verifies the integrity of the crypto API by checking the round trip values
 * @param atu8_data 
 * @param dk_cipher 
 * @param atu8_nonce 
 * @param atu8_verify 
 */
export async function test_encryption_integrity(
	atu8_data: Uint8Array,
	dk_cipher: CryptoKey,
	atu8_nonce: Uint8Array,
	atu8_verify=ATU8_SHA256_STARSHELL
): Promise<void> {
	try {
		const atu8_encrypted = await aes_gcm_encrypt(atu8_data, dk_cipher, atu8_nonce, atu8_verify);
		const s_encrypted = bytes_to_base93(atu8_encrypted);
		const atu8_encrypted_b = base93_to_bytes(s_encrypted);
		const atu8_decrypted = await aes_gcm_decrypt(atu8_encrypted_b, dk_cipher, atu8_nonce, atu8_verify);

		if(atu8_data.byteLength !== atu8_decrypted.byteLength) {
			throw new IntegrityCheckError('byte length mismatch');
		}

		for(let ib_each=0; ib_each<atu8_data.byteLength; ib_each++) {
			if(atu8_data[ib_each] !== atu8_decrypted[ib_each]) {
				throw new IntegrityCheckError('buffers were not identical');
			}
		}
	}
	catch(e_integrity) {
		if(e_integrity instanceof IntegrityCheckError) {
			e_integrity = new IntegrityCheckError('an error was thrown: ', e_integrity);
		}

		throw e_integrity;
	}
}
