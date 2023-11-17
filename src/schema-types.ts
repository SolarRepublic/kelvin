import type {A} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {GenericItemController, ItemController} from './controller';
import type {FieldArray} from './field-array';
import type {RuntimeItem} from './item-proto';
import type {ItemRef} from './item-ref';
import type {AllValues, KvTuplesToObject, UnionToTuple, FilterDrop} from './meta';
import type {Dict, ES_TYPE, JsonArray, JsonObject, JsonPrimitive, NaiveBase64} from '@blake.regalia/belt';


/**
 * Describes a primitive datatype in a serialized schema
 */
export enum PrimitiveDatatype {
	UNKNOWN=0,
	INT=1,
	BIGINT=2,
	DOUBLE=3,
	STRING=4,
	BYTES=5,
	OBJECT=6,
}

/**
 * Describes a tagged datatype in a serialized schema
 */
export enum TaggedDatatype {
	UNKNOWN=0,
	REF=1,
	ARRAY=2,
	TUPLE=3,
	STRUCT=4,
	SWITCH=5,
}

export type PrimitiveDatatypeToEsType<xc_type extends PrimitiveDatatype> = {
	[PrimitiveDatatype.UNKNOWN]: unknown;
	[PrimitiveDatatype.INT]: number;
	[PrimitiveDatatype.BIGINT]: bigint;
	[PrimitiveDatatype.DOUBLE]: number;
	[PrimitiveDatatype.STRING]: string;
	[PrimitiveDatatype.BYTES]: Uint8Array;
	[PrimitiveDatatype.OBJECT]: JsonObject;
}[xc_type];


export type PartableDatatype = PrimitiveDatatype.INT | PrimitiveDatatype.BIGINT | PrimitiveDatatype.STRING;

export type PartableEsType = PrimitiveDatatypeToEsType<PartableDatatype>;

export type AcceptablePartTuples = Readonly<
	| []
	| [PartableEsType]
	| [PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
>;


export type TaggedDatatypeToEsTypeGetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: ItemRef;
	[TaggedDatatype.ARRAY]: FieldArray;
	[TaggedDatatype.TUPLE]: any[];
	[TaggedDatatype.STRUCT]: object;
	[TaggedDatatype.SWITCH]: any;
}[xc_type];

export type TaggedDatatypeToEsTypeSetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: RuntimeItem | ItemRef;
	[TaggedDatatype.ARRAY]: any[];
	[TaggedDatatype.TUPLE]: any[];
	[TaggedDatatype.STRUCT]: object;
	[TaggedDatatype.SWITCH]: any;
}[xc_type];

declare const DATATYPE: unique symbol;
declare const SUBTYPE: unique symbol;
declare const PART_FIELD: unique symbol;

/**
 * Creates a schema datatype
 */
export type SchemaSubtype<
	w_type,
	s_id extends string,
> = {
	[DATATYPE]: s_id;
	[SUBTYPE]: w_type;
} & w_type;

/**
 * Removes schema datatype metadata
 */
export type Unschema<w_type> = w_type extends SchemaSubtype<infer w_estype, infer s_id>? w_estype: never;


type SoftBool = 0 | 1;

/**
 * Acceptable types for a classifier
 */
type Classifier = string | number;

/**
 * Union of all schema datatypes
 */
export type Datatype =
	| DatatypeInt
	| DatatypeBigint
	| DatatypeDouble
	| DatatypeStr
	| DatatypeArr
	| DatatypeTuple
	| DatatypeObj
	| SchemaSwitch;

export type StrictSchema = Dict<Datatype>;


/**
 * Reinterprets the given type as being JSON-compatible
 */
export type ReduceSchema<z_test> =
	z_test extends SchemaSubtype<infer w_estype, infer s_id>? ReduceSchema<w_estype>
		: z_test extends {[ES_TYPE]: any}? z_test
			: z_test extends JsonPrimitive? z_test
				: z_test extends Array<infer w_type>
					? ReduceSchema<w_type>[]
					: {
						[si_each in keyof z_test]: ReduceSchema<z_test[si_each]>;
					};


export type DatatypeInt<
	w_subtype extends number=number,
	b_part_field extends SoftBool=SoftBool,
> = SchemaSubtype<w_subtype, 'int'> & {
	[PART_FIELD]: b_part_field;
};

