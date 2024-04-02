import type {A} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {GenericItemController, ItemController} from './controller';
import type {FieldArray} from './field-array';
import type {RuntimeItem} from './item-proto';
import type {ItemRef, Refish} from './item-ref';
import type {AllValues, KvTuplesToObject, UnionToTuple, FilterDrop} from './meta';
import type {DomainLabel, ItemCode, KnownSerTaggedDatatype} from './types';
import type {Dict, JsonObject, JsonPrimitive, NaiveBase64} from '@blake.regalia/belt';


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
	SET=3,
	TUPLE=4,
	STRUCT=5,
	DICT=6,
	REGISTRY=7,
	MAP_REF=8,
	SWITCH=9,
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

export type FieldSet = Set<KnownEsDatatypes>;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type FieldDict = {
	[si_key: string]: KnownEsDatatypes;
};

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type FieldStruct = {
	[si_key: string]: KnownEsDatatypes;
};

export type FieldMapRef = Map<ItemRef, KnownEsDatatypes>;


export type TaggedDatatypeToEsTypeGetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: ItemRef | null;
	[TaggedDatatype.ARRAY]: FieldArray;
	[TaggedDatatype.SET]: FieldSet;
	[TaggedDatatype.DICT]: FieldDict;
	[TaggedDatatype.TUPLE]: FieldTuple;
	[TaggedDatatype.STRUCT]: FieldStruct;
	[TaggedDatatype.REGISTRY]: Partial<FieldStruct>;
	[TaggedDatatype.MAP_REF]: FieldMapRef;
	[TaggedDatatype.SWITCH]: any;
}[xc_type];

export type TaggedDatatypeToEsTypeSetter<xc_type extends TaggedDatatype> = {
	[TaggedDatatype.UNKNOWN]: unknown;
	[TaggedDatatype.REF]: RuntimeItem | ItemRef | null;
	[TaggedDatatype.ARRAY]: any[];
	[TaggedDatatype.SET]: any[] | Set<any>;
	[TaggedDatatype.DICT]: Record<string, KnownEsDatatypes>;
	[TaggedDatatype.TUPLE]: any[];
	[TaggedDatatype.STRUCT]: object;
	[TaggedDatatype.REGISTRY]: object;
	[TaggedDatatype.MAP_REF]: Map<Refish, KnownEsDatatypes> | FieldMapRef;
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

declare const DATATYPE_PLACEHOLDER: unique symbol;
export type DX = typeof DATATYPE_PLACEHOLDER;

/**
 * Union of all schema datatypes
 */
export type CoreDatatype =
	| DX
	| DatatypeInt
	| DatatypeBigint
	| DatatypeDouble
	| DatatypeString
	| DatatypeBytes
	| DatatypeObject
	| DatatypeRef
	| DatatypeArray<Datatype[]>
	| DatatypeSet<Set<Datatype>>
	// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
	| DatatypeDict<{[si_key: string]: Datatype}>
	| DatatypeStruct
	| DatatypeRegistry
	| DatatypeMapRef<Map<ItemRef, CoreDatatype>>
	// | SchemaSwitch<string, Classifier, Datatype, SchemaBuilderSwitchMap<Classifier, Datatype>>;
	| SchemaSwitch<string, Classifier>;

export type Datatype =
	| CoreDatatype
	| DatatypeTuple;


// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type StructuredSchema = {
	[si_key: string]: Datatype;
};


/**
 * Reinterprets the given type as being JSON-compatible.
 * @param b_setter - value of `1` indicates that target type is intended for setters
 */
