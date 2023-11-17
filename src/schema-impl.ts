import type {L} from 'ts-toolbelt';

import type {SchemaSimulator, SchemaBuilder, SchemaSpecifier, AcceptablePartTuples, StrictSchema} from './schema-types';
import type {FieldLabel, SerField, SerFieldStruct, SerKeyStruct, SerSchema, SerTaggedDatatype} from './types';

import type {Dict, Arrayable, DiscriminatedUnion} from '@blake.regalia/belt';

import {__UNDEFINED, fodemtv, is_dict_es, ode} from '@blake.regalia/belt';

import {NL_MAX_PART_FIELDS} from './constants';

import {Bug, SchemaError} from './errors';
import {PrimitiveDatatype, TaggedDatatype} from './schema-types';


type SchemaCounter = SchemaBuilder<SchemaSimulator, symbol[], Dict<CountedValues>>;

type SchemaSerializer = SchemaBuilder<ReturnType<typeof spec_for_ser>, symbol[], Dict<any>>;


const $_COUNTER = Symbol('field-counter');
const $_COUNT = Symbol('field-count');


export type CountedValues = {
	[$_COUNT]: number;
	subcounts?: {
		array: CountedValues;
	} | {
		tuple: CountedValues[];
	} | {
		struct: Dict<CountedValues>;
	} | {
		switch: Dict<CountedValues>;
	};
};

const spec_for_count = (): SchemaSimulator<Arrayable<CountedValues>> & {[$_COUNTER]: number} => {
	let c_fields = 0;

	const f_countable = (): CountedValues => ({
		[$_COUNT]: ++c_fields,
	});

	return {
		get [$_COUNTER]() {
			return c_fields;
		},

		int: f_countable,
		bigint: f_countable,
		double: f_countable,
		str: f_countable,
		bytes: f_countable,
		obj: f_countable,
		ref: f_countable,
		arr: f_sub => ({
			[$_COUNT]: ++c_fields,
			subcounts: {
				array: f_sub(spec_for_count()) as CountedValues,
			},
		}),
		tuple: f_sub => ({
			[$_COUNT]: ++c_fields,
			subcounts: {
				tuple: f_sub(spec_for_count() as SchemaSimulator<Arrayable<CountedValues>[]> & {[$_COUNTER]: number}),
			},
		}),
		struct: f_sub => ({
			[$_COUNT]: ++c_fields,
			subcounts: {
				struct: f_sub(spec_for_count()) as Dict<CountedValues>,
			},
		}),
		switch: (si_dep, w_classifier, h_switch) => ({
			[$_COUNT]: ++c_fields,
			subcounts: {
				switch: fodemtv(h_switch, (w_value, si_key): CountedValues => {
					const z_simulation = h_switch[si_key!](spec_for_count()) as unknown as CountedValues;

					// tuple shorthand
					if(Array.isArray(z_simulation)) {
						return {
							[$_COUNT]: 1,
							subcounts: {
								tuple: z_simulation,
							},
						};
					}
						// dict
					else if(is_dict_es(z_simulation)) {
						// not counted values, is struct shorthand
						if(!z_simulation[$_COUNT]) {
							return {
								[$_COUNT]: 1,
								subcounts: {
									struct: z_simulation as unknown as Dict<CountedValues>,
								},
							};
						}
					}

					// as-is
					return z_simulation;
				}),
			},
		}),
	};
};



type ShapedFields = {
	fieldIndex(si_field: string): number;
	access(i_field: number): DiscriminatedUnion<CountedValues['subcounts']>;
};

type ShapeDescriptor = [
	i_field: number,
	z_field: SerField | ShapeDescriptor,
	w_part?: symbol,
];

const spec_for_ser: (g_shape: ShapedFields, i_field?: number) => SchemaSimulator<ShapeDescriptor> = (g_shape, i_field=0) => ({
	int: (w_part?: any) => [++i_field, PrimitiveDatatype.INT, w_part],
	bigint: (w_part?: any) => [++i_field, PrimitiveDatatype.BIGINT, w_part],
	double: () => [++i_field, PrimitiveDatatype.DOUBLE],
	str: (w_part?: any) => [++i_field, PrimitiveDatatype.STRING, w_part],
	bytes: () => [++i_field, PrimitiveDatatype.BYTES],
	obj: () => [++i_field, PrimitiveDatatype.OBJECT],
	ref: g_item => [++i_field, [TaggedDatatype.REF, g_item.domain]],
	arr: (f_sub) => {
		const g_subcounted = g_shape.access(++i_field);
		const g_subshape = bind_shaper([g_subcounted.array]);
		return [i_field, [TaggedDatatype.ARRAY, f_sub(spec_for_ser(g_subshape))]];
	},
	tuple: (f_sub) => {
		const g_subshape = bind_shaper(g_shape.access(++i_field).tuple!);
		return [i_field, [TaggedDatatype.TUPLE, f_sub(spec_for_ser(g_subshape) as unknown as SchemaSimulator<ShapeDescriptor[]>)]];
	},
	struct: (f_sub) => {
		const g_subshape = bind_shaper(g_shape.access(++i_field).struct!);
		return [i_field, [TaggedDatatype.STRUCT, f_sub(spec_for_ser(g_subshape))]];
	},
	switch: (si_dep, w_classifier, h_switch) => {
		const h_positions = g_shape.access(++i_field).switch!;

		return [i_field, [
			TaggedDatatype.SWITCH,
			g_shape.fieldIndex(si_dep),
			fodemtv(h_switch, (f_sub, w_key) => {
				const g_subshape = bind_shaper([h_positions[w_key!]]);
				return f_sub(spec_for_ser(g_subshape));
			}),
		]];
	},
});


