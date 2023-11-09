import type {A} from 'ts-toolbelt';

import type {Dict, IntStr, NaiveBase64, NaiveHexLower, JsonObject, JsonValue, JsonArray} from '@blake.regalia/belt';


/**
 * A Domain's unique human-readable label
 */
export type DomainLabel = A.Type<string, 'domain-label'>;

/**
 * Encodes a Domain to a base92 index
 */
export type DomainCode = A.Type<string, 'domain-code'>;

/**
 * An Item's ID, made up of a {@link DomainCode} and an {@link ItemPath}
 */
export type ItemIdent = A.Type<`${string}:${string}`, 'item-ident'>;

/**
 * The part of an Item's ID that is unique within its domain
 */
export type ItemPath = A.Type<string, 'item-path'>;

/**
 * Encodes an Item to a uint index
 */
export type ItemCode = A.Type<number, 'item-code'>;


/**
 * An Index's unique human-readable label (and key)
 */
export type IndexLabel = A.Type<string, 'index-label'>;

/**
 * A possible value for a particular Index
 */
export type IndexValue = A.Type<string, 'index-value'>;

/**
 * The position of an Item ID in an Index list
 */
export type IndexPosition = A.Type<number, 'index-position'>;


/**
 * Encodes a Bucket to a uint index
 */
export type BucketCode = A.Type<number, 'bucket-code'>;

/**
 * The plaintext storage key of a bucket
 */
export type BucketKey = A.Type<string, 'bucket-key'>;


export type LockSpecifier = A.Type<string, 'lock-specifier'>;

export type LockId = A.Type<string, 'lock-id'>;



type Sequence<
	w_item,
	w_key extends number=number,
> = A.Cast<Omit<Array<w_item>, 'shift' | 'unshift' | 'reverse' | 'sort' | 'indexOf' | 'lastIndexOf' | 'push'> & {
	indexOf(w_find: w_item, i_from?: number): w_key;
	lastIndexOf(w_find: w_item, i_from?: number): w_key;
	push(...items: w_item[]): w_key;
}, JsonArray>;



/**
 * Serialized argon hashing params
 */
export type SerVaultHashParams = {
	/**
	 * Hashing algorithm identifier
	 */
	algorithm: 'argon2id';

	/**
	 * The Argon2id iterations parameter
	 */
	iterations: number;

	/**
	 * The Argon2id memory parameter, in bytes
	 */
	memory: number;

	/**
	 * The Argon2id parallelism parameter
	 */
	parallelism: number;
};


/**
 * Serialized encryption metadata
 */
export type SerVaultBase = {
	/**
	 * The version number of the Vault implementation
	 */
	version: number;

	/**
	 * Globally unique entropy used when deriving nonce that gets applied to password hashing function when deriving root key.
	 * Once set, it never needs to change.
	 */
	entropy: NaiveBase64;

	/**
	 * An overflowable Uint128 that increments each time the Vault is (re)encrypted. Initialized to a random number.
	 */
	nonce: IntStr;

	/**
	 * The result of signing `sha256("starshell")`, used to verify a root key.
	 */
	signature: NaiveBase64;

	/**
	 * A random salt used when performing HKDF to derive the cipher key and signing key.
	 */
	salt: NaiveBase64;

	/**
	 * The passphrase hashing params
	 */
	params: SerVaultHashParams;
};



/**
 * 
 */
export type SerShapeFieldSwitch = [
	/**
	 * Label of the field
	 */
	si_field: string,

	/**
	 * Index of field being switched on
	 */
	i_switch: number,

	/**
	 * Maps switch values to subschemas
	 */
	a_options: JsonValue[] | JsonObject,
];

export type SerShapeFieldTagged = {
	s: SerShapeFieldSwitch;
};

export type SerShapeField = string | SerShapeFieldStruct | SerShapeFieldTagged;

export type SerShapeFieldStruct = [s_label: string, ...a_members: SerShapeField[]];

/**
 * 
 */
export type SerShape = [
	/**
	 * Identifies the schema version for this shape's encoding
	 */
	n_schema: number,

	/**
	 * Labels for the key parts of the item
	 */
	a_keys: string[],

	/**
	 * Labels and nested structs for the fields of the item
	 */
	a_fields: SerShapeField[],
];

/**
 * 
 */
export type SerBucket = {
	/**
	 * Schema shape of stored items
	 */
	shape: SerShape;

	/**
	 * Locates item to its position in the serialized
	 */
	items: Record<ItemCode, JsonArray>;
};

/**
 * Serialized database hub object
 */
export type SerVaultHub = {
	/**
	 * Domain labels stored in sequence
	 */
	domains: Sequence<DomainLabel>;

	/**
	 * Item idents stored in a sparse sequence
	 */
	items: Sequence<ItemIdent, ItemCode>;

	/**
	 * Indexes keyed by their name, storing a dict of item codes keyed by the index's value
	 */
	indexes: Dict<Dict<ItemCode[]>>;

	/**
	 * Bucket storage keys stored in sequence
	 */
	buckets: Sequence<BucketKey, BucketCode>;

	/**
	 * Locates each item to the Bucket it is stored in
	 */
	locations: Sequence<ItemCode, BucketCode>;
};
