import type {GenericItemController} from './controller';

import type {FieldTuple, KnownEsPrimitiveDatatypes, PrimitiveDatatypeToEsType, FieldStruct, KnownEsDatatypes} from './schema-types';
import type {FieldLabel, SerField, SerFieldStruct, SerTaggedDatatype} from './types';

import type {Dict, Arrayable, JsonObject} from '@blake.regalia/belt';

import {__UNDEFINED, is_dict_es, ode, buffer_to_base64} from '@blake.regalia/belt';

import {SchemaError} from './errors';
import {FieldArray} from './field-array';
import {$_CODE, is_runtime_item} from './item-proto';
import {ItemRef} from './item-ref';
import {TaggedDatatype, PrimitiveDatatype} from './schema-types';

export type MatchCriteria<g_item extends object> = {
	[si_key in keyof g_item]: g_item[si_key] | (g_item[si_key] extends PrimitiveDatatypeToEsType<PrimitiveDatatype>
		? RegExp | Set<g_item[si_key]>
		: g_item[si_key] extends GenericItemController
			? Set<g_item[si_key]>
			: never);
};

type Settable<w_item> = Set<w_item> | w_item;

type GenericMatchCriteria = Settable<Arrayable<KnownEsPrimitiveDatatypes | ItemRef>>;

export type GenericStructMatchCriteria = Dict<GenericMatchCriteria>;

// TODO: refactor type errors into common class

// apply an item reference filter
const apply_filter_ref = (g_value: ItemRef, z_filter: unknown, sr_path: string): boolean => {
	// other item
	if(is_runtime_item(z_filter)) {
		return z_filter[$_CODE] === g_value.code;
	}
	// other ref
	else if(z_filter instanceof ItemRef) {
		return z_filter.code === g_value.code;
	}
	// key parts
	else if(is_dict_es(z_filter)) {
		return g_value.controller.getItemCode(z_filter) === g_value.code;
	}
	// item code
	else if('number' === typeof z_filter) {
		return z_filter === g_value.code;
	}

	// other
	throw TypeError(`Invalid filter value for reference: ${typeof z_filter} at ${sr_path}`);
};

// apply a tuple filter
const apply_filter_tuple = (a_tuple: FieldTuple, z_filter: unknown, sr_path: string, _a_schema_fields: SerField[]): boolean => {
	// array
	if(Array.isArray(z_filter)) {
		// lengths differ
		if(z_filter.length !== a_tuple.length) return false;

		// compare each item
		for(let i_item=0; i_item<a_tuple.length; i_item++) {
			// filter doesn't pass; reject match
			if(!apply_filter_any(a_tuple[i_item], _a_schema_fields[i_item], z_filter[i_item] as GenericMatchCriteria, sr_path+'.'+i_item)) return false;
		}

		// passed
		return true;
	}

	// other
	throw TypeError(`Invalid filter value for reference: ${typeof z_filter} at ${sr_path}`);
};

// apply an array filter
const apply_filter_array = (a_array: FieldArray, z_filter: unknown, sr_path: string, z_datatype: SerField): boolean => {
	// array
	if(Array.isArray(z_filter)) {
		// compare each item
		for(let i_item=0; i_item<a_array.length; i_item++) {
			// filter doesn't pass; reject match
			if(!apply_filter_any(a_array[i_item] as KnownEsDatatypes, z_datatype, z_filter[i_item] as GenericMatchCriteria, sr_path+'.'+i_item)) return false;
		}

		// passed
		return true;
	}

	// other
	throw TypeError(`Invalid filter value for reference: ${typeof z_filter} at ${sr_path}`);
};

const apply_filter_bytes = (z_value: Uint8Array, z_match: unknown, sr_path: string): boolean => {
	// assert match type
	if(!(z_match instanceof Uint8Array)) {
		throw TypeError(`${typeof z_match} is not an acceptable filter value for bytes field ${sr_path}`);
	}

	// compare stringified base64
	return buffer_to_base64(z_match) === buffer_to_base64(z_value);
};

const apply_filter_object = (z_value: JsonObject, z_match: unknown, sr_path: string): boolean => {
	// assert match type
	if(!is_dict_es(z_match)) {
		throw TypeError(`${typeof z_match} is not an acceptable filter value for object field ${sr_path}`);
	}

	// each key
	for(const [si_key, z_arg] of ode(z_match)) {
		// skip undefined
		if(__UNDEFINED === z_arg) continue;

		// compare stringified JSON
		if(JSON.stringify(z_arg) !== JSON.stringify(z_value[si_key])) return false;
	}

	// passed
	return true;
};

const apply_set_filter = <
	z_value,
	z_match,
	a_rest extends any[],