export type DatatypeBigint<
	w_subtype extends bigint=bigint,
	b_part_field extends SoftBool=SoftBool,
> = SchemaSubtype<w_subtype, 'bigint'> & {
	[PART_FIELD]: b_part_field;
};

export type DatatypeDouble<
	w_subtype extends number=number,
> = SchemaSubtype<w_subtype, 'double'>;

export type DatatypeStr<
	w_subtype extends string=string,
	b_part_field extends SoftBool=SoftBool,
> = SchemaSubtype<w_subtype, 'str'> & {
	[PART_FIELD]: b_part_field;
};

export type DatatypeBytes<
	w_subtype extends Uint8Array=Uint8Array,
> = SchemaSubtype<w_subtype, 'str'>;

export type DatatypeObj<
	w_subtype extends JsonObject=JsonObject,
> = SchemaSubtype<w_subtype, 'obj'>;

export type DatatypeRef<
	g_ref extends GenericItemController,
> = SchemaSubtype<g_ref, 'ref'>;

export type DatatypeArr<
	w_subtype extends JsonArray=JsonArray,
> = SchemaSubtype<w_subtype, 'arr'>;

export type DatatypeTuple<
	w_subtype extends JsonArray=JsonArray,
> = SchemaSubtype<w_subtype, 'tuple'>;

export type DatatypeStruct<
	w_subtype extends JsonObject=JsonObject,
> = SchemaSubtype<w_subtype, 'struct'>;

type SchemaSwitch<
	si_dep extends string=string,
	w_classifier extends Classifier=Classifier,
	h_switch extends {
		[w_key in w_classifier]: SchemaBuilder;
	}={
		[w_key in w_classifier]: SchemaBuilder;
	},
> = {
	[DATATYPE]: 'switch';
	dep: si_dep;
	code: w_classifier;
	switch: h_switch;
	value: h_switch[w_classifier];
};



type FindSwitches<
	g_schema,
> = AllValues<{
	[si_key in keyof g_schema]: g_schema[si_key] extends SchemaSwitch<infer si_dep, infer xc_code, infer h_switch>
		? {[si in si_key]: [si_dep, xc_code, h_switch]}
		: never
}>;


export type ItemShapesFromSchema<g_schema> = FindSwitches<g_schema> extends never
	? ReduceSchema<g_schema>
	: FindSwitches<g_schema> extends infer h_switches
		? AllValues<{
			// each switch (there should only be one per block level)
			[si_switch in keyof h_switches]: h_switches[si_switch] extends [
				// infer the tuple contents of the parsed switch
				infer si_dep, infer w_classifier, infer h_switch,
			]
				? ReduceSchema<AllValues<{
					// each value the classifier can be
					[w_value in (w_classifier & Key)]:  /* eslint-disable @typescript-eslint/indent */
						// define property pair for the classifier value
						{
							[si in (si_dep & Key)]: w_value;
						}
						// the switch value depending on the classifier value
						& {
							[si in si_switch]: w_value extends keyof h_switch
								// ? SchemaVariants<h_switch[w_value]>
								? h_switch[w_value]
								: never
						}
						// the rest of the object
						& Omit<g_schema, (si_dep & Key) | si_switch>;

						/* eslint-enable */
				}>>
				: g_schema;
		}>
		: never;


export type PartFields<g_schema> = ReduceSchema<FilterDrop<{
	[si_key in keyof g_schema]: g_schema[si_key] extends {[PART_FIELD]: infer b_part_field}
		? b_part_field extends 1
			? g_schema[si_key]
			: never
		: never;
}>>;


export type SelectionCriteria<a_parts extends readonly any[], g_schema> = KvTuplesToObject<
	UnionToTuple<keyof PartFields<g_schema>>,
	a_parts
>;


export type ExtractWherePartsMatch<
	a_parts extends readonly any[],
	g_schema,
> = Extract<ItemShapesFromSchema<g_schema>, SelectionCriteria<a_parts, g_schema>>;

export type ExtractedMembers<
	a_parts extends readonly any[],
	g_schema,
> = Omit<ExtractWherePartsMatch<a_parts, g_schema>, keyof PartFields<g_schema>>;


