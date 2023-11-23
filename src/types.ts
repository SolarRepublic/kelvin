import type {A, L} from 'ts-toolbelt';

import type {PartableDatatype, PrimitiveDatatype, TaggedDatatype} from './schema-types';
import type {Dict, IntStr, NaiveBase64, JsonObject, JsonValue, JsonArray, Subtype, NaiveBase93} from '@blake.regalia/belt';

/**
 * App-controlled database version identifier
 */
export type DbVersionId = Subtype<number, 'db-version-id'>;

// /**
//  * Canonical hash of a single domain's schema
//  */
// export type DomainVersionId = Subtype<`=${DomainLabel}:${NaiveBase93}`, 'domain-version-id'>;

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


export type SchemaCode = Subtype<number, 'shape-code'>;


export type FieldLabel = Subtype<string, 'field-label'>;

export type FieldCode = Subtype<number, 'field-code'>;


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



export type SerItem = JsonArray;

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

export type SerTaggedDatatypeMap = {
	[TaggedDatatype.UNKNOWN]: [...unknown[]];
	[TaggedDatatype.REF]: [DomainLabel];
	[TaggedDatatype.ARRAY]: [SerField];
	[TaggedDatatype.TUPLE]: [SerField[]];
	[TaggedDatatype.STRUCT]: [SerFieldStruct];
	[TaggedDatatype.SWITCH]: [...SerFieldSwitch];
};

// // though it would be convenient to define it this way, it creates a problematic circular reference
// export type SerTaggedDatatype = {
// 	[xc_type in keyof SerTaggedDatatypeMap]: [xc_type, ...SerTaggedDatatypeMap[xc_type]];
// }[keyof SerTaggedDatatypeMap]

export type SerTaggedDatatype =
	| [TaggedDatatype.UNKNOWN, ...unknown[]]
	| [TaggedDatatype.REF, DomainLabel]
	| [TaggedDatatype.ARRAY, SerField]
	| [TaggedDatatype.TUPLE, SerField[]]
	| [TaggedDatatype.STRUCT, SerFieldStruct]
	| [TaggedDatatype.SWITCH, ...SerFieldSwitch];


export type SerField = PrimitiveDatatype | SerTaggedDatatype;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type SerKeyStruct = {
	[si_label: FieldLabel]: PartableDatatype;
};

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
 * Locates item to its position in the serialized
 */
export type SerBucket = Record<ItemCode, SerItem>;

export type SerBucketMetadata = [
	/**
	 * Bucket key
	 */
	key: BucketKey,

	/**
	 * Byte length of the unpadded bucket contents
	 */
	size: number,
];


export enum DomainStorageStrategy {
	DEFAULT=0,
	MINIMIZE=1,
	APPEND=2,
}

export type SerDomainMetadata = [
	/**
	 * Unordered list of buckets containing items in domain
	 */
	buckets: BucketCode[],

	/**
	 * Domain storage strategy
	 */
	strategy: DomainStorageStrategy,
];

/**
 * Serialized database hub object
 */
export type SerVaultHub = {
	/**
	 * Database version id
	 */
	db_version: DbVersionId;

	/**
	 * Target bucket length
	 */
	bucket_length: number;

	/**
	 * Domain labels associated to bucket codes, order matters
	 */
	// domains: Sequence<DomainLabel>;
	domains: Record<DomainLabel, SerDomainMetadata>;

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
	buckets: Sequence<SerBucketMetadata, BucketCode>;

	/**
	 * Locates each item to the Bucket it is stored in
	 */
	locations: Sequence<BucketCode, ItemCode>;

	/**
	 * Maps bucket codes to schema codes
	 */
	buckets_to_schemas: Sequence<SchemaCode, BucketCode>;

	/**
	 * Schemas stored in sequence
	 */
	schemas: Sequence<Readonly<SerSchema> | 0, SchemaCode>;
};
