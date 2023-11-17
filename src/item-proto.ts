
import type {GenericItemController, ItemController} from './controller';
import type {PartableDatatype, PrimitiveDatatypeToEsType, TaggedDatatypeToEsTypeGetter, TaggedDatatypeToEsTypeSetter} from './schema-types';
import type {DomainLabel, ItemCode, SerField, SerSchema, SerTaggedDatatype, SerTaggedDatatypeMap} from './types';

import type {JsonPrimitive, JsonValue, JsonObject, JsonArray} from '@blake.regalia/belt';

import {ode, base93_to_buffer, buffer_to_base93, F_IDENTITY} from '@blake.regalia/belt';

import {SchemaError, SchemaWarning, TypeFieldNotWritableError, UnparseableSchemaError} from './errors';
import {FieldArray} from './field-array';
import {ItemRef} from './item-ref';
import {PrimitiveDatatype, TaggedDatatype} from './schema-types';

export const $_CODE = Symbol('item-code');
export const $_DOMAIN = Symbol('item-domain');
export const $_REFS = Symbol('item-refs');
export const $_PARTS = Symbol('item-parts');
export const $_TUPLE = Symbol('item-tuple');

type FieldPath = (string | number)[];

export type RuntimeItem = {
	[$_CODE]: ItemCode;
	[$_DOMAIN]: DomainLabel;
	[$_REFS]: Record<DomainLabel, GenericItemController>;
	[$_PARTS]: Extract<JsonPrimitive, number | string>[];
	[$_TUPLE]: JsonValue[];
};

const is_primitive_datatype = (z_field: SerTaggedDatatype[1]): z_field is PrimitiveDatatype => 'number' === typeof z_field;
const is_tagged_datatype = (z_field: SerTaggedDatatype[1]): z_field is SerTaggedDatatype => Array.isArray(z_field);

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
	[PrimitiveDatatype.BYTES]: (atu8_value: Uint8Array) => buffer_to_base93(atu8_value),
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
	[PrimitiveDatatype.BYTES]: (sb93_value: JsonValue) => base93_to_buffer(sb93_value as string),
	[PrimitiveDatatype.OBJECT]: F_IDENTITY,
};

const F_DEFAULT_ZERO = () => 0;
const F_DEFAULT_EMPTY = () => '';

const H_DEFAULTS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: () => JsonValue;
} = {
	[PrimitiveDatatype.UNKNOWN]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.INT]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.BIGINT]: () => '0',
	[PrimitiveDatatype.DOUBLE]: F_DEFAULT_ZERO,
	[PrimitiveDatatype.STRING]: F_DEFAULT_EMPTY,
	[PrimitiveDatatype.BYTES]: F_DEFAULT_EMPTY,
	[PrimitiveDatatype.OBJECT]: () => ({}),
};

type TaggedSerializer<xc_type extends TaggedDatatype> = (w_value: TaggedDatatypeToEsTypeSetter<xc_type>, a_path: FieldPath) => JsonValue;
type TaggedDeserializer<xc_type extends TaggedDatatype> = (w_value: JsonValue, a_path: FieldPath) => TaggedDatatypeToEsTypeSetter<xc_type>;
type TaggedDefaulter<xc_type extends TaggedDatatype> = () => TaggedDatatypeToEsTypeSetter<xc_type>;

const tagged_serdefaults = <
	xc_tag extends TaggedDatatype,
