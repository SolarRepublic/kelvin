import type {A, L} from 'ts-toolbelt';

import type {PrimitiveDatatype, TaggedDatatype} from './schema';
import type {Dict, IntStr, NaiveBase64, JsonObject, JsonValue, JsonArray, Subtype} from '@blake.regalia/belt';


/**
 * A Domain's unique human-readable label
 */
export type DomainLabel = Subtype<string, 'domain-label'>;

/**
 * Encodes a Domain to a base92 index
 */
export type DomainCode = Subtype<string, 'domain-code'>;

/**
 * An Item's ID, made up of a {@link DomainCode} and an {@link ItemPath}
 */
export type ItemIdent = Subtype<`${string}:${string}`, 'item-ident'>;

/**
 * The part of an Item's ID that is unique within its domain
 */
export type ItemPath = Subtype<string, 'item-path'>;

/**
 * Encodes an Item to a uint index
 */
export type ItemCode = Subtype<number, 'item-code'>;


/**
 * An Index's unique human-readable label (and key)
 */
export type IndexLabel = Subtype<string, 'index-label'>;

/**
 * A possible value for a particular Index
 */
export type IndexValue = Subtype<string, 'index-value'>;

/**
 * The position of an Item ID in an Index list
 */
export type IndexPosition = Subtype<number, 'index-position'>;


/**
 * Encodes a Bucket to a uint index
 */
export type BucketCode = Subtype<number, 'bucket-code'>;

/**
 * The plaintext storage key of a bucket
 */
export type BucketKey = Subtype<string, 'bucket-key'>;


export type ShapeCode = Subtype<number, 'shape-code'>;


export type FieldLabel = Subtype<string, 'field-label'>;


export type LockSpecifier = Subtype<string, 'lock-specifier'>;

export type LockId = Subtype<string, 'lock-id'>;



type Sequence<
	w_item,
	w_key extends number=number,
> = A.Cast<Omit<Array<w_item>, 'shift' | 'unshift' | 'reverse' | 'sort' | 'indexOf' | 'lastIndexOf' | 'push'> & {
	indexOf(w_find: w_item, i_from?: number): w_key;
	lastIndexOf(w_find: w_item, i_from?: number): w_key;
	push(...items: w_item[]): w_key;
}, w_item[]>;



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
export type SerFieldSwitch = [
	/**
	 * Index of field being switched on
	 */
	i_switch: number,

	/**
	 * Maps switch values to subschemas
	 */
	z_options: SerField[] | SerFieldStruct,
];

export type SerTaggedDatatype =
	| [TaggedDatatype.REF, DomainLabel]
	| [TaggedDatatype.ARRAY, SerField]
	| [TaggedDatatype.TUPLE, SerField[]]
	| [TaggedDatatype.STRUCT, SerFieldStruct]
	| [TaggedDatatype.SWITCH, ...SerFieldSwitch];


export type SerField = PrimitiveDatatype | SerTaggedDatatype;

export type SerKeyStruct = Record<FieldLabel, PrimitiveDatatype>;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type SerFieldStruct = {
	[si_label: FieldLabel]: SerField;
};


/**
 * 
 */
export type SerSchema = [
	/**
	 * Identifies the schema version for this encoding
	 */
	n_version: number,

	/**
	 * Schema for key parts of the item
	 */
	h_keys: SerKeyStruct,

	/**
	 * Labels and nested structs for the fields of the item
	 */
	h_fields: SerFieldStruct,
];

/**
 * 
 */
export type SerBucket = {
	/**
	 * Schema shape of stored items
	 */
	shape: SerSchema;

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
	locations: Sequence<BucketCode, ItemCode>;

	/**
	 * Maps bucket codes to shape codes
	 */
	buckets_to_shapes: Sequence<ShapeCode, BucketCode>;

	/**
	 * Shapes stored in sequence
	 */
	shapes: Sequence<SerSchema, ShapeCode>;
};
