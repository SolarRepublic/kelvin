
import type {GenericItemController} from './controller';
import type {KnownEsDatatypes, PartableDatatype, PrimitiveDatatypeToEsType, TaggedDatatypeToEsTypeGetter, TaggedDatatypeToEsTypeSetter} from './schema-types';
import type {DomainCode, FieldPath, SerFieldPath, ItemCode, SerField, SerSchema, SerTaggedDatatype, SerTaggedDatatypeMap, SerFieldSwitch, FieldLabel, DomainLabel, SerFieldStruct} from './types';

import type {JsonValue, JsonObject, JsonArray} from '@blake.regalia/belt';

import {entries, base93_to_bytes, bytes_to_base93, F_IDENTITY, transform_values, __UNDEFINED, is_array, collapse} from '@blake.regalia/belt';

import {SX_KEY_PART_DELIMITER} from './constants';
import {Bug, SchemaError, SchemaWarning, TypeFieldNotWritableError, UnparseableSchemaError} from './errors';
import {FieldArray} from './field-array';
import {FieldDict} from './field-dict';
import {FieldMapRef} from './field-map-ref';
import {FieldSet} from './field-set';
import {FieldStruct} from './field-struct';
import {ItemRef, refish_to_code, type Refish} from './item-ref';
import {PrimitiveDatatype, TaggedDatatype} from './schema-types';

export const $_CONTROLLER = Symbol('item-controller');
export const $_CODE = Symbol('item-code');
export const $_TUPLE = Symbol('item-tuple');
export const $_LINKS = Symbol('item-links');

export type TaggedSerializer<xc_type extends TaggedDatatype> = (w_value: TaggedDatatypeToEsTypeSetter<xc_type>, a_path: FieldPath, k_this: RuntimeItem) => JsonValue;
export type TaggedDeserializer<xc_type extends TaggedDatatype> = (w_value: JsonValue, a_path: FieldPath, k_this: RuntimeItem) => TaggedDatatypeToEsTypeGetter<xc_type>;
export type TaggedDefaulter<xc_type extends TaggedDatatype> = (a_path: FieldPath, k_this: RuntimeItem) => TaggedDatatypeToEsTypeGetter<xc_type>;

type PrimitiveOrTaggedDatatype = PrimitiveDatatype | TaggedDatatype;

export type ItemSerializer<
	w_backing extends JsonValue=JsonValue,
	w_es=any,
> = (w_value: w_es, a_path: FieldPath, k_this: RuntimeItem) => w_backing;

export type ItemDeserializer<
	w_backing extends JsonValue=JsonValue,
	w_es=any,
> = (w_value: w_backing, a_path: FieldPath, k_this: RuntimeItem) => w_es;

export type ItemDefaulter<
	w_backing extends JsonValue=JsonValue,
> = (a_path: FieldPath, g_runtime: RuntimeItem) => w_backing;

export type GenericItem = Record<string, KnownEsDatatypes>;

export type RefDeltas = Record<SerFieldPath, ItemCode>;

export type RuntimeItem<g_item extends object=GenericItem> = {
	[Symbol.toStringTag]: string;

	[$_CODE]: ItemCode;
	[$_CONTROLLER]: GenericItemController;
	[$_TUPLE]: JsonValue[];
	[$_LINKS]: Record<DomainCode, {
		remove: RefDeltas;
		insert: RefDeltas;
	}>;
} & g_item;

/**
 * Tests whether the given value is a {@link RuntimeItem} and narrows its type
 */
export const is_runtime_item = (z_item: unknown): z_item is RuntimeItem => !!(z_item as RuntimeItem)[$_TUPLE];

/**
 * Tests whether the given field is a primitive datatype and narrows its type
 */
const is_primitive_datatype = (z_field: SerTaggedDatatype[1]): z_field is PrimitiveDatatype => 'number' === typeof z_field;

/**
 * Tests whether the given field is a tagged datatype and narrows its type
 */
const is_tagged_datatype = (z_field: SerTaggedDatatype[1]): z_field is SerTaggedDatatype => is_array(z_field);

type Router<
	w_primitive=any,
	w_tagged=any,
> = {
	primitive(xc_type: PrimitiveDatatype): w_primitive;
	tagged(...a_ser: SerTaggedDatatype): w_tagged;
};

const primitive_or_tagged = <
	xc_type extends TaggedDatatype,
	w_primitive=any,
	w_tagged=any,
