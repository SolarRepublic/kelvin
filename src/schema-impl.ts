import type {L} from 'ts-toolbelt';

import type {SchemaSimulator, SchemaBuilder, PartableSchemaSpecifier, AcceptablePartTuples, StructuredSchema, PartableDatatype, Datatype} from './schema-types';
import type {FieldCode, FieldLabel, SerField, SerFieldStruct, SerKeyStruct, SerSchema, SerTaggedDatatype} from './types';

import type {Dict, DiscriminatedUnion} from '@blake.regalia/belt';

import {F_IDENTITY, __UNDEFINED, fodemtv, is_dict_es, ode} from '@blake.regalia/belt';

import {NL_MAX_PART_FIELDS} from './constants';

import {ItemController} from './controller';
import {Bug, SchemaError} from './errors';
import {PrimitiveDatatype, TaggedDatatype} from './schema-types';


type SchemaSerializer = SchemaBuilder<ReturnType<typeof spec_for_ser>, symbol[], Dict<SchemaAnnotation>>;


class SchemaAnnotation {
	constructor(protected _z_field: SerField, protected _w_part?: any) {}

	get serialized(): SerField {
		const {_z_field} = this;

		// if(Array.isArray(_z_field)) {
		// 	return [_z_field[0], ..._z_field[1].serialized];
		// }

		return _z_field;
	}

	get part(): any {
		return this._w_part;
	}
}

const annotation = (z_desc: SerField | SchemaAnnotation, w_part?: any): SchemaAnnotation => z_desc instanceof SchemaAnnotation? z_desc: new SchemaAnnotation(z_desc, w_part);

const spec_for_ser: (
	f_wrapper?: (w_datatype: SerField, w_part?: any) => SchemaAnnotation
) => SchemaSimulator<0 | 1, SchemaAnnotation> = (f_wrapper=(z, w) => annotation(z, w)) => ({
	int: (w_part?: any) => f_wrapper(PrimitiveDatatype.INT, w_part),
	bigint: (w_part?: any) => f_wrapper(PrimitiveDatatype.BIGINT, w_part),
	double: () => f_wrapper(PrimitiveDatatype.DOUBLE),
	str: (w_part?: any) => f_wrapper(PrimitiveDatatype.STRING, w_part),
	bytes: () => f_wrapper(PrimitiveDatatype.BYTES),
	obj: () => f_wrapper(PrimitiveDatatype.OBJECT),
	ref: g_item => f_wrapper([TaggedDatatype.REF, g_item.domain]),

	get array() {
		return spec_for_ser(w => annotation(f_wrapper([TaggedDatatype.ARRAY, w])));
	},

	get set() {
		return spec_for_ser(w => annotation(f_wrapper([TaggedDatatype.SET, w])));
	},

	get dict() {
		const w_return = spec_for_ser(w => annotation(f_wrapper([TaggedDatatype.DICT, w])));
		const g_desc = Object.getOwnPropertyDescriptors(w_return);
		return Object.defineProperties(() => w_return, g_desc) as SchemaSimulator<0, SchemaAnnotation>
		& (() => SchemaSimulator<0, SchemaAnnotation> & SchemaAnnotation);
		// return Object.assign(() => w_return, w_return)
	},

	tuple: (a_tuple: SchemaAnnotation[]) => annotation(f_wrapper([TaggedDatatype.TUPLE, a_tuple.map(k => k.serialized)])),

	struct: (h_struct: Dict<SchemaAnnotation>) => annotation(f_wrapper([TaggedDatatype.STRUCT, fodemtv(h_struct, k => k.serialized)])),

	registry: (h_reg: Dict<SchemaAnnotation>) => annotation(f_wrapper([TaggedDatatype.REGISTRY, fodemtv(h_reg, k => k.serialized)])),

	switch: (si_dep, w_classifier, h_switch) => annotation(f_wrapper([TaggedDatatype.SWITCH, si_dep as FieldLabel, fodemtv(h_switch, k_option => k_option.serialized)])),
});

