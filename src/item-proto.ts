import type {ItemController} from './controller';
import type {DomainLabel, FieldCode, FieldLabel, ItemCode, SerField, SerSchema} from './types';

import {ode, type JsonPrimitive, type JsonValue, base93_to_buffer, buffer_to_base93, type JsonObject} from '@blake.regalia/belt';

import {SchemaWarning, TypeFieldNotWritableError, UnparseableSchemaError, VaultCorruptedError} from './errors';
import {PrimitiveDatatype, type PartableDatatype, type PrimitiveDatatypeToEsType, TaggedDatatype, type TaggedDatatypeToEsType} from './schema-types';

export const $_CODE = Symbol('item-code');
export const $_REFS = Symbol('item-refs');
export const $_PARTS = Symbol('item-parts');
export const $_TUPLE = Symbol('item-tuple');

export type RuntimeItem = {
	[$_CODE]: ItemCode;
	[$_REFS]: Record<DomainLabel, ItemController>;
	[$_PARTS]: Extract<JsonPrimitive, number | string>[];
	[$_TUPLE]: JsonValue[];
};

// descriptors for part keys
const H_DESCRIPTORS_PARTS: {
	[xc_type in PartableDatatype | PrimitiveDatatype.UNKNOWN]: (i_field: number, sr_path: string) => {
		get(this: RuntimeItem): PrimitiveDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: never): void;
	};
} = {
	[PrimitiveDatatype.UNKNOWN]: (i_field, sr_path) => ({
		get() {
			console.warn(new SchemaWarning(`Part field at ${sr_path} has an unknown type`));
			return this[$_PARTS][i_field] as unknown;
		},

		set() {
			throw new TypeFieldNotWritableError(sr_path);
		},
	}),

	[PrimitiveDatatype.INT]: (i_field, sr_path) => ({
		get() {
			return this[$_PARTS][i_field] as number;
		},

		set() {
			throw new TypeFieldNotWritableError(sr_path);
		},
	}),

	[PrimitiveDatatype.BIGINT]: (i_field, sr_path) => ({
		get() {
			return BigInt(this[$_PARTS][i_field]);
		},

		set() {
			throw new TypeFieldNotWritableError(sr_path);
		},
	}),

	[PrimitiveDatatype.STRING]: (i_field, sr_path) => ({
		get() {
			return this[$_PARTS][i_field] as string;
		},

		set() {
			throw new TypeFieldNotWritableError(sr_path);
		},
	}),
};

