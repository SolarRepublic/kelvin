import type {F} from 'ts-toolbelt';

import type {VaultHub} from './hub';
import type {RuntimeItem} from './item-proto';
import type {Reader} from './reader';
import type {ItemShapesFromSchema, ExtractedMembers, StrictSchema, SchemaSpecifier, AcceptablePartTuples, SchemaBuilder, PartFields, PartableEsType} from './schema-types';



import type {Vault} from './vault';
import type {Dict, JsonArray, JsonObject} from '@blake.regalia/belt';

import {F_IDENTITY, __UNDEFINED} from '@blake.regalia/belt';


import {$_CODE, $_DOMAIN, $_PARTS, $_TUPLE, item_prototype} from './item-proto';
import {interpret_schema} from './schema-impl';
import {DomainStorageStrategy, type DomainLabel, type ItemCode, type ItemIdent, type ItemPath, type SerFieldStruct, type SerItem, type SerKeyStruct, type SerSchema} from './types';

const is_runtime_item = (g_item: object): g_item is RuntimeItem => !!(g_item as RuntimeItem)[$_TUPLE];

export class ItemController<
	s_domain extends string,
	si_domain extends s_domain & DomainLabel,
	a_parts extends AcceptablePartTuples,
	g_schema extends StrictSchema,
	f_schema extends SchemaBuilder<SchemaSpecifier, a_parts, g_schema>,
	g_item extends ItemShapesFromSchema<g_schema>,
	g_proto,
	g_runtime extends g_item & g_proto,
	g_criteria extends PartFields<g_schema>,
