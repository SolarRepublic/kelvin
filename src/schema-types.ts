import type {A} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {GenericItemController} from './controller';
import type {FieldArray} from './field-array';
import type {RuntimeItem} from './item-proto';
import type {ItemRef} from './item-ref';
import type {AllValues, KvTuplesToObject, UnionToTuple, FilterDrop} from './meta';
import type {Dict, ES_TYPE, JsonObject, JsonPrimitive, NaiveBase64} from '@blake.regalia/belt';


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

export type PrimitiveDatatypeToEsType<xc_type extends PrimitiveDatatype=PrimitiveDatatype> = {
	[PrimitiveDatatype.UNKNOWN]: unknown;
	[PrimitiveDatatype.INT]: number;
	[PrimitiveDatatype.BIGINT]: bigint;
	[PrimitiveDatatype.DOUBLE]: number;
	[PrimitiveDatatype.STRING]: string;
	[PrimitiveDatatype.BYTES]: Uint8Array;
	[PrimitiveDatatype.OBJECT]: JsonObject;
}[xc_type];

export type KnownEsPrimitiveDatatypes = PrimitiveDatatypeToEsType<Exclude<PrimitiveDatatype, PrimitiveDatatype.UNKNOWN>>;


export type PartableDatatype = PrimitiveDatatype.INT | PrimitiveDatatype.BIGINT | PrimitiveDatatype.STRING;

export type PartableEsType = PrimitiveDatatypeToEsType<PartableDatatype>;

export type AcceptablePartTuples =
	| []
	| [PartableEsType]
	| [PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType]
	| [PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType, PartableEsType];

export type KnownEsDatatypes = KnownEsPrimitiveDatatypes | KnownEsTaggedDatatypes;

export type FieldTuple = Array<KnownEsDatatypes>;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type FieldStruct = {
	[si_key: string]: KnownEsDatatypes;
};

export type TaggedDatatypeToEsTypeGetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: ItemRef | null;
	[TaggedDatatype.ARRAY]: FieldArray;
	[TaggedDatatype.TUPLE]: FieldTuple;
	[TaggedDatatype.STRUCT]: FieldStruct;
	[TaggedDatatype.SWITCH]: any;
}[xc_type];

export type TaggedDatatypeToEsTypeSetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: RuntimeItem | ItemRef | null;
	[TaggedDatatype.ARRAY]: any[];
	[TaggedDatatype.TUPLE]: any[];
	[TaggedDatatype.STRUCT]: object;
	[TaggedDatatype.SWITCH]: any;
}[xc_type];

export type KnownEsTaggedDatatypes = TaggedDatatypeToEsTypeGetter<Exclude<TaggedDatatype, TaggedDatatype.UNKNOWN | TaggedDatatype.SWITCH>>;

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
export type CoreDatatype =
	| DatatypeInt
	| DatatypeBigint
	| DatatypeDouble
	| DatatypeString
	| DatatypeBytes
	| DatatypeObject
	| DatatypeRef
	| DatatypeArray<Datatype[]>
	| DatatypeStruct
	// | SchemaSwitch<string, Classifier, Datatype, SchemaBuilderSwitchMap<Classifier, Datatype>>;
	| SchemaSwitch<string, Classifier>;

export type Datatype =
	| CoreDatatype
	| DatatypeTuple;


// export type StructuredSchema = Dict<CoreDatatype>;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type StructuredSchema = {
	[si_key: string]: Datatype;
};


/**
 * Reinterprets the given type as being JSON-compatible
 */
export type ReduceSchema<z_test> =
	z_test extends DatatypeRef<infer g_ref>? g_ref | null
		: z_test extends SchemaSubtype<infer w_estype, infer s_id>? ReduceSchema<w_estype>
			: z_test extends {[ES_TYPE]: any}? z_test
				: z_test extends Uint8Array? z_test
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

export type DatatypeString<
	w_subtype extends string=string,
	b_part_field extends SoftBool=SoftBool,
> = SchemaSubtype<w_subtype, 'str'> & {
	[PART_FIELD]: b_part_field;
};

export type DatatypeBytes<
	w_subtype extends Uint8Array=Uint8Array,
> = SchemaSubtype<w_subtype, 'str'>;

export type DatatypeObject<
	w_subtype extends JsonObject=JsonObject,
> = SchemaSubtype<w_subtype, 'obj'>;

export type DatatypeRef<
	g_ref extends ItemRef=ItemRef,
