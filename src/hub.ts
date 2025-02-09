import type {AnyItemController, GenericItemController} from './controller';
import type {$_LINKS, RuntimeItem} from './item-proto';
import type {KelvinKeyValueWriter} from './store';
import type {DomainCode, DomainLabel, ItemIdent, ItemCode, ItemPath, SerVaultHub, IndexLabel, IndexValue, IndexPosition, BucketKey, BucketCode, SchemaCode, SerSchema, SerItem, SerBucketMetadata, SerBucket, FieldPathCode, SerFieldPath, SerLinksTuple} from './types';
import type {Migration, Vault} from './vault';

import type {Nilable} from '@blake.regalia/belt';

import {bytes_to_base93, transform_values, fold, is_array, entries, map_entries, values, from_entries, text_to_bytes} from '@blake.regalia/belt';

import {random_bytes} from '@solar-republic/crypto';

import {NB_BUCKET_CONTAINER, NB_BUCKET_CONTENTS, NB_BUCKET_LABEL, SX_KEY_PART_DELIMITER, XT_ROTATION_DEBOUNCE, XT_ROTATION_WAIT_MAX} from './constants';
import {index_to_b92} from './data';
import {Bug, ClientBehindError, MigrationError, MissingMigrationError, MissingMigrationRouterError, SchemaError, SchemaWarning} from './errors';
import {DomainStorageStrategy} from './types';



export type ItemIdentPattern = ItemIdent | RegExp;

export type HubEffects = {
	links: RuntimeItem[typeof $_LINKS];
};

// creates a new random bucket key
const new_bucket_key = () => '_'+bytes_to_base93(random_bytes(NB_BUCKET_LABEL)) as BucketKey;

export class VaultHub {
	// decrypted and unmarshalled hub
	protected _n_db_version = 0 as SerVaultHub['db_version'];
	protected _h_domains: SerVaultHub['domains'] = {};
	protected _a_items = [0] as unknown as SerVaultHub['items'];
	protected _h_indexes: SerVaultHub['indexes'] = {};
	protected _a_buckets = [] as unknown as SerVaultHub['buckets'];
	protected _a_locations = [0] as unknown as SerVaultHub['locations'];
	protected _a_buckets_to_schemas = [] as unknown as SerVaultHub['buckets_to_schemas'];
	protected _a_schemas = [] as unknown as SerVaultHub['schemas'];
	protected _nb_bucket: SerVaultHub['bucket_length'] = NB_BUCKET_CONTENTS;
	protected _h_links: SerVaultHub['links'] = {};
	protected _a_prune: SerVaultHub['prune'] = [];

	// caches
	protected _h_domain_codes: Record<DomainLabel, DomainCode> = {};
	protected _h_domain_labels: Record<DomainCode, DomainLabel> = {};
	protected _h_items: Record<ItemIdent, ItemCode> = {};

	// index of first gap in index sequence
	protected _i_next_item = 0;

	// update counter
	protected _c_updates = 0;

	// scheduled tasks
	protected _i_task_rotate = 0;
	protected _xt_since_rotate = 0;

	// bucket bypass queue
	protected _as_buckets_bypass = new Set<BucketKey>();

	// bucket prune queue
	protected _as_buckets_prune = new Set<BucketKey>();


	constructor(
		protected _k_vault: Vault,
		protected _h_controllers: Record<DomainLabel, GenericItemController>
	) {}

	get vault(): Vault {
		return this._k_vault;
	}

	get items(): ItemIdent[] {
		return this._a_items;
	}

	async _write_hub(kw_content: KelvinKeyValueWriter, g_overwrite: Partial<SerVaultHub>={}): Promise<void> {
		return await this._k_vault.writeHub({
			...this.isolate(),
			...g_overwrite,
		}, kw_content);
	}

	// returns the isolated form of the current vault, ready for JSON serialization
	isolate(): SerVaultHub {
		const g_hub: SerVaultHub = {
			db_version: this._n_db_version,
			bucket_length: this._nb_bucket,
			domains: this._h_domains,
			items: this._a_items,
			indexes: this._h_indexes,
			buckets: this._a_buckets,
			locations: this._a_locations,
			buckets_to_schemas: this._a_buckets_to_schemas,
			schemas: this._a_schemas,
			links: this._h_links,
			prune: this._a_prune,
		};

		return g_hub;
	}

