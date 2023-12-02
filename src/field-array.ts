import type {F} from 'ts-toolbelt';

import type {JsonArray, JsonValue} from '@blake.regalia/belt';

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

type Privates<w_member=any> = {
	readonly _a_members: JsonArray;
	readonly _f_serializer: (w_value: w_member) => JsonValue;
	readonly _f_deserializer: (w_value: JsonValue) => w_member;
	readonly _f_default: () => JsonValue;
};

const hm_privates = new WeakMap<FieldArray, Privates>();

export class FieldArray<
	w_member=any,
> extends Array implements Iterable<w_member>, ArrayMutatorMethods {
	static create<
		w_member=any,
	>(
		a_members: JsonArray,
		f_serializer: (w_value: any) => JsonValue,
		f_deserializer: (w_value: JsonValue) => any,
		f_default: () => JsonValue
	): FieldArray<w_member> {
		// create backing field array object
		const k_array = new FieldArray<w_member>(a_members, f_serializer, f_deserializer, f_default);

		// ref its private fields' struct
		const g_privates = hm_privates.get(k_array)!;

		// ref its prototype
		const w_prototype = Object.getPrototypeOf(k_array) as object;

		// wrap in proxy
		const k_proxy = new Proxy(k_array, {
			// reads
			get(k_target, z_property, w_receiver) {
				// override length
				if('length' === z_property) {
					return g_privates._a_members.length;
				}
				// give precedence to instance
				else if(Reflect.has(k_target, z_property)) {
					return k_array[z_property as keyof typeof k_target];
					// return Reflect.get(k_array, z_property, k_array);
				}
				// give precedence to class prototype
				else if(Reflect.has(w_prototype, z_property)) {
					return Reflect.get(w_prototype, z_property, w_receiver);
				}

				// transform int deserialized form
				const a_read = [...k_target];

				// apply array prototype property
				return Reflect.get(a_read, z_property as keyof Array<any>, a_read);
			},

			// writes
			set(k_target, z_property, w_value, w_receiver) {
				// not symbol
				if('symbol' !== typeof z_property) {
					// as number
					const i_pos = +z_property;

					// index; set on backing array
					if(Number.isInteger(i_pos)) {
						// const {a_members, f_serializer} = hm_privates.get(k_array)!;

						a_members[i_pos] = f_serializer(w_value as w_member);

						// success
						return true;
					}
				}

				// set on instance
				k_target[z_property as Exclude<keyof typeof k_target, symbol>] = w_value;

				// success
				return true;
			},
		}) as unknown as FieldArray<w_member>;

		hm_privates.set(k_proxy, g_privates);

		return k_proxy;
	}

	[Symbol.species] = Array;

	// readonly #a_members: JsonArray;
	// readonly #f_serializer: (w_value: w_member) => JsonValue;
	// readonly #f_deserializer: (w_value: JsonValue) => w_member;
	// readonly #f_default: () => JsonValue;

	protected constructor(
		_a_members: JsonArray,
		_f_serializer: (w_value: w_member) => JsonValue,
		_f_deserializer: (w_value: JsonValue) => w_member,
		_f_default: () => JsonValue
	) {
		super(0);

		// this.#a_members = a_members;
		// this.#f_serializer = f_serializer;
		// this.#f_deserializer = f_deserializer;
		// this.#f_default = f_default;

		hm_privates.set(this, {
			_a_members,
			_f_serializer,
			_f_deserializer,
			_f_default,
		});
	}

	/**
	 * Basis iterator for all inherited read methods
	 */
	* [Symbol.iterator](): Generator<any, void, undefined> {
		// yield* this.#a_members.map(this.#f_deserializer);
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;

		yield* _a_members.map(_f_deserializer);
	}

	/**
	 * Override so it does not get length property from function prototype
	 * @returns 
	 */
	override get length(): number {
		const {_a_members} = hm_privates.get(this)!;
		return _a_members.length;
	}

	/**
	 * Also a mutator
	 * @returns 
	 */
	override set length(nl_value: number) {
		const {_a_members, _f_default} = hm_privates.get(this)!;
		// const _a_members = this.#a_members;
		// const _f_default = this.#f_default;

		// expand with default values
		for(let i_each=_a_members.length; i_each<nl_value; i_each++) {
			_a_members[i_each] = _f_default();
		}

		// adjust length
		_a_members.length = nl_value;
	}


	/*
	All mutator methods...
	*/

	override shift(): w_member | undefined {
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;
		return _f_deserializer(_a_members.shift());
		// return this.#f_deserializer(this.#a_members.shift());
	}

	override pop(): w_member | undefined {
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;
		return _f_deserializer(_a_members.pop());
		// return this.#f_deserializer(this.#a_members.pop());
	}

	override unshift(...a_items: w_member[]): number {
		const {_a_members, _f_serializer} = hm_privates.get(this)!;
		return _a_members.unshift(...a_items.map(_f_serializer));
		// return this.#a_members.unshift(...a_items.map(this.#f_serializer));
	}

	override push(...a_items: w_member[]): number {
		const {_a_members, _f_serializer} = hm_privates.get(this)!;
		// return this.#a_members.push(...a_items.map(this.#f_serializer));
		return _a_members.push(...a_items.map(_f_serializer));
	}

	override reverse(): w_member[] {
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;
		return _a_members.reverse().map(_f_deserializer);
		// return this.#a_members.reverse().map(this.#f_deserializer);
	}

	override sort(f_cmp?: ((w_a: w_member, w_b: w_member) => number) | undefined): this {
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;
		// const f_deserializer = this.#f_deserializer;

		_a_members.sort((w_a, w_b) => (f_cmp ?? F_CMP_DEFAULT)(_f_deserializer(w_a) as w_member, _f_deserializer(w_b) as w_member));
		// this.#a_members.sort((w_a, w_b) => (f_cmp ?? F_CMP_DEFAULT)(_f_deserializer(w_a), _f_deserializer(w_b)));

		return this;
	}

	override splice(i_start: number, nl_del?: number | undefined): w_member[];
	override splice(i_start: number, nl_del: number, ...a_items: w_member[]): w_member[];
	override splice(i_start: unknown, nl_del?: unknown, ...a_rest: unknown[]): w_member[] {
		const {_a_members, _f_serializer, _f_deserializer} = hm_privates.get(this)!;

		return _a_members.splice(
			i_start as number,
			nl_del as number,
			...(a_rest as w_member[]).map(_f_serializer)
		).map(_f_deserializer);

		// return this.#a_members.splice(
		// 	i_start as number,
		// 	nl_del as number,
		// 	...(a_rest as w_member[]).map(this.#f_serializer)
		// ).map(this.#f_deserializer);
	}

	override copyWithin(i_target: number, i_start: number, i_end?: number | undefined): this {
		const {_a_members} = hm_privates.get(this)!;

		_a_members.copyWithin(i_target, i_start, i_end);
		// this.#a_members.copyWithin(i_target, i_start, i_end);

		return this;
	}

	override fill(w_value: w_member, i_start?: number | undefined, i_end?: number | undefined): this {
		const {_a_members, _f_serializer} = hm_privates.get(this)!;

		_a_members.fill(_f_serializer(w_value), i_start, i_end);
		// this.#a_members.fill(this.#f_serializer(w_value), i_start, i_end);

		return this;
	}

	// optimization
	override slice(i_start?: number | undefined, i_end?: number | undefined): w_member[] {
		const {_a_members, _f_deserializer} = hm_privates.get(this)!;

		return _a_members.slice(i_start, i_end).map(_f_deserializer);
		// return this.#a_members.slice(i_start, i_end).map(this.#f_deserializer);
	}
}