> = SchemaSubtype<g_ref, 'ref'>;

export type DatatypeArray<
	w_subtype extends Datatype[],
> = SchemaSubtype<w_subtype, 'arr'>;

export type DatatypeTuple<
	w_subtype extends Readonly<CoreDatatype[]>=Readonly<CoreDatatype[]>,
> = SchemaSubtype<w_subtype, 'tuple'>;

export type DatatypeStruct<
	w_subtype extends StructuredSchema=StructuredSchema,
> = SchemaSubtype<w_subtype, 'struct'>;

type SchemaBuilderSwitchMap<
	w_classifier extends Classifier,
	w_out=any,
> = {
	[w_key in w_classifier]: SubschemaBuilder<w_out>;
};


export type SchemaSwitch<
	si_dep extends string,
	w_classifier extends Classifier,
	// w_out,
	// h_switch extends SchemaBuilderSwitchMap<w_classifier, w_out>,
	h_switch extends SchemaBuilderSwitchMap<w_classifier>=SchemaBuilderSwitchMap<w_classifier>,
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


export type SchemaToItemShape<g_schema> = FindSwitches<g_schema> extends never
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
								? h_switch[w_value] extends (...a_args: any[]) => infer w_out
									? w_out
									: h_switch[w_value]
								: never
						}
						// the rest of the object
						& Omit<g_schema, (si_dep & Key) | si_switch>;

						/* eslint-enable */
				}>>
				: g_schema;
		}>
		: never;

export type MakeItemFieldsSettable<z_item> = z_item extends Uint8Array
	? z_item
	: z_item extends Dict<any>
		? {
			[si_key in keyof z_item]: z_item[si_key] extends (ItemRef<infer g_dst, infer g_runtime> | null)
				? g_runtime | z_item[si_key]
				: MakeItemFieldsSettable<z_item[si_key]>;
		}: z_item;

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
> = Extract<SchemaToItemShape<g_schema>, SelectionCriteria<a_parts, g_schema>>;

export type ExtractedMembers<
	a_parts extends readonly any[],
	g_schema,
> = Omit<ExtractWherePartsMatch<a_parts, g_schema>, keyof PartFields<g_schema>>;


export type SchemaSimulator<
	b_partable extends 0|1=0,
	w_return=any,
> = ({
	0: {
		int(w_part?: number): w_return;
		bigint(w_part?: bigint): w_return;
		str(w_part?: string): w_return;
	};
	1: {
		int(): w_return;
		bigint(): w_return;
		str(): w_return;
	};
}[b_partable]) & {
	double(): w_return;
	bytes(): w_return;
	obj(): w_return;
	ref(g_controller: GenericItemController): w_return;
	arr(f_sub: SubschemaBuilder<w_return>): w_return;
	tuple(f_sub: SubschemaBuilder<w_return>): w_return;
	struct(f_sub: SubschemaBuilder<w_return>): w_return;
	switch(
		si_dep: string,
		w_classifier: Classifier,
		h_switch: {
			[w_key in typeof w_classifier]: SubschemaBuilder<w_return>;
		}
	): SchemaSwitch<typeof si_dep, typeof w_classifier, typeof h_switch>;
};



/**
 * Top-level schema builder for a domain, accepting key part arguments
 */
export type SchemaBuilder<
	k_spec extends SchemaSimulator<1>=SchemaSimulator<1>,
	a_parts extends any[]=AcceptablePartTuples,
	w_return=any,
> = (k: k_spec, ...a_parts: a_parts) => w_return;


// /**
//  * Sub-level schema builder for nested fields
//  */
// export type SubschemaBuilder<
// 	w_return,
// 	// k_spec extends SchemaSimulator<0, w_return>=SchemaSimulator<0, w_return>,
// 	k_spec extends PartableSchemaSpecifier=PartableSchemaSpecifier,
// > = (k: k_spec) => Dict<w_return>;



/**
 * Used to ensure that the type implements all the schema datatypes correctly
 */
export type ImplementsSchemaTypes<g_impl extends SchemaSimulator> = g_impl;


/**
 * Represents a dummy type assigned to the callback parameter of a `schema` function declaration.
 */