>(z_field: SerTaggedDatatype[1], g_router: Router<w_primitive, w_tagged>): w_primitive | w_tagged => {
	if(is_primitive_datatype(z_field)) {
		return g_router.primitive(z_field);
	}
	else if(is_tagged_datatype(z_field)) {
		return g_router.tagged(...z_field);
	}
	else {
		throw new SchemaError('invalid datatype qualifier');
	}
};

const H_SERIALIZERS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: (w_value: PrimitiveDatatypeToEsType<xc_type>) => JsonValue;
} = {
	[PrimitiveDatatype.UNKNOWN]: F_IDENTITY,
	[PrimitiveDatatype.INT]: F_IDENTITY,
	[PrimitiveDatatype.BIGINT]: (xg_value: bigint) => xg_value+'',
	[PrimitiveDatatype.DOUBLE]: F_IDENTITY,
	[PrimitiveDatatype.STRING]: F_IDENTITY,
	[PrimitiveDatatype.BYTES]: (atu8_value: Uint8Array) => bytes_to_base93(atu8_value),
	[PrimitiveDatatype.OBJECT]: F_IDENTITY,
};

const H_DESERIALIZERS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: (w_value: JsonValue) => PrimitiveDatatypeToEsType<xc_type>;
} = {
	[PrimitiveDatatype.UNKNOWN]: F_IDENTITY,
	[PrimitiveDatatype.INT]: F_IDENTITY,
	[PrimitiveDatatype.BIGINT]: (sg_value: JsonValue) => BigInt(sg_value as string),
	[PrimitiveDatatype.DOUBLE]: F_IDENTITY,
	[PrimitiveDatatype.STRING]: F_IDENTITY,
	[PrimitiveDatatype.BYTES]: (sb93_value: JsonValue) => base93_to_bytes(sb93_value as string),
	[PrimitiveDatatype.OBJECT]: F_IDENTITY,
};

const F_DEFAULT_ZERO: ItemDefaulter = () => 0;
const F_DEFAULT_EMPTY: ItemDefaulter = () => '';

const H_DEFAULTS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: ItemDefaulter;
} = {
	[PrimitiveDatatype.UNKNOWN]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.INT]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.BIGINT]: () => '0',
	[PrimitiveDatatype.DOUBLE]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.STRING]: F_DEFAULT_EMPTY,
	[PrimitiveDatatype.BYTES]: F_DEFAULT_EMPTY,
	[PrimitiveDatatype.OBJECT]: () => ({}),
};


export type SerdefaultsTuple<
	xc_type extends PrimitiveOrTaggedDatatype=PrimitiveOrTaggedDatatype,
	w_backing extends JsonValue=xc_type extends PrimitiveDatatype
		? PrimitiveDatatypeToEsType<xc_type>
		: xc_type extends TaggedDatatype
			? TaggedDatatypeToEsTypeSetter<xc_type>
			: never,
	w_es extends any=xc_type extends PrimitiveDatatype
		? PrimitiveDatatypeToEsType<xc_type>
		: xc_type extends TaggedDatatype
			? TaggedDatatypeToEsTypeGetter<xc_type>
			: never,
> = [
	ItemSerializer<w_backing, w_es>,
	ItemDeserializer<w_backing, w_es>,
	ItemDefaulter<w_backing>,
];


type SubjectTree<w_leaf> = {
	[z_key: string | number]: SubjectTree<w_leaf> | w_leaf;
};

const access_path = <w_leaf>(
	w_subject: SubjectTree<w_leaf>,
	a_path: (string | number)[]
): w_leaf => a_path.length
	? access_path(w_subject[a_path[0]] as SubjectTree<w_leaf>, a_path.slice(1))
	: w_subject as w_leaf;


const unwrap_datatype = (z_datatype: SerTaggedDatatype[1], k_item: GenericItemController) => primitive_or_tagged(z_datatype, {
	// primitive member
	primitive: xc_subtype => [
		// serializer
		H_SERIALIZERS_PRIMITIVE[xc_subtype],

		// deserializer
		H_DESERIALIZERS_PRIMITIVE[xc_subtype],

		// defaults
		H_DEFAULTS_PRIMITIVE[xc_subtype],
	],
	// tagged member
	tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item),
}) as SerdefaultsTuple;


/**
 * Serializes an item ref into its code, while updating links
 */