>(
	f_filter: (z_value: z_value, z_match: z_match, si_field: string, ...a_rest: a_rest) => boolean,
	z_value: z_value, z_match: Settable<z_match>, si_field: string, ...a_rest: a_rest
): boolean => {
	// containment
	if(z_match instanceof Set) {
		// each item in set
		for(const z_check of z_match) {
			// found a match; next field
			if(f_filter(z_value, z_check, si_field, ...a_rest)) return true;
		}

		// not found in set; next candidate
		return false;
	}

	// filter doesn't match; next candidate
	return f_filter(z_value, z_match, si_field, ...a_rest);
};

export function apply_filter_struct(g_item: FieldStruct, h_fields: GenericStructMatchCriteria, s_path: string, _h_schema_fields: SerFieldStruct): boolean {
	// check ách specified field
	for(const [si_field, z_match] of ode(h_fields)) {
		// build local path
		const sr_path = s_path+'.'+si_field;

		// key not in fields; ignore
		if(!(si_field in _h_schema_fields)) continue;

		// ref actual value
		const z_value = g_item[si_field];

		// ref datatype
		const z_datatype = _h_schema_fields[si_field as FieldLabel];

		// filter doesn't match; next candidate
		if(!apply_filter_any(z_value, z_datatype, z_match, sr_path)) return false;
	}

	// passed
	return true;
}

function apply_filter_any(z_value: KnownEsDatatypes, z_datatype: SerField, z_match: GenericMatchCriteria, sr_path: string): boolean {
	// skip undefined
	if(__UNDEFINED === z_match) return true;

	// primitive field
	if('number' === typeof z_datatype) {
		// depending on tag
		switch(z_datatype) {
			// bytes
			case PrimitiveDatatype.BYTES: {
				// assert value type
				if(!z_value) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be a plain object but instead found: ${typeof z_value}`);
				}

				// apply bytes filer
				return apply_set_filter(apply_filter_bytes, z_value as Uint8Array, z_match, sr_path);
			}

			// object
			case PrimitiveDatatype.OBJECT: {
				// expects null
				if(null === z_match) {
					if(null !== z_value) return false;
				}

				// assert value type
				if(!is_dict_es(z_value)) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be a plain object but instead found: ${typeof z_value}`);
				}

				// apply object filter
				return apply_set_filter(apply_filter_object, z_value, z_match, sr_path);
			}

			// other
			default: {
				// regex
				if(z_match instanceof RegExp) {
					// not a match; next candidate
					if(!z_match.test((z_value as Exclude<KnownEsPrimitiveDatatypes, JsonObject>)+'')) return false;
				}
				// containment
				else if(z_match instanceof Set) {
					// not in set; next candidate
					if(!z_match.has(z_value as KnownEsPrimitiveDatatypes)) return false;
				}
				// not acceptable type
				else if(!['number', 'bigint', 'string'].includes(typeof z_match)) {
					throw TypeError(`${typeof z_match} is not an acceptable filter value for primitive type field ${sr_path}`);
				}
				// using equality to compare, not a match; next candidate
				else if(z_match !== z_value) {
					return false;
				}

				return true;
			}
		}
	}
	// tagged field
	else {
		// destructure datatype
		const [xc_tag] = z_datatype as SerTaggedDatatype;

		// depending on tag
		switch(xc_tag) {
			// ref type
			case TaggedDatatype.REF: {
				// value is not an item ref
				if(!(z_value instanceof ItemRef)) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be an item reference but instead found: ${typeof z_value}`);
				}

				// apply ref filter
				return apply_set_filter(apply_filter_ref, z_value, z_match, sr_path);
			}

			// array
			case TaggedDatatype.ARRAY: {
				// value is not an array
				if(!(z_value instanceof FieldArray)) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be an array but instead found: ${typeof z_value}`);
				}

				// apply array filter
				return apply_set_filter(apply_filter_array, z_value, z_match, sr_path, z_datatype[1] as SerField);
			}

			// tuple
			case TaggedDatatype.TUPLE: {
				// value is not an tuple
				if(!Array.isArray(z_value)) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be a tuple (array) but instead found: ${typeof z_value}`);
				}

				// apply tuple filter
				return apply_set_filter(apply_filter_tuple, z_value, z_match, sr_path, z_datatype[1] as SerField[]);
			}

			// struct
			case TaggedDatatype.STRUCT: {
				// value is not a struct
				if(!is_dict_es(z_value)) {
					throw new SchemaError(`Expected field value for '${sr_path}' to be a struct (object) but instead found: ${typeof z_value}`);
				}

				// apply struct filter
				return apply_set_filter(apply_filter_struct, z_value as FieldStruct, z_match as GenericStructMatchCriteria, sr_path, z_datatype[1] as SerFieldStruct);
			}

			// switch
			case TaggedDatatype.SWITCH: {
				throw new Error(`Filtering on switches not yet implemented`);
			}

			// unknown
			default: {
				throw new SchemaError(`Attempted to filter against a field having an unknown datatype: '${sr_path}'`);
			}
		}
	}
}
