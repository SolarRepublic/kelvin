import {ItemController} from 'src/controller';
import {item_prototype} from 'src/item-proto';
import {interpret_schema} from 'src/schema-impl';
import {PrimitiveDatatype, TaggedDatatype, type SchemaBuilderDeprecated} from 'src/schema-types';
import {describe, expect, it} from 'vitest';

enum Category {
	UNKNOWN=0,
	PRIMITIVE=1,
	ARRAY=2,
	TUPLE=3,
	STRUCT=4,
	TUPLE_SHORTHAND=5,
	STRUCT_SHORTHAND=6,
}

// @ts-expect-error backwards inference for parts
const kitch_sink: SchemaBuilderDeprecated = (k, [xc_cat, s_id]: [Category, string]) => ({
	part_int: k.int(xc_cat),
	part_str: k.str(s_id),
	int: k.int(),
	bigint: k.bigint(),
	double: k.double(),
	str: k.str(),
	bytes: k.bytes(),
	obj: k.obj(),
	// ref: k.ref(),
	arr_int: k.arr(k1 => k1.int()),
	arr_bigint: k.arr(k1 => k1.bigint()),
	arr_double: k.arr(k1 => k1.double()),
	arr_str: k.arr(k1 => k1.str()),
	arr_bytes: k.arr(k1 => k1.bytes()),
	arr_obj: k.arr(k1 => k1.obj()),
	arr_arr_str: k.arr(k1 => k1.arr(k2 => k2.str())),
	arr_arr_arr_str: k.arr(k1 => k1.arr(k2 => k2.arr(k3 => k3.str()))),
	tuple_int: k.tuple(k1 => [k1.int()]),
	tuple_int_str: k.tuple(k1 => [k1.int(), k1.str()]),
	tuple_int_str_arr_bytes: k.tuple(k1 => [k1.int(), k1.str(), k1.arr(k2 => k2.bytes())]),
	struct: k.struct(k1 => ({
		int: k1.int(),
		bigint: k1.bigint(),
		double: k1.double(),
		str: k1.str(),
		bytes: k1.bytes(),
		obj: k1.obj(),
		arr_int: k1.arr(k2 => k2.int()),
	})),
	switch: k.switch('part_int', xc_cat, {
		[Category.UNKNOWN]: k1 => k1.int(),
		[Category.PRIMITIVE]: k1 => k1.str(),
		[Category.ARRAY]: k1 => k1.arr(k2 => k2.str()),
		[Category.TUPLE]: k1 => k1.tuple(k2 => [k2.str(), k2.bytes()]),
		[Category.STRUCT]: k1 => k1.struct(k2 => ({
			str: k2.str(),
			obj: k2.obj(),
		})),
		[Category.TUPLE_SHORTHAND]: k1 => [k1.str(), k1.bytes()],
		[Category.STRUCT_SHORTHAND]: k1 => ({
			str: k1.str(),
			obj: k1.obj(),
		}),
	}),
});

const a_actual = interpret_schema('test', kitch_sink);

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
	switch: [TaggedDatatype.SWITCH, 1, {
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

describe('kitch sink', () => {
	it('schema matches', () => {
		expect(a_actual).toMatchObject(a_expect);
	});
});