const serialize_ref = (
	k_ref: RuntimeItem | ItemRef | null,
	a_path: FieldPath,
	w_info: DomainLabel | '',
	g_runtime: RuntimeItem
) => {
	// prep referenced item's code
	let i_code = 0 as ItemCode;

	// not intentional null
	if(null !== k_ref) {
		// resolve item code
		i_code = (k_ref as RuntimeItem)[$_CODE] || (k_ref as ItemRef).code;

		// no code
		if(!i_code) {
			throw Error(`Cannot assign to ${a_path.join('.')} property a reference item that has not yet been saved to vault`);
		}

		// normalize to controller
		const k_controller = (k_ref as RuntimeItem)[$_CONTROLLER] || (k_ref as ItemRef).controller;

		// resolve domain
		const si_domain_ref = k_controller.domain;

		// wrong domain
		if(w_info && w_info !== si_domain_ref) {
			throw Error(`Cannot assign to ${a_path.join('.')} property a reference item in the "${si_domain_ref}" domain; must be in the "${w_info}" domain`);
		}
	}

	// actual ref domain (empty string signifies self)
	const si_domain_actual = w_info as DomainLabel || g_runtime[$_CONTROLLER].domain;

	// lookup code
	const sb92_domain = g_runtime[$_CONTROLLER].hub.encodeDomain(si_domain_actual);

	// could not encode domain
	if(!sb92_domain) {
		throw Error(`Failed to encode domain "${si_domain_actual}" while attempting to assign item reference to ${a_path.join('.')}`);
	}

	// lookup/create links staging struct
	const g_links = g_runtime[$_LINKS][sb92_domain] ??= {
		remove: {},
		insert: {},
	};

	// path ident
	const sr_path = a_path.slice(1).join('.') as SerFieldPath;

	// previous item ref might exist
	if(g_runtime[$_CODE]) {
		// removing/replacing previous
		const g_prev = access_path<KnownEsDatatypes>(g_runtime, a_path.slice(1));
		if(g_prev instanceof ItemRef) {
			// only remove the stored item code
			g_links.remove[sr_path] ??= g_prev.code;
		}
	}

	// ref is present; only store the latest write
	if(i_code) g_links.insert[sr_path] = i_code;

	// return item code (encoding 0 for null)
	return i_code;
};


const tagged_serdefaults = <
	xc_tag extends TaggedDatatype,
