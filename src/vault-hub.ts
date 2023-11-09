import type {DomainCode, DomainLabel, ItemIdent, ItemCode, ItemPath, SerVaultHub, IndexLabel, IndexValue, IndexPosition, BucketKey} from './types';
import type {VaultClient} from './vault-client';

import type {JsonObject, Nilable} from '@blake.regalia/belt';

import {fold, odem, ofe} from '@blake.regalia/belt';

import {b92_to_index, index_to_b92} from './data';
import {Bug} from './errors';


export type ItemIdentPattern = ItemIdent | RegExp;

export class VaultHub {
	// decrypted and unmarshalled hub
	protected _a_domains: SerVaultHub['domains'] = [];
	protected _a_items = [] as unknown as SerVaultHub['items'];
	protected _h_indexes: SerVaultHub['indexes'] = {};
	protected _a_buckets = [] as unknown as SerVaultHub['buckets'];
	protected _a_locations = [] as unknown as SerVaultHub['locations'];

	// caches
	protected _h_domains: Record<DomainLabel, DomainCode> = {};
	protected _h_items: Record<ItemIdent, ItemCode> = {};

	// index of first gap in index sequence
	protected _i_next_item = 0;

	// update counter
	protected _c_updates = 0;

	constructor(
		protected _k_vault: VaultClient,
		_g_hub: SerVaultHub
	) {
		this._update(_g_hub);
	}

	get vault(): VaultClient {
		return this._k_vault;
	}

	// returns the isolated form of the current vault, ready for JSON serialization
	protected _isolate(): SerVaultHub {
		const g_hub: SerVaultHub = {
			domains: this._a_domains,
			items: this._a_items,
			indexes: this._h_indexes,
			buckets: this._a_buckets,
			locations: this._a_locations,
		};

		return g_hub;
	}


	/**
	 * Access the list contained by the given index label at the specified value
	 * @param si_index - the name of the index, e.g., "msg.type"
	 * @param s_value - the value to match, e.g., "/cosmos.bank.v1beta1.MsgSend"
	 * @returns `null` if the index does not exist or `undefiend` if the value is not indexed.
	 * 	otherwise, the list of {@link ItemCode} is returned
	 */
	_access_index(si_index: IndexLabel, s_value: IndexValue): Nilable<ItemCode[]> {
		// lookup index
		const h_index = this._h_indexes[si_index];

		// index not exists
		if(!h_index) return null;

		// lookup index value
		const a_list = h_index[s_value];

		// value does not exist
		return a_list;
	}


	/**
	 * @internal
	 * @param g_hub 
	 */
	_update(g_hub: SerVaultHub): void {
		// increment update counter
		this._c_updates += 1;

		// load fields from ser
		Object.assign(this, {
			_a_domains: g_hub.domains,
			_a_items: g_hub.items,
			_h_indexes: g_hub.indexes,
			_a_buckets: g_hub.buckets,
			_a_locations: g_hub.locations,
		});

		// cache domain lookup
		this._h_domains = fold(this._a_domains, (si_domain, i_domain) => ({
			[si_domain]: index_to_b92(i_domain) as DomainCode,
		}));

		// record non-zero index of first gap if it exists (zero means no gap)
		let i_next_item = 0;

		// cache item lookup; skip empty values
		this._h_items = fold(this._a_items, (si_item, i_item) => si_item? {
			[si_item]: i_item as ItemCode,
		}: (i_next_item ||= i_item, {}));

		// save field
		this._i_next_item = i_next_item;

		// 
	}


	/**
	 * Encode the given name to its domain code
	 * @param si_domain - the domain name
	 * @returns the domain key, or `null` if the domain does not exist
	 */
	encodeDomain(si_domain: DomainLabel): DomainCode | null {
		// encode domain
		const sb92_domain = this._h_domains[si_domain];

		// domain exists; return its key
		if(sb92_domain) return sb92_domain;

		// domain does not exist
		return null;
	}

	/**
	 * Encode the given domain and item path to its item code.
	 * Codes start at 1 so a falsy check on return value means item was not found.
	 * @param si_domain - the domain name
	 * @param sr_item - the item path
	 * @returns the non-zero index of the item if it was found, `undefined` otherwise
	 */
	encodeItem(si_domain: DomainLabel, sr_item: ItemPath): ItemCode | undefined {
		// encode domain and build item key
		const si_item = this._h_domains[si_domain]+':'+sr_item as ItemKey;

		// locate item code
		return this._h_items[si_item];
	}


	/**
	 * Adds the given item key to the global index, or no-op if it already exists.
	 * @param si_domain - the domain name
	 * @param sr_item - the item path
	 * @returns the non-zero index of the new/existing item
	 */
	addItemKey(si_domain: DomainLabel, sr_item: ItemPath): ItemCode {
		// encode domain
		const sb92_domain = this._h_domains[si_domain];

		// no such domain
		if(!sb92_domain) throw new Bug(`Attempted to add an item to non-existant domain "${si_domain}"`);

		// build item ident
		const si_item = sb92_domain+':'+sr_item as ItemIdent;

		// prep to locate or create code of item
		let i_code = this._h_items[si_item];

		// return existing
		if(i_code) return i_code;

		// a gap exists
		let i_empty = this._i_next_item;
		if(i_empty) {
			// set index to use
			i_code = i_empty as ItemCode;

			// fill gap
			this._a_items[i_code] = si_item;

			// update lookup cache
			this._h_items[si_item] = i_code;

			// find next gap
			i_empty = this._a_items.indexOf('' as ItemIdent, i_code+1);

			// save to field
			this._i_next_item = i_empty > 0? i_empty: 0;
		}
		// no gaps; append
		else {
			i_code = this._a_items.push(si_item) - 1 as ItemCode;
		}

		// return new index
		return i_code;
	}


