import type {F} from 'ts-toolbelt';

import type {Key} from 'ts-toolbelt/out/Any/Key';

import type {ItemDefaulter, ItemDeserializer, ItemSerializer, RuntimeItem} from './item-proto';
import type {FieldPath} from './types';

import type {JsonArray, JsonValue} from '@blake.regalia/belt';

import {__UNDEFINED} from '@blake.regalia/belt';

const F_CMP_DEFAULT = (w_a: any, w_b: any): -1 | 0 | 1 => {
	const s_a = w_a+'';
	const s_b = w_b+'';

	if(s_a < s_b) {
		return -1;
	}
	else if(s_a > s_b) {
		return 1;
	}

	return 0;
};

type ArrayMutatorMethods<w_member=any> = Pick<Array<w_member>,
	| 'shift'
	| 'pop'
	| 'unshift'
	| 'push'
	| 'reverse'
	| 'splice'
> & {
	[si_key in 'copyWithin' | 'fill' | 'sort']: F.Function<Parameters<Array<w_member>[si_key]>, ThisType<Array<w_member>>>;
};

// resolves the given property, binding `this` if a function was returned for the value
const resolve_methods = (w_prototype: object, z_property: Key, w_this: object=w_prototype) => {
	// resolve property value
	const w_value = Reflect.get(w_prototype, z_property, w_this);

	// returned a function; bind as method
	if('function' === typeof w_value) {
		return w_value.bind(w_this);
	}

	// return plain value
	return w_value;
};

export class FieldArray<
	w_member=any,
	w_backing extends JsonValue=JsonValue,