>(
	a_datatype: [xc_tag, ...SerTaggedDatatypeMap[xc_tag]],
	k_item: GenericItemController
): SerdefaultsTuple<xc_tag, JsonValue, any> => {
	const [xc_tag, w_info, ...a_tail] = a_datatype;

	switch(xc_tag) {
		case TaggedDatatype.UNKNOWN: return [F_IDENTITY, F_IDENTITY, F_DEFAULT_ZERO];

		// ref
		case TaggedDatatype.REF: return [
			// ref serializer
			(k_ref: RuntimeItem | ItemRef, a_path, g_runtime) => serialize_ref(k_ref, a_path, w_info as DomainLabel, g_runtime),

			// ref deserializer
			(i_code, a_path, g_runtime) => i_code? new ItemRef(w_info? k_item.hub.vault.kelvin.controllerFor(w_info as DomainLabel)!: g_runtime[$_CONTROLLER], i_code as ItemCode): null,

			// ref default
			F_DEFAULT_ZERO,
		];

		// array or set
		case TaggedDatatype.ARRAY: {
			// get serdefaults
			const [f_ser, f_deser, f_def] = unwrap_datatype(w_info, k_item);

			return [
				// serializer
				(a_items: any[], a_path, g_runtime) => {
					// already of correct type
					if(a_items instanceof FieldArray) {
						return FieldArray.serialize(a_items as FieldArray<any, JsonValue>);
					}

					// transform into serialized form
					return a_items.map((w_value, i_member) => f_ser(w_value, [...a_path, i_member], g_runtime));
				},

				// deserializer
				(a_items, a_path, g_runtime) => FieldArray.create(a_items as JsonValue[], f_ser, f_deser, f_def, a_path, g_runtime),

				// default
				// (a_path, g_runtime) => FieldArray.create([], f_ser, f_deser, f_def, a_path, g_runtime),
				(a_path, g_runtime) => [],
			];
		}

		// set
		case TaggedDatatype.SET: {
			// get serdefaults
			const [f_ser, f_deser, f_def] = unwrap_datatype(w_info, k_item);

			return [
				// serializer
				(as_items: Set<any>, a_path, g_runtime) => {
					// already of correct type
					if(as_items instanceof FieldSet) {
						return FieldSet.serialize(as_items as FieldSet<any, JsonValue>);
					}

					// transform into serialized form
					return [...as_items].map((w_value, i_member) => f_ser(w_value, [...a_path, i_member], g_runtime));
				},

				// deserializer
				(a_items, a_path, g_runtime) => FieldSet.create(a_items as JsonValue[], f_ser, f_deser, f_def, a_path, g_runtime),

				// default
				(a_path, g_runtime) => [],
			];
		}

		// tuple
		case TaggedDatatype.TUPLE: {
			// transform each tuple member's datatype into a serdef
			const a_serdefaults = (w_info as SerField[]).map(z_field => unwrap_datatype(z_field, k_item));

			// return joint serdef
			return [
				// serializer
				(a_items, a_path, g_runtime) => a_serdefaults.map((a_serdef, i_field) => a_serdef[0](
					a_items[i_field] as TaggedDatatypeToEsTypeSetter<xc_tag>, [...a_path, i_field], g_runtime)),

				// deserializer
				(a_items, a_path, g_runtime) => a_serdefaults.map((a_serdef, i_field) => a_serdef[1](
					(a_items as JsonArray)[i_field], [...a_path, i_field], g_runtime)),

				// default
				(a_path, g_runtime) => a_serdefaults.map(a_serdef => a_serdef[2](a_path, g_runtime)),
			];
		}

		// struct
		case TaggedDatatype.STRUCT: {
			// transform each struct member's datatype into a serdef
			const h_serdefs = transform_values(w_info as SerFieldStruct, z_field => unwrap_datatype(z_field, k_item));

			// return joint serdef
			return [
				// serializer
				(h_items, a_path, g_runtime) => Object.values(transform_values(h_serdefs, ([f_ser,, f_def], si_field) => si_field in h_items
					? f_ser(h_items[si_field], [...a_path, si_field], g_runtime): f_def(a_path, g_runtime))),

				// deserializer
				(a_items, a_path, g_runtime) => FieldStruct.create(h_serdefs, a_items as JsonValue[], a_path, g_runtime),

				// default
				(a_path, g_runtime) => transform_values(h_serdefs, ([,, f_def]) => f_def(a_path, g_runtime)),
			];
		}

		// registry
		case TaggedDatatype.REGISTRY: {
			// transform each struct member's datatype into a serdef
			const h_serdefs = transform_values(w_info as SerFieldStruct, z_field => unwrap_datatype(z_field, k_item));

			// return joint serdef
			return [
				// serializer
				(h_items, a_path, g_runtime) => transform_values(h_serdefs, ([f_ser,, f_def], si_field) => si_field in h_items
					? f_ser(h_items[si_field], [...a_path, si_field], g_runtime): f_def(a_path, g_runtime)),

				// deserializer
				(h_items, a_path, g_runtime) => transform_values(h_serdefs, ([, f_deser], si_field) => si_field in (h_items as JsonObject)
					? f_deser((h_items as JsonObject)[si_field], [...a_path, si_field], g_runtime): __UNDEFINED),

				// default
				(a_path, g_runtime) => transform_values(h_serdefs, ([,, f_def]) => f_def(a_path, g_runtime)),
			];
		}

		// map-ref
		case TaggedDatatype.MAP_REF: {
			// unwrap the member datatype
			const [f_ser, f_deser, f_def] = unwrap_datatype(a_tail[0] as SerField, k_item);

			return [
				// serializer
				(hm_items: Map<Refish, KnownEsDatatypes> | FieldMapRef, a_path, g_runtime) => {
					// already of correct type
					if(hm_items instanceof FieldMapRef) {
						return FieldMapRef.serialize(hm_items);
					}

					// transform into serialized form
					collapse(hm_items.entries(), ([z_key, w_value]) => {
						const i_code = refish_to_code(z_key);

						if(!i_code) {
							// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
							throw Error(`Attempted to set map entry having key that refers to non-existent item: ${z_key}`);
						}

						return [i_code, f_ser(w_value, [...a_path, i_code], g_runtime)];
					});
				},

				// deserializer
				(h_items, a_path, g_runtime) => {
					// lookup controller for target domain
					const k_controller = g_runtime[$_CONTROLLER].hub.vault.kelvin.controllerFor(w_info as DomainLabel);
					if(!k_controller) {
						throw Error(`Failed to find item controller while attempting to deserialize MapRef for domain "${w_info as string}"`);
					}

					return FieldMapRef.create(
						k_controller,
						h_items as Record<ItemCode, JsonValue>,
						f_ser,
						f_deser,
						f_def,
						a_path,
						g_runtime
					);
				},

				// default
				(a_path, g_runtime) => ({}),
			];
		}

		// dict
		case TaggedDatatype.DICT: {
			// unwrap the member datatype
			const [f_ser, f_deser, f_def] = unwrap_datatype(w_info, k_item);

			return [
				// serializer; serialize if already of correct type
				(h_items, a_path, g_runtime) => FieldDict.serialize(h_items as {})
					// otherwise, transform into serialized form
					|| transform_values(h_items as {}, (w_value, si_member) => f_ser(w_value, [...a_path, si_member], g_runtime)),

					// deserializer
				(h_items, a_path, g_runtime) => FieldDict.create(
					h_items as JsonObject,
					f_ser,
					f_deser,
					f_def,
					a_path,
					g_runtime
				),

					// default
				() => ({}),
			];
		}

		// switch
		case TaggedDatatype.SWITCH: {
			// transform each switch option's datatype into a serdef
			const h_options = transform_values(a_tail[0] as SerFieldSwitch[1], z_field => unwrap_datatype(z_field, k_item));

			// return joint serdef
			return [
				// serializer
				(z_value, a_path, g_runtime) => {
					// depending on which option is set on instance
					const si_opt = (a_path.length > 2
						? access_path(g_runtime, a_path.slice(1, -1))
						: g_runtime)[w_info]+'' as FieldLabel;

					// get its serializer
					const [f_ser] = h_options[si_opt];

					// apply
					return f_ser(z_value, a_path, g_runtime);
				},

				// deserializer
				(z_value, a_path, g_runtime) => {
					// depending on which option is set on instance
					const si_opt = (a_path.length > 2
						? access_path(g_runtime, a_path.slice(1, -1))
						: g_runtime)[w_info]+'' as FieldLabel;

					// get its deserializer
					const [, f_deser] = h_options[si_opt];

					// apply
					return f_deser(z_value, a_path, g_runtime);
				},

				// default
				(a_path, g_runtime) => {
					// depending on which option is set on instance
					const si_opt = (a_path.length > 2
						? access_path(g_runtime, a_path.slice(1, -1))
						: g_runtime)[w_info]+'' as FieldLabel;

					// get its default
					const [, , f_def] = h_options[si_opt];

					// return
					return f_def(a_path, g_runtime);
				},
			];
		}

		default: {
			break;
		}
	}

	throw Error('Invalid datatype tag '+xc_tag);
};


