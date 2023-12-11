import type {ItemDefaulter, ItemDeserializer, ItemSerializer, RuntimeItem} from './item-proto';
import type {FieldPath} from './types';
import type {JsonValue} from '@blake.regalia/belt';

export class FieldSet<
	w_member=any,
	w_backing extends JsonValue=JsonValue,
> extends Set<w_member> {
	static create<w_member=any>(
		a_members: JsonValue[],
		f_serializer: ItemSerializer,
		f_deserializer: ItemDeserializer,
		f_default: ItemDefaulter,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	): FieldSet<w_member, JsonValue> {
		return new FieldSet(a_members, f_serializer, f_deserializer, f_default, a_path, g_runtime);
	}

	static serialize(k_set: FieldSet): JsonValue[] {
		return k_set.#a_members;
	}

	readonly #a_members: w_backing[];
	readonly #f_serializer: ItemSerializer<w_backing, w_member>;
	readonly #f_deserializer: ItemDeserializer<w_backing, w_member>;
	readonly #f_default: ItemDefaulter<w_backing>;
	readonly #a_path: FieldPath;
	readonly #g_runtime: RuntimeItem;

	constructor(
		a_members: w_backing[],
		f_serializer: ItemSerializer<w_backing, w_member>,
		f_deserializer: ItemDeserializer<w_backing, w_member>,
		f_default: ItemDefaulter<w_backing>,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	) {
		// create set
		super(a_members.map((w_value, i_member) => f_deserializer(w_value, [...a_path, '*'], g_runtime)));

		// save backing array
		this.#a_members = a_members;

		// save serdefs
		this.#f_serializer = f_serializer;
		this.#f_deserializer = f_deserializer;
		this.#f_default = f_default;
		this.#a_path = a_path;
		this.#g_runtime = g_runtime;
	}

	override has(w_value: w_member): boolean {
		// does not appear to be in set
		if(!super.has(w_value)) {
			// serialize
			const w_ser = this.#f_serializer(w_value, [...this.#a_path, '*'], this.#g_runtime);

			// serialization differs, check serialized variant
			if(w_ser !== w_value as unknown as w_backing) return this.#a_members.includes(w_ser);
		}

		// not in set
		return false;
	}

	override add(w_value: w_member): this {
		// not in set
		if(!this.has(w_value)) {
			// insert
			super.add(w_value);

			// update backing array
			this.#a_members.push(this.#f_serializer(w_value, [...this.#a_path, '*'], this.#g_runtime));
		}

		// interface
		return this;
	}

	override delete(w_value: w_member): boolean {
		// ref private
		const a_members = this.#a_members;

		// serialize
		const w_ser = this.#f_serializer(w_value, [...this.#a_path, '*'], this.#g_runtime);

		// locate in backing array
		const i_found = a_members.indexOf(w_ser);

		// is actually in set
		if(-1 !== i_found) {
			// remove it
			a_members.splice(i_found, 1);

			// found in super; delet eit
			if(super.has(w_value)) {
				super.delete(w_value);
			}
			// serializations differ, need to rest
			else {
				// clear self
				super.clear();

				// add items
				for(const w_each of a_members) {
					super.add(this.#f_deserializer(w_each, [...this.#a_path, '*'], this.#g_runtime));
				}
			}

			// exit
			return true;
		}

		// not in set
		return false;
	}

	override clear(): void {
		// clear
		super.clear();

		// update backing array
		this.#a_members.length = 0;
	}
}