>(
	a_datatype: SerTaggedDatatype,
	k_item: GenericItemController
): [
	TaggedSerializer<xc_tag>,
	TaggedDeserializer<xc_tag>,
	TaggedDefaulter<xc_tag>,
] => {
	const [xc_tag, w_info, ...a_tail] = a_datatype;

	switch(xc_tag) {
		case TaggedDatatype.UNKNOWN: return [F_IDENTITY, F_IDENTITY, F_DEFAULT_ZERO];

		// ref
		case TaggedDatatype.REF: return [
			// ref serializer
			(k_ref, a_path) => {
				// resolve item code
				const i_code = (k_ref as RuntimeItem)[$_CODE] || (k_ref as ItemRef).code;

				// no code
				if(!i_code) {
					throw Error(`Cannot assign to ${a_path.join('.')} property a reference item that has not yet been saved to vault`);
				}

				// resolve domain
				const si_domain_ref = (k_ref as RuntimeItem)[$_DOMAIN] || (k_ref as ItemRef).domain;

				// wrong domain
				if(w_info !== si_domain_ref) {
					throw Error(`Cannot assign to ${a_path.join('.')} property a reference item in the "${si_domain_ref}" domain; must be in the "${w_info}" domain`);
				}

				return i_code;
			},

			// ref deserializer
			i_code => new ItemRef(k_item, i_code as ItemCode, w_info),

			// ref default
			F_DEFAULT_ZERO,
		];

		// array
		case TaggedDatatype.ARRAY: {
			return primitive_or_tagged(w_info, {
				// primitive item type
				primitive: xc_type => [
					// serializer
					a_items => a_items.map(H_SERIALIZERS_PRIMITIVE[xc_type]),

					// deserializer
					a_items => FieldArray.create(
						a_items as JsonArray,
						H_SERIALIZERS_PRIMITIVE[xc_type],
						H_DESERIALIZERS_PRIMITIVE[xc_type],
						H_DEFAULTS_PRIMITIVE[xc_type]
					),

					// default
					() => [],
				],

				// tagged item type
				tagged(...a_ser) {
					// get serdefaults
					const [f_serializer, f_deserializer, f_default] = tagged_serdefaults(a_ser, k_item);

					// structure
					return [
						// serializer
						(a_items, a_path) => (a_items as any[]).map((w_item, i_item) => f_serializer(w_item, [...a_path, i_item])),

						// deserializer
						(a_items, a_path) => (a_items as JsonArray).map((w_item, i_item) => f_deserializer(w_item, [...a_path, i_item])),

						// default
						() => [],
					];
				},
			});
		}

		// tuple
		case TaggedDatatype.TUPLE: {
			return [
				// serializer
				(a_items, a_path) => w_info.map((z_field, i_field) => primitive_or_tagged(z_field, {
					primitive: xc_subtype => H_SERIALIZERS_PRIMITIVE[xc_subtype](a_items[i_field] as never),
					tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[0](a_items[i_field], [...a_path, i_field]),
				})),

				// deserializer
				(a_items, a_path) => w_info.map((z_field, i_field) => primitive_or_tagged(z_field, {
					primitive: xc_subtype => H_DESERIALIZERS_PRIMITIVE[xc_subtype]((a_items as JsonArray)[i_field]),
					tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[1](a_items as JsonArray, [...a_path, i_field]),
				})),

				// defaults
				() => w_info.map(z_field => primitive_or_tagged(z_field, {
					primitive: xc_subtype => H_DEFAULTS_PRIMITIVE[xc_subtype](),
					tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[2](),
				})),
			];
		}

		// struct
		case TaggedDatatype.STRUCT: {
			break;
		}

		// switch
		case TaggedDatatype.SWITCH: {
			break;
		}

		default: {
			break;
		}
	}

	throw Error('Invalid datatype tag '+xc_tag);
};


