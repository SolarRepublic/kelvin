import type {A} from 'ts-toolbelt';

import type {Exactly} from './meta';
import type {Reader} from './reader';
import type {SchemaTyper, ItemShapesFromSchema, ExtractedMembers, SelectionCriteria, StrictSchema, SchemaBuilder, SchemaSimulator} from './schema-types';
import type {DomainLabel, ItemCode, ItemIdent, ItemPath, SerFieldStruct, SerKeyStruct, SerSchema} from './types';
import type {VaultClient} from './vault-client';

import type {VaultHub} from './vault-hub';
import type {Dict, JsonPrimitive, JsonObject, JsonValue, JsonArray} from '@blake.regalia/belt';

import {ode, F_IDENTITY, __UNDEFINED} from '@blake.regalia/belt';

import {NL_MAX_PART_FIELDS} from './constants';
import {Bug, SchemaError} from './errors';

import {$_PARTS, $_TUPLE, create_shape_item} from './item-serde';
import {interpret_schema} from './schema-impl';



type ItemType<
	a_keys extends readonly JsonPrimitive[],
	g_schema extends StrictSchema,
> = {
	client: VaultClient;
	domain: string;
	schema: (k_typer: SchemaTyper, a_parts: a_keys) => g_schema;
};



export class ItemController<
	a_parts extends readonly JsonPrimitive[]=any,
	g_schema_dummy extends StrictSchema=any,
	gc_type extends ItemType<a_parts, g_schema_dummy>=any,
	g_schema extends ReturnType<gc_type['schema']>=any,
	g_criteria extends A.Cast<SelectionCriteria<a_parts, g_schema>, JsonObject>=any,
	g_item extends A.Cast<ItemShapesFromSchema<g_schema>, g_criteria>=any,
> {
	protected _k_vault: VaultClient;
	protected _si_domain!: DomainLabel;
	// protected _sb92_domain: DomainCode | undefined;

	// protected _k_hub!: VaultHub;

	protected _k_reader!: Reader;
	// protected _k_writer!: Writer

	protected _h_shapes_cache: Dict<object> = {};

	// current shape in isolated form
	protected _a_schema: Readonly<SerSchema>;

	constructor(gc_type: gc_type) {
		// destructure config arg
		const {
			client: k_vault,
			domain: si_domain,
			schema: f_builder,
		} = gc_type;

		// save to fields
		this._k_vault = k_vault;

		// domain label
		this._si_domain = si_domain as DomainLabel;

		// interpret schema
		const a_schema = this._a_schema = interpret_schema(si_domain, f_builder as unknown as SchemaBuilder<SchemaSimulator, A.Key[]>);

		// build prototype


		// serialize
		JSON.stringify(a_schema);
	}

	get _schema_parts(): SerKeyStruct {
		return this._a_schema[1];
	}

	get _schema_fields(): SerFieldStruct {
		return this._a_schema[2];
	}

	// access hub; memoized
	protected get _k_hub(): VaultHub {
		return Object.defineProperty(this, '_k_hub', this._k_vault.hub())._k_hub;
	}

	protected _path_parts(g_criteria: g_criteria): [Readonly<a_parts>, JsonObject] {
		// shallow copy object
		const g_copy: JsonObject = {...g_criteria};

		// construct item key
		return [this._schema_parts.map((g_field) => {
			// ref label
			const si_label = g_field.label;

			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return g_field.keyify(g_criteria[si_label as keyof g_criteria]);
		}) as unknown as Readonly<a_parts>, g_copy];
	}

	protected _item_path(g_criteria: g_criteria): [ItemPath, JsonObject] {
		const [a_parts, g_copy] = this._path_parts(g_criteria);

		return [a_parts.join(':') as ItemPath, g_copy];
	}

	// protected _serialize(g_item: g_item): [ItemPath, JsonArray] {
	// 	// serialize key and get remaining fields
	// 	const [si_item, g_copy] = this._item_path(g_item);

	// 	// prep serialized tuple
	// 	const a_tuple: JsonArray = [];

	// 	// each field in item
	// 	for(const g_field of this._a_serial_fields) {
	// 		// ref label
	// 		const si_label = g_field.label;

	// 		// remove from copy
	// 		delete g_copy[si_label];

	// 		// add to tuple
	// 		a_tuple.push(g_item[si_label as keyof g_item] || g_field.default);
	// 	}

	// 	// push any extraneous in object to last tuple member
	// 	if(Object.keys(g_copy)) {
	// 		a_tuple.push(g_copy);
	// 	}

	// 	return [si_item, a_tuple];
	// }

	get domain(): DomainLabel {
		return this._si_domain;
	}

	get shape(): Readonly<SerSchema> {
		return this._a_schema;
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

		return this.getAt(a_parts);
	}

	async getByCode(i_code: ItemCode | undefined): Promise<g_item | undefined> {
		// item not found
		if(!i_code) return Promise.resolve(__UNDEFINED);

		// 
		const [a_shape_loaded, a_tuple] = await this._k_reader.getItemContent(i_code);

		// canonicalize loaded shape
		const sx_shape_loaded = JSON.stringify(a_shape_loaded);

		// // lookup cached property descriptor map for canonical shape
		// const g_proto = _h_shapes_cache[sx_shape_loaded];

		// // loaded shape not yet cached
		// if(!g_proto) {
		// 	// create property descriptor map
		// 	const h_props = create_shape_item(a_shape_loaded, `in ${this._si_domain}`);

		// 	// create proto
		// 	const g_proto = Object.defineProperties({}, h_props);

		// 	// save to cache
		// 	h_shapes_cache[sx_shape_loaded] = g_proto;

		// 	// TODO: migrate to new schema... otherwise changes to properties not defined
		// 	// in prototype will not mutate the tuple and thus get lost on serialization
		// }

		// create instance and set its local properties
		const g_item = Object.create(this._proto(), {
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

	_proto(i_code: ItemCode) {
		// destructure field(s)
		const {_k_hub} = this;

		// get item bucket code
		const i_bucket = _k_hub.getItemBucketCode(i_code);

		// get shape code
		const i_shape = _k_hub.getBucketShapeCode(i_bucket);

		// bucket was not migrated
		if(i_shape !== this._i_shape) {
			throw new SchemaError(`bucket #${i_bucket} for ${this._si_domain} domain is using shape #${i_shape}, which is incompatible with expected shape. migrations need to be handled when vault is opened`);
		}

		// create property descriptor map
		const h_props = create_shape_item(a_shape_loaded, `in ${this._si_domain}`);

		// create proto
		const g_proto = Object.defineProperties({}, h_props);

		// save to cache
		h_shapes_cache[sx_shape_loaded] = g_proto;

		// TODO: migrate to new schema... otherwise changes to properties not defined
		// in prototype will not mutate the tuple and thus get lost on serialization
	}

	async getAt<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): Promise<g_item | undefined> {
	// Promise<ExtractWherePartsMatch<a_local, g_schema> | undefined> {

		// locate item by its path
		return this.getByCode(this._k_hub.encodeItem(this._si_domain, a_parts.join(':') as ItemPath));
	}

	async put(g_item: g_item) {
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

	* entries(): AsyncIterableIterator<[ItemIdent, g_item]> {

	}
}

// new ItemController({
// 	schema(k, [si_type, si_id]: [string, string]) {
// 		type: k.str(si_type),
// 		id: k.str(si_id),
// 		data: k.str(),
// 		other: k.ref<Other>(),
// 	},
// })
