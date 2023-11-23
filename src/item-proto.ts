
import type {GenericItemController, ItemController} from './controller';
import type {KnownEsDatatypes, PartableDatatype, PrimitiveDatatypeToEsType, TaggedDatatypeToEsTypeGetter, TaggedDatatypeToEsTypeSetter} from './schema-types';
import type {ItemCode, SerField, SerSchema, SerTaggedDatatype, SerTaggedDatatypeMap} from './types';

import type {JsonValue, JsonObject, JsonArray, Dict} from '@blake.regalia/belt';

import {ode, base93_to_buffer, buffer_to_base93, F_IDENTITY, fodemtv} from '@blake.regalia/belt';

import {SchemaError, SchemaWarning, TypeFieldNotWritableError, UnparseableSchemaError} from './errors';
import {FieldArray} from './field-array';
import {ItemRef} from './item-ref';
import {PrimitiveDatatype, TaggedDatatype} from './schema-types';

export const $_CONTROLLER = Symbol('item-controller');
export const $_CODE = Symbol('item-code');
export const $_TUPLE = Symbol('item-tuple');

type FieldPath = (string | number)[];

export type GenericItem = Record<string, KnownEsDatatypes>;

export type RuntimeItem<g_item extends object=GenericItem> = {
	[$_CODE]: ItemCode;
	[$_CONTROLLER]: GenericItemController;
	[$_TUPLE]: JsonValue[];
} & g_item;

export type ItemStruct<g_controller=GenericItemController> = g_controller extends ItemController<infer s_domain, infer si_domain, infer a_parts, infer g_schema, infer f_schema, infer g_item, infer g_proto, infer g_runtime, infer g_parts>
	? g_item
	: GenericItem;

export const is_runtime_item = (z_item: unknown): z_item is RuntimeItem => !!(z_item as RuntimeItem)[$_TUPLE];


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

// TODO make this compatible with primitive datatype versions
type SerdefaultsTuple<xc_tag extends TaggedDatatype=TaggedDatatype> = [
	TaggedSerializer<xc_tag>,
	TaggedDeserializer<xc_tag>,
	TaggedDefaulter<xc_tag>,
];

const tagged_serdefaults = <
	xc_tag extends TaggedDatatype,
>(
	a_datatype: SerTaggedDatatype,
	k_item: GenericItemController
): SerdefaultsTuple<xc_tag> => {
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
				const si_domain_ref = (k_ref as RuntimeItem)[$_CONTROLLER].domain || (k_ref as ItemRef).domain;

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
			// transform each tuple member's datatype into a serdef
			const a_serdefaults = w_info.map(z_field => primitive_or_tagged(z_field, {
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
			})) as SerdefaultsTuple<xc_tag>[];

			// return joint serdef
			return [
				// serializer
				(a_items, a_path) => a_serdefaults.map((a_serdef, i_field) => a_serdef[0](a_items[i_field] as TaggedDatatypeToEsTypeSetter<xc_tag>, a_path)),

				// deserializer
				(a_items, a_path) => a_serdefaults.map((a_serdef, i_field) => a_serdef[1]((a_items as JsonArray)[i_field], a_path)),

				// defaults
				() => a_serdefaults.map(a_serdef => a_serdef[2]()),
			];

			// return [
			// 	// serializer
			// 	(a_items, a_path) => w_info.map((z_field, i_field) => primitive_or_tagged(z_field, {
			// 		primitive: xc_subtype => H_SERIALIZERS_PRIMITIVE[xc_subtype](a_items[i_field] as never),
			// 		tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[0](a_items[i_field], [...a_path, i_field]),
			// 	})),

			// 	// deserializer
			// 	(a_items, a_path) => w_info.map((z_field, i_field) => primitive_or_tagged(z_field, {
			// 		primitive: xc_subtype => H_DESERIALIZERS_PRIMITIVE[xc_subtype]((a_items as JsonArray)[i_field]),
			// 		tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[1](a_items as JsonArray, [...a_path, i_field]),
			// 	})),

			// 	// defaults
			// 	() => w_info.map(z_field => primitive_or_tagged(z_field, {
			// 		primitive: xc_subtype => H_DEFAULTS_PRIMITIVE[xc_subtype],
			// 		tagged: (...a_ser) => tagged_serdefaults(a_ser, k_item)[2](),
			// 	})),
			// ];
		}

		// struct
		case TaggedDatatype.STRUCT: {
			debugger;

			const h_serdefs: Dict<SerdefaultsTuple> = fodemtv(w_info, z_field => primitive_or_tagged(z_field, {
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
			}));

			// return joint serdef
			return [
				// serializer
				(h_items, a_path) => fodemtv(h_serdefs, ([f_ser,, f_def], si_field) => si_field in h_items
					? f_ser(h_items[si_field], a_path): f_def()),

				// deserializer
				(h_items, a_path) => fodemtv(h_serdefs, ([, f_deser, f_def], si_field) => si_field in (h_items as JsonObject)
					? f_deser((h_items as JsonObject)[si_field], a_path): f_def()),

				// default
				() => fodemtv(h_serdefs, ([,, f_def]) => f_def()),
			];
		}

		// switch
		case TaggedDatatype.SWITCH: {
			debugger;

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

					// value contains reserved colon
					if(s_value.includes(':')) {
						// OK in last part, just issue warning
						if(i_field === this[$_CONTROLLER].partLength) {
							console.warn(new SchemaWarning(`Colon character (":") noticed in value passed to ${a_path.join('.')}, which is a key part. Tolerated since it occurs at last position but could lead to critical issues if schema changes`));
						}
						// forbidden elsewhere
						else {
							throw new SchemaError(`Colon character (":") noticed in value passed to ${a_path.join('.')}. Not allowed here`);
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
	else if(Array.isArray(z_datatype)) {
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
	for(const [si_key, z_datatype] of ode(h_keys)) {
		// lookup descriptor
		const f_descriptor = H_DESCRIPTORS_PARTS[z_datatype](b_writable);

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
	}

	// return property descriptor map
	return h_props;
}
