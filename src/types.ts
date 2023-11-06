import type {A} from 'ts-toolbelt';

import type {Dict, IntStr, JsonObject, JsonValue, NaiveBase64, NaiveHexLower} from '@blake.regalia/belt';


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
 * Encodes an Item to a base92 index
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


export type LockSpecifier = A.Type<string, 'lock-specifier'>;

export type LockId = A.Type<string, 'lock-id'>;


/**
 * Describes a compatible backing key-value store
 */
export interface JsonKeyValueStore<
	h_schema extends JsonObject=JsonObject,
> {
	get<
		w_value extends JsonValue=JsonValue,
		si_key extends string=string,
	>(si_key: si_key): Promise<
		JsonValue extends w_value
			? h_schema[si_key]
			: w_value
	>;

	getMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
	>(a_keys: string[]): Promise<{
		[si_key in keyof h_types]: h_types[si_key] | undefined;
	}>;

	getAll(): Promise<Dict<JsonValue>>;

	set(si_key: string, w_value: JsonValue): Promise<void>;

	setMany(h_set: Dict<JsonValue>): Promise<void>;

	onChange<
		w_value extends JsonValue=JsonValue,
	>(si_key: string, fk_changed: (w_value: w_value) => void): VoidFunction;
}



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



type Sequence<
	w_item,
	w_key extends number=number,
> = Omit<Array<w_item>, 'shift' | 'unshift' | 'reverse' | 'sort' | 'indexOf' | 'lastIndexOf' | 'push'> & {
	indexOf(w_find: w_item, i_from?: number): w_key;
	lastIndexOf(w_find: w_item, i_from?: number): w_key;
	push(...items: w_item[]): w_key;
};


/**
 * Serialized database hub object
 */
export type SerVaultHub = {
	/**
	 * Domain lookup maps domain name to b92 id.
	 * append-only
	 */
	// domains: Dict;
	domains: Sequence<DomainLabel>;


	items: Sequence<ItemIdent, ItemCode>;


	indexes: Dict<Dict<ItemCode[]>>;

	// /**
	//  * Ref lookup maps serially incrementing ref id to global key.
	//  * append-mostly, entries can be deleted but keys can never be re-used
	//  */
	// refs: Record<ItemIndex, ItemKey>;

	// /**
	//  * Stores the index number for the next Ref id.
	//  */
	// ref_count: number;

	// /**
	//  * Alias lookup maps global key to its unique ref id.
	//  * inverse of "refs"
	//  */
	// aliases: Record<ItemKey, ItemIndex>;
};

// ({
// 	'a':'x:a:24115128a789aa9182',
// 	'','','','','','',
// 	'b':'DATA',
// })

/*

999
"x" - 91

9999
"xx" - 8463

99999
"xxx" - 778,687



*/