export type SchemaSpecifier = ImplementsSchemaTypes<{
	int<w_subtype extends number=number>(): DatatypeInt<w_subtype, 0>;

	bigint<w_subtype extends bigint=bigint>(): DatatypeBigint<w_subtype, 0>;

	double<w_subtype extends number=number>(): DatatypeDouble<w_subtype>;

	str<w_subtype extends string=string>(): DatatypeString<w_subtype, 0>;

	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeBytes<w_subtype>;

	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeObject<w_subtype>;

	ref<
		dc_controller extends GenericItemController,
	>(g_controller: dc_controller): dc_controller extends GenericItemController<infer g_thing>
		? DatatypeRef<ItemRef<g_thing>>: never;

	arr<
		w_items extends Datatype,
	>(
		f_sub: SubschemaBuilder<w_items>
	): DatatypeArray<w_items[]>;

	tuple<
		const a_tuple extends Readonly<CoreDatatype[]>,
	>(
		// f_sub: (k: SchemaSimulator) => a_tuple,
		f_sub: SubschemaBuilder<a_tuple>
	): DatatypeTuple<a_tuple>;

	struct<
		// w_subtype extends JsonObject=JsonObject
		h_subschema extends StructuredSchema,
	>(
		// f_sub: SubschemaBuilder<SchemaSimulator<0, DatatypeStruct<w_subtype>>>,
		// f_sub: SubschemaStructBuilder<Datatype>,
		// f_sub: {
		// 	[si_key in keyof h_subschema]: 
		// }
		f_sub: (k: SchemaSpecifier) => h_subschema,
		// f_sub: SchemaBuilder<SchemaSimulator<0>, []>,
	): DatatypeStruct<h_subschema>;

	switch<
		si_dep extends string,
		w_classifier extends Classifier,
		// h_switch extends SchemaBuilderSwitchMap<w_classifier>,
		w_things,
		h_switch extends {
			[w_key in w_classifier]: SubschemaBuilder<w_things>;
		},
	>(
		si_dep: si_dep,
		w_classifier: w_classifier,
		h_switch: h_switch,
	): SchemaSwitch<si_dep, w_classifier, h_switch>;
}>;


/**
 * Ammends the core specifier with methods for partable datatypes
 */
export type PartableSchemaSpecifier = SchemaSpecifier & {
	int<w_subtype extends number>(n_part: w_subtype): DatatypeInt<w_subtype, 1>;
	bigint<w_subtype extends bigint>(xg_part: w_subtype): DatatypeBigint<w_subtype, 1>;
	str<w_subtype extends string=string>(si_part: w_subtype): DatatypeString<w_subtype, 1>;
};

/**
 * Sub-level schema builder for nested fields
 */
export type SubschemaBuilder<
	w_return,
> = (k: SchemaSpecifier) => w_return;

/**
 * Sub-level schema builder for nested fields
 */
export type SubschemaStructBuilder<
	w_return,
> = (k: SchemaSpecifier) => Dict<w_return>;

// /**
//  * Sub-level schema builder for nested fields
//  */
// export type SubschemaBuilder<
// 	w_return,
// 	// k_spec extends SchemaSimulator<0, w_return>=SchemaSimulator<0, w_return>,
// 	k_spec extends PartableSchemaSpecifier=PartableSchemaSpecifier,
// > = (k: k_spec) => Dict<w_return>;


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
		type: DatatypeString<'sample', 1>;
		id: DatatypeString<'s', 1>;
		data: DatatypeString<NaiveBase64, 0>;
	} | {
		category: DatatypeInt<ItemType, 1>;
		type: DatatypeString<'net', 1>;
		id: DatatypeString<'s', 1>;
		data: DatatypeString<NaiveBase64, 0>;
	};

	type reduced = ReduceSchema<start>;

	type shape = SchemaToItemShape<start>;

	type test = PartFields<start>;

	type ss = A.Cast<SelectionCriteria<[ItemType, string, string], start>, JsonObject>;

	type Demo = {
		type: DatatypeInt<ItemType, 1>;
		ref: DatatypeRef<ItemRef<start>>;
		switch: SchemaSwitch<'type', ItemType, {
			[ItemType.UNKNOWN]: (k1: SchemaSpecifier) => DatatypeInt<number, 0>;
			[ItemType.THING]: (k1: SchemaSpecifier) => DatatypeString<'thing', 0>;
			[ItemType.OTHER]: (k1: SchemaSpecifier) => DatatypeString<'other', 0>;
		}>;
	};

	type examine = MakeItemFieldsSettable<SchemaToItemShape<Demo>>;

	type inspp = SchemaToItemShape<Demo>;
}
