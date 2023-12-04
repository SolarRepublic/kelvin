import type {JsonValue} from '@blake.regalia/belt';

export class FieldSet<w_member, w_backing extends JsonValue> extends Set<w_member> {
	static create(
		a_members: JsonValue[],
		f_serializer: (w_value: any) => JsonValue,
		f_deserializer: (w_value: JsonValue) => any,
		f_default?: () => JsonValue  // eslint-disable-line @typescript-eslint/no-unused-vars
	): FieldSet<any, JsonValue> {
		// create backing field array object
		return new FieldSet(a_members, f_serializer, f_deserializer);
	}

	readonly #a_members: w_backing[];
	readonly #f_serializer: (w_value: w_member) => w_backing;
	readonly #f_deserializer: (w_value: w_backing) => w_member;

	constructor(
		a_members: w_backing[],
		f_serializer: (w_value: w_member) => w_backing,
		f_deserializer: (w_value: w_backing) => w_member
	) {
		// create set
		super(a_members.map(f_deserializer));

		// save backing array
		this.#a_members = a_members;

		// save serdefs
		this.#f_serializer = f_serializer;
		this.#f_deserializer = f_deserializer;
	}

	override has(w_value: w_member): boolean {
		// does not appear to be in set
		if(!super.has(w_value)) {
			// serialize
			const w_ser = this.#f_serializer(w_value);

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
			this.#a_members.push(this.#f_serializer(w_value));
		}

		// interface
		return this;
	}

	override delete(w_value: w_member): boolean {
		// ref private
		const a_members = this.#a_members;

		// serialize
		const w_ser = this.#f_serializer(w_value);

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
					super.add(this.#f_deserializer(w_each));
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
