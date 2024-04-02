import type {GenericItemController} from './controller';
import type {ItemDefaulter, ItemDeserializer, ItemSerializer, RuntimeItem} from './item-proto';

import type {Refish} from './item-ref';
import type {FieldPath, ItemCode} from './types';

import type {Dict, JsonValue} from '@blake.regalia/belt';

import {__UNDEFINED, assign, entries, from_entries, keys} from '@blake.regalia/belt';

import {ItemRef, refish_to_code} from './item-ref';

type BackingDict = Record<ItemCode, JsonValue>;

export class FieldMapRef<
	g_item extends Dict<any>=Dict<any>,
	w_member=any,
	w_backing extends JsonValue=JsonValue,
> extends Map<Refish<g_item>, w_member> {
	static create(
		k_controller: GenericItemController,
		h_backing: BackingDict,
		f_serializer: ItemSerializer,
		f_deserializer: ItemDeserializer,
		f_default: ItemDefaulter,  // eslint-disable-line @typescript-eslint/no-unused-vars
		a_path: FieldPath,
		g_runtime: RuntimeItem
	): FieldMapRef {
		return new FieldMapRef(k_controller, h_backing, f_serializer, f_deserializer, f_default, a_path, g_runtime);
	}

	static serialize(k_ref: FieldMapRef): BackingDict {
		return k_ref.#h_backing;
	}

	readonly #k_controller: GenericItemController<g_item>;
	readonly #h_backing: Record<ItemCode, w_backing>;
	readonly #f_serializer: ItemSerializer<w_backing, w_member>;
	readonly #f_deserializer: ItemDeserializer<w_backing, w_member>;
	readonly #f_default: ItemDefaulter<w_backing>;
	readonly #a_path: FieldPath;
	readonly #g_runtime: RuntimeItem;

	constructor(
		k_controller: GenericItemController<g_item>,
		h_backing: Record<ItemCode, w_backing>,
		f_serializer: ItemSerializer<w_backing, w_member>,
		f_deserializer: ItemDeserializer<w_backing, w_member>,
		f_default: ItemDefaulter<w_backing>,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	) {
		// create (empty) map
		super();

		// save controller
		this.#k_controller = k_controller;

		// save backing dict
		this.#h_backing = h_backing;

		// save serdefs
		this.#f_serializer = f_serializer;
		this.#f_deserializer = f_deserializer;
		this.#f_default = f_default;

		// complementaries
		this.#a_path = a_path;
		this.#g_runtime = g_runtime;
	}

	override get size(): number {
		return Object.keys(this.#h_backing).length;
	}

	override get(z_key: Refish<g_item> | null): w_member | undefined {
		// falsy
		if(!z_key) return __UNDEFINED;

		// get item code
		const i_code = refish_to_code(z_key);

		// no item
		if(!i_code) return __UNDEFINED;

		// lookup and deserialize
		return this.#f_deserializer(this.#h_backing[i_code], [...this.#a_path, i_code], this.#g_runtime);
	}

	override set(z_key: Refish<g_item>, w_value: w_member): this {
		// get item code
		const i_code = refish_to_code(z_key);

		// no item
		if(!i_code) throw TypeError('No item exists for map-ref key');

		// set
		this.#h_backing[i_code] = this.#f_serializer(w_value, [...this.#a_path, i_code], this.#g_runtime);

		// chainable
		return this;
	}

	/**
	 * Inserts the given key-value pair into the specified position in the map
	 * @param z_key 
	 * @param w_value 
	 * @param i_pos - if negative value is given, `i_pos + map.length` is used
	 * @returns 
	 */
	insert(z_key: Refish<g_item>, w_value: w_member, i_pos: number): this {
		// get item code
		const i_code = refish_to_code(z_key);

		// no item
		if(!i_code) throw TypeError('No item exists for map-ref key');

		// ref backing
		const _h_backing = this.#h_backing;

		// delete if exists
		delete _h_backing[i_code];

		// rebuild map
		const a_entries_post: [`${number}`, w_backing][] = [];

		// count position while iterating
		let i_index = 0;

		// negative position; relative to end of list
		if(i_pos < 0) i_pos += keys(_h_backing).length;

		// each entry
		for(const a_entry of entries(_h_backing)) {
			// reached target position
			if(i_index++ >= i_pos) {
				// start deleting everything after
				delete _h_backing[+a_entry[0] as ItemCode];

				// add to entry list
				a_entries_post.push(a_entry);
			}
		}

		// insert new entry
		_h_backing[i_code] = this.#f_serializer(w_value, [...this.#a_path, i_code], this.#g_runtime);

		// re-add deleted entries
		assign(_h_backing, from_entries(a_entries_post));

		// chainable
		return this;
	}

	setMany(z_values: Map<Refish<g_item>, w_member> | [Refish<g_item>, w_member][]): this {
		// add each entry
		for(const [k_ref, w_value] of z_values instanceof Map? z_values.entries(): z_values) {
			this.set(k_ref, w_value);
		}

		// chainable
		return this;
	}

	replace(z_values: Map<Refish<g_item>, w_member> | [Refish<g_item>, w_member][]): this {
		this.clear();
		return this.setMany(z_values);
	}

	override clear(): void {
		const _h_members = this.#h_backing;

		for(const si_key in _h_members) {
			delete _h_members[si_key as unknown as keyof typeof _h_members];
		}
	}

	override has(z_key: Refish<g_item>): boolean {
		// get item code
		const i_code = refish_to_code(z_key);

		// no item
		if(!i_code) return false;

		// item exists
		return i_code in this.#h_backing;
	}

	override delete(z_key: Refish<g_item>): boolean {
		// not present
		if(!this.has(z_key)) return false;

		// delete entry
		delete this.#h_backing[refish_to_code(z_key)!];

		// something was deleted
		return true;
	}

	override* keys(): IterableIterator<Refish<g_item>> {
		const _k_controller = this.#k_controller;

		for(const si_code of keys(this.#h_backing)) {
			yield new ItemRef(_k_controller, +si_code as ItemCode);
		}
	}

	override* values(): IterableIterator<w_member> {
		const _f_deserializer = this.#f_deserializer;
		const _g_runtime = this.#g_runtime;
		const _a_path = this.#a_path;

		for(const [si_code, w_value] of entries(this.#h_backing)) {
			yield _f_deserializer(w_value, [..._a_path, +si_code as ItemCode], _g_runtime);
		}
	}

	override* entries(): IterableIterator<[ItemRef<g_item>, w_member]> {
		const _k_controller = this.#k_controller;
		const _f_deserializer = this.#f_deserializer;
		const _g_runtime = this.#g_runtime;
		const _a_path = this.#a_path;

		for(const [si_code, w_value] of entries(this.#h_backing)) {
			yield [new ItemRef(_k_controller, +si_code as ItemCode), _f_deserializer(w_value, [..._a_path, +si_code as ItemCode], _g_runtime)];
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	override forEach(f_each: (w: w_member, g_ref: ItemRef<g_item>, k_map: Map<ItemRef<g_item>, w_member>) => void, z_this?: any): void {
		for(const [g_ref, z_item] of this.entries()) {
			f_each.call(z_this, z_item, g_ref, this as Map<ItemRef<g_item>, w_member>);
		}
	}
}