export type ReduceSchema<z_test, b_setter extends 0|1=0> =
	z_test extends null | DatatypeRef<infer g_ref>
		? g_ref | null | (b_setter extends 1
			? g_ref extends ItemRef<infer g_dst, infer g_runtime>
				? g_runtime
				: never
			: never)
		// cannot use ItemController unfortunately as it creates a circular type def
		// : z_test extends ItemController<infer g_schema, infer g_item, infer g_proto, infer g_runtime, infer s_domain, infer si_domain, infer a_parts, infer f_schema, infer g_parts>
		// 	? g_runtime
		: z_test extends SchemaSubtype<infer w_estype, infer s_id>? ReduceSchema<w_estype>
		// : z_test extends {[ES_TYPE]: any}? z_test
		// : z_test extends {[ES_TYPE]: infer w_es}? w_es
			: z_test extends Set<infer w_thing>? Set<ReduceSchema<w_thing>>
				: z_test extends Uint8Array? z_test
					: z_test extends JsonPrimitive? z_test
						: JsonObject extends z_test
							? string extends keyof z_test? JsonObject
								: {
									[si_each in keyof z_test]: ReduceSchema<z_test[si_each], b_setter>;
								}
							: z_test extends Array<infer w_type>
								? ReduceSchema<w_type, b_setter>[]
								: {
									[si_each in keyof z_test]: ReduceSchema<z_test[si_each], b_setter>;
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
> = SchemaSubtype<w_subtype, 'bytes'>;

export type DatatypeObject<
	w_subtype extends JsonObject=JsonObject,
> = SchemaSubtype<w_subtype, 'obj'>;

export type DatatypeRef<
	g_ref extends ItemRef=ItemRef,
> = SchemaSubtype<g_ref, 'ref'>;

export type DatatypeArray<
	w_subtype extends Datatype[],
> = SchemaSubtype<w_subtype, 'arr'>;

export type DatatypeSet<
	w_subtype extends Set<Datatype>,
> = SchemaSubtype<w_subtype, 'set'>;

export type DatatypeTuple<
	w_subtype extends Readonly<CoreDatatype[]>=Readonly<CoreDatatype[]>,
> = SchemaSubtype<w_subtype, 'tuple'>;

export type DatatypeStruct<
	w_subtype extends StructuredSchema=StructuredSchema,
> = SchemaSubtype<w_subtype, 'struct'>;

export type DatatypeRegistry<
	w_subtype extends StructuredSchema=StructuredSchema,
> = SchemaSubtype<Partial<w_subtype>, 'registry'>;

export type DatatypeMapRef<
	w_subtype extends Map<ItemRef, Datatype>,
	// g_ref extends ItemRef=ItemRef,
	// w_values extends Datatype=Datatype,
> = SchemaSubtype<w_subtype, 'map-ref'>;

export type DatatypeDict<
	w_subtype extends Record<string, Datatype>,
> = SchemaSubtype<w_subtype, 'dict'>;

type SchemaBuilderSwitchMap<
	w_classifier extends Classifier,
	w_out=any,
> = {
	[w_key in w_classifier]: Datatype;
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


// TODO: support multiple switches. rather complicated. requires collating by classifier
export type SchemaToItemShape<g_schema, b_setter extends 0|1=0> = FindSwitches<g_schema> extends never
	? ReduceSchema<g_schema, b_setter>
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
								? h_switch[w_value] extends infer w_out
									? w_out extends DatatypeStruct<infer h_struct>
										? SchemaToItemShape<h_struct, 0>
										: w_out
									: h_switch[w_value]
								: never
						}
						// the rest of the object
						& Omit<g_schema, (si_dep & Key) | si_switch>;

						/* eslint-enable */
				}>, b_setter>
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
		int(): w_return;
		bigint(): w_return;
		str(): w_return;
	};
	1: {
		int(w_part?: number): w_return;
		bigint(w_part?: bigint): w_return;
		str(w_part?: string): w_return;
		ref(g_controller: GenericItemController, i_part: ItemCode): w_return;
	};
}[b_partable]) & {
	/* eslint-disable @typescript-eslint/member-ordering */

	double(): w_return;
	bytes(): w_return;
	obj(): w_return;
	ref(g_controller: GenericItemController): w_return;
	refSelf(): w_return;
	array: SchemaSimulator<0, w_return>;
		// // eslint-disable-next-line @typescript-eslint/indent
		// & ((w_type: w_return[]) => w_return);
	set: SchemaSimulator<0, w_return>;
	dict: SchemaSimulator<0, w_return>
		// eslint-disable-next-line @typescript-eslint/indent
		& ((as_keys: Extract<keyof w_return, string>, w_values: AllValues<w_return>) => w_return);
	tuple(a_tuple: w_return[]): w_return;
	struct(h_subschema: Dict<w_return>): w_return;
	registry(h_subschema: Dict<w_return>): w_return;
	mapRef(g_controller: GenericItemController): SchemaSimulator<0, w_return>;
	switch(
		si_dep: string,
		w_classifier: Classifier,
		h_switch: {
			[w_key in typeof w_classifier]: w_return;
		}
	): w_return;

	/* eslint-disable */
};



/**
 * Top-level schema builder for a domain, accepting key part arguments
 */