// descriptors for part keys
const H_DESCRIPTORS_PARTS: {
	[xc_type in PartableDatatype | PrimitiveDatatype.UNKNOWN]: (b_writable: boolean) => (i_field: number, a_path: FieldPath) => {
		get(this: RuntimeItem): PrimitiveDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: never): void;
	};
} = {
	[PrimitiveDatatype.UNKNOWN]: b_writable => (i_field, a_path) => ({
		get() {
			console.warn(new SchemaWarning(`Part field at ${a_path.join('.')} has an unknown type`));
			return this[$_TUPLE][i_field] as unknown;
		},

		...b_writable
			? {
				set(w_value) {
					this[$_TUPLE][i_field] = w_value;
				},
			}
			: {
				set() {
					throw new TypeFieldNotWritableError(a_path.join('.'));
				},
			},
	}),

	[PrimitiveDatatype.INT]: b_writable => (i_field, a_path) => ({
		get() {
			if(!this[$_TUPLE]) {
				throw new Bug(`Something went horribly wrong while attempting to access int datatype ${a_path.join('.')}`);
			}

			return +this[$_TUPLE][i_field]!;
		},

		...b_writable
			? {
				set(n_value) {
					// doesn't matter what gets stored, will get stringify anyway
					this[$_TUPLE][i_field] = n_value;
				},
			}
			: {
				set() {
					throw new TypeFieldNotWritableError(a_path.join('.'));
				},
			},
	}),

	[PrimitiveDatatype.BIGINT]: b_writable => (i_field, a_path) => ({
		get() {
			return BigInt(this[$_TUPLE][i_field] as string);
		},

		...b_writable
			? {
				set(xg_value) {
					this[$_TUPLE][i_field] = xg_value+'';
				},
			}
			: {
				set() {
					throw new TypeFieldNotWritableError(a_path.join('.'));
				},
			},
	}),

	[PrimitiveDatatype.STRING]: b_writable => (i_field, a_path) => ({
		get() {
			return this[$_TUPLE][i_field] as string;
		},

		...b_writable
			? {
				set(w_value) {
					// stringify
					const s_value = w_value+'';

					// value contains reserved delimiter
					if(s_value.includes(SX_KEY_PART_DELIMITER)) {
						// OK in last part, just issue warning
						if(i_field === this[$_CONTROLLER].partLength) {
							console.warn(new SchemaWarning(`Reserved delimiter character ("${SX_KEY_PART_DELIMITER}") noticed in value passed to ${a_path.join('.')}, which is a key part. Tolerated since it occurs at last position but could lead to critical issues if schema changes`));
						}
						// forbidden elsewhere
						else {
							throw new SchemaError(`Reserved delimiter character ("${SX_KEY_PART_DELIMITER}") noticed in value passed to ${a_path.join('.')}. Not allowed here`);
						}
					}

					// accept
					this[$_TUPLE][i_field] = s_value;
				},
			}
			: {
				set() {
					throw new TypeFieldNotWritableError(a_path.join('.'));
				},
			},
	}),
};


