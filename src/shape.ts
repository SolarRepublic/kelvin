import type {L} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {SchemaSimulator, SchemaBuilder, SubschemaBuilder} from './schema';
import type {FieldLabel, SerField, SerFieldStruct, SerKeyStruct, SerSchema, SerTaggedDatatype} from './types';

import type {JsonValue, Dict} from '@blake.regalia/belt';

import {assert} from 'console';

import {__UNDEFINED, fodemtv, is_dict_es, ode} from '@blake.regalia/belt';

import {NL_MAX_PART_FIELDS} from './constants';


import {ItemController} from './controller';
import {SchemaError} from './errors';
import {PrimitiveDatatype, TaggedDatatype} from './schema';



// const F_STRINGIFY = (w_input: any) => w_input+'';

// const F_NUMERIZE = (s_part: string) => +s_part;


// const undef_or = (w_test: any, w_value: any) => __UNDEFINED === w_test? w_test: w_value;



type KeyPartDescriptor = {
	symbol: symbol;
	// keyify: (w_input: any) => string;
	// parse: (s_part: string) => any;
};

type TupleMemberDescriptor = {
	// only here so that conditions can use discriminated union
	symbol?: undefined;
	default: JsonValue;
	index: number;
};


type FieldDescriptor = KeyPartDescriptor | TupleMemberDescriptor;

const $_COUNTER = Symbol('field-counter');

type CountedValues = symbol | number | [number, CountedValues];

const spec_for_count = (): SchemaSimulator<CountedValues> & {[$_COUNTER]: number} => {
	let c_fields = 0;

	// const f_partable = (z_code?: any) => z_code ?? ++c_fields;
	const f_countable = () => ++c_fields;

	const f_subable = (f_sub: SubschemaBuilder<any>) => [++c_fields, f_sub(spec_for_count())];

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
		arr: f_subable,
		struct: f_subable,
		switch: (si_dep, w_classifier, h_switch) => {
			const g_out = fodemtv(h_switch, (w_value, si_key) => h_switch[si_key!](spec_for_count()));
			return [++c_fields, g_out];
		},
	};
};



type ShapedFields = {
	fieldIndex(si_field: string): number;
	access(i_field: number): ShapedFields;
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
		const w_type = g_shape.access(i_field);
		debugger;
		return [++i_field, [TaggedDatatype.ARRAY, f_sub(spec_for_ser(w_type))]];
	},
	// @ts-expect-error bc i said so
	struct: (f_sub) => {
		debugger;
		return [++i_field, [TaggedDatatype.STRUCT, f_sub(spec_for_ser(bind_shaper(g_shape.access(i_field))))]];
	},
	switch: (si_dep, w_classifier, h_switch) => {
		const h_positions = g_shape.access(++i_field);
		debugger;

		// const g_subser = spec_for_ser(h_types);

		return [i_field, [
			TaggedDatatype.SWITCH,
			g_shape.fieldIndex(si_dep),
			fodemtv(h_switch, (f_sub, w_key) => {
				debugger;
				const g_subshape = bind_shaper(h_positions[w_key]);
				return f_sub(spec_for_ser(g_subshape));
			}),
		]];
	},
});


const bind_shaper = (h_probe: Dict<any>): ShapedFields & {
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
			const [, w_type] = a_values[i_field-1];

			return w_type;
		},

		fieldIndex(si_field) {
			return a_keys.indexOf(si_field) + 1;
		},
	};
};

function assert_counts_match(h_probe: Dict, g_counter: {[$_COUNTER]: number}, si_domain: string) {
	// get as entries
	const a_entries = Object.entries(h_probe);

	// check counts match
	if(g_counter[$_COUNTER] !== a_entries.length) {
		throw new SchemaError(`field count mismatch in schema builder for ${si_domain}`);
	}

	// each field
	for(const [si_key, z_value] of ode(h_probe)) {
		// nested
		if(Array.isArray(z_value)) {
			// switch(z_value[0]) {
			// 	case TaggedDatatype.ARRAY: {
			// 		assert_counts_match(z_value[1])
			// 	}

			// 	default: {
			// 		debugger;
			// 	}
			// }
			debugger;
			// assert_counts_match(z_value);
		}
	}
}



