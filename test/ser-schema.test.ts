import type {SchemaBuilder, PartableSchemaSpecifier} from '../src/schema-types';

import {describe, expect, it} from 'vitest';

import {interpret_schema} from '../src/schema-impl';
import {PrimitiveDatatype, TaggedDatatype} from '../src/schema-types';

enum Category {
	UNKNOWN=0,
	PRIMITIVE=1,
	ARRAY=2,
	TUPLE=3,
	STRUCT=4,
	TUPLE_SHORTHAND=5,
	STRUCT_SHORTHAND=6,
}

// @ts-expect-error lone declaration
const kitchen_sink: SchemaBuilder = (k: PartableSchemaSpecifier, xc_cat: Category, s_id: string) => ({
	part_int: k.int(xc_cat),
	part_str: k.str(s_id),
	int: k.int(),
	bigint: k.bigint(),
	double: k.double(),
	str: k.str(),
	bytes: k.bytes(),
	obj: k.obj(),
	// ref: k.ref(),
	arr_int: k.array.int(),
	arr_bigint: k.array.bigint(),
	arr_double: k.array.double(),
	arr_str: k.array.str(),
	arr_bytes: k.array.bytes(),
	arr_obj: k.array.obj(),
	arr_arr_str: k.array.array.str(),
	arr_arr_arr_str: k.array.array.array.str(),
	tuple_int: k.tuple([k.int()]),
	tuple_int_str: k.tuple([k.int(), k.str()]),
	tuple_int_str_arr_bytes: k.tuple([k.int(), k.str(), k.array.bytes()]),
	struct: k.struct({
		int: k.int(),
		bigint: k.bigint(),
		double: k.double(),
		str: k.str(),
		bytes: k.bytes(),
		obj: k.obj(),
		arr_int: k.array.int(),
	}),
	switch: k.switch('part_int', xc_cat, {
		[Category.UNKNOWN]: k.int(),
		[Category.PRIMITIVE]: k.str(),
		[Category.ARRAY]: k.array.str(),
		[Category.TUPLE]: k.tuple([k.str(), k.bytes()]),
		[Category.STRUCT]: k.struct({
			str: k.str(),
			obj: k.obj(),
		}),
		[Category.TUPLE_SHORTHAND]: k.tuple([k.str(), k.bytes()]),
		[Category.STRUCT_SHORTHAND]: k.struct({
			str: k.str(),
			obj: k.obj(),
		}),
	}),
});

const a_actual = interpret_schema('test', kitchen_sink);

// dest:
const a_expect = [1, {
	part_int: PrimitiveDatatype.INT,
	part_str: PrimitiveDatatype.STRING,
}, {
	int: PrimitiveDatatype.INT,
	bigint: PrimitiveDatatype.BIGINT,
	double: PrimitiveDatatype.DOUBLE,
	str: PrimitiveDatatype.STRING,
	bytes: PrimitiveDatatype.BYTES,
	obj: PrimitiveDatatype.OBJECT,
	// ref: k.ref(),
	arr_int: [TaggedDatatype.ARRAY, PrimitiveDatatype.INT],
	arr_bigint: [TaggedDatatype.ARRAY, PrimitiveDatatype.BIGINT],
	arr_double: [TaggedDatatype.ARRAY, PrimitiveDatatype.DOUBLE],
	arr_str: [TaggedDatatype.ARRAY, PrimitiveDatatype.STRING],
	arr_bytes: [TaggedDatatype.ARRAY, PrimitiveDatatype.BYTES],
	arr_obj: [TaggedDatatype.ARRAY, PrimitiveDatatype.OBJECT],
	arr_arr_str: [TaggedDatatype.ARRAY, [TaggedDatatype.ARRAY, PrimitiveDatatype.STRING]],
	arr_arr_arr_str: [TaggedDatatype.ARRAY, [TaggedDatatype.ARRAY, [TaggedDatatype.ARRAY, PrimitiveDatatype.STRING]]],
	tuple_int: [TaggedDatatype.TUPLE, [PrimitiveDatatype.INT]],
	tuple_int_str: [TaggedDatatype.TUPLE, [PrimitiveDatatype.INT, PrimitiveDatatype.STRING]],
	tuple_int_str_arr_bytes: [TaggedDatatype.TUPLE, [
		PrimitiveDatatype.INT,
		PrimitiveDatatype.STRING,
		[TaggedDatatype.ARRAY, PrimitiveDatatype.BYTES],
	]],
	struct: [TaggedDatatype.STRUCT, {
		int: PrimitiveDatatype.INT,
		bigint: PrimitiveDatatype.BIGINT,
		double: PrimitiveDatatype.DOUBLE,
		str: PrimitiveDatatype.STRING,
		bytes: PrimitiveDatatype.BYTES,
		obj: PrimitiveDatatype.OBJECT,
		arr_int: [TaggedDatatype.ARRAY, PrimitiveDatatype.INT],
	}],
	switch: [TaggedDatatype.SWITCH, 'part_int', {
		[Category.UNKNOWN]: PrimitiveDatatype.INT,
		[Category.PRIMITIVE]: PrimitiveDatatype.STRING,
		[Category.ARRAY]: [TaggedDatatype.ARRAY, PrimitiveDatatype.STRING],
		[Category.TUPLE]: [TaggedDatatype.TUPLE, [PrimitiveDatatype.STRING, PrimitiveDatatype.BYTES]],
		[Category.STRUCT]: [TaggedDatatype.STRUCT, {
			str: PrimitiveDatatype.STRING,
			obj: PrimitiveDatatype.OBJECT,
		}],
		[Category.TUPLE_SHORTHAND]: [TaggedDatatype.TUPLE, [PrimitiveDatatype.STRING, PrimitiveDatatype.BYTES]],
		[Category.STRUCT_SHORTHAND]: [TaggedDatatype.STRUCT, {
			str: PrimitiveDatatype.STRING,
			obj: PrimitiveDatatype.OBJECT,
		}],
	}],
}];

describe('kitchen sink', () => {
	it('schema matches', () => {
		expect(a_actual).toMatchObject(a_expect);
	});
});