// descriptors for part keys
const H_DESCRIPTORS_TAGGED_PARTS: {
	[xc_type in TaggedDatatype.REF | TaggedDatatype.UNKNOWN]: (b_writable: boolean, ...a_args: any[]) => (i_field: number, a_path: FieldPath) => {
		get(this: RuntimeItem): TaggedDatatypeToEsTypeGetter<xc_type>;
		set(this: RuntimeItem, w_value: never): void;
	};
} = {
	[TaggedDatatype.UNKNOWN]: H_DESCRIPTORS_PARTS[PrimitiveDatatype.UNKNOWN],

	[TaggedDatatype.REF]: (b_writable, si_domain: DomainLabel) => (i_field: number, a_path: FieldPath) => ({
		get() {
			// ref item code
			const i_code = this[$_TUPLE][i_field] as ItemCode;

			// lookup controller
			const k_controller = this[$_CONTROLLER].hub.vault.kelvin.controllerFor(si_domain);

			// controller not found
			if(!k_controller) {
				throw Error(`Failed to resolve reference to item in '${si_domain}' domain at ${a_path.join(SX_KEY_PART_DELIMITER)}`);
			}

			// return
			return i_code? new ItemRef(k_controller, i_code): null;
		},

		...b_writable
			? {
				set(w_value: RuntimeItem | ItemRef | null) {
					this[$_TUPLE][i_field] = serialize_ref(w_value, a_path, si_domain, this);
				},
			}
			: {
				set() {
					throw new TypeFieldNotWritableError(a_path.join('.'));
				},
			},
	}),
};


// descriptors for primitive fields
const H_DESCRIPTORS_FIELDS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: (i_field: number, a_path: FieldPath) => {
		get(this: RuntimeItem): PrimitiveDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: PrimitiveDatatypeToEsType<xc_type>): void;
	};
} = {
	[PrimitiveDatatype.UNKNOWN]: (i_field, a_path) => ({
		get() {
			console.warn(new SchemaWarning(`Part field at ${a_path.join('.')} has an unknown type`));
			return this[$_TUPLE][i_field] as unknown;
		},

		set(w_value) {
			this[$_TUPLE][i_field] = w_value as JsonValue;
		},
	}),

	[PrimitiveDatatype.INT]: i_field => ({
		get() {
			return this[$_TUPLE][i_field] as number;
		},

		set(n_value) {
			this[$_TUPLE][i_field] = n_value;
		},
	}),

	[PrimitiveDatatype.BIGINT]: i_field => ({
		get() {
			return BigInt(this[$_TUPLE][i_field] as string);
		},

		set(xg_value) {
			this[$_TUPLE][i_field] = xg_value+'';
		},
	}),

	[PrimitiveDatatype.DOUBLE]: i_field => ({
		get() {
			return this[$_TUPLE][i_field] as number;
		},

		set(x_value) {
			this[$_TUPLE][i_field] = x_value;
		},
	}),

	[PrimitiveDatatype.STRING]: i_field => ({
		get() {
			return this[$_TUPLE][i_field] as string;
		},

		set(s_value) {
			this[$_TUPLE][i_field] = s_value;
		},
	}),

	[PrimitiveDatatype.BYTES]: i_field => ({
		get() {
			return base93_to_bytes(this[$_TUPLE][i_field] as string);
		},

		set(atu8_value) {
			this[$_TUPLE][i_field] = bytes_to_base93(atu8_value);
		},
	}),

	[PrimitiveDatatype.OBJECT]: i_field => ({
		get() {
			return this[$_TUPLE][i_field] as JsonObject;
		},

		set(h_value) {
			this[$_TUPLE][i_field] = h_value;
		},
	}),
};