export type SchemaBuilder<
	k_spec extends SchemaSimulator<1>=SchemaSimulator<1>,
	a_parts extends any[]=AcceptablePartTuples,
	w_return=any,
> = (k: k_spec, ...a_parts: a_parts) => w_return;


/**
 * Used to ensure that the type implements all the schema datatypes correctly
 */
export type ImplementsSchemaTypes<g_impl extends SchemaSimulator> = g_impl;


// type OptionalDatatype<g_spec> = {
// 	[si_key in keyof g_spec]: g_spec[si_key] extends (...a_args: infer a_args) => SchemaSubtype<infer w_type, infer s_id>
// 		? (...a_args: a_args) => SchemaSubtype<w_type | undefined, s_id>
// 		: never;
// };

// // allows for a more convenient way to express schemas
// export type ChainedSchemaSpecifier<w_datatype extends SchemaSubtype<any, string>> = {
// 	[si_method in keyof SchemaSpecifier]: SchemaSpecifier[si_method] extends (...a_args: infer a_args) => infer w_return
// 		? w_return extends Datatype
// 			? (...a_args: a_args) => w_return
// 			: never
// 		: never;
// };


type PrimitiveSpecifier = {
	int<w_subtype extends number=number>(): DatatypeInt<w_subtype, 0>;

	bigint<w_subtype extends bigint=bigint>(): DatatypeBigint<w_subtype, 0>;

	double<w_subtype extends number=number>(): DatatypeDouble<w_subtype>;

	str<w_subtype extends string=string>(): DatatypeString<w_subtype, 0>;

	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeBytes<w_subtype>;

	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeObject<w_subtype>;
};

type ImplementsPrimitiveSpecifier<g_spec extends {
	[si_key in keyof PrimitiveSpecifier]: () => Datatype;
}> = g_spec;

type TaggedSpecifier = {
	/**
	 * Creates a reference to other items belonging to *different* controllers.
	 * 
	 * For referencing the same controller, use `.refSelf()`
	 * 
	 * @param g_controller - the controller for the referenced item
	 */
	ref<
		dc_controller extends GenericItemController,
	>(g_controller: dc_controller): dc_controller extends GenericItemController<infer g_thing>
		? DatatypeRef<ItemRef<g_thing>>
		: never;

	/**
	 * Creates a reference to other items belonging to the same controller
	 */
	refSelf(): DatatypeRef<ItemRef>;

	/**
	 * Creates an {@link Array} schema containing items of an arbitrary type.
	 * 
	 * Example:
	 * ```ts
	 * // equivalent of Array<string>
	 * (k) => k.array.str()
	 * ```
	 */
	array: ChainedArray;

	/**
	 * Creates a {@link Set} schema containing items of an arbitrary type.
	 * 
	 * Example:
	 * ```ts
	 * // equivalent of Set<string>
	 * (k) => k.set.str()
	 * ```
	 */
	set: ChainedSet;

	/**
	 * Creates a dictionary schema, where arbitray keys can be used but all values must be of the given type.
	 * 
	 * Example:
	 * ```ts
	 * // equivalent of Record<string, number>
	 * (k) => k.dict.int()
	 * 
	 * // equivalent of Record<`${bigint}`, string>
	 * (k) => k.dict<`${bigint}`>().str()
	 * ```
	 * 
	 * @param s_keys - optional value typed by subset of string to pass onto type inference
	 */
	dict: ChainedDict
		& (<
			s_keys extends string,
		>(s_keys?: s_keys) => ChainedDict<s_keys>);

	/**
	 * Creates a tuple schema, composed of ordered members of arbitrary types.
	 * 
	 * Example:
	 * ```ts
	 * (k) => k.tuple([k.int(), k.str()])
	 * ```
	 * 
	 * @param a_tuple - the ordered datatypes
	 */
	tuple<
		const a_tuple extends Readonly<CoreDatatype[]>,
	>(
		a_tuple: a_tuple,
	): DatatypeTuple<a_tuple>;

	/**
	 * Creates a nested struct schema containing named, _required_ items of arbitrary datatypes.
	 * 
	 * For a similar type, but with optional items, see `.registry`
	 * 
	 * Example:
	 * ```ts
	 * (k) => k.struct({
	 * 	enabled: k.int<0 | 1>(),
	 * 	name: k.str(),
	 * })
	 * ```
	 * 
	 * @param h_subschema - the subschema specifying the appropriate types for each item
	 */
	struct<
		h_subschema extends StructuredSchema,
	>(
		h_subschema: h_subschema,
	): DatatypeStruct<h_subschema>;

	/**
	 * Creates a registry of named items, where only the given keys are allowed to be used and whose values
	 * must be of the specified arbitrary datatypes, but entries are allowed to be omitted.
	 * 
	 * Useful for schemas where a known set of optional attributes is used to describe an object.
	 * 
	 * Example:
	 * ```ts
	 * (k) => k.registry({
	 * 	color: k.str(),
	 * 	icon: k.str<HttpsUrl>(),
	 * 	aliases: k.dict.str(),
	 * })
	 * ```
	 * 
	 * @param h_subschema - the subchema specifying the appropriate types for each key
	 */
	registry<
		h_subschema extends StructuredSchema,
	>(
		h_subschema: h_subschema,
	): DatatypeRegistry<h_subschema>;

	/**
	 * Creates a mapping where items can be used as keys.
	 * 
	 * @param g_controller - the controller for the referenced item
	 */
	mapRef<
		dc_controller extends GenericItemController,
	>(g_controller: dc_controller): dc_controller extends GenericItemController<infer g_thing>
		? ChainedMapRef<g_thing>
		: never;

	switch<
		si_dep extends string,
		w_classifier extends Classifier,
		w_things extends Datatype,
		h_switch extends {
			[w_key in w_classifier]: w_things;
		},
	>(
		si_dep: si_dep,
		w_classifier: w_classifier,
		h_switch: h_switch,
	): SchemaSwitch<si_dep, w_classifier, h_switch>;
};