	/**
	 * @param g_hub 
	 */
	load(g_hub: SerVaultHub): void {
		// increment update counter
		this._c_updates += 1;

		// load fields from ser
		Object.assign(this, {
			_n_database: g_hub.db_version,
			_nb_bucket: g_hub.bucket_length,
			_h_domains: g_hub.domains,
			_a_items: g_hub.items,
			_h_indexes: g_hub.indexes,
			_a_buckets: g_hub.buckets,
			_a_locations: g_hub.locations,
			_a_buckets_to_schemas: g_hub.buckets_to_schemas,
			_a_schemas: g_hub.schemas,
			_h_links: g_hub.links,
			_a_prune: g_hub.prune,
		});

		// create lookup from domain label to domain code
		this._h_domain_codes = transform_values(this._h_domains, (w_metadata, si_domain, i_domain) => index_to_b92(i_domain) as DomainCode);

		// create lookup from domain code to domain label
		this._h_domain_labels = from_entries(map_entries(this._h_domains, ([si_domain], i_domain) => [index_to_b92(i_domain), si_domain]));

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

	async _init(kw_content: KelvinKeyValueWriter, h_migrations?: Record<number, Migration>): Promise<void> {
		// db version the app is targetting
		const {version: n_db_version_app} = this._k_vault.databaseInfo;

		// version of the database in storage
		const n_db_version_storage = this._n_db_version;

		// prep discrepancy error msg
		const s_discrepancy_msg = `database version: #${n_db_version_storage}; your version: #${n_db_version_app}`;

		// storage is behind
		if(n_db_version_storage < n_db_version_app) {
			// no migration router
			if(!h_migrations) {
				throw new MissingMigrationRouterError(s_discrepancy_msg);
			}

			// process migrations
			for(let n_version=n_db_version_storage; n_version<n_db_version_app; n_version++) {
				// ref migration
				const f_migrate = h_migrations[n_version];

				// prep error message info
				const s_version_msg = `from version #${n_version} to version #${n_version+1}`;

				// migration handler not found
				if(!f_migrate) throw new MissingMigrationError(s_version_msg);

				// call migration
				try {
					debugger;

					await f_migrate({
						domain(si_domain) {
							throw new Error(`Not yet implemented`);
						},
					});
				}
				catch(e_migrate) {
					throw new MigrationError(s_version_msg, e_migrate);
				}
			}
		}
		// storage is ahead
		else if(n_db_version_storage > n_db_version_app) {
			throw new ClientBehindError(s_discrepancy_msg);
		}

		// destructure fields
		const {_h_domains, _h_domain_codes, _h_domain_labels, _a_buckets_to_schemas, _a_schemas} = this;

		// each registered domain/controller pair
		for(const [si_domain, k_controller] of entries(this._h_controllers)) {
			// serialize latest schema
			const sx_schema_new = JSON.stringify(k_controller.schema);

			// prep schema code
			let i_schema = -1 as SchemaCode;

			// domain not defined in hub
			if(!_h_domains[si_domain]) {
				// compute domain code
				const sc_domain = index_to_b92(Object.keys(_h_domains).length) as DomainCode;

				// add domain
				_h_domains[si_domain] = [
					[],  // no buckets yet
					k_controller.strategy,
					// this.domain_version_id(si_domain, sx_schema_new),  // domain version id
				];

				// update code and label
				_h_domain_codes[si_domain] = sc_domain;
				_h_domain_labels[sc_domain] = si_domain;

				// find next spot for schema
				i_schema = _a_schemas.indexOf(0) as SchemaCode;

				// no open spots, append new spot to end
				if(i_schema < 0) i_schema = _a_schemas.length as SchemaCode;
			}
			// domain exists
			else {
				// destructure it
				const [a_bucket_codes] = _h_domains[si_domain];

				// prep 
				i_schema = -1 as SchemaCode;

				// each bucket
				for(const i_bucket of a_bucket_codes) {
					// lookup its schema
					const i_schema_check = _a_buckets_to_schemas[i_bucket];

					// schema is up-to-date; skip
					if(i_schema_check === i_schema) continue;

					// serialize its schema
					const sx_schema_old = JSON.stringify(_a_schemas[i_schema_check]);

					// same as latest
					if(sx_schema_old === sx_schema_new) {
						// capture schema code
						i_schema = i_schema_check;

						// next
						continue;
					}

					// discrepancy
					throw new SchemaError(`Schema for '${si_domain}' domain changed but items were not migrated`);
				}
			}

			// save schema code to controller
			(k_controller as AnyItemController)._i_schema = i_schema;
		}

		// delete all buckets marked for pruning in they still exist
		const {_a_prune} = this;
		if(_a_prune.length) {
			await this._k_vault.deleteBuckets(_a_prune, kw_content);
			_a_prune.length = 0;
		}
	}

	_schedule_rotation(): void {
		// already scheduled
		if(this._i_task_rotate) {
			// max wait time exceeded; do not postpone any longer
			if(Date.now() - this._xt_since_rotate > XT_ROTATION_WAIT_MAX) return;

			// clear old timeout
			clearTimeout(this._i_task_rotate);
		}
		// nothing scheduled
		else {
			// record time at which this original task was scheduled
			this._xt_since_rotate = Date.now();
		}

		// schedule
		this._i_task_rotate = (setTimeout as Window['setTimeout'])(async() => {
			// destructure fields
			const {_k_vault, _nb_bucket, _a_buckets, _as_buckets_bypass, _as_buckets_prune} = this;

			// obtain write lock
			await _k_vault.withExclusive(async(kw_content) => {
				// copy buckets sequence
				const a_buckets = [..._a_buckets.map(a_meta => [...a_meta])] as SerBucketMetadata[];

				// each bucket defined in hub
				for(const [i_bucket, [si_bucket_old]] of this._a_buckets.entries()) {
					// bypass bucket from rotation
					if(_as_buckets_bypass.has(si_bucket_old)) continue;

					// read contents
					const h_bucket = await _k_vault.readBucket(si_bucket_old);

					// generate new key
					const si_bucket_new = new_bucket_key();

					// update bucket key
					a_buckets[i_bucket as BucketCode][0] = si_bucket_new;

					// write contents to new bucket
					await _k_vault.writeBucket(si_bucket_new, h_bucket, _nb_bucket, kw_content);

					// add old bucket to prune list
					_as_buckets_prune.add(si_bucket_old);
				}

				// write hub
				await this._write_hub(kw_content, {
					buckets: a_buckets,
				});

				// replace buckets sequence synchronously now that new buckets exist
				this._a_buckets = a_buckets;

				// prune all old buckets at once
				await _k_vault.deleteBuckets(_as_buckets_prune, kw_content);
			});
		}, XT_ROTATION_DEBOUNCE);
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
	 * Encode the given name to its domain code
	 * @param si_domain - the domain name
	 * @returns the domain key, or `null` if the domain does not exist
	 */
	encodeDomain(si_domain: DomainLabel): DomainCode | null {
		// encode domain
		const sb92_domain = this._h_domain_codes[si_domain];

		// domain exists; return its key
		if(sb92_domain) return sb92_domain;

		// domain does not exist
		return null;
	}

	/**
	 * Decode the given code to its domain label (inverse of {@link encodeDomain})
	 * @param sb92_domain - the domain code
	 * @returns the domain label, or `null` if the domain does not exist
	 */
	decodeDomain(sb92_domain: DomainCode): DomainLabel | null {
		return this._h_domain_labels[sb92_domain] || null;
	}

	/**
	 * Encode the given domain and item path to its item ident.
	 * @param si_domain - the domain name
	 * @param sr_item - the item path
	 * @returns the non-zero index of the item if it was found, `undefined` otherwise
	 */
	itemIdent(si_domain: DomainLabel, sr_item: ItemPath): ItemIdent {
		// encode domain and build item ident
		return this._h_domain_codes[si_domain]+SX_KEY_PART_DELIMITER+sr_item as ItemIdent;
	}

	/**
	 * Looks up the given ident in the item registry and returns its code if found.
	 * Codes start at 1 so a falsy check on return value means item was not found.
	 * @param si_domain - the domain name
	 * @param sr_item - the item path
	 * @returns the non-zero index of the item if it was found, `undefined` otherwise
	 */
	itemCode(si_item: ItemIdent): ItemCode | undefined {
		// locate item code
		return this._h_items[si_item];
	}

	/**
	 * Retrieves an item' ident by its code.
	 * @param i_code 
	 * @returns 
	 */
	decodeItem(i_code: ItemCode): ItemIdent | undefined {
		return this._a_items[i_code];
	}

	/**
	 * Adds the given item key to the global index, or no-op if it already exists.
	* @param si_domain - the domain name
	* @param sr_item - the item path
	 * @returns a tuple where:
	 *   - 0: the non-zero index of the new/existing item
	 *   - 1: `true` if the item already exists, `false` otherwise
	 */
	addItemKey(si_domain: DomainLabel, sr_item: ItemPath): [ItemCode, boolean] {
		// encode domain
		const sb92_domain = this._h_domain_codes[si_domain];

		// no such domain
		if(!sb92_domain) {
			throw new Bug(`Attempted to add an item to non-existant domain "${si_domain}". Keep in mind that any ItemController needs to be created before the Vault is opened`);
		}

		// build item ident
		const si_item = sb92_domain+SX_KEY_PART_DELIMITER+sr_item as ItemIdent;

		// prep to locate or create code of item
		let i_code = this._h_items[si_item];

		// return existing
		if(i_code) return [i_code, true];

		// a gap exists
		let i_empty = this._i_next_item;
		if(i_empty) {
			// set index to use
			i_code = i_empty as ItemCode;

			// fill gap
			this._a_items[i_code] = si_item;

			// find next gap
			i_empty = this._a_items.indexOf('' as ItemIdent, i_code+1);

			// save to field
			this._i_next_item = i_empty > 0? i_empty: 0;
		}
		// no gaps; append
		else {
			i_code = this._a_items.push(si_item) - 1 as ItemCode;
		}

		// update lookup cache
		this._h_items[si_item] = i_code;

		// return new index
		return [i_code, false];
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
			const i_split = si_item.indexOf(SX_KEY_PART_DELIMITER);

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
	getIndex(
		si_index: IndexLabel,
		s_value: IndexValue,
		r_filter?: RegExp
	): Nilable<Record<DomainLabel, ItemPath[]>> {
		// destructure fields
		const {
			_h_domain_labels,
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
		return from_entries(map_entries(h_groups, ([sb92_domain, a_items]) => [
			_h_domain_labels[sb92_domain],
			a_items,
		]));
	}

	findCodesInIndex(
		si_index: IndexLabel,
		s_value: IndexValue,
		z_item: ItemIdentPattern
	): Nilable<[ItemCode[], [IndexPosition, ItemIdent][]]> {
		// access the index
		const a_list = this._access_index(si_index, s_value);

		// non-existant
		if(!a_list) return a_list;

		// destructure fields
		const {_a_items} = this;

		// list of [position, item ident] where a match was found
		const a_found: [IndexPosition, ItemIdent][] = [];

		// exact item id given
		if('string' === typeof z_item) {
			// map to item code
			const i_code = _a_items.indexOf(z_item) as ItemCode;

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

	findIdentsInIndex(
		si_index: IndexLabel,
		s_value: IndexValue,
		z_item: ItemIdentPattern
	): Nilable<ItemIdent[]> {
		// attempt to match item pattern
		const a_findings = this.findCodesInIndex(si_index, s_value, z_item);

		// index or its value don't exist
		if(!a_findings) return a_findings;

		// transform positions into item idents
		return a_findings[1].map(([, si_item]) => si_item);
	}

	/**
	 * Gets the code of the bucket containing the given item code
	 * @param i_code 
	 * @returns 
	 */
	getItemBucketCode(i_code: ItemCode): BucketCode {
		return this._a_locations[i_code];
	}

	// resolve bucket code to bucket key
	getBucketMetadata(i_bucket: BucketCode): SerBucketMetadata {
		return this._a_buckets[i_bucket];
	}

	getBucketSchemaCode(i_bucket: BucketCode): SchemaCode {
		return this._a_buckets_to_schemas[i_bucket];
	}

	getSchema(i_schema: SchemaCode): Readonly<SerSchema> | 0 {
		return this._a_schemas[i_schema];
	}

	_new_bucket(si_domain: DomainLabel, h_contents: SerBucket={}, nb_bucket=2): [BucketCode, BucketKey, SerBucket] {
		// create new bucket key
		const si_bucket = new_bucket_key();

		// acquire immutable bucket code
		const i_bucket = this._a_buckets.length as BucketCode;

		// add bucket to sequence
		this._a_buckets[i_bucket] = [si_bucket, nb_bucket || 2];  // 2 for surrounding `{}`

		// add bucket to domain map
		(this._h_domains[si_domain][0] ??= []).push(i_bucket);

		// return code and key as tuple
		return [i_bucket, si_bucket, h_contents];
	}

	async _select_bucket_for_insert(si_domain: DomainLabel, nb_item: number): Promise<[BucketCode, BucketKey, SerBucket, BucketKey?]> {
		// destructure fields
		const {
			_nb_bucket,
			_a_buckets,
		} = this;

		// destructure domain metadatas
		const [a_bucket_codes, xc_strategy] = this._h_domains[si_domain];

		// prep bucket selection
		let i_bucket = -1 as BucketCode;

		// default/minimize mode
		if([DomainStorageStrategy.DEFAULT, DomainStorageStrategy.MINIMIZE].includes(xc_strategy)) {
			// find first slot item can fit
			for(const i_bucket_test of a_bucket_codes) {
				// destructure bucket metadata
				const [, nb_size] = _a_buckets[i_bucket_test];

				// there is room to add item
				if(_nb_bucket - nb_size > nb_item) {
					i_bucket = i_bucket_test;
					break;
				}
			}
		}
		// append mode
		else if(DomainStorageStrategy.APPEND === xc_strategy) {
			// take last bucket
			const i_bucket_test = a_bucket_codes.at(-1)!;

			// destructure bucket metadata
			const [, nb_size] = _a_buckets[i_bucket_test];

			// there is room to add item
			if(_nb_bucket - nb_size > nb_item) {
				i_bucket = i_bucket_test;
			}
		}
		// unrecognized option
		else {
			throw new Bug(`Unrecognized domain storage strategy #${xc_strategy}`);
		}

		// an existing bucket was selected
		if(i_bucket >= 0) {
			// get bucket key
			const si_bucket = this.getBucketMetadata(i_bucket)[0];

			// load bucket contents
			const h_bucket = await this._k_vault.readBucket(si_bucket);

			// return all bucket info
			return [i_bucket, new_bucket_key(), {...h_bucket}, si_bucket];
		}

		// no bucket was selected, add new one
		return this._new_bucket(si_domain);
	}

	// async putItem(si_domain: DomainLabel, i_schema: SchemaCode, sr_item: ItemPath, w_item: SerItem, g_effects: HubEffects): Promise<void> {
	// 	// obtain lock
	// 	await this._k_vault.withExclusive(async(kw_content) => {
	// 		// add item key
	// 		const [i_item, b_exists] = this.addItemKey(si_domain, sr_item);

	// 		// serialize item to calculate its length
	// 		const nb_item = text_to_buffer(`"${i_item}":${JSON.stringify(w_item)}`).length;

	// 		// item is larger than capacity
	// 		if(nb_item + NB_BUCKET_CONTAINER > this._nb_bucket) {
	// 			console.warn(new SchemaWarning(`Item being stored to ${si_domain}:${sr_item} exceeds bucket capacity. This can lead to degradation of privacy.`));
	// 		}

	// 		// which bucket item is being place in
	// 		let i_bucket: BucketCode;
	// 		let si_bucket: BucketKey;
	// 		let h_bucket: SerBucket;

	// 		// in case an old bucket needs to be deleted
	// 		let si_bucket_delete: BucketKey | undefined;

	// 		// item already exists
	// 		if(b_exists) {
	// 			// get bucket code
	// 			const i_bucket_exist = this.getItemBucketCode(i_item);

	// 			// get bucket metadata
	// 			const [si_bucket_exist, nb_bucket_exist] = this.getBucketMetadata(i_bucket_exist);

	// 			// load bucket
	// 			const h_bucket_exist = await this._k_vault.readBucket(si_bucket_exist);

	// 			// calculate size of existing item
	// 			const nb_item_exist = text_to_buffer(JSON.stringify(h_bucket_exist[i_item])).length;

	// 			// new item will fit (adding 1 for comma)
	// 			if(nb_item + 1 <= nb_item_exist || (nb_bucket_exist - nb_item_exist + nb_item + 1) <= this._nb_bucket) {
	// 				// select bucket
	// 				i_bucket = i_bucket_exist;

	// 				// mark old entry for deletion
	// 				si_bucket_delete = si_bucket_exist;

	// 				// copy contents
	// 				h_bucket = {...h_bucket_exist};

	// 				// create new bucket key
	// 				si_bucket = new_bucket_key();
	// 			}
	// 			// item won't fit
	// 			else {
	// 				// create new bucket and select as destination
	// 				[i_bucket, si_bucket, h_bucket] = this._new_bucket(si_domain);

	// 				// set schema association
	// 				this._a_buckets_to_schemas[i_bucket] = i_schema;
	// 			}
	// 		}
	// 		// new item
	// 		else {
	// 			// determine which bucket to place item in
	// 			[i_bucket, si_bucket, h_bucket, si_bucket_delete] = await this._select_bucket_for_insert(si_domain, nb_item);
	// 		}

	// 		// place item into bucket
	// 		h_bucket[i_item] = w_item;

	// 		// first, write the new bucket
	// 		await this._k_vault.writeBucket(si_bucket, h_bucket, this._nb_bucket, kw_content);

	// 		// create copies of hub entries being modified
	// 		const a_buckets_mut = this._a_buckets.slice();
	// 		const a_locations_mut = this._a_locations.slice();
	// 		const h_links_mut = {...this._h_links};

	// 		// ref-clone bucket metadata
	// 		const a_metadata = a_buckets_mut[i_bucket] = a_buckets_mut[i_bucket].slice() as SerBucketMetadata;

	// 		// update bucket key
	// 		a_metadata[0] = si_bucket;

	// 		// adjust bucket size
	// 		a_metadata[1] += nb_item;

	// 		// save item location
	// 		a_locations_mut[i_item] = i_bucket;

	// 		// apply hub effects
	// 		{
	// 			// encode source domain
	// 			const sb92_domain_source = this.encodeDomain(si_domain)!;

	// 			// each affected domain
	// 			for(const [sb92_domain_target, g_links] of ode(g_effects.links)) {
	// 				// nothing to do; skip
	// 				if(!Object.keys(g_links.remove).length && !Object.keys(g_links.insert).length) continue;

	// 				debugger;

	// 				// ref-clone-create dict of incoming links for the specified target domain
	// 				const h_incoming_mut = {...h_links_mut[sb92_domain_target] || {}};

	// 				// ref-clone-create 
	// 				const [h_paths, h_items] = (h_incoming_mut[sb92_domain_source]?.slice() || [[], {}]) as SerLinksTuple;

	// 				// convert to mutable entries
	// 				let h_paths_mut = {...h_paths};

	// 				// create pseudo-sequence from keys
	// 				const a_paths_keys = Object.keys(h_paths_mut);

	// 				// ref-clone-create item
	// 				const h_refs_mut = {...h_items[i_item]};

	// 				// each removal
	// 				for(const [sr_path_remove, w_remove] of ode(g_links.remove)) {
	// 					// path not found
	// 					if(!h_paths[sr_path_remove]) {
	// 						throw Error(`Cannot remove old item reference since field path (${sr_path_remove}) could not be encoded in ${this.decodeDomain(sb92_domain_target)}`);
	// 					}

	// 					// encode field path
	// 					const i_path = a_paths_keys.indexOf(sr_path_remove) as FieldPathCode;

	// 					// confirm value being removed
	// 					const z_value = h_refs_mut[i_path];
	// 					if(Array.isArray(z_value)) {
	// 						if(JSON.stringify(w_remove) !== JSON.stringify(z_value)) {
	// 							throw Error(`Mismatch link removal; expected ${JSON.stringify(w_remove)} but found ${JSON.stringify(z_value)}`);
	// 						}
	// 					}
	// 					else if(w_remove !== z_value) {
	// 						throw Error(`Mismatch link removal; expected ${w_remove} but found ${z_value}`);
	// 					}

	// 					// delete from refs
	// 					delete h_refs_mut[i_path];

	// 					// decrement ref counter; no more usages
	// 					if(0 === (h_paths_mut[sr_path_remove] -= 1)) {
	// 						// convert object to entries to preserve order
	// 						const a_entries = ode(h_paths_mut);

	// 						// nullify entry
	// 						a_entries[i_path] = ['' as SerFieldPath, 0];

	// 						// write serialized entries back to object
	// 						h_paths_mut = ofe(a_entries);
	// 					}
	// 				}

	// 				// each insertion
	// 				for(const [sr_path_insert, w_insert] of ode(g_links.insert)) {
	// 					// prep path code
	// 					let i_path: FieldPathCode;

	// 					// path already defined; deduce its code
	// 					if(h_paths[sr_path_insert]) {
	// 						i_path = a_paths_keys.indexOf(sr_path_insert) as FieldPathCode;
	// 					}
	// 					// add new path
	// 					else {
	// 						// find next free spot
	// 						i_path = a_paths_keys.indexOf('') as FieldPathCode;

	// 						// need to append
	// 						if(-1 === i_path) {
	// 							// append key
	// 							i_path = a_paths_keys.push(sr_path_insert) - 1 as FieldPathCode;

	// 							// insert new entry, init ref counter to 0
	// 							h_paths_mut[sr_path_insert] = 0;
	// 						}
	// 					}

	// 					// increment ref counter
	// 					h_paths_mut[sr_path_insert] += 1;

	// 					// insert ref
	// 					h_refs_mut[i_path] = w_insert;
	// 				}

	// 				// ref-clone-set items
	// 				const h_items_mut = {
	// 					...h_items,
	// 					[i_item]: h_refs_mut,
	// 				};

	// 				// set incoming
	// 				h_incoming_mut[sb92_domain_source] = [h_paths_mut, h_items_mut];

	// 				// set links
	// 				h_links_mut[sb92_domain_target] = h_incoming_mut;
	// 			}
	// 		}

	// 		// next, update the hub
	// 		await this._write_hub(kw_content, {
	// 			buckets: a_buckets_mut,
	// 			locations: a_locations_mut,
	// 		});

	// 		// add old bucket to deletion queue
	// 		if(si_bucket_delete) {
	// 			this._as_buckets_prune.add(si_bucket_delete);
	// 		}

	// 		// schedule a bucket rotation
	// 		this._schedule_rotation();
	// 	});
	// }


	async putItems(si_domain: DomainLabel, i_schema: SchemaCode, a_items: [sr_item: ItemPath, w_item: SerItem, g_effects: HubEffects][]): Promise<void> {
		type DraftBucket = {
			key: BucketKey;
			code: BucketCode;
			size: number;
			contents: SerBucket;
		};

		// obtain lock
		await this._k_vault.withExclusive(async(kw_content) => {
			// // create copies of hub entries being modified
			// const a_buckets_mut = this._a_buckets.slice();
			// const a_locations_mut = this._a_locations.slice();
			// const h_links_mut = {...this._h_links};

			const a_buckets_mut = this._a_buckets;
			const a_locations_mut = this._a_locations;
			const h_links_mut =this._h_links;

			// list of old bucket keys pending deletion
			const as_buckets_delete = new Set<BucketKey>();

			// new buckets being added
			const h_buckets_new: Record<BucketCode, DraftBucket> = {};

			// most recent bucket added
			let g_bucket_draft!: DraftBucket;

			// each item
			for(const [sr_item, w_item, g_effects] of a_items) {
				// add item key
				const [i_item, b_exists] = this.addItemKey(si_domain, sr_item);

				// serialize item to calculate its length
				const nb_item = text_to_bytes(`"${i_item}":${JSON.stringify(w_item)}`).length;

				// item is larger than capacity
				if(nb_item + NB_BUCKET_CONTAINER > this._nb_bucket) {
					console.warn(new SchemaWarning(`Item being stored to ${si_domain}:${sr_item} exceeds bucket capacity. This can lead to degradation of privacy.`));
				}

				// which bucket item is being place in
				let i_bucket: BucketCode;
				let si_bucket: BucketKey;
				let h_bucket: SerBucket;

				// in case an old bucket needs to be deleted
				let si_bucket_delete: BucketKey | undefined;

				// item already exists
				if(b_exists) {
					// get bucket code
					const i_bucket_exist = this.getItemBucketCode(i_item);

					// prep bucket metadata
					let si_bucket_exist: BucketKey;
					let nb_bucket_exist: number;
					let h_bucket_exist: SerBucket;

					// bucket already being modified
					const g_added = h_buckets_new[i_bucket_exist];
					if(g_added) {
						// get its metadata
						si_bucket_exist = g_added.key;
						nb_bucket_exist = g_added.size;
						h_bucket_exist = g_added.contents;
					}
					else {
						// get bucket metadata
						[si_bucket_exist, nb_bucket_exist] = this.getBucketMetadata(i_bucket_exist);

						// load bucket
						h_bucket_exist = await this._k_vault.readBucket(si_bucket_exist);
					}

					// calculate size of existing item
					const nb_item_exist = text_to_bytes(JSON.stringify(h_bucket_exist[i_item])).length;

					// new item will fit (adding 1 for comma)
					if(nb_item + 1 <= nb_item_exist || (nb_bucket_exist - nb_item_exist + nb_item + 1) <= this._nb_bucket) {
						// select bucket
						i_bucket = i_bucket_exist;

						// mark old entry for deletion
						si_bucket_delete = si_bucket_exist;

						// copy contents
						h_bucket = {...h_bucket_exist};

						// create new bucket key
						si_bucket = new_bucket_key();
					}
					// item won't fit
					else {
						// create new bucket and select as destination
						[i_bucket, si_bucket, h_bucket] = this._new_bucket(si_domain);

						// set schema association (doesn't need mut since bucket is new)
						this._a_buckets_to_schemas[i_bucket] = i_schema;
					}
				}
				// draft bucket exists and item will fit
				else if(g_bucket_draft && ((nb_item + 1 + g_bucket_draft.size) <= this._nb_bucket)) {
					i_bucket = g_bucket_draft.code;
					si_bucket = g_bucket_draft.key;
					h_bucket = g_bucket_draft.contents;
				}
				// entirely new item
				else {
					// determine which bucket to place item in
					[i_bucket, si_bucket, h_bucket, si_bucket_delete] = await this._select_bucket_for_insert(si_domain, nb_item);
				}

				// place item into bucket
				h_bucket[i_item] = w_item;

				// // ref-clone bucket metadata
				// const a_metadata = a_buckets_mut[i_bucket] = a_buckets_mut[i_bucket].slice() as SerBucketMetadata;
				const a_metadata = a_buckets_mut[i_bucket];

				// update bucket key
				a_metadata[0] = si_bucket;

				// adjust bucket size
				a_metadata[1] += nb_item;

				// save item location
				a_locations_mut[i_item] = i_bucket;

				// add to bucket deletion queue
				if(si_bucket_delete) as_buckets_delete.add(si_bucket_delete);

				// save new bucket by code
				h_buckets_new[i_bucket] = g_bucket_draft = {
					code: i_bucket,
					key: si_bucket,
					size: a_metadata[1],
					contents: h_bucket,
				};

				// apply hub effects
				{
					// encode source domain
					const sb92_domain_source = this.encodeDomain(si_domain)!;

					// each affected domain
					for(const [sb92_domain_target, g_links] of entries(g_effects.links)) {
						// nothing to do; skip
						if(!Object.keys(g_links.remove).length && !Object.keys(g_links.insert).length) continue;

						// debugger;

						// ref-clone-create dict of incoming links for the specified target domain
						const h_incoming_mut = {...h_links_mut[sb92_domain_target] || {}};

						// ref-clone-create 
						const [h_paths, h_items] = (h_incoming_mut[sb92_domain_source]?.slice() || [[], {}]) as SerLinksTuple;

						// convert to mutable entries
						let h_paths_mut = {...h_paths};

						// create pseudo-sequence from keys
						const a_paths_keys = Object.keys(h_paths_mut);

						// ref-clone-create item
						const h_refs_mut = {...h_items[i_item]};

						// each removal
						for(const [sr_path_remove, w_remove] of entries(g_links.remove)) {
							// path not found
							if(!h_paths[sr_path_remove]) {
								throw Error(`Cannot remove old item reference since field path (${sr_path_remove}) could not be encoded in ${this.decodeDomain(sb92_domain_target)}`);
							}

							// encode field path
							const i_path = a_paths_keys.indexOf(sr_path_remove) as FieldPathCode;

							// confirm value being removed
							const z_value = h_refs_mut[i_path];
							if(is_array(z_value)) {
								if(JSON.stringify(w_remove) !== JSON.stringify(z_value)) {
									throw Error(`Mismatch link removal; expected ${JSON.stringify(w_remove)} but found ${JSON.stringify(z_value)}`);
								}
							}
							else if(w_remove !== z_value) {
								throw Error(`Mismatch link removal; expected ${w_remove} but found ${z_value}`);
							}

							// delete from refs
							delete h_refs_mut[i_path];

							// decrement ref counter; no more usages
							if(0 === (h_paths_mut[sr_path_remove] -= 1)) {
								// convert object to entries to preserve order
								const a_entries = entries(h_paths_mut);

								// nullify entry
								a_entries[i_path] = ['' as SerFieldPath, 0];

								// write serialized entries back to object
								h_paths_mut = from_entries(a_entries);
							}
						}

						// each insertion
						for(const [sr_path_insert, w_insert] of entries(g_links.insert)) {
							// prep path code
							let i_path: FieldPathCode;

							// path already defined; deduce its code
							if(h_paths[sr_path_insert]) {
								i_path = a_paths_keys.indexOf(sr_path_insert) as FieldPathCode;
							}
							// add new path
							else {
								// find next free spot
								i_path = a_paths_keys.indexOf('') as FieldPathCode;

								// need to append
								if(-1 === i_path) {
									// append key
									i_path = a_paths_keys.push(sr_path_insert) - 1 as FieldPathCode;

									// insert new entry, init ref counter to 0
									h_paths_mut[sr_path_insert] = 0;
								}
							}

							// increment ref counter
							h_paths_mut[sr_path_insert] += 1;

							// insert ref
							h_refs_mut[i_path] = w_insert;
						}

						// ref-clone-set items
						const h_items_mut = {
							...h_items,
							[i_item]: h_refs_mut,
						};

						// set incoming
						h_incoming_mut[sb92_domain_source] = [h_paths_mut, h_items_mut];

						// set links
						h_links_mut[sb92_domain_target] = h_incoming_mut;
					}
				}
			}

			// first, write the new buckets
			for(const g_bucket of values(h_buckets_new)) {
				await this._k_vault.writeBucket(g_bucket.key, g_bucket.contents, this._nb_bucket, kw_content);
			}

			// add old buckets to deletion queue
			for(const si_bucket_delete of as_buckets_delete) {
				this._as_buckets_prune.add(si_bucket_delete);
			}

			// next, update the hub
			await this._write_hub(kw_content, {
				buckets: a_buckets_mut,
				locations: a_locations_mut,
				links: h_links_mut,
				prune: Array.from(new Set([...this._a_prune, ...this._as_buckets_prune])),
			});

			// schedule a bucket rotation
			this._schedule_rotation();
		});
	}

	async* itemEntries(si_domain: DomainLabel, as_seen=new Set<ItemCode>()): AsyncIterableIterator<[ItemCode, ItemIdent, SerItem]> {
		// destructure field(s)
		const {_k_vault} = this;

		// get list of bucket codes
		const [a_bucket_codes] = this._h_domains[si_domain];

		// each bucket code
		for(const i_bucket of a_bucket_codes) {
			// resolve bucket metadata
			const a_metadata = this.getBucketMetadata(i_bucket);

			// bucket no longer exists
			if(!a_metadata) {
				// redo, but filter out all items that have already been iterated
				for await(const a_item of this.itemEntries(si_domain)) {
					// item already seen; skip
					if(as_seen.has(a_item[0])) continue;

					// yield it
					yield a_item;
				}

				// exit
				return;
			}

			// destructure bucket metadata
			const [si_bucket] = a_metadata;

			// load bucket
			const h_bucket = await _k_vault.readBucket(si_bucket);

			// each item
			for(const [sn_item, a_tuple] of entries(h_bucket)) {
				// item path
				const sr_item = this._a_items[+sn_item];

				// yield pair
				yield [+sn_item as ItemCode, sr_item, a_tuple];
			}
		}
	}

	async getItemContent(i_code: ItemCode): Promise<SerItem> {
		// locate which bucket the item is stored in
		const i_bucket = this.getItemBucketCode(i_code);

		// resolve bucket key
		const [si_bucket] = this.getBucketMetadata(i_bucket);

		// load the bucket
		const h_bucket = await this._k_vault.readBucket(si_bucket);

		// return accessed item
		return h_bucket[i_code];
	}
}