const bind_shaper = (h_probe: Record<string | number, any> | any[]): ShapedFields & {
	_dbg_probe: typeof h_probe;
	_dbg_keys: string[];
	_dbg_values: any[];
} => {
	const a_keys = Object.keys(h_probe);
	const a_values = Object.values(h_probe);

	return {
		_dbg_probe: h_probe,
		_dbg_keys: a_keys,
		_dbg_values: a_values,

		access(i_field) {
			return a_values[i_field-1].subcounts;
		},

		fieldIndex(si_field) {
			return a_keys.indexOf(si_field) + 1;
		},
	};
};

function validate_counted(g_counted: CountedValues, sr_path: string, i_count=0) {
	const {
		[$_COUNT]: n_check,
		subcounts: g_subcounts,
	} = g_counted as CountedValues & {
		subcounts?: DiscriminatedUnion<CountedValues['subcounts']>;
	};

	const sr_local = sr_path+'.'+i_count;

	// subcounts exist
	if(g_subcounts) {
		// nested
		if(is_dict_es(g_subcounts)) {
			// array
			if(g_subcounts.array) {
				validate_counted(g_subcounts.array, sr_local);
			}
			// tuple
			else if(g_subcounts.tuple) {
				const a_subcounts = g_subcounts.tuple;

				// each member
				for(let i_member=0; i_member<a_subcounts.length; i_member++) {
					validate_counted(a_subcounts[i_member], sr_local, i_member);
				}
			}
			// struct
			else if(g_subcounts.struct) {
				// get as entries
				const a_entries = Object.entries(g_subcounts.struct);

				// each entry
				for(let i_entry=0; i_entry<a_entries.length; i_entry++) {
					const [si_key, g_subcounted] = a_entries[i_entry];

					validate_counted(g_subcounted, sr_local+'.'+si_key, i_entry);
				}
			}
			// switch
			else if(g_subcounts.switch) {
				const h_switch = g_subcounts.switch;

				// each option
				for(const [si_option, g_subcount] of ode(h_switch)) {
					validate_counted(g_subcount, sr_local+'@'+si_option);
				}
			}
		}
		// other
		else {
			debugger;
		}
	}

	// assert count matches index
	if(i_count + 1 !== n_check) {
		throw new Bug(`counted schema index misalignement in ${sr_local}`);
	}
}

function assert_counts_match_in_struct(h_probe: Dict<CountedValues>, g_counter: {[$_COUNTER]: number}, si_domain: string) {
	// get as entries
	const a_entries = Object.entries(h_probe);

	// check counts match
	if(g_counter[$_COUNTER] !== a_entries.length) {
		const b_overcounted = g_counter[$_COUNTER] > a_entries.length;
		throw new SchemaError(`field count mismatch in schema builder for "${si_domain}"; ${b_overcounted? 'too many datatypes': 'too few datatypes'}`);
	}

	// each entry
	for(let i_entry=0; i_entry<a_entries.length; i_entry++) {
		const [si_key, g_counted] = a_entries[i_entry];

		validate_counted(g_counted, si_domain+':'+si_key, i_entry);
	}
}

function reshape_tagged_value([xc_type, w_info, w_extra]: SerTaggedDatatype, sr_local: string): SerTaggedDatatype {
	// prep list of mids to occupy the data members of a serialized tagged datatype
	let a_mids = [w_info] as L.Tail<SerTaggedDatatype>;

	// depending on type
	switch(xc_type) {
		// trivial. unwrap
		case TaggedDatatype.REF:
		case TaggedDatatype.ARRAY: {
			const sr_inner = sr_local+(TaggedDatatype.ARRAY === xc_type? '[]': '<>');
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
		const [si_key, [i_mark, w_type, z_symbol]] = a_entries[i_field];

		const sr_local = sr_path+'.'+si_key;

		// misalignment
		if(i_mark !== i_field+1) {
			throw new SchemaError(`detected field misalignment in schema builder for at ${sr_local}`);
		}

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
			h_keys[si_key as keyof SerKeyStruct] = w_type;
		}
		// field
		else {
			let w_ser: SerField;

			// tagged type
			if(Array.isArray(w_type)) {
				w_ser = reshape_tagged_value(w_type as SerTaggedDatatype, sr_local);

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


/**
 * Takes a schema builder and produces the serialized representation of that schema
 * @param si_domain 
 * @param f_schema 
 * @returns 
 */
export function interpret_schema<a_parts extends AcceptablePartTuples>(
	si_domain: string,
	f_schema: SchemaBuilder<SchemaSpecifier, a_parts, StrictSchema>
): SerSchema {
	// allow up to 8 part fields
	const a_simulators: symbol[] = [];
	for(let i_part=0; i_part<NL_MAX_PART_FIELDS; i_part++) {
		a_simulators.push(Symbol(`${si_domain}.part-simulator#${i_part+1}`));
	}

	// locate fields that can be ommitted from serialized form
	const g_counter = spec_for_count();
	const h_probe = (f_schema as unknown as SchemaCounter)(g_counter, ...a_simulators);

	// 
	assert_counts_match_in_struct(h_probe, g_counter, si_domain);

	// 
	const g_shape = bind_shaper(h_probe);

	// build 
	const h_shape = (f_schema as unknown as SchemaSerializer)(spec_for_ser(g_shape), ...a_simulators);

	// extract keys and fields
	const {
		keys: h_keys,
		fields: h_fields,
	} = reshape_fields(si_domain, h_shape, a_simulators);

	// construct ser schema
	return [1, h_keys, h_fields];
}
