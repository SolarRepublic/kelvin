import type {A} from 'ts-toolbelt';

import type {ReduceSchema, SchemaTyper, ItemShapesFromSchema, ExtractedMembers, SelectionCriteria, ExtractWherePartsMatch, SchemaType, StrictSchema, PartFields} from './schema';
import type {DomainCode, DomainLabel, IndexLabel, IndexValue, ItemPath, SerShape, SerShapeFieldStruct} from './types';
import type {VaultClient} from './vault-client';

import type {VaultHub} from './vault-hub';
import type {Schema} from 'inspector';

import {ode, type Dict, type JsonPrimitive, type JsonObject, is_dict_es, F_IDENTITY, type JsonValue, type JsonArray, __UNDEFINED} from '@blake.regalia/belt';

import {index_to_b92} from './data';
import {Bug, SchemaError, VaultCorruptedError, VaultDamagedError} from './errors';
import type { Exactly } from './meta';
import type { Reader } from './reader';
import { $_PARTS, $_TUPLE, create_shape_item } from './item-serde';


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


class ItemController<
	a_parts extends readonly JsonPrimitive[],
	g_schema_dummy extends StrictSchema,
	gc_type extends ItemType<a_parts, g_schema_dummy>,
	g_schema extends ReturnType<gc_type['schema']>,
	g_item extends A.Cast<ItemShapesFromSchema<g_schema>, JsonObject>,
	g_criteria extends A.Cast<SelectionCriteria<a_parts, g_schema>, JsonObject>,
> {
	protected _k_vault: VaultClient;
	protected _si_domain!: DomainLabel;
	// protected _sb92_domain: DomainCode | undefined;

	protected _k_hub!: VaultHub;

	protected _k_reader!: Reader;
	// protected _k_writer!: Writer

	protected _h_shapes_cache: Dict<object> = {};

	// names of fields that belong to item's key
	protected _a_key_fields: {
		label: string;
		keyify: (w_in: any) => string;
	}[] = [];

	// names of fields that are stored in serial tuple
	protected _a_serial_fields: {
		label: string;
		default: JsonValue;
	}[] = [];


	constructor(gc_type: gc_type) {
		// destructure config arg
		const {
			client: k_vault,
			domain: si_domain,
			schema: f_schema,
		} = gc_type;

		// save to fields
		this._k_vault = k_vault;

		// domain label
		this._si_domain = si_domain as DomainLabel;

		// access hub
		const k_hub = this._k_hub = k_vault.hub();

		// destructure already initialized fields
		const {
			_a_key_fields,
			_a_serial_fields,
		} = this;

		// run simulation on schema
		{
			const k_counter = schema_counter();

			const a_simulators = [
				Symbol('1'),
				Symbol('2'),
				Symbol('3'),
				Symbol('4'),
				Symbol('5'),
			];

			const f_simulate = f_schema as unknown as (k_typer: SchemaInterpretter, a_sims: symbol[]) => Dict<FieldDescriptor>;

			// locate fields that can be ommitted from serialized form
			const g_probe = f_simulate(k_counter, a_simulators);
			for(const [si_key, g_descriptor] of ode(g_probe)) {
				// key part
				if(g_descriptor.symbol) {
					// omit from serialized form
					delete g_probe[si_key];

					// save key field at its approrpriate index
					_a_key_fields[a_simulators.indexOf(g_descriptor.symbol)] = {
						label: si_key,
						keyify: g_descriptor.keyify,
					};
				}
				// tuple member
				else {
					_a_serial_fields[g_descriptor.index] = {
						label: si_key,
						default: g_descriptor.default,
					};
				}
			}
		}
	}

	protected _path_parts(g_criteria: g_criteria): [string[], JsonObject] {
		// shallow copy object
		const g_copy: JsonObject = {...g_criteria};

		// construct item key
		return [this._a_key_fields.map((g_field) => {
			// ref label
			const si_label = g_field.label;

			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return g_field.keyify(g_criteria[si_label]);
		}), g_copy];
	}

	protected _item_path(g_criteria: g_criteria): [ItemPath, JsonObject] {
		const [a_parts, g_copy] = this._path_parts(g_criteria);

		return [a_parts.join(':') as ItemPath, g_copy];
	}

	protected _serialize(g_item: g_item): [ItemPath, JsonArray] {
		// serialize key and get remaining fields
		const [si_item, g_copy] = this._item_path(g_item);

		// prep serialized tuple
		const a_tuple: JsonArray = [];

		// each field in item
		for(const g_field of this._a_serial_fields) {
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


	has<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): boolean {
		return !!this._k_hub.encodeItem(this._si_domain, a_parts.join(':') as ItemPath);
	}

	get(g_criteria: Exactly<g_criteria>): Promise<g_item | undefined> {
		// destructure field(s)
		const {_h_shapes_cache} = this;

		// 
		const a_parts = this._path_parts(g_criteria)[0];

		// locate item by its path
		const i_code = this._k_hub.encodeItem(this._si_domain, a_parts.join(':') as ItemPath);

		// item not found
		if(!i_code) return Promise.resolve(__UNDEFINED);

		// 
		const [a_shape_loaded, a_tuple] = await this._k_reader.getItemContent(i_code);

		// canonicalize loaded shape
		const sx_shape_loaded = JSON.stringify(a_shape_loaded);

		// lookup cached property descriptor map for canonical shape
		let g_proto = _h_shapes_cache[sx_shape_loaded];

		// loaded shape not yet cached
		if(!g_proto) {
			// create property descriptor map
			const h_props = create_shape_item(a_shape_loaded, `in ${this._si_domain}`);

			// create proto
			const g_proto = Object.defineProperties({}, h_props);

			// save to cache
			h_shapes_cache[sx_shape_loaded] = g_proto;

			// TODO: migrate to new schema... otherwise changes to properties not defined
			// in prototype will not mutate the tuple and thus get lost on serialization
		}

		// create instance and set its local properties
		const g_item = Object.create(g_proto, {
			[$_PARTS]: {
				value: a_parts,
			},
			[$_TUPLE]: {
				value: a_tuple,
			},
		});

		// return instance
		return g_item;
	}

	getAt<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): ExtractWherePartsMatch<a_local, g_schema> | undefined {
		return undefined;
	}

	put(g_item: g_item) {
		const {_k_hub} = this;

		const [sr_item, g_ser] = this._serialize(g_item);

		// encode item
		const i_code = _k_hub.encodeItem(this._si_domain, sr_item);

		// new item

		// item already exists and therefore already belongs to bucket
		if(i_code) {
			// replace the item
			await _k_hub.replaceItem(i_code);
		}


		return [sr_item, g_ser];
	}

	putAt<a_local extends a_parts>(
		a_parts: a_local,
		g_item: ExtractedMembers<a_local, g_schema>
	) {

	}


	find(g_criteria: Partial<g_item>): Promise<g_item | undefined> {

	}

	* filter(g_criteria: Partial<g_item>): AsyncIterableIterator<g_item> {

	}

	* entries(): AsyncIterableIterator<> {

	}
}

new ItemController({
	schema(k, [si_type, si_id]: [string, string]) {
		type: k.str(si_type),
		id: k.str(si_id),
		data: k.str(),
		other: k.ref<Other>(),
	},
})
