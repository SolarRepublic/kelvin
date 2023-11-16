import {interpret_schema, type CountedValues} from 'src/schema-impl';
import {PrimitiveDatatype, TaggedDatatype, type SchemaBuilder} from 'src/schema-types';
import {expect} from 'vitest';

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
const kitch_sink: SchemaBuilder = (k, [xc_cat, s_id]: [Category, string]) => ({
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

// let i_top = 0;
// const inc = (w_subcounts?: CountedValues | undefined) => ({count:++i_top, subcounts:w_subcounts});
// const g_subcount_1 = {count:1};

// const h_counted = {
// 	part_int: inc(),
// 	part_str: inc(),
// 	int: inc(),
// 	bigint: inc(),
// 	double: inc(),
// 	str: inc(),
// 	bytes: inc(),
// 	obj: inc(),
// 	arr_int: inc(g_subcount_1),
// 	arr_bigint: inc(g_subcount_1),
// 	arr_double: inc(g_subcount_1),
// 	arr_str: inc(g_subcount_1),
// 	arr_bytes: inc(g_subcount_1),
// 	arr_obj: inc(g_subcount_1),
// 	arr_arr_str: [++i_top, [1, [1, 1]]],
// 	arr_arr_arr_str: [++i_top, [1, [1, [1, 1]]]],
// 	tuple_int: [++i_top, [1]],
// 	tuple_int_str: [++i_top, [1, 2]],
// };

const a_actual = interpret_schema('test', kitch_sink);
debugger;

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
	arr_arr_int: [TaggedDatatype.ARRAY, [TaggedDatatype.ARRAY, PrimitiveDatatype.INT]],
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

expect(a_actual).toMatchObject(a_expect);

debugger;
