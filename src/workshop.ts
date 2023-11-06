import type { JsonPrimitive } from '@blake.regalia/belt';
import type { A } from 'ts-toolbelt';
import type { Key } from 'ts-toolbelt/out/Any/Key';


enum IncidentType {
	TX_IN,
	TX_OUT,
}


type Schema = {};

/**
 * Reinterprets the given type as being JSON-compatible
 */
export type ReduceSchema<z_test> = z_test extends SchemaTypeStr<infer w_subtype>
	? ReduceSchema<w_subtype>
	: z_test extends SchemaTypeInt<infer w_subtype>
		? ReduceSchema<w_subtype>
		: z_test extends JsonPrimitive? z_test
			: z_test extends Array<infer w_type>
				? ReduceSchema<w_type>[]
				: {
					[si_each in keyof z_test]: ReduceSchema<z_test[si_each]>;
				};


type SchemaTypeInt<
	w_subtype extends number=number,
> = w_subtype & (() => SchemaTypeInt<w_subtype>);

type SchemaTypeStr<
	w_subtype extends string=string,
> = w_subtype & (() => SchemaTypeStr<w_subtype>);


declare const META_TYPE: unique symbol;

type SchemaSwitch<
	si_dep extends string,
	xc_code extends number,
	h_switch extends Record<xc_code, Schema>,
> = {
	[META_TYPE]: 'schema-switch';
	dep: si_dep,
	code: xc_code;
	switch: h_switch;
	value: h_switch[xc_code];
};



enum StageValue {
	SYNCED,
	PENDING,
}

type Demo = {
	type: IncidentType.TX_OUT;
	id: SchemaTypeStr;
	time: SchemaTypeInt;
	data: SchemaSwitch<'type', IncidentType, {
		[IncidentType.TX_IN]: {
			payer: string;
		};
		[IncidentType.TX_OUT]: {
			account: string;
			stage: StageValue;
			nested: SchemaSwitch<'stage', StageValue, {
				[StageValue.PENDING]: 'pending',
				[StageValue.SYNCED]: 'synced',
			}>;
		};
	}>;
};

type AllValues<h_any> = h_any[keyof h_any];

type FindSwitches<
	g_schema,
> = AllValues<{
	[si_key in keyof g_schema]: g_schema[si_key] extends SchemaSwitch<infer si_dep, infer xc_code, infer h_switch>
		? {[si in si_key]: [si_dep, xc_code, h_switch]}
		: never
}>;

type SchemaVariants<g_schema> = FindSwitches<g_schema> extends infer h_switches
	? AllValues<{
		// each switch (there should only be one per block level)
		[si_switch in keyof h_switches]: h_switches[si_switch] extends [
			// infer the tuple contents of the parsed switch
			infer si_dep, infer w_classifier, infer h_switch
		]
			? ReduceSchema<AllValues<{
				// each value the classifier can be
				[w_value in (w_classifier & Key)]:
					// define property pair for the classifier value
					{
						[si in (si_dep & Key)]: w_value;
					}
					// the switch value depending on the classifier value
					& {
						[si in si_switch]: w_value extends keyof h_switch
							? SchemaVariants<h_switch[w_value]>
							: never
					}
					// the rest of the object
					& Omit<g_schema, (si_dep & Key) | si_switch>;
			}>>
			: g_schema;
	}>
	: never;


type X = A.Compute<SchemaVariants<Demo>>;


function test(x: X) {}

test({
	type: IncidentType.TX_IN,
	id: 't',
	time: 1,
	data: 
})

// extends infer w_resolved
// ? w_resolved extends {[META_TYPE]: 'schema-switch'}
// 	? SchemaVariants<w_resolved>
// 	: w_resolved
// : never
// : never;