function reshape_fields(
	si_domain: string,
	h_shape: ReturnType<SchemaBuilder<ReturnType<typeof spec_for_ser>>>,
	a_simulators?: symbol[]
): [SerKeyStruct, SerFieldStruct] {
	// prep components of serialized schema
	const h_keys: SerKeyStruct = {};
	const h_fields: SerFieldStruct = {};

	// index of last part
	let i_last_part = -1;

	// each entry in shape
	const a_entries = ode(h_shape);
	for(let i_field=0; i_field<a_entries.length; i_field++) {
		const [si_key, [i_mark, w_type, z_symbol]] = a_entries[i_field];

		// misalignment
		if(i_mark !== i_field+1) {
			throw new SchemaError(`detected field misalignment in schema builder for "${si_domain}" domain around the "${si_key}" property`);
		}

		// part key
		if('symbol' === typeof z_symbol) {
			// not allowed here
			if(!a_simulators) {
				throw new SchemaError(`part keys not allowed in nested fields; violation at "${si_key}"`);
			}

			// find position of part key
			const i_part = a_simulators.indexOf(z_symbol);

			// not aligned with schema
			if(i_part !== i_field) {
				throw new SchemaError(`detected part key #${i_part+1} being used in the "${si_key}" field at position #${i_field+1}, which is out of order`);
			}

			// not contiguous
			if(i_part !== i_last_part+1) {
				throw new SchemaError(`part key #${i_part+1} must be move to field position #${i_last_part+1}; part keys must be contigious`);
			}

			// not primitive
			if('number' !== typeof w_type) {
				throw new SchemaError(`cannot use complex type part key; violation found at "${si_key}" field`);
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
				// destructure
				const [xc_type, w_info] = w_type as SerTaggedDatatype;

				// prep list of mids to occupy the data members of a serialized tagged datatype
				const a_mids = [w_info] as L.Tail<SerTaggedDatatype>;

				// depending on type
				switch(xc_type) {
					// trivial. keep as-is
					case TaggedDatatype.REF:
					case TaggedDatatype.ARRAY: {
						break;
					}

					// struct
					case TaggedDatatype.STRUCT: {
						a_mids[0] = reshape_fields(si_domain, w_info)[1];
						break;
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

				w_ser = [xc_type, ...a_mids] as SerTaggedDatatype;
			}
			// primitive
			else {
				w_ser = w_type;
			}

			h_fields[si_key as keyof SerFieldStruct] = w_ser;
		}
	}

	return [
		h_keys,
		h_fields,
	];
}

export function interpret_schema(
	si_domain: string,
	f_schema: SchemaBuilder<SchemaSimulator, Key[]>
): SerSchema {
	// allow up to 8 part fields
	const a_simulators = [];
	for(let i_part=0; i_part<NL_MAX_PART_FIELDS; i_part++) {
		a_simulators.push(Symbol(`${si_domain}.part-simulator#${i_part+1}`));
	}

	// locate fields that can be ommitted from serialized form
	const g_counter = spec_for_count();
	const h_probe = f_schema(g_counter, a_simulators);

	// 
	assert_counts_match(h_probe, g_counter, si_domain);

	// 
	const g_shape = bind_shaper(h_probe);

	// build 
	const h_shape = (f_schema as SchemaBuilder<ReturnType<typeof spec_for_ser>>)(spec_for_ser(g_shape), a_simulators);

	// extract keys and fields
	const [h_keys, h_fields] = reshape_fields(si_domain, h_shape, a_simulators);

	// construct ser schema
	return [1, h_keys, h_fields];
}



enum Category {
	UNKNOWN=0,
	SOME=1,
	OTHER=2,
}

// const Chains = new ItemController({
// 	client: k_
// });


// @ts-expect-error backwards inference for parts
const ex_schema: SchemaBuilder = (k, [xc_cat, s_id]: [Category, string]) => ({
	category: k.int(xc_cat),
	id: k.str(s_id),
	dbl: k.double(),
	counter: k.bigint(),
	notes: k.str(),
	pubkey: k.bytes(),
	other: k.obj(),
	// chains: k.arr(k => k.ref(Chains)),
	data: k.struct(k1 => ({
		name: k1.str(),
		color: k1.str(),
	})),
	more: k.switch('category', xc_cat, {
		[Category.UNKNOWN]: k1 => k1.int(),
		[Category.SOME]: k1 => k1.bytes(),
		[Category.OTHER]: k1 => ({
			one: k1.str(),
			two: k1.bigint(),
		}),
	}),
});

const a_test = interpret_schema('test', ex_schema);

debugger;

// dest:
const h_dest = [{
	category: PrimitiveDatatype.INT,
	id: PrimitiveDatatype.STRING,
}, {
	counter: PrimitiveDatatype.BIGINT,
	notes: PrimitiveDatatype.STRING,
	chains: [TaggedDatatype.ARRAY,
		[TaggedDatatype.REF, 'chains'],
	],
	data: [TaggedDatatype.STRUCT, {
		name: PrimitiveDatatype.STRING,
		color: PrimitiveDatatype.STRING,
	}],
	other: PrimitiveDatatype.OBJECT,
}];