// descriptors for primitive fields
const H_DESCRIPTORS_FIELDS_PRIMITIVE: {
	[xc_type in PrimitiveDatatype]: (i_field: number, sr_path: string) => {
		get(this: RuntimeItem): PrimitiveDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: PrimitiveDatatypeToEsType<xc_type>): void;
	};
} = {
	[PrimitiveDatatype.UNKNOWN]: (i_field, sr_path) => ({
		get() {
			console.warn(new SchemaWarning(`Part field at ${sr_path} has an unknown type`));
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



// descriptors for primitive fields
const H_DESCRIPTORS_FIELDS_TAGGED: {
	[xc_type in TaggedDatatype]: (i_field: number, sr_path: string, a_mids) => {
		get(this: RuntimeItem): TaggedDatatypeToEsType<xc_type>;
		set(this: RuntimeItem, w_value: TaggedDatatypeToEsType<xc_type>): void;
	};
} = {
	[TaggedDatatype.UNKNOWN]: i_field => ({
		get() {
			return this[$_TUPLE][i_field] as JsonObject;
		},

		set(w_value) {
			this[$_TUPLE][i_field] = w_value as any;
		},
	}),

	[TaggedDatatype.REF]: (i_field, si_key, [si_domain]: [DomainLabel]) => ({
		get() {
			return this[$_REFS][si_domain].getByCode(this[$_TUPLE][i_field] as ItemCode);
		},

		set(k_item) {
			this[$_TUPLE][i_field] = k_item[$_CODE];
		},
	}),

	[TaggedDatatype.ARRAY]: (i_field, si_key, [z_field]: [SerField]) => ({
		get() {
			return (this[$_TUPLE][i_field] as any[]).map((w_value) => {
				prototype_subfield(w_value);
			});
		},

		set(k_item) {
			// this[$_TUPLE][i_field] = k_item. as any;
		},
	}),

	[TaggedDatatype.TUPLE]: (i_field, si_key, [z_field]: [SerField]) => ({
		get() {
			return this[$_TUPLE][i_field].map();
		},

		set(k_item) {
			// this[$_TUPLE][i_field] = k_item. as any;
		},
	}),

	[TaggedDatatype.STRUCT]: (i_field, si_key, [z_field]: [SerField]) => ({
		get() {
			return (this[$_TUPLE][i_field] as SerField[]).map();
		},

		set(k_item) {
			// this[$_TUPLE][i_field] = k_item. as any;
		},
	}),

	[TaggedDatatype.SWITCH]: (i_field, si_key, [z_field]: [SerField]) => ({
		get() {
			return this[$_TUPLE][i_field].map();
		},

		set(k_item) {
			// this[$_TUPLE][i_field] = k_item. as any;
		},
	}),
};

function prototype_subfield(z_datatype: SerField, sr_path: string, h_props: PropertyDescriptorMap={}, i_field=1) {
	// primitive
	if('number' === typeof z_datatype) {
		// lookup descriptor
		const f_descriptor = H_DESCRIPTORS_FIELDS_PRIMITIVE[z_datatype];

		// not found
		if(!f_descriptor) {
			throw new UnparseableSchemaError(`Invalid primitive datatype code for field at ${sr_path}`);
		}

		// set descriptor
		h_props[sr_path] = f_descriptor(i_field, sr_path);
	}
	// tagged
	else if(Array.isArray(z_datatype)) {
		const [xc_tag, ...a_mids] = z_datatype;

		// lookup descriptor
		const f_descriptor = H_DESCRIPTORS_FIELDS_TAGGED[xc_tag];

		// not found
		if(!f_descriptor) {
			throw new UnparseableSchemaError(`Invalid tagged datatype code for field at ${sr_path}`);
		}

		// set descriptor
		h_props[sr_path] = f_descriptor(i_field, sr_path, a_mids);
	}
	// unrecognized
	else {
		throw new UnparseableSchemaError(`for field at ${sr_path}`);
	}
}

export function item_prototype(a_schema: SerSchema) {
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
		h_props[si_key] = f_descriptor(++i_field, si_key);
	}

	// each field
	for(const [si_key, z_datatype] of ode(h_fields)) {
		// increment counter
		i_field += 1;

		// primitive
		if('number' === typeof z_datatype) {
			// lookup descriptor
			const f_descriptor = H_DESCRIPTORS_FIELDS_PRIMITIVE[z_datatype];

			// not found
			if(!f_descriptor) {
				throw new UnparseableSchemaError(`Invalid primitive datatype code for field key "${si_key}"`);
			}

			// set descriptor
			h_props[si_key] = f_descriptor(i_field, si_key);
		}
		// tagged
		else if(Array.isArray(z_datatype)) {
			const [xc_tag, ...a_mids] = z_datatype;

			// lookup descriptor
			const f_descriptor = H_DESCRIPTORS_FIELDS_TAGGED[xc_tag];

			// not found
			if(!f_descriptor) {
				throw new UnparseableSchemaError(`Invalid tagged datatype code for field key "${si_key}"`);
			}

			// set descriptor
			h_props[si_key] = f_descriptor(i_field, si_key, a_mids);
		}
		// unrecognized
		else {
			throw new UnparseableSchemaError(`at field "${si_key}"`);
		}
	}

	// return property descriptor map
	return h_props;
}