> extends Array implements Iterable<w_member>, ArrayMutatorMethods {
	static create<
		w_member=any,
	>(
		a_members: JsonValue[],
		f_serializer: ItemSerializer,
		f_deserializer: ItemDeserializer,
		f_default: ItemDefaulter,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	): FieldArray<w_member> {
		// create backing field array object
		const k_array = new FieldArray<w_member>(a_members, f_serializer, f_deserializer, f_default, a_path, g_runtime);

		// ref its prototype
		const w_prototype = Object.getPrototypeOf(k_array) as object;

		// wrap in proxy
		return new Proxy(k_array, {
			// reads
			get(k_target, z_property) {
				// not symbol
				if('symbol' !== typeof z_property) {
					// as number
					const i_pos = +z_property;

					// index
					if(Number.isInteger(i_pos)) {
						// get from backing array
						const z_value = k_array.#a_members[i_pos];

						// deserialize if defined
						return __UNDEFINED === z_value? z_value: k_array.#f_deserializer(z_value, [...a_path, i_pos], g_runtime);
					}
				}

				// property defined on prototype; resolve against class property/method
				if(Object.hasOwn(w_prototype, z_property)) {
					return resolve_methods(w_prototype, z_property, k_array);
				}

				// transform into deserialized form
				const a_read = [...k_target];

				// resolve against array prototype property value
				return resolve_methods(a_read, z_property);
			},

			// writes
			set(k_target, z_property, w_value) {
				// not symbol
				if('symbol' !== typeof z_property) {
					// as number
					const i_pos = +z_property;

					// index; set on backing array
					if(Number.isInteger(i_pos)) {
						k_array.#a_members[i_pos] = k_array.#f_serializer(w_value as w_member, [...a_path, i_pos], g_runtime);

						// success
						return true;
					}
					// has setter
					else if(Object.getOwnPropertyDescriptor(w_prototype, z_property)?.set) {
						// forward
						return Reflect.set(w_prototype, z_property, w_value, k_array);
					}
				}

				// set on instance
				k_target[z_property as Exclude<keyof typeof k_target, symbol>] = w_value;

				// success
				return true;
			},

			// deletes
			deleteProperty(k_target, z_property) {
				// not symbol
				if('symbol' !== typeof z_property) {
					// as number
					const i_pos = +z_property;

					// index; delete on backing array
					if(Number.isInteger(i_pos)) {
						return Reflect.deleteProperty(k_array.#a_members, i_pos);
					}
				}

				// forward
				return Reflect.deleteProperty(k_array, z_property);
			},
		}) as unknown as FieldArray<w_member>;
	}

	static serialize(k_array: FieldArray): JsonArray {
		return k_array.#a_members;
	}

	[Symbol.species] = Array;

	readonly #a_members: w_backing[];
	readonly #f_serializer: ItemSerializer<w_backing, w_member>;
	readonly #f_deserializer: ItemDeserializer<w_backing, w_member>;
	readonly #f_default: ItemDefaulter<w_backing>;
	readonly #a_path: FieldPath;
	readonly #g_runtime: RuntimeItem;

	protected constructor(
		a_members: w_backing[],
		f_serializer: ItemSerializer<w_backing, w_member>,
		f_deserializer: ItemDeserializer<w_backing, w_member>,
		f_default: ItemDefaulter<w_backing>,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	) {
		super(0);

		this.#a_members = a_members;
		this.#f_serializer = f_serializer;
		this.#f_deserializer = f_deserializer;
		this.#f_default = f_default;
		this.#a_path = a_path;
		this.#g_runtime = g_runtime;
	}

	/**
	 * Basis iterator for all inherited read methods
	 */
	override * [Symbol.iterator](): Generator<any, undefined, undefined> {
		const _a_path = this.#a_path;
		const _g_runtime = this.#g_runtime;

		yield* this.#a_members.map((w_value, i_member) => this.#f_deserializer(w_value, [..._a_path, i_member], _g_runtime));
	}

	/**
	 * Override so it does not get length property from function prototype
	 * @returns 
	 */
	override get length(): number {
		return this.#a_members.length;
	}

	/**
	 * Also a mutator
	 * @returns 
	 */
	override set length(nl_value: number) {
		const _a_members = this.#a_members;
		const _f_default = this.#f_default;
		const _a_path = this.#a_path;
		const _g_runtime = this.#g_runtime;

		// expand with default values
		for(let i_each=_a_members.length; i_each<nl_value; i_each++) {
			_a_members[i_each] = _f_default([..._a_path, i_each], _g_runtime);
		}

		// adjust length
		_a_members.length = nl_value;
	}


	/*
	All mutator methods...
	*/

	override shift(): w_member | undefined {
		return this.length? this.#f_deserializer(this.#a_members.shift()!, [...this.#a_path, 0], this.#g_runtime): __UNDEFINED;
	}

	override pop(): w_member | undefined {
		return this.length? this.#f_deserializer(this.#a_members.pop()!, [...this.#a_path, this.length-1], this.#g_runtime): __UNDEFINED;
	}

	override unshift(...a_items: w_member[]): number {
		const a_path = [...this.#a_path, -1];
		const _g_runtime = this.#g_runtime;

		return this.#a_members.unshift(...a_items.map(w_value => this.#f_serializer(w_value, a_path, _g_runtime)));
	}

	override push(...a_items: w_member[]): number {
		const _a_path = this.#a_path;
		const _g_runtime = this.#g_runtime;
		const nl_this = this.length;

		return this.#a_members.push(...a_items.map((w_value, i_value) => this.#f_serializer(w_value, [..._a_path, nl_this+i_value], _g_runtime)));
	}

	override reverse(): w_member[] {
		const _a_path = this.#a_path;
		const _g_runtime = this.#g_runtime;

		return this.#a_members.reverse().map((w_value, i_member) => this.#f_deserializer(w_value, [..._a_path, i_member], _g_runtime));
	}

	override sort(f_cmp?: ((w_a: w_member, w_b: w_member) => number) | undefined): this {
		const a_path = [...this.#a_path, -1];
		const _g_runtime = this.#g_runtime;

		const f_deserializer = this.#f_deserializer;

		this.#a_members.sort((w_a, w_b) => (f_cmp ?? F_CMP_DEFAULT)(f_deserializer(w_a, a_path, _g_runtime), f_deserializer(w_b, a_path, _g_runtime)));

		return this;
	}

	override splice(i_start: number, nl_del?: number | undefined): w_member[];
	override splice(i_start: number, nl_del: number, ...a_items: w_member[]): w_member[];
	override splice(i_start: unknown, nl_del?: unknown, ...a_rest: unknown[]): w_member[] {
		const a_path = [...this.#a_path, -1];
		const _g_runtime = this.#g_runtime;

		return this.#a_members.splice(
			i_start as number,
			nl_del as number,
			...(a_rest as w_member[]).map(w_value => this.#f_serializer(w_value, a_path, _g_runtime))
		).map((w_value, i_value) => this.#f_deserializer(w_value, a_path, _g_runtime));
	}

	override copyWithin(i_target: number, i_start: number, i_end?: number | undefined): this {
		this.#a_members.copyWithin(i_target, i_start, i_end);

		return this;
	}

	override fill(w_value: w_member, i_start: number=0, i_end: number=this.length): this {
		const _a_members = this.#a_members;
		const _a_path = this.#a_path;
		const _g_runtime = this.#g_runtime;

		const f_serializer = this.#f_serializer;

		if(i_start < 0) i_start += this.length;
		if(i_end < 0) i_end += this.length;

		for(let i_each=i_start; i_each<i_end; i_each++) {
			_a_members[i_each] = f_serializer(w_value, [..._a_path, i_each], _g_runtime);
		}

		return this;
	}

	// optimization
	override slice(i_start?: number | undefined, i_end?: number | undefined): w_member[] {
		const a_path = [...this.#a_path, -1];
		const _g_runtime = this.#g_runtime;

		return this.#a_members.slice(i_start, i_end).map(w_value => this.#f_deserializer(w_value, a_path, _g_runtime));
	}
}

