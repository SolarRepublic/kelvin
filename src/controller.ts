/* eslint-disable @typescript-eslint/naming-convention */
import type {F} from 'ts-toolbelt';

import type {GenericStructMatchCriteria, MatchCriteria} from './filter';
import type {HubEffects, VaultHub} from './hub';
import type {RuntimeItem} from './item-proto';

import type {SchemaToItemShape, StructuredSchema, PartableSchemaSpecifier, AcceptablePartTuples, SchemaBuilder, PartFields, PartableEsType, FieldStruct, SchemaSimulator} from './schema-types';
import type {DomainLabel, ItemCode, ItemIdent, ItemPath, SchemaCode, SerFieldStruct, SerItem, SerKeyStruct, SerSchema} from './types';
import type {Vault} from './vault';
import type {Dict, JsonArray, JsonObject} from '@blake.regalia/belt';

import {F_IDENTITY, __UNDEFINED, escape_regex, odk} from '@blake.regalia/belt';

import {AppError} from './errors';
import {apply_filter_struct} from './filter';
import {$_CODE, $_CONTROLLER, $_LINKS, $_TUPLE, is_runtime_item, item_prototype} from './item-proto';
import {ItemRef} from './item-ref';
import {SchemaAnnotation, interpret_schema, type RootSchemaBuilder} from './schema-impl';
import {DomainStorageStrategy} from './types';


export interface GenericItemController<
	g_item extends Dict<any>=Dict<any>,
	g_runtime extends RuntimeItem<g_item>=RuntimeItem<g_item>,
	g_schema extends StructuredSchema=StructuredSchema,
	a_parts extends AcceptablePartTuples=AcceptablePartTuples,
	g_parts extends PartFields<g_schema>=PartFields<g_schema>,
> {
	strategy: DomainStorageStrategy;
	schema: Readonly<SerSchema>;
	partLength: number;
	domain: DomainLabel;
	hub: VaultHub;

	getItemCode(g_parts: g_parts): ItemCode | undefined;

	getItemRef(g_parts: g_parts): ItemRef<g_item, g_runtime> | null;

	has(a_parts: Readonly<AcceptablePartTuples>): boolean;

	get(g_parts: g_parts): Promise<g_runtime | undefined>;

	getByCode(i_code: ItemCode | undefined, a_parts?: a_parts): Promise<g_runtime | undefined>;

	getAt(a_parts: Readonly<AcceptablePartTuples>): Promise<g_runtime | undefined>;

	put(g_item: SchemaToItemShape<g_schema, 1>): Promise<[ItemPath, SerItem]>;

	putMany(a_items: SchemaToItemShape<g_schema, 1>[]): Promise<[ItemPath, SerItem][]>;

	entries(): AsyncIterableIterator<[ItemIdent, g_item]>;

	filter(h_criteria: MatchCriteria<g_item>, n_limit?: number): AsyncIterableIterator<g_item>;
}



export class ItemController<
	g_schema extends StructuredSchema,
	g_item extends SchemaToItemShape<g_schema>,
	g_proto,
	g_runtime extends RuntimeItem<g_item & g_proto>,
	s_domain extends string,
	si_domain extends s_domain & DomainLabel,
	a_parts extends AcceptablePartTuples,
	f_schema extends SchemaBuilder<PartableSchemaSpecifier, a_parts, g_schema>,
	// f_schema extends RootSchemaBuilder<a_parts>,
	g_parts extends PartFields<g_schema>,