> {
	protected _k_vault: Vault;
	protected _si_domain!: si_domain;
	protected _xc_strategy: DomainStorageStrategy;
	protected _k_reader!: Reader;

	protected _h_shapes_cache: Dict<object> = {};

	// current shape in isolated form
	protected _a_schema: Readonly<SerSchema>;
	protected _g_descriptor_schema: PropertyDescriptorMap;
	protected _g_descriptor_proto: PropertyDescriptorMap;

	protected _g_prototype: object;
	protected _g_loader: object;

	constructor(gc_type: {
		client: Vault;
		domain: s_domain;
		strategy?: DomainStorageStrategy;
		schema: F.NoInfer<f_schema>;
		proto?: (
			f_cast: <h_extension>(w_this: h_extension) => g_item & h_extension,
		) => g_proto;
	}) {
		// destructure config arg
		const {
			client: k_vault,
			domain: si_domain,
			strategy: xc_strategy=DomainStorageStrategy.DEFAULT,
			schema: f_builder,
			proto: f_proto,
		} = gc_type;

		// save to fields
		this._k_vault = k_vault;

		// domain label
		this._si_domain = si_domain as unknown as si_domain;

		// domain storage strategy
		this._xc_strategy = xc_strategy;

		// interpret schema
		const a_schema = this._a_schema = interpret_schema(si_domain, f_builder);

		// build schema descriptor
		const g_descriptor_schema = this._g_descriptor_schema = item_prototype(a_schema, this as GenericItemController, false);

		// get descriptor from proto
		const g_descriptor_proto = this._g_descriptor_proto = f_proto? Object.getOwnPropertyDescriptors(f_proto(F_IDENTITY)): {};

		// merge and create prototype
		this._g_prototype = Object.create({}, Object.assign({}, g_descriptor_proto, g_descriptor_schema));

		// create loader prototype
		this._g_loader = Object.create({}, item_prototype(a_schema, this as GenericItemController, true));

		// register controller with client
		this._k_vault.registerController(this._si_domain, this);
	}

	get strategy(): DomainStorageStrategy {
		return this._xc_strategy;
	}

	get schema(): Readonly<SerSchema> {
		return this._a_schema;
	}

	get _h_schema_parts(): SerKeyStruct {
		return this._a_schema[1];
	}

	get _h_schema_fields(): SerFieldStruct {
		return this._a_schema[2];
	}

	// access hub; memoized
	protected get _k_hub(): VaultHub {
		return Object.defineProperty(this, '_k_hub', {
			value: this._k_vault.hub(),
		})._k_hub;
	}

	protected _path_parts(g_criteria: g_criteria): [Readonly<a_parts>, JsonObject] {
		// shallow copy object
		const g_copy: JsonObject = {...g_criteria as object};

		// construct item key
		return [Object.keys(this._h_schema_parts).map((si_label) => {
			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return g_criteria[si_label as keyof g_criteria];
		}) as unknown as Readonly<a_parts>, g_copy];
	}

	protected _item_path(g_criteria: g_criteria): [ItemPath, JsonObject] {
		const [a_parts, g_copy] = this._path_parts(g_criteria);

		return [a_parts.join(':') as ItemPath, g_copy];
	}

	protected _backing(a_parts: PartableEsType[]=[], a_tuple: JsonArray=[]): PropertyDescriptorMap {
		return {
			[$_CODE]: {
				value: 0,
			},
			[$_DOMAIN]: {
				value: this._si_domain,
			},
			[$_PARTS]: {
				value: a_parts,
			},
			[$_TUPLE]: {
				value: a_tuple,
			},
		};
	}

	get domain(): si_domain {
		return this._si_domain;
	}

	get shape(): Readonly<SerSchema> {
		return this._a_schema;
	}

	get hub(): VaultHub {
		return this._k_hub;
	}

	_encode_item(a_parts: a_parts) {
		const {_k_hub} = this;

		return _k_hub.itemCode(_k_hub.itemIdent(this._si_domain, a_parts.join(':') as ItemPath));
	}

	has<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): boolean {
		const {_k_hub} = this;

		return !!this._encode_item(a_parts);
	}

	get(g_criteria: g_criteria): Promise<g_runtime | undefined> {
		// 
		const a_parts = this._path_parts(g_criteria)[0];

		return this.getAt(a_parts);
	}

	async getByCode(i_code: ItemCode | undefined, a_parts?: a_parts): Promise<g_runtime | undefined> {
		// item not found
		if(!i_code) return Promise.resolve(__UNDEFINED);

		// 
		const [a_shape_loaded, a_tuple] = await this._k_reader.getItemContent(i_code);

		// create instance and set its local properties
		const g_item = Object.create(this._g_prototype, this._backing(a_parts, a_tuple));

		// return instance
		return g_item;
	}

	_serialize(g_item: g_item | g_runtime): [ItemPath, SerItem] {
		// prep runtime item
		let g_runtime = g_item as RuntimeItem;

		// no backing data
		if(!is_runtime_item(g_item)) {
			// create bare instance
			const g_inst: RuntimeItem = Object.create(this._g_loader, this._backing());

			// load into it
			Object.assign(g_inst, g_item);

			// replace
			g_runtime = g_inst;
		}
		// incorrect domain
		else if(this._si_domain !== g_item[$_DOMAIN]) {
			throw new TypeError(`Attempted to pass an item from "${g_item[$_DOMAIN]}" domain to the "${this._si_domain}" domain`);
		}

		// return serialized item
		return [
			g_runtime[$_PARTS].slice(1).join(':') as ItemPath,
			g_runtime[$_TUPLE],
		];
	}

	// _proto(i_code: ItemCode) {
	// 	// destructure field(s)
	// 	const {_k_hub} = this;

	// 	// get item bucket code
	// 	const i_bucket = _k_hub.getItemBucketCode(i_code);

	// 	// get shape code
	// 	const i_shape = _k_hub.getBucketShapeCode(i_bucket);

	// 	// bucket was not migrated
	// 	if(i_shape !== this._i_shape) {
	// 		throw new SchemaError(`bucket #${i_bucket} for ${this._si_domain} domain is using shape #${i_shape}, which is incompatible with expected shape. migrations need to be handled when vault is opened`);
	// 	}

	// 	// create property descriptor map
	// 	const h_props = create_shape_item(a_shape_loaded, `in ${this._si_domain}`);

	// 	// create proto
	// 	const g_proto = Object.defineProperties({}, h_props);

	// 	// save to cache
	// 	h_shapes_cache[sx_shape_loaded] = g_proto;

	// 	// TODO: migrate to new schema... otherwise changes to properties not defined
	// 	// in prototype will not mutate the tuple and thus get lost on serialization
	// }

	async getAt<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): Promise<g_runtime | undefined> {
	// Promise<ExtractWherePartsMatch<a_local, g_schema> | undefined> {

		// locate item by its path
		return this.getByCode(this._encode_item(a_parts), a_parts);
	}

	async put(g_item: g_item) {
		const {_k_hub} = this;

		// serialize item
		const [sr_item, w_ser] = this._serialize(g_item);

		// // encode item
		// const si_item = _k_hub.itemIdent(this._si_domain, sr_item);

		// // item already exists and therefore already belongs to bucket
		// const i_code = _k_hub.itemCode(si_item);
		// if(i_code) {
		// 	// replace the item
		// 	await _k_hub.replaceItem(i_code, w_ser);
		// }
		// // item does not yet exist
		// else {
		// 	await _k_hub.addItem(si_item, w_ser);
		// }

		// write item to storage
		await _k_hub.putItem(this._si_domain, sr_item, w_ser);

		// 
		return [sr_item, w_ser];
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

export type GenericItemController = ItemController<
	string,
	DomainLabel,
	AcceptablePartTuples,
	StrictSchema,
	any,
	ItemShapesFromSchema<StrictSchema>,
	any,
	any,
	any
>;



// const k_client = new VaultClient();

// const Chains1 = new ItemController({
// 	client: k_client,
// 	domain: 'chains' as DomainLabel,
// 	schema: (k0, xc_ns: ChainNamespace, si_ref: string) => ({
// 		ns: k0.int(xc_ns),
// 		ref: k0.str(si_ref),
// 		data: k0.str(),
// 	}),
// 	proto: cast => ({
// 		test() {
// 			cast(this).ns;
// 		},

// 		get caip2(): string {
// 			return cast(this).ref;
// 		},
// 	}),
// });

// const test = await Chains1.get({
// 	ns: ChainNamespace.COSMOS,
// 	ref: 's',
// });

// test?.caip2;