type TaggedDescriptor<xc_type extends TaggedDatatype> = {
	get(this: RuntimeItem): TaggedDatatypeToEsTypeGetter<xc_type>;
	set(this: RuntimeItem, w_value: TaggedDatatypeToEsTypeSetter<xc_type>): void;
};

const tagged_descriptor = <
	xc_tag extends TaggedDatatype,
>(
	i_field: number,
	a_path: FieldPath,
	a_ser: [xc_tag, ...SerTaggedDatatypeMap[xc_tag]],
	k_item: GenericItemController
): TaggedDescriptor<xc_tag> => {
	const [f_serializer, f_deserializer] = tagged_serdefaults(a_ser as SerTaggedDatatype, k_item);

	return {
		get() {
			return f_deserializer(this[$_TUPLE][i_field], a_path, this);
		},

		// special handling for switch
		...TaggedDatatype.SWITCH === a_ser[0]
			? {
				set(w_value) {
					// when a switch is used within a nested struct, it needs to read the primitive value of the switch field
					// setting the tuple is OK since primitives should always be in canonical form
					this[$_TUPLE][i_field] = Object.values(w_value);

					// serialize the rest of the struct
					this[$_TUPLE][i_field] = f_serializer(w_value, a_path, this);
				},
			}
			: {
				set(w_value) {
					this[$_TUPLE][i_field] = f_serializer(w_value, a_path, this);
				},
			},
	};
};

function prototype_subfield(
	z_datatype: SerField,
	k_item: GenericItemController,
	a_path: FieldPath,
	h_props: PropertyDescriptorMap={},
	i_field=1
) {
	// primitive
	if('number' === typeof z_datatype) {
		// lookup descriptor
		const f_descriptor = H_DESCRIPTORS_FIELDS_PRIMITIVE[z_datatype];

		// not found
		if(!f_descriptor) {
			throw new UnparseableSchemaError(`Invalid primitive datatype code for field at ${a_path.join('.')}`);
		}

		// set descriptor
		h_props[a_path.at(-1)!] = f_descriptor(i_field, a_path);
	}
	// tagged; build descriptor
	else if(is_array(z_datatype)) {
		h_props[a_path.at(-1)!] = tagged_descriptor(i_field, a_path, z_datatype, k_item);
	}
	// unrecognized
	else {
		throw new UnparseableSchemaError(`for field at ${a_path.join('.')}`);
	}

	return h_props;
}

export function item_prototype(a_schema: SerSchema, k_item: GenericItemController, b_writable=false): PropertyDescriptorMap {
	// destructure schema tuple
	const [n_version, h_keys, h_fields] = a_schema;

	// prep property descriptor map
	const h_props: PropertyDescriptorMap = {};

	// field position
	let i_field = 0;

	// each part key
	for(const [si_key, z_datatype] of entries(h_keys)) {
		// lookup descriptor
		const f_descriptor = is_array(z_datatype)
			? H_DESCRIPTORS_TAGGED_PARTS[z_datatype[0] as TaggedDatatype.REF](b_writable, ...z_datatype.slice(1))
			: H_DESCRIPTORS_PARTS[z_datatype](b_writable);

		// not found
		if(!f_descriptor) {
			throw new UnparseableSchemaError(`Invalid primitive datatype code for part key "${si_key}"`);
		}

		// set descriptor
		h_props[si_key] = f_descriptor(++i_field, [k_item.domain, si_key]);
	}

	// each field
	for(const [si_key, z_datatype] of entries(h_fields)) {
		// increment counter
		i_field += 1;

		// build prototype into existing property descriptor
		prototype_subfield(z_datatype, k_item, [k_item.domain, si_key], h_props, i_field);
	}

	// return property descriptor map
	return h_props;
}