> implements
	GenericItemController<g_item, g_runtime, g_schema, a_parts, g_parts>
	// GenericItemController
{
	protected _k_vault: Vault;
	protected _si_domain!: si_domain;
	protected _xc_strategy: DomainStorageStrategy;
	protected _nl_parts: number;
	protected _nl_fields: number;

	protected _h_shapes_cache: Dict<object> = {};

	// current shape in isolated form
	protected _a_schema: Readonly<SerSchema>;
	protected _g_descriptor_schema: PropertyDescriptorMap;
	protected _g_descriptor_proto: PropertyDescriptorMap;

	protected _g_prototype: object;
	protected _g_loader: object;

	/**
	 * @internal
	 */
	_i_schema = -1 as SchemaCode;

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

		// vault is already open
		if(k_vault.isOpened()) {
			throw new AppError(`ItemController "${si_domain}" must be created before the vault is opened`);
		}

		// save to fields
		this._k_vault = k_vault;

		// domain label
		this._si_domain = si_domain as unknown as si_domain;

		// domain storage strategy
		this._xc_strategy = xc_strategy;

		// interpret schema
		const a_schema = this._a_schema = interpret_schema(si_domain, f_builder as unknown as RootSchemaBuilder<a_parts>);

		// cast to generic (shouldn't have to tho...)
		const k_generic = this as GenericItemController;

		// build schema descriptor
		const g_descriptor_schema = this._g_descriptor_schema = item_prototype(a_schema, k_generic, false);

		// get descriptor from proto
		const g_descriptor_proto = this._g_descriptor_proto = f_proto? Object.getOwnPropertyDescriptors(f_proto(F_IDENTITY)): {};

		// merge and create prototype
		this._g_prototype = Object.create({}, Object.assign({}, g_descriptor_proto, g_descriptor_schema));

		// create loader prototype
		this._g_loader = Object.create({}, item_prototype(a_schema, k_generic, true));

		// register controller with client
		this._k_vault.registerController(this._si_domain, k_generic);

		// cache part length
		this._nl_parts = odk(a_schema[1]).length;

		// cache field length
		this._nl_fields = odk(a_schema[2]).length;
	}

	get strategy(): DomainStorageStrategy {
		return this._xc_strategy;
	}

	get schema(): Readonly<SerSchema> {
		return this._a_schema;
	}

	get partLength(): number {
		return this._nl_parts;
	}

	get schemaCode(): number {
		return this._i_schema;
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

	protected _path_parts(g_criteria: g_parts): [Readonly<a_parts>, JsonObject] {
		// shallow copy object
		const g_copy: JsonObject = {...g_criteria as object};

		// construct item key
		return [odk(this._h_schema_parts).map((si_label) => {
			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return (g_criteria as Dict)[si_label as unknown as string];
		}) as unknown as Readonly<a_parts>, g_copy];
	}

	protected _item_path(g_criteria: g_parts): [ItemPath, JsonObject] {
		const [a_parts, g_copy] = this._path_parts(g_criteria);

		return [a_parts.join(':') as ItemPath, g_copy];
	}

	protected _backing(a_parts: PartableEsType[]=[], a_fields: JsonArray=[], i_code=0 as ItemCode): PropertyDescriptorMap {
		const {_nl_parts, _nl_fields} = this;

		const a_tuple = Array(1+this._nl_parts+this._nl_fields);

		// copy parts into place
		for(let i_part=0; i_part<Math.min(a_parts.length, _nl_parts); i_part++) {
			a_tuple[1+i_part] = a_parts[i_part];
		}

		// copy fields into place
		for(let i_field=0; i_field<Math.min(a_fields.length, _nl_fields); i_field++) {
			a_tuple[1+_nl_parts+i_field] = a_fields[i_field];
		}

		return {
			[$_CODE]: {
				value: i_code,
			},
			[$_CONTROLLER]: {
				value: this,
			},
			[$_TUPLE]: {
				value: a_tuple,
			},
			[$_LINKS]: {
				value: {},
			},
		};
	}

	protected _create_item_filter = (a_parts: (string | null)[]): RegExp => {
		// encode domain and escape regex
		const sx_domain = escape_regex(this._k_hub.encodeDomain(this._si_domain)!)+':';

		// no value specified; use wildcard; otherwise use escaped regex
		const a_patterns = a_parts.map(w_part => null === w_part? '[^:]*': escape_regex(w_part+''));

		// construct regex
		return new RegExp(`^${sx_domain}${a_patterns.join(':')}$`);
	};

	get domain(): si_domain {
		return this._si_domain;
	}

	get hub(): VaultHub {
		return this._k_hub;
	}

	_encode_item(a_parts: a_parts): ItemCode | undefined {
		const {_k_hub} = this;

		// joining parts implicitly stringifies them
		return _k_hub.itemCode(_k_hub.itemIdent(this._si_domain, a_parts.join(':') as ItemPath));
	}

	getItemCode(g_parts: g_parts): ItemCode | undefined {
		const a_parts = this._path_parts(g_parts)[0];

		return this._encode_item(a_parts);
	}

	getItemRef(g_parts: g_parts): ItemRef<g_item, g_runtime> | null {
		const i_item = this.getItemCode(g_parts);

		if(!i_item) return null;

		return new ItemRef<g_item, g_runtime>(this as GenericItemController<g_item, g_runtime>, i_item);
	}

	has1<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): boolean {
		return !!this._encode_item(a_parts);
	}

	has(a_parts: Readonly<a_parts>): boolean {
		return !!this._encode_item(a_parts);
	}

	get(g_parts: g_parts): Promise<g_runtime | undefined> {
		// 
		const a_parts = this._path_parts(g_parts)[0];

		return this.getAt(a_parts);
	}

	_instantiate(si_item: ItemIdent, a_tuple: SerItem, i_item: ItemCode): g_runtime {
		// split ident by reserved delimiter
		const a_split = si_item.split(':');

		// construct parts safely
		const a_parts = [...a_split.slice(1, this._nl_parts), a_split.slice(this._nl_parts).join(':')] as a_parts;

		// create instance
		return Object.create(this._g_prototype, this._backing(a_parts, a_tuple, i_item));
	}

	async getByCode(i_code: ItemCode | undefined, a_parts?: a_parts): Promise<g_runtime | undefined> {
		// item not found
		if(!i_code) return Promise.resolve(__UNDEFINED);

		// get item content
		const a_tuple = await this._k_hub.getItemContent(i_code);

		// create instance and set its local properties
		const g_item = Object.create(this._g_prototype, this._backing(a_parts, a_tuple, i_code));

		// return instance
		return g_item;
	}

	_serialize(g_item: SchemaToItemShape<g_schema, 1> | g_runtime): [ItemPath, SerItem, HubEffects] {
		// prep runtime item
		let g_runtime = g_item as g_runtime;

		// no backing data
		if(!is_runtime_item(g_item)) {
			// create bare instance
			const g_inst: RuntimeItem = Object.create(this._g_loader, this._backing());

			// TODO: ensure switches are ordered last, add test case

			// load into it
			Object.assign(g_inst, g_item);

			// replace
			g_runtime = g_inst as g_runtime;
		}
		// incorrect domain
		else if(this._si_domain !== g_item[$_CONTROLLER].domain) {
			throw new TypeError(`Attempted to pass an item from "${g_item[$_CONTROLLER].domain}" domain to the "${this._si_domain as string}" domain`);
		}

		// where the break between parts and fields is
		const i_break = this._nl_parts + 1;

		// return serialized item
		return [
			g_runtime[$_TUPLE].slice(1, i_break).join(':') as ItemPath,
			g_runtime[$_TUPLE].slice(i_break),
			{
				links: g_runtime[$_LINKS],
			},
		];
	}

	async getAt<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): Promise<g_runtime | undefined> {
		// locate item by its path
		return this.getByCode(this._encode_item(a_parts), a_parts);
	}

	async put(g_item: SchemaToItemShape<g_schema, 1>): Promise<[ItemPath, SerItem]> {
		const {_k_hub} = this;

		// serialize item
		const a_ser = this._serialize(g_item);

		// write item to storage
		await _k_hub.putItems(this._si_domain, this._i_schema, [a_ser]);

		// 
		return a_ser.slice(0, 2) as [ItemPath, SerItem];
	}

	async putMany(a_items: SchemaToItemShape<g_schema, 1>[]): Promise<[ItemPath, SerItem][]> {
		const {_k_hub} = this;

		// serialize items
		const a_sers = a_items.map(g_item => this._serialize(g_item));

		// write items to storage
		await _k_hub.putItems(this._si_domain, this._i_schema, a_sers);

		// 
		return a_sers.map(a_ser => a_ser.slice(0, 2) as [ItemPath, SerItem]);
	}


	/**
	 * Asynchronously iterates through all items as entries.
	 * If db is modified during iteration, deleted items will not cause error but new items
	 * _might_ not be yielded.
	 */
	async* entries(): AsyncIterableIterator<[ItemIdent, g_item]> {
		// each item entry from hub
		for await(const [i_item, si_item, a_tuple] of this._k_hub.itemEntries(this._si_domain)) {
			// create item
			const g_item = this._instantiate(si_item, a_tuple, i_item);

			if(!g_item[$_TUPLE]) {
				throw new Error(`Item missing TUPLE?!`);
			}

			// return key/value pair
			yield [si_item, g_item];
		}
	}

	/**
	 * 
	 * @param h_criteria 
	 * @param n_limit 
	 */
	async* filter(h_criteria: MatchCriteria<g_item>, n_limit=Infinity): AsyncIterableIterator<g_item> {
		// destructure fields
		const {_h_schema_fields, _h_schema_parts, _k_hub} = this;

		// copy criteria in prep to keep only fields
		const h_fields = {...h_criteria};

		// prep list of parts
		const a_parts: (string | null)[] = [];

		// each key part
		for(const si_part of odk(this._h_schema_parts)) {
			// part is present in criteria and able to be embedded in regex
			if(['number', 'bigint', 'string'].includes(typeof h_criteria[si_part])) {
				// use value
				a_parts.push(h_criteria[si_part]+'');

				// remove from fields-only copy
				delete h_fields[si_part];
			}
			// part not specified in criteria; indicate wildcard
			else {
				a_parts.push(null);
			}
		}

		// create filter regex
		const r_filter = this._create_item_filter(a_parts);

		// prep list of found items
		const a_matched: [ItemCode, ItemIdent][] = [];

		// each item
		const a_items = _k_hub.items;
		for(let i_item=1; i_item<a_items.length; i_item++) {
			const si_test = a_items[i_item];

			// filter passes; add to found list
			if(r_filter.test(si_test)) {
				a_matched.push([i_item as ItemCode, si_test]);
			}
		}

		// sort matches by bucket code to improve lookup locality
		a_matched.sort(([i_item_a], [i_item_b]) => _k_hub.getItemBucketCode(i_item_a) - _k_hub.getItemBucketCode(i_item_b));

		// count how many items have been yielded
		const c_yielded = 0;

		// each match
		for(const [i_item, si_item] of a_matched) {
			// get item content
			const a_tuple = await _k_hub.getItemContent(i_item);

			// load item
			const g_item = this._instantiate(si_item, a_tuple, i_item);

			// filter does not match; next candidate
			if(!apply_filter_struct(g_item as FieldStruct, h_fields as GenericStructMatchCriteria, '', _h_schema_fields, _h_schema_parts)) continue;

			// passed filter; yield
			yield g_item;

			// reached limit; search no more
			if(c_yielded >= n_limit) break;
		}
	}
}

export type AnyItemController = ItemController<any, any, any, any, any, any, any, any, any>;