export type ChainedArray = ImplementsSchemaTypes<ImplementsPrimitiveSpecifier<{
	int<w_subtype extends number=number>(): DatatypeArray<DatatypeInt<w_subtype, 0>[]>;
	bigint<w_subtype extends bigint=bigint>(): DatatypeArray<DatatypeBigint<w_subtype, 0>[]>;
	double<w_subtype extends number=number>(): DatatypeArray<DatatypeDouble<w_subtype>[]>;
	str<w_subtype extends string=string>(): DatatypeArray<DatatypeString<w_subtype, 0>[]>;
	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeArray<DatatypeBytes<w_subtype & Uint8Array>[]>;
	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeArray<DatatypeObject<w_subtype>[]>;
}> & {
	[si_method in keyof TaggedSpecifier]: TaggedSpecifier[si_method] extends (...a_args: infer a_args) => infer w_return
		? w_return extends Datatype
			? (...a_args: a_args) => DatatypeArray<w_return[]>
			: never
		: SchemaSpecifier[si_method];
}>;

type ChainedSet = ImplementsSchemaTypes<ImplementsPrimitiveSpecifier<{
	int<w_subtype extends number=number>(): DatatypeSet<Set<DatatypeInt<w_subtype, 0>>>;
	bigint<w_subtype extends bigint=bigint>(): DatatypeSet<Set<DatatypeBigint<w_subtype, 0>>>;
	double<w_subtype extends number=number>(): DatatypeSet<Set<DatatypeDouble<w_subtype>>>;
	str<w_subtype extends string=string>(): DatatypeSet<Set<DatatypeString<w_subtype, 0>>>;
	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeSet<Set<DatatypeBytes<w_subtype & Uint8Array>>>;
	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeSet<Set<DatatypeObject<w_subtype>>>;
}> & {
	[si_method in keyof TaggedSpecifier]: TaggedSpecifier[si_method] extends (...a_args: infer a_args) => infer w_return
		? w_return extends Datatype
			? (...a_args: a_args) => DatatypeSet<Set<w_return>>
			: never
		: SchemaSpecifier[si_method];
}>;

type ChainedDict<as_keys extends string=string> = ImplementsPrimitiveSpecifier<{
	int<w_subtype extends number=number>(): DatatypeDict<Record<as_keys, DatatypeInt<w_subtype, 0>>>;
	bigint<w_subtype extends bigint=bigint>(): DatatypeDict<Record<as_keys, DatatypeBigint<w_subtype, 0>>>;
	double<w_subtype extends number=number>(): DatatypeDict<Record<as_keys, DatatypeDouble<w_subtype>>>;
	str<w_subtype extends string=string>(): DatatypeDict<Record<as_keys, DatatypeString<w_subtype, 0>>>;
	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeDict<Record<as_keys, DatatypeBytes<w_subtype & Uint8Array>>>;
	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeDict<Record<as_keys, DatatypeObject<w_subtype>>>;
}> & {
	[si_method in keyof TaggedSpecifier]: TaggedSpecifier[si_method] extends (...a_args: infer a_args) => infer w_return
		? w_return extends Datatype
			? (...a_args: a_args) => DatatypeDict<Record<as_keys, w_return>>
			: never
		: SchemaSpecifier[si_method];
};