function reshape_tagged_value([xc_type, w_info, w_extra]: SerTaggedDatatype, sr_local: string): SerTaggedDatatype {
	// prep list of mids to occupy the data members of a serialized tagged datatype
	let a_mids = [w_info] as L.Tail<SerTaggedDatatype>;

	// depending on type
	switch(xc_type) {
		// // ref
		// case TaggedDatatype.REF: {
		// 	const sr_inner = sr_local+'<>';
		// 	// a_mids[0] = reshape_fields(sr_inner, [w_info]).fields['0' as FieldLabel];
		// 	// a_mids[0] = w_info;
		// 	break;
		// }

		// array
		case TaggedDatatype.ARRAY: {
			const sr_inner = sr_local+'[]';
			a_mids[0] = reshape_fields(sr_inner, [w_info]).fields['0' as FieldLabel];
			break;
		}

		// set
		case TaggedDatatype.SET: {
			const sr_inner = sr_local+'<>';
			a_mids[0] = reshape_fields(sr_inner, [w_info]).fields['0' as FieldLabel];
			break;
		}

		// dict
		case TaggedDatatype.DICT: {
			const sr_inner = sr_local+'<>';
			a_mids[0] = reshape_fields(sr_inner, [w_info]).fields['0' as FieldLabel];
			break;
		}

		// tuple
		case TaggedDatatype.TUPLE: {
			const h_reshaped = reshape_fields(sr_local, w_info).fields;
			a_mids[0] = Object.values(h_reshaped);
			break;
		}

		// struct
		case TaggedDatatype.STRUCT: {
			a_mids[0] = reshape_fields(sr_local, w_info).fields;
			break;
		}

		// registry
		case TaggedDatatype.REGISTRY: {
			a_mids[0] = reshape_fields(sr_local, w_info).fields;
			break;
		}

		// switch
		case TaggedDatatype.SWITCH: {
			const h_options = w_extra as Dict<[number, SerTaggedDatatype]>;
			a_mids = [w_info, fodemtv(h_options, (z_value, si_option) => {
				// tuple shorthand
				if(Array.isArray(z_value) && Array.isArray(z_value[0])) {
					z_value = [1, [TaggedDatatype.TUPLE, z_value as SerField[]]];
				}
				// struct shorthand
				else if(is_dict_es(z_value)) {
					z_value = [1, [TaggedDatatype.STRUCT, z_value as SerFieldStruct]];
				}

				return reshape_fields(sr_local+'['+si_option+']', [z_value]).fields['0' as FieldLabel];
			})];
			break;
		}

		default: {
			break;
		}
	}

	return [xc_type, ...a_mids] as SerTaggedDatatype;
}


function reshape_fields(
	sr_path: string,
	h_shape: ReturnType<SchemaSerializer>,
	a_simulators?: symbol[]
): {
		keys: SerKeyStruct;
		fields: SerFieldStruct;
	} {
	// prep components of serialized schema
	const h_keys: SerKeyStruct = {};
	const h_fields: SerFieldStruct = {};

	// index of last part
	let i_last_part = -1;

	// each entry in shape
	const a_entries = ode(h_shape);
	for(let i_field=0; i_field<a_entries.length; i_field++) {
		const [si_key, z_type] = a_entries[i_field];

		const [w_type, z_symbol] = z_type instanceof SchemaAnnotation? [z_type.serialized, z_type.part]: [z_type];

		const sr_local = sr_path+'.'+si_key;

		// part key
		if('symbol' === typeof z_symbol) {
			// not allowed here
			if(!a_simulators) {
				throw new SchemaError(`part keys not allowed in nested fields; violation at ${sr_local}`);
			}

			// find position of part key
			const i_part = a_simulators.indexOf(z_symbol);

			// not aligned with schema
			if(i_part !== i_field) {
				throw new SchemaError(`detected part key #${i_part+1} being used at ${sr_local} at relative position #${i_field+1}, which is out of order`);
			}

			// not contiguous
			if(i_part !== i_last_part+1) {
				throw new SchemaError(`part key #${i_part+1} (${sr_local}) must be moved to field position #${i_last_part+1}; part keys must be contigious`);
			}

			// not primitive
			if('number' !== typeof w_type) {
				throw new SchemaError(`cannot use complex type part key; violation found at ${sr_local} field`);
			}

			// update last part
			i_last_part = i_part;

			// add to keys
			h_keys[si_key as keyof SerKeyStruct] = w_type as PartableDatatype;
		}
		// field
		else {
			let w_ser: SerField;

			// tagged type
			if(Array.isArray(w_type)) {
				w_ser = reshape_tagged_value(w_type, sr_local);

				// // create per-serialized schema value
				// w_ser = [xc_type, ...a_mids] as SerTaggedDatatype;
			}
			// primitive
			else {
				w_ser = w_type;
			}

			h_fields[si_key as keyof SerFieldStruct] = w_ser;
		}
	}

	return {
		keys: h_keys,
		fields: h_fields,
	};
}