	/**
	 * Scans the list of values contained by the given index having the specified value
	 * @param si_index - the name of the index, e.g., "msg.type"
	 * @param s_value - the value to match, e.g., "/cosmos.bank.v1beta1.MsgSend"
	 * @param r_filter - optional regex to filter by {@link ItemIdent}
	 * @returns an iterator yielding a tuple where:
	 *   - 0: {@link DomainCode} - raw base92-encoded domain code. use {@link encodeDomain} to get the {@link DomainLabel}
	 *   - 1: {@link ItemPath} - raw item path
	 */
	* scanIndex(si_index: IndexLabel, s_value: IndexValue, r_filter?: RegExp): Nilable<Iterable<[DomainCode, ItemPath]>> {
		// access the index
		const a_list = this._access_index(si_index, s_value);

		// non-existant
		if(!a_list) return a_list;

		// destructure fields
		const {
			_a_items,
		} = this;

		// each item code in index
		for(const i_code of a_list) {
			// lookup item ident
			const si_item = _a_items[i_code];

			// apply optional filter
			if(r_filter && !r_filter.test(si_item)) continue;

			// split item ident into domain code and item path
			const i_split = si_item.indexOf(':');

			// extract domain code
			const sb92_domain = si_item.slice(0, i_split) as DomainCode;

			// extract item path
			const sr_item = si_item.slice(i_split+1) as ItemPath;

			// yield tuple of [DomainCode, ItemPath]
			yield [sb92_domain, sr_item];
		}
	}

	/**
	 * Gets all items by their domain and path contained by the given index having the specified value
	 * @param si_index - the name of the index, e.g., "msg.type"
	 * @param s_value - the value to match, e.g., "/cosmos.bank.v1beta1.MsgSend"
	 * @param r_filter - optional regex to filter by {@link ItemIdent}
	 * @returns an object keyed by {@link DomainLabel} having values that are arrays of {@link ItemPath}s
	 */
	getIndex(si_index: IndexLabel, s_value: IndexValue, r_filter?: RegExp): Nilable<Record<DomainLabel, ItemPath[]>> {
		// destructure fields
		const {
			_a_domains,
		} = this;

		// prep groups for results
		const h_groups: Record<DomainCode, ItemPath[]> = {};

		// prep scan iterator
		const di_scan = this.scanIndex(si_index, s_value, r_filter);

		// index or value not found
		if(!di_scan) return di_scan;

		// scan the index, for each item
		for(const [sb92_domain, sr_item] of di_scan) {
			// update group
			(h_groups[sb92_domain] ??= []).push(sr_item);
		}

		// transform group by mapping domain codes to labels
		return ofe(odem(h_groups, ([sb92_domain, a_items]) => [
			_a_domains[b92_to_index(sb92_domain)],
			a_items,
		]));
	}

	findCodesInIndex(si_index: IndexLabel, s_value: IndexValue, z_item: ItemIdentPattern): Nilable<[ItemCode[], [IndexPosition, ItemIdent][]]> {
		// access the index
		const a_list = this._access_index(si_index, s_value);

		// non-existant
		if(!a_list) return a_list;

		// destructure fields
		const {
			_a_items,
		} = this;

		// list of [position, item ident] where a match was found
		const a_found: [IndexPosition, ItemIdent][] = [];

		// exact item id given
		if('string' === typeof z_item) {
			// map to item code
			const i_code = _a_items.indexOf(z_item);

			// item exists
			if(i_code > 0) {
				// search the list for the given item ident
				const i_found = a_list.indexOf(i_code) as IndexPosition;

				// found; add to list
				if(-1 !== i_found) {
					a_found.push([i_found, z_item]);
				}
			}
		}
		// regex given
		else {
			// each item code in index
			for(let i_pos=0; i_pos<a_list.length; i_pos++) {
				// lookup item ident
				const si_item = _a_items[a_list[i_pos]];

				// apply filter
				if(!z_item.test(si_item)) continue;

				// add to list
				a_found.push([i_pos as IndexPosition, si_item]);
			}
		}

		// return found results
		return [a_list, a_found];
	}

	findIdentsInIndex(si_index: IndexLabel, s_value: IndexValue, z_item: ItemIdentPattern): Nilable<ItemIdent[]> {
		// attempt to match item pattern
		const a_findings = this.findCodesInIndex(si_index, s_value, z_item);

		// index or its value don't exist
		if(!a_findings) return a_findings;

		// transform positions into item idents
		return a_findings[1].map(([, si_item]) => si_item);
	}

	getItemBucket(i_code: ItemCode): BucketKey {
		// get bucket code
		const i_bucket = this._a_locations[i_code];

		// resolve to bucket key
		return this._a_buckets[i_bucket];
	}

	async replaceItem(i_code: ItemCode, g_item: JsonObject) {
		// get bucket key for item
		const si_bucket = this.getItemBucket(i_code);

		// load bucket
		const [n_version, g_schema] = await this._k_vault.readBucket(si_bucket);
	}
}



