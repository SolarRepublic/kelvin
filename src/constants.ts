import type {SerVaultHashParams} from './types';

import {buffer, text_to_buffer} from '@blake.regalia/belt';
import {ATU8_SHA256_STARSHELL, random_bytes} from '@solar-republic/crypto';

// uint specifying system version for database compatibility
export const N_SYSTEM_VERSION = 2;


// maximum value of an unsigned 64-bit integer
export const XG_UINT64_MAX = (2n ** 64n) - 1n;


// target number of argon hashing iterations
export const N_ARGON2_ITERATIONS = import.meta.env?.DEV? 8: 21;

// target memory value to use for argon hashing parameter, in bytes
export const NB_ARGON2_MEMORY = (import.meta.env?.DEV? 16: 32) * 1024;

// target parallelism
export const N_ARGON2_PARALLELISM = 2;

// TODO: clarify what this is used for, could be 96 bits
// // size of the nonce
// export const NB_NONCE = 32;

// size of hmac-sha256 salt in bytes (256 bits)
export const NB_SHA256_SALT = 256 >> 3;

// size of derived AES key in bits
const NI_DERIVED_AES_KEY = 256;

// once this threshold is exceeded, do not enqueue any more recryption operations
export const NB_RECRYPTION_THRESHOLD = 32 * 1024;  // 64 KiB

// cache dummy values to estimate time to completion
export const ATU8_DUMMY_PHRASE = text_to_buffer('32-character-long-dummy-password');
export const ATU8_DUMMY_VECTOR = random_bytes(16);

// algorithm options for deriving root signing key
export const GC_DERIVE_ROOT_SIGNING = {
	name: 'HMAC',
	hash: 'SHA-256',
};

// algorithm options for deriving root encryption/decryption key
export const GC_DERIVE_ROOT_CIPHER = {
	name: 'AES-GCM',
	length: NI_DERIVED_AES_KEY,
};

// params for hkdf common to all cases (salt gets overridden)
export const GC_HKDF_COMMON = {
	name: 'HKDF',
	hash: 'SHA-256',
	salt: ATU8_SHA256_STARSHELL,
	info: Uint8Array.from([]),
};

// default params for passphrase hashing
export const G_DEFAULT_HASHING_PARAMS: SerVaultHashParams = {
	algorithm: 'argon2id',
	iterations: N_ARGON2_ITERATIONS,
	memory: NB_ARGON2_MEMORY,
	parallelism: N_ARGON2_PARALLELISM,
};