// descriptors for part keys
const H_DESCRIPTORS_PARTS: {
	[xc_type in PartableDatatype | PrimitiveDatatype.UNKNOWN]: (i_field: number, a_path: FieldPath) => {
		get(this: RuntimeItem): PrimitiveDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: never): void;
	};
} = {
	[PrimitiveDatatype.UNKNOWN]: (i_field, a_path) => ({
		get() {
			console.warn(new SchemaWarning(`Part field at ${a_path.join('.')} has an unknown type`));
			return this[$_PARTS][i_field] as unknown;
		},

		set() {
			throw new TypeFieldNotWritableError(a_path.join('.'));
		},
	}),

	[PrimitiveDatatype.INT]: (i_field, a_path) => ({
		get() {
			return this[$_PARTS][i_field] as number;
		},

		set() {
			throw new TypeFieldNotWritableError(a_path.join('.'));
		},
	}),

	[PrimitiveDatatype.BIGINT]: (i_field, a_path) => ({
		get() {
			return BigInt(this[$_PARTS][i_field]);
		},

		set() {
			throw new TypeFieldNotWritableError(a_path.join('.'));
		},
	}),

	[PrimitiveDatatype.STRING]: (i_field, a_path) => ({
		get() {
			return this[$_PARTS][i_field] as string;
		},

		set() {
			throw new TypeFieldNotWritableError(a_path.join('.'));
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
			return base93_to_buffer(this[$_TUPLE][i_field] as string);
		},

		set(atu8_value) {
			this[$_TUPLE][i_field] = buffer_to_base93(atu8_value);
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
			return f_deserializer(this[$_TUPLE][i_field] as JsonValue, a_path);
		},

		set(w_value) {
			this[$_TUPLE][i_field] = f_serializer(w_value, a_path);
		},
	};
};

// // descriptors for primitive fields
// const H_DESCRIPTORS_FIELDS_TAGGED: {
// 	[xc_type in TaggedDatatype]: (
// 		i_field: number,
// 		sr_path: string,
// 		a_mids: SerTaggedDatatypeMap[xc_type],
// 		k_item: ItemController
// 	) => TaggedDescriptor<xc_type>;
// } = {
// 	[TaggedDatatype.UNKNOWN]: i_field => ({
// 		get() {
// 			return this[$_TUPLE][i_field] as JsonObject;
// 		},

// 		set(w_value) {
// 			this[$_TUPLE][i_field] = w_value as any;
// 		},
// 	}),

// 	[TaggedDatatype.REF]: (i_field, si_key, [si_domain], k_item) => ({
// 		get() {
// 			return new ItemRef(k_item, this[$_TUPLE][i_field] as ItemCode, si_domain);
// 		},

// 		set(k_ref: RuntimeItem | ItemRef) {
// 			// resolve item code
// 			const i_code = (k_ref as RuntimeItem)[$_CODE] || (k_ref as ItemRef).code;

// 			// no code
// 			if(!i_code) {
// 				throw Error(`Cannot assign to "${si_key}" property a reference item that has not yet been saved to vault`);
// 			}

// 			// resolve domain
// 			const si_domain_ref = (k_ref as RuntimeItem)[$_DOMAIN] || (k_ref as ItemRef).domain;

// 			// wrong domain
// 			if(si_domain !== si_domain_ref) {
// 				throw Error(`Cannot assign to "${si_key}" property a reference item in the "${si_domain_ref}" domain; must be in the "${si_domain}" domain`);
// 			}

// 			// accept
// 			this[$_TUPLE][i_field] = i_code;
// 		},
// 	}),

// 	[TaggedDatatype.ARRAY]: (i_field, si_key, [z_field], k_item) => {

// 		const [f_serializer, f_deserializer, f_default] = tagged_serdefaults(, k_item);

// 		primitive_or_tagged(z_field, {
// 		primitive: (xc_type) => ({
// 			get() {
// 				return FieldArray.create(
// 					this[$_TUPLE][i_field] as JsonArray,
// 					H_SERIALIZERS_PRIMITIVE[xc_type],
// 					H_DESERIALIZERS_PRIMITIVE[xc_type],
// 					H_DEFAULTS_PRIMITIVE[xc_type]
// 				);
// 			},

// 			set(a_items) {
// 				this[$_TUPLE][i_field] = a_items.map(H_SERIALIZERS_PRIMITIVE[xc_type]);
// 			},
// 		}),

// 		tagged: (...a_ser) => {
// 			const [f_serializer, f_deserializer, f_default] = tagged_serdefaults(a_ser, k_item);

// 			return {
// 				get() {
// 					return f_serializer(this[$_TUPLE][i_field] as JsonArray);
// 				},

// 				set(a_items) {
// 					this[$_TUPLE][i_field] = f_deserializer(a_items);
// 				},
// 			};
// 		},
// 	}),

// 	// primitive_or_tagged(z_field, {
// 	// 	primitive: (xc_type) => ({
// 	// 		get() {
// 	// 			return FieldArray.create(
// 	// 				this[$_TUPLE][i_field] as JsonArray,
// 	// 				H_SERIALIZERS_PRIMITIVE[xc_type],
// 	// 				H_DESERIALIZERS_PRIMITIVE[xc_type],
// 	// 				H_DEFAULTS_PRIMITIVE[xc_type]
// 	// 			);
// 	// 		},

// 	// 		set(a_items) {
// 	// 			this[$_TUPLE][i_field] = a_items.map(H_SERIALIZERS_PRIMITIVE[xc_type]);
// 	// 		},
// 	// 	}),

// 	// 	tagged: (xc_type, ...a_mids) => ({
// 	// 		get() {
// 	// 			return FieldArray.create(
// 	// 				this[$_TUPLE][i_field] as JsonArray,
// 	// 				H_SERIALIZERS_TAGGED[xc_type],
// 	// 				H_DESERIALIZERS_TAGGED[xc_type],
// 	// 				H_DEFAULTS_TAGGED[xc_type]
// 	// 			);
// 	// 		},

// 	// 		set(a_items) {

// 	// 		},
// 	// 	}),
// 	// }),

// 	[TaggedDatatype.TUPLE]: (i_field, si_key, [a_members]) => ({
// 		get() {

// 		},

// 		set() {

// 		},
// 	}),

// 	[TaggedDatatype.STRUCT]: (i_field, si_key, [z_field]: [SerField]) => ({
// 		get() {
// 			return (this[$_TUPLE][i_field] as SerField[]).map();
// 		},

// 		set(k_item) {
// 			// this[$_TUPLE][i_field] = k_item. as any;
// 		},
// 	}),

// 	[TaggedDatatype.SWITCH]: (i_field, si_key, [z_field]: [SerField]) => ({
// 		get() {
// 			return this[$_TUPLE][i_field].map();
// 		},

// 		set(k_item) {
// 			// this[$_TUPLE][i_field] = k_item. as any;
// 		},
// 	}),
// };

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
			throw new UnparseableSchemaError(`Invalid primitive datatype code for field at ${a_path}`);
		}

		// set descriptor
		h_props[a_path.at(-1)!] = f_descriptor(i_field, a_path);
	}
	// tagged
	else if(Array.isArray(z_datatype)) {
		// const [xc_tag, ...a_mids] = z_datatype;

		// // lookup descriptor
		// const g_descriptor = tagged_descriptor(i_field, sr_path, z_datatype, k_item);

		// // not found
		// if(!f_descriptor) {
		// 	throw new UnparseableSchemaError(`Invalid tagged datatype code for field at ${sr_path}`);
		// }

		// // set descriptor
		// h_props[sr_path] = f_descriptor(i_field, sr_path, a_mids, k_item);

		// build descriptor
		h_props[a_path.at(-1)!] = tagged_descriptor(i_field, a_path, z_datatype, k_item);
	}
	// unrecognized
	else {
		throw new UnparseableSchemaError(`for field at ${a_path}`);
	}

	return h_props;
}