// /**
//  * Takes a schema builder and produces the serialized representation of that schema
//  * @param si_domain 
//  * @param f_schema 
//  * @returns 
//  */
// export function interpret_schema<a_parts extends AcceptablePartTuples>(
// 	si_domain: string,
// 	f_schema: SchemaBuilder<SchemaSimulator<1>, a_parts, StructuredSchema>
// ): SerSchema {
// 	// allow up to 8 part fields
// 	const a_simulators: symbol[] = [];
// 	for(let i_part=0; i_part<NL_MAX_PART_FIELDS; i_part++) {
// 		a_simulators.push(Symbol(`${si_domain}.part-simulator#${i_part+1}`));
// 	}

// 	// locate fields that can be ommitted from serialized form
// 	const g_counter = spec_for_count();
// 	const h_probe = (f_schema as unknown as SchemaCounter)(g_counter, ...a_simulators);

// 	// 
// 	assert_counts_match_in_struct(h_probe, g_counter, si_domain);

// 	// 
// 	const g_shape = bind_shaper(h_probe);

// 	// build 
// 	const h_shape = (f_schema as unknown as SchemaSerializer)(spec_for_ser(g_shape), ...a_simulators);

// 	// extract keys and fields
// 	const {
// 		keys: h_keys,
// 		fields: h_fields,
// 	} = reshape_fields(si_domain, h_shape, a_simulators);

// 	// construct ser schema
// 	return [1, h_keys, h_fields];
// }

type SchemaQualifier = any;

function struct_to_serfield(h_struct: Dict<SchemaQualifier>): SerFieldStruct {
	return fodemtv(h_struct, (z_value) => {
		// // destructure entry
		// const [si_key, z_value] = a_entries[i_field];

		// annotation
		if(z_value instanceof SchemaAnnotation) {
			return z_value.serialized;
		}
		// tuple
		else if(Array.isArray(z_value)) {
			return [TaggedDatatype.TUPLE, z_value as SerField[]];
		}
		// reference
		else if(z_value instanceof ItemController) {
			return [TaggedDatatype.REF, z_value.domain];
		}
		// struct
		else if(is_dict_es(z_value)) {
			return [TaggedDatatype.STRUCT, struct_to_serfield(z_value as Dict<SchemaQualifier>)];
		}
		// string
		else if('string' === typeof z_value) {
			return [PrimitiveDatatype.STRING];
		}
		// number
		else if('number' === typeof z_value) {
			// integer
			if(Number.isInteger(z_value)) {
				return [PrimitiveDatatype.INT];
			}
			// double
			else {
				return [PrimitiveDatatype.DOUBLE];
			}
		}
		// other
		else {
			throw TypeError(`Invalid field type for schema specifier: ${z_value}`);
		}
	});
}

export function interpret_schema<a_parts extends AcceptablePartTuples>(
	si_domain: string,
	f_schema: SchemaBuilder<SchemaSimulator<1>, a_parts, Dict<SchemaAnnotation>>
): SerSchema {
	// allow up to 8 part fields
	const a_simulators: symbol[] = [];
	for(let i_part=0; i_part<NL_MAX_PART_FIELDS; i_part++) {
		a_simulators.push(Symbol(`${si_domain}.part-simulator#${i_part+1}`));
	}

	// interpret schema
	const h_probe = f_schema(spec_for_ser(), ...a_simulators as a_parts);

	// extract keys and fields
	const {
		keys: h_keys,
		fields: h_fields,
	} = reshape_fields(si_domain, h_probe, a_simulators);

	// construct ser schema
	return [1, h_keys, h_fields];
}
