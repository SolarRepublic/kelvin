import type {A} from 'ts-toolbelt';

import type {ReduceSchema, SchemaTyper, ItemShapesFromSchema, ExtractedMembers, SelectionCriteria, ExtractWherePartsMatch, SchemaType, StrictSchema, PartFields} from './schema';
import type {IndexLabel, IndexValue, ItemPath} from './types';
import type {VaultClient} from './vault-client';

import type {Schema} from 'inspector';

import {ode, type Dict, type JsonPrimitive, type JsonObject, is_dict_es, F_IDENTITY, type JsonValue, type JsonArray} from '@blake.regalia/belt';

import {index_to_b92} from './data';
import {Bug} from './errors';


const F_STRINGIFY = (w_input: any) => w_input+'';

const F_NUMERIZE = (s_part: string) => +s_part;

type ItemType<
	a_keys extends readonly JsonPrimitive[],
	g_schema extends StrictSchema,
> = {
	client: VaultClient;
	domain: string;
	schema: (k_typer: SchemaTyper, a_parts: a_keys) => g_schema;
};


type KeyPartDescriptor = {
	symbol: symbol;
	keyify: (w_input: any) => string;
	parse: (s_part: string) => any;
	type?: 'code' | 'int' | 'str';
};

type TupleMemberDescriptor = {
	// only here so that conditions can use discriminated union
	symbol?: undefined;
	default: JsonValue;
	index: number;
};

type FieldDescriptor = KeyPartDescriptor | TupleMemberDescriptor;

type SchemaInterpretter = {
	[si_type in keyof SchemaTyper]: (z_code?: symbol) => FieldDescriptor;
};

const schema_counter = (): SchemaInterpretter => {
	let c_fields = 0;

	const f_simulator = (w_default: JsonValue, f_parse=F_IDENTITY, f_keyify=F_STRINGIFY) => (z_code?: symbol): FieldDescriptor => {
		if('symbol' === typeof z_code) {
			return {
				symbol: z_code,
				parse: f_parse,
				keyify: f_keyify,
			};
		}

		return {
			default: w_default,
			index: c_fields++,
		};
	};

	const f_reject = (w_default: JsonValue, s_type: string) => f_simulator(w_default, F_IDENTITY, () => {
		throw new Bug(`Attempted to use schema type ${s_type} in item key part, which cannot keyify correctly`);
	});

	const g_interpretter: SchemaInterpretter = {
		int: f_simulator(0, F_NUMERIZE),
		str: f_simulator(''),
		arr: f_reject([], 'arr'),
		obj: f_reject({}, 'obj'),
		switch: f_reject(null, 'switch'),
	};

	return g_interpretter;
};


export function createItemController<
	a_parts extends readonly JsonPrimitive[],
	g_schema_dummy extends StrictSchema,
	gc_type extends ItemType<a_parts, g_schema_dummy>,
>(gc_type: gc_type) {
	type g_schema = ReturnType<gc_type['schema']>;

	type g_item = A.Cast<ItemShapesFromSchema<g_schema>, JsonObject>;

	// destructure config arg
	const {
		client: k_vault,
		domain: si_domain,
		schema: f_schema,
	} = gc_type;

	const k_hub = k_vault.hub();

	const k_counter = schema_counter();

	const a_simulators = [
		Symbol('1'),
		Symbol('2'),
		Symbol('3'),
		Symbol('4'),
		Symbol('5'),
	];

	// names of fields that belong to item's key
	const a_key_fields: {
		label: string;
		keyify: (w_in: any) => string;
	}[] = [];

	// names of fields that are stored in serial tuple
	const a_serial_fields: {
		label: string;
		default: JsonValue;
	}[] = [];

	{
		const f_simulate = f_schema as unknown as (k_typer: SchemaInterpretter, a_sims: symbol[]) => Dict<FieldDescriptor>;

		// locate fields that can be ommitted from serialized form
		const g_probe = f_simulate(k_counter, a_simulators);
		for(const [si_key, g_descriptor] of ode(g_probe)) {
			// key part
			if(g_descriptor.symbol) {
				// omit from serialized form
				delete g_probe[si_key];

				// save key field at its approrpriate index
				a_key_fields[a_simulators.indexOf(g_descriptor.symbol)] = {
					label: si_key,
					keyify: g_descriptor.keyify,
				};
			}
			// tuple member
			else {
				a_serial_fields[g_descriptor.index] = {
					label: si_key,
					default: g_descriptor.default,
				};
			}
		}
	}

	function item_path(g_item: g_item): [ItemPath, JsonObject] {
		// shallow copy object
		const g_copy = {...g_item};

		// construct item key
		const si_item = a_key_fields.map((g_field) => {
			// ref label
			const si_label = g_field.label;

			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return g_field.keyify(g_item[si_label]);
		}).join(':') as ItemPath;

		return [si_item, g_copy];
	}

	function serialize(g_item: g_item): [ItemPath, JsonArray] {
		// serialize key and get remaining fields
		const [si_item, g_copy] = item_path(g_item);

		// prep serialized tuple
		const a_tuple: JsonArray = [];

		// each field in item
		for(const g_field of a_serial_fields) {
			// ref label
			const si_label = g_field.label;

			// remove from copy
			delete g_copy[si_label];

			// add to tuple
			a_tuple.push(g_item[si_label] || g_field.default);
		}

		// push any extraneous in object to last tuple member
		if(Object.keys(g_copy)) {
			a_tuple.push(g_copy);
		}

		return [si_item, a_tuple];
	}

	return {
		put(g_item: g_item) {
			const [sr_item, g_ser] = serialize(g_item);

			const si_item = k_hub.lookup(si_domain, sr_item);

			return [sr_item, g_ser];
		},

		putAt<a_local extends a_parts>(
			a_parts: a_local,
			g_item: ExtractedMembers<a_local, g_schema>
		) {

		},

		get(g_item: SelectionCriteria<a_parts, g_schema>): Promise<g_item> {

		},

		getAt<a_local extends Readonly<a_parts>>(
			a_parts: a_local
		): ExtractWherePartsMatch<a_local, g_schema> | undefined {
			return undefined;
		},

		find(g_criteria: Partial<g_item>): Promise<g_item | undefined> {

		},

		* filter(g_criteria: Partial<g_item>): AsyncIterableIterator<g_item> {

		},

		* entries(): AsyncIterableIterator<> {

		},
	};
}
