import {buffer, hex_to_buffer, text_to_buffer} from '@blake.regalia/belt';
import {ATU8_SHA256_STARSHELL} from '@solar-republic/crypto';


// maximum value of an unsigned 64-bit integer
export const XG_UINT64_MAX = (2n ** 64n) - 1n;


// target number of argon hashing iterations
export const N_ARGON2_ITERATIONS = import.meta.env?.DEV? 8: 21;

// target memory value to use for argon hashing parameter, in bytes
export const NB_ARGON2_MEMORY = import.meta.env?.DEV? 1024: 32 * 1024;  // 32 KiB

// size of the nonce
export const NB_NONCE = 32;

// size of derived AES key in bits
const NI_DERIVED_AES_KEY = 256;

// once this threshold is exceeded, do not enqueue any more recryption operations
export const NB_RECRYPTION_THRESHOLD = 32 * 1024;  // 64 KiB

// cache dummy values to estimate time to completion
export const ATU8_DUMMY_PHRASE = text_to_buffer('32-character-long-dummy-password');
export const ATU8_DUMMY_VECTOR = crypto.getRandomValues(buffer(16));

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