export type SchemaSimulator<w_return=any> = {
	int(w_part?: number): w_return;
	bigint(w_part?: bigint): w_return;
	double(): w_return;
	str(w_part?: string): w_return;
	bytes(): w_return;
	obj(): w_return;
	ref(g_controller: GenericItemController): w_return;
	arr(f_sub: SubschemaSpecifier<SchemaSimulator<w_return>, w_return>): w_return;
	tuple(f_sub: SubschemaSpecifier<SchemaSimulator<w_return[]>>): w_return;
	struct(f_sub: SubschemaBuilder<w_return>): w_return;
	switch(
		si_dep: string,
		w_classifier: Classifier,
		h_switch: {
			[w_key in typeof w_classifier]: SubschemaBuilder<w_return>;
		}
	): w_return;
};


/**
 * Top-level schema builder for a domain, accepting key part arguments
 */
export type SchemaBuilder<
	k_spec extends SchemaSimulator=SchemaSimulator,
	a_parts extends readonly any[]=AcceptablePartTuples,
	w_return=any,
> = (k: k_spec, ...a_parts: a_parts) => w_return;


/**
 * Sub-level schema specifier for nested fields
 */
export type SubschemaSpecifier<
	k_spec extends SchemaSimulator=SchemaSimulator,
	w_return=any,
> = (k: k_spec) => w_return;

/**
 * Sub-level schema builder for nested fields
 */
export type SubschemaBuilder<
	w_return,
	k_spec extends SchemaSimulator<w_return>=SchemaSimulator<w_return>,
> = (k: k_spec) => Dict<w_return>;



/**
 * Used to ensure that the type implements all the schema datatypes correctly
 */
export type ImplementsSchemaTypes<g_impl extends SchemaSimulator> = g_impl;


/**
 * Represents a dummy type assigned to the callback parameter of a `schema` function declaration.
 */
export type SchemaSpecifier = ImplementsSchemaTypes<{
	int<w_subtype extends number=number>(): DatatypeInt<w_subtype, 0>;
	int<w_subtype extends number>(n_part: w_subtype): DatatypeInt<w_subtype, 1>;

	bigint<w_subtype extends bigint=bigint>(): DatatypeBigint<w_subtype, 0>;
	bigint<w_subtype extends bigint>(xg_part: w_subtype): DatatypeBigint<w_subtype, 1>;

	double<w_subtype extends number=number>(): DatatypeDouble<w_subtype>;

	str<w_subtype extends string=string>(): DatatypeStr<w_subtype, 0>;
	str<w_subtype extends string=string>(si_part: w_subtype): DatatypeStr<w_subtype, 1>;

	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeBytes<w_subtype>;

	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeObj<w_subtype>;

	ref<g_ref extends GenericItemController>(g_controller: GenericItemController): DatatypeRef<g_ref>;

	arr<w_subtype extends JsonArray=JsonArray>(
		f_sub: (k: SchemaSimulator) => Datatype,
	): DatatypeArr<w_subtype>;

	tuple<w_subtype extends JsonArray=JsonArray>(
		f_sub: (k: SchemaSimulator) => Datatype[],
	): DatatypeTuple<w_subtype>;

	struct<w_subtype extends JsonObject=JsonObject>(
		f_sub: SubschemaBuilder<SchemaSimulator<DatatypeStruct<w_subtype>>>,
	): DatatypeStruct<w_subtype>;

	switch<
		si_dep extends string,
		w_classifier extends Classifier,
		h_switch extends {
			[w_key in w_classifier]: SubschemaBuilder<any>;
		},
	>(
		si_dep: si_dep,
		w_classifier: w_classifier,
		h_switch: h_switch,
	): SchemaSwitch<si_dep, w_classifier, h_switch>;
}>;

/* Tests */
{
	enum ItemType {
		UNKNOWN=0,
		THING=1,
		OTHER=2,
	}

	type cat = DatatypeInt<0 | 1, 1>;

	type start = {
		category: DatatypeInt<ItemType, 1>;
		type: DatatypeStr<'sample', 1>;
		id: DatatypeStr<'s', 1>;
		data: DatatypeStr<NaiveBase64, 0>;
	} | {
		category: DatatypeInt<ItemType, 1>;
		type: DatatypeStr<'net', 1>;
		id: DatatypeStr<'s', 1>;
		data: DatatypeStr<NaiveBase64, 0>;
	};

	type reduced = ReduceSchema<start>;

	type shape = ItemShapesFromSchema<start>;

	type ss = A.Cast<SelectionCriteria<[ItemType, string, string], start>, JsonObject>;
}