export function item_prototype(a_schema: SerSchema, k_item: GenericItemController): PropertyDescriptorMap {
	// destructure schema tuple
	const [n_version, h_keys, h_fields] = a_schema;

	// prep property descriptor map
	const h_props: PropertyDescriptorMap = {};

	// field position
	let i_field = 0;

	// each part key
	for(const [si_key, z_datatype] of ode(h_keys)) {
		// lookup descriptor
		const f_descriptor = H_DESCRIPTORS_PARTS[z_datatype];

		// not found
		if(!f_descriptor) {
			throw new UnparseableSchemaError(`Invalid primitive datatype code for part key "${si_key}"`);
		}

		// set descriptor
		h_props[si_key] = f_descriptor(++i_field, [k_item.domain, si_key]);
	}

	// each field
	for(const [si_key, z_datatype] of ode(h_fields)) {
		// increment counter
		i_field += 1;

		// build prototype into existing property descriptor
		prototype_subfield(z_datatype, k_item, [k_item.domain, si_key], h_props, i_field);

		// // primitive
		// if('number' === typeof z_datatype) {
		// 	// lookup descriptor
		// 	const f_descriptor = H_DESCRIPTORS_FIELDS_PRIMITIVE[z_datatype];

		// 	// not found
		// 	if(!f_descriptor) {
		// 		throw new UnparseableSchemaError(`Invalid primitive datatype code for field key "${si_key}"`);
		// 	}

		// 	// set descriptor
		// 	h_props[si_key] = f_descriptor(i_field, si_key);
		// }
		// // tagged
		// else if(Array.isArray(z_datatype)) {
		// 	const [xc_tag, ...a_mids] = z_datatype;

		// 	// lookup descriptor
		// 	const f_descriptor = H_DESCRIPTORS_FIELDS_TAGGED[xc_tag];

		// 	// not found
		// 	if(!f_descriptor) {
		// 		throw new UnparseableSchemaError(`Invalid tagged datatype code for field key "${si_key}"`);
		// 	}

		// 	// set descriptor
		// 	h_props[si_key] = f_descriptor(i_field, si_key, a_mids);
		// }
		// // unrecognized
		// else {
		// 	throw new UnparseableSchemaError(`at field "${si_key}"`);
		// }
	}

	// return property descriptor map
	return h_props;
}
