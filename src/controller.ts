import type {F} from 'ts-toolbelt';

import type {VaultHub} from './hub';
import type {RuntimeItem} from './item-proto';
import type {Reader} from './reader';

import type {DomainLabel, ItemCode, ItemIdent, ItemPath, SerFieldStruct, SerItem, SerKeyStruct, SerSchema, FieldLabel, SerTaggedDatatype} from './types';
import type {Vault} from './vault';
import type {Dict, JsonArray, JsonObject} from '@blake.regalia/belt';

import {F_IDENTITY, __UNDEFINED, escape_regex, is_dict_es, ode} from '@blake.regalia/belt';

import {SchemaError} from './errors';
import {apply_filter_struct, type GenericStructMatchCriteria, type MatchCriteria} from './filter';
import {$_CODE, $_CONTROLLER, $_TUPLE, item_prototype} from './item-proto';
import {ItemRef} from './item-ref';
import {interpret_schema} from './schema-impl';
import {type ItemShapesFromSchema, type StrictSchema, type SchemaSpecifier, type AcceptablePartTuples, type SchemaBuilder, type PartFields, type PartableEsType, type PrimitiveDatatypeToEsType, type PrimitiveDatatype, TaggedDatatype, type FieldStruct} from './schema-types';
import {DomainStorageStrategy} from './types';


export class ItemController<
	s_domain extends string,
	si_domain extends s_domain & DomainLabel,
	a_parts extends AcceptablePartTuples,
	g_schema extends StrictSchema,
	f_schema extends SchemaBuilder<SchemaSpecifier, a_parts, g_schema>,
	g_item extends ItemShapesFromSchema<g_schema>,
	g_proto,
	g_runtime extends g_item & g_proto,
	g_parts extends PartFields<g_schema>,
> {
	protected _k_vault: Vault;
	protected _si_domain!: si_domain;
	protected _xc_strategy: DomainStorageStrategy;
	protected _k_reader!: Reader;
	protected _nl_parts: number;
	protected _nl_fields: number;

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

		// cache part length
		this._nl_parts = Object.keys(a_schema[1]).length;

		// cache field length
		this._nl_fields = Object.keys(a_schema[2]).length;
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
		return [Object.keys(this._h_schema_parts).map((si_label) => {
			// remove from copy
			delete g_copy[si_label];

			// add to key parts
			return g_criteria[si_label as keyof g_parts];
		}) as unknown as Readonly<a_parts>, g_copy];
	}

	protected _item_path(g_criteria: g_parts): [ItemPath, JsonObject] {
		const [a_parts, g_copy] = this._path_parts(g_criteria);

		return [a_parts.join(':') as ItemPath, g_copy];
	}

	protected _backing(a_parts: PartableEsType[]=[], a_fields: JsonArray=[]): PropertyDescriptorMap {
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
				value: 0,
			},
			[$_CONTROLLER]: {
				value: this,
			},
			[$_TUPLE]: {
				value: a_tuple,
			},
		};
	}

	protected _create_item_filter = (a_parts: (PartableEsType | null)[]): RegExp => {
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

	get shape(): Readonly<SerSchema> {
		return this._a_schema;
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

	has<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): boolean {
		return !!this._encode_item(a_parts);
	}

	get(g_parts: g_parts): Promise<g_runtime | undefined> {
		// 
		const a_parts = this._path_parts(g_parts)[0];

		return this.getAt(a_parts);
	}

	_instantiate(si_item: ItemIdent, a_tuple: SerItem): g_item {
		// split ident by reserved delimiter
		const a_split = si_item.split(':');

		// construct parts safely
		const a_parts = [...a_split.slice(1, this._nl_parts), a_split.slice(this._nl_parts).join(':')] as a_parts;

		// create instance
		return Object.create(this._g_prototype, this._backing(a_parts, a_tuple));
	}

	async getByCode(i_code: ItemCode | undefined, a_parts?: a_parts): Promise<g_runtime | undefined> {
		// item not found
		if(!i_code) return Promise.resolve(__UNDEFINED);

		// get item content
		const a_tuple = await this._k_hub.getItemContent(i_code);

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

			// TODO: ensure switches are ordered last, add test case

			// load into it
			Object.assign(g_inst, g_item);

			// replace
			g_runtime = g_inst;
		}
		// incorrect domain
		else if(this._si_domain !== g_item[$_DOMAIN]) {
			throw new TypeError(`Attempted to pass an item from "${g_item[$_DOMAIN]}" domain to the "${this._si_domain as string}" domain`);
		}

		// where the break between parts and fields is
		const i_break = this._nl_parts + 1;

		// return serialized item
		return [
			g_runtime[$_TUPLE].slice(1, i_break).join(':') as ItemPath,
			g_runtime[$_TUPLE].slice(i_break),
		];
	}

	async getAt<a_local extends Readonly<a_parts>>(
		a_parts: a_local
	): Promise<g_runtime | undefined> {
		// locate item by its path
		return this.getByCode(this._encode_item(a_parts), a_parts);
	}

	async put(g_item: g_item) {
		const {_k_hub} = this;

		// serialize item
		const [sr_item, w_ser] = this._serialize(g_item);

		// write item to storage
		await _k_hub.putItem(this._si_domain, sr_item, w_ser);

		// 
		return [sr_item, w_ser];
	}

	// putAt<a_local extends a_parts>(
	// 	a_parts: a_local,
	// 	g_item: ExtractedMembers<a_local, g_schema>
	// ) {

	// }


	async* filter(h_criteria: MatchCriteria<g_item>, n_limit=Infinity): AsyncIterableIterator<g_item> {
		// destructure fields
		const {_h_schema_fields} = this;

		// copy criteria in prep to keep only fields
		const h_fields = {...h_criteria};

		// prep list of parts
		const a_parts = [];

		// each key part
		for(const si_part of Object.keys(this._h_schema_parts)) {
			// part is present in criteria
			if(si_part in h_criteria) {
				// use value
				a_parts.push(si_part);

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
		const a_items = this._k_hub.items;
		for(let i_item=1; i_item<a_items.length; i_item++) {
			const si_test = a_items[i_item];

			// filter passes; add to found list
			if(r_filter.test(si_test)) {
				a_matched.push([i_item as ItemCode, si_test]);
			}
		}

		// count how many items have been yielded
		const c_yielded = 0;

		// each match
		for(const [i_item, si_item] of a_matched) {
			// get item content
			const a_tuple = await this._k_hub.getItemContent(i_item);

			// load item
			const g_item = this._instantiate(si_item, a_tuple);

			// filter does not match; next candidate
			if(!apply_filter_struct(g_item as FieldStruct, h_fields as GenericStructMatchCriteria, '', _h_schema_fields)) continue;

			// passed filter; yield
			yield g_item;

			// reached limit; search no more
			if(c_yielded >= n_limit) break;
		}
	}

	// * filter(g_criteria: Partial<g_item>): AsyncIterableIterator<g_item> {

	// }

	/**
	 * Asynchronously iterates through all items as entries.
	 * If db is modified during iteration, deleted items will not cause error but new items
	 * _might_ not be yielded.
	 */
	async* entries(): AsyncIterableIterator<[ItemIdent, g_item]> {
		// each item entry from hub
		for await(const [i_item, si_item, a_tuple] of this._k_hub.itemEntries(this._si_domain)) {
			// create item
			const g_item = this._instantiate(si_item, a_tuple);

			// return key/value pair
			yield [si_item, g_item];
		}
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