type ChainedMapRef<g_thing extends Dict<any>> = ImplementsPrimitiveSpecifier<{
	int<w_subtype extends number=number>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeInt<w_subtype, 0>>>;
	bigint<w_subtype extends bigint=bigint>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeBigint<w_subtype, 0>>>;
	double<w_subtype extends number=number>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeDouble<w_subtype>>>;
	str<w_subtype extends string=string>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeString<w_subtype, 0>>>;
	bytes<w_subtype extends Uint8Array=Uint8Array>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeBytes<w_subtype & Uint8Array>>>;
	obj<w_subtype extends JsonObject=JsonObject>(): DatatypeMapRef<Map<ItemRef<g_thing>, DatatypeObject<w_subtype>>>;
}> & {
	[si_method in keyof TaggedSpecifier]: TaggedSpecifier[si_method] extends (...a_args: infer a_args) => infer w_return
		? w_return extends Datatype
			? (...a_args: a_args) => DatatypeMapRef<Map<ItemRef<g_thing>, w_return>>
			: never
		: SchemaSpecifier[si_method];
};

/**
 * Represents a dummy type assigned to the callback parameter of a `schema` function declaration.
 */
export type SchemaSpecifier = ImplementsSchemaTypes<PrimitiveSpecifier & TaggedSpecifier>;

// {
// 	/* eslint-disable @typescript-eslint/member-ordering */
// 	// optional: OptionalDatatype<SchemaSpecifier>;

// 	/* eslint-enable */
// }>;


/**
 * Ammends the core specifier with methods for partable datatypes
 */
export type PartableSchemaSpecifier = SchemaSpecifier & {
	int<w_subtype extends number>(n_part: w_subtype): DatatypeInt<w_subtype, 1>;
	bigint<w_subtype extends bigint>(xg_part: w_subtype): DatatypeBigint<w_subtype, 1>;
	str<w_subtype extends string=string>(si_part: w_subtype): DatatypeString<w_subtype, 1>;
	ref<
		dc_controller extends GenericItemController,
	>(g_controller: dc_controller, i_part: ItemCode): dc_controller extends GenericItemController<infer g_thing>
		? DatatypeRef<ItemRef<g_thing>>
		: never;
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

/**
 * Extracts the item struct from a controller type
 */
export type StructFromController<
	k_controller,
	w_else=never,
> = k_controller extends ItemController<
	infer g_schema,
	infer g_item,
	infer g_proto,
	infer g_runtime,
	infer s_domain,
	infer si_domain,
	infer a_parts,
	infer f_schema,
	infer g_parts
>? g_item: w_else;


/**
 * Extracts the runtime item from a controller type
 */
export type RuntimeItemFromController<
	k_controller,
	w_else=never,
> = k_controller extends ItemController<
	infer g_schema,
	infer g_item,
	infer g_proto,
	infer g_runtime,
	infer s_domain,
	infer si_domain,
	infer a_parts,
	infer f_schema,
	infer g_parts
>? g_runtime: w_else;


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
		switch0: SchemaSwitch<'type', ItemType, {
			[ItemType.UNKNOWN]: DatatypeInt<number, 0>;
			[ItemType.THING]: DatatypeString<'thing', 0>;
			[ItemType.OTHER]: DatatypeStruct<{
				on: DatatypeInt<0 | 1, 0>;
				b: SchemaSwitch<'on', 0 | 1, {
					0: DatatypeInt<number, 0>;
					1: DatatypeString<'other', 0>;
				}>;
			}>;
		}>;

		// switch1: SchemaSwitch<'type', ItemType, {
		// 	[ItemType.UNKNOWN]: (k1: SchemaSpecifier) => DatatypeInt<number, 0>;
		// 	[ItemType.THING]: (k1: SchemaSpecifier) => DatatypeString<'thing', 0>;
		// 	[ItemType.OTHER]: (k1: SchemaSpecifier) => DatatypeString<'other', 0>;
		// }>;
	};

	type examine = SchemaToItemShape<Demo, 1>;

	type inspp = SchemaToItemShape<Demo>;
}
