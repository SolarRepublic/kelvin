import type {L, O, U} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {AllValues, KvTuplesToObject, UnionToTuple, FilterDrop} from './meta';
import type {Dict, JsonArray, JsonObject, JsonPrimitive} from '@blake.regalia/belt';



declare const SCHEMA_TYPE: unique symbol;
declare const PART_FIELD: unique symbol;

type SoftBool = 0 | 1;

type Classifier = string | number;

export type SchemaType = SchemaTypeCode | SchemaTypeInt | SchemaTypeStr | SchemaTypeArr | SchemaTypeObj | SchemaSwitch;

export type StrictSchema = Dict<SchemaType>;

export type FlexibleSchema = SchemaType | Dict<JsonPrimitive | SchemaType>;


/**
 * Reinterprets the given type as being JSON-compatible
 */
export type ReduceSchema<z_test> =
	z_test extends SchemaTypeCode<infer w_subtype>
		? ReduceSchema<w_subtype>
		: z_test extends SchemaTypeStr<infer w_subtype>
			? ReduceSchema<w_subtype>
			: z_test extends SchemaTypeInt<infer w_subtype>
				? ReduceSchema<w_subtype>
				: z_test extends SchemaTypeArr<infer w_subtype>
					? ReduceSchema<w_subtype>
					: z_test extends SchemaTypeObj<infer w_subtype>
						? ReduceSchema<w_subtype>
						: z_test extends JsonPrimitive? z_test
							: z_test extends Array<infer w_type>
								? ReduceSchema<w_type>[]
								: {
									[si_each in keyof z_test]: ReduceSchema<z_test[si_each]>;
								};


export type SchemaTypeCode<
	w_subtype extends number=number,
	b_part_field extends SoftBool=SoftBool,
> = w_subtype & {
	[SCHEMA_TYPE]: 'code';
	[PART_FIELD]: b_part_field;
};

export type SchemaTypeInt<
	w_subtype extends number=number,
	b_part_field extends SoftBool=SoftBool,
> = w_subtype & {
	[SCHEMA_TYPE]: 'int';
	[PART_FIELD]: b_part_field;
};

export type SchemaTypeStr<
	w_subtype extends string=string,
	b_part_field extends SoftBool=SoftBool,
> = w_subtype & {
	[SCHEMA_TYPE]: 'str';
	[PART_FIELD]: b_part_field;
};

export type SchemaTypeArr<
	w_subtype extends JsonArray=JsonArray,
> = w_subtype & {
	[SCHEMA_TYPE]: 'arr';
};

export type SchemaTypeObj<
	w_subtype extends JsonObject=JsonObject,
> = w_subtype & {
	[SCHEMA_TYPE]: 'obj';
};

type SchemaSwitch<
	si_dep extends string=string,
	w_classifier extends Classifier=Classifier,
	h_switch extends Record<w_classifier, FlexibleSchema>=Record<w_classifier, {}>,
> = {
	[SCHEMA_TYPE]: 'switch';
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



export type SchemaTyper = {
	// code<w_subtype extends number>(xc_part?: w_subtype): SchemaTypeCode<w_subtype>;

	int<w_subtype extends number=number>(): SchemaTypeInt<w_subtype, 0>;
	int<w_subtype extends number>(n_part: w_subtype): SchemaTypeInt<w_subtype, 1>;

	str<w_subtype extends string=string>(si_part?: w_subtype): SchemaTypeStr<w_subtype>;

	arr<w_subtype extends JsonArray=JsonArray>(): SchemaTypeArr<w_subtype>;

	obj<w_subtype extends JsonObject=JsonObject>(): SchemaTypeObj<w_subtype>;

	switch<si_dep extends string, w_classifier extends Classifier, h_switch extends Record<w_classifier, FlexibleSchema>>(
		si_dep: si_dep,
		w_classifier: w_classifier,
		h_switch: h_switch,
	): SchemaSwitch<si_dep, w_classifier, h_switch>;

	// // aliases with different meanings on ES side
	// text<w_subtype extends string=string>(si_part?: w_subtype): SchemaTypeStr<w_subtype>;

	// uint<w_subtype extends number=number>(n_part?: w_subtype): SchemaTypeCode<w_subtype>;
};



// ------



enum IncidentType {
	TX_IN,
	TX_OUT,
}

type Demo = {
	type: SchemaTypeInt<IncidentType, 1>;
	id: SchemaTypeStr<string, 1>;
	time: SchemaTypeInt<number, 0>;
	data: SchemaSwitch<'type', IncidentType, {
		[IncidentType.TX_IN]: {
			payer: SchemaTypeStr;
		};
		[IncidentType.TX_OUT]: {
			account: SchemaTypeStr;
			// stage: StageValue;
			// nested: string;;
		};
	}>;
};

type mustard = readonly [IncidentType.TX_IN, string];

type criteria = SelectionCriteria<mustard, Demo>;

type in_of = [ItemShapesFromSchema<Demo>, SelectionCriteria<mustard, Demo>];

type match = ExtractWherePartsMatch<mustard, Demo>;


type start = {
	type: SchemaTypeStr<'sample', 1>;
	id: SchemaTypeStr<'s', 1>;
	data: SchemaTypeStr<'sippie', 0>;
} | {
	type: SchemaTypeStr<'net', 1>;
	id: SchemaTypeStr<'s', 1>;
	data: SchemaTypeStr<'newton', 0>;
};


type ok = SelectionCriteria<start, Readonly<['sample', 's']>>;

type show2 = Extract<Demo, {
	type: SchemaTypeInt<IncidentType.TX_OUT, 1>;
}>;

type showcase = ExtractWherePartsMatch<Readonly<['net', 's']>, start>;

type shape = ItemShapesFromSchema<start>;
type dbg = Extract<ItemShapesFromSchema<start>, ok>;

/**
 * inputs: 
 *  - [IncidentType.TX_IN, string]
 *  - Schema {type:SchemaTypeInt, id:SchemaTypeInt, data:SchemaTypeStr}
 * 
 * interm:
 * ['type', 'id']
 * 
 * dest: {
 * 	type: IncidentType.TX_IN;
 * 	id: string;
 * } 
 * 
 * descr: need to extract from the union where {type: IncidentType.TX_IN, id: string}
 * 
 * output: 
 */

type incident = PartFields<Demo>;

type holf = Extract<start, {type: SchemaTypeInt<6, 1>}>;


type union = {
	type: 'apple';
	data: 'red';
} | {
	type: 'banana';
	data: 'yellow';
} | {
	type: 'grape';
	data: 'purple';
};

