import type {Dict, JsonValue} from '@blake.regalia/belt';

export const FieldDict = {
	create<w_member, w_backing extends JsonValue>(
		h_members: Dict<w_backing>,
		f_serializer: (w_value: any) => w_backing,
		f_deserializer: (w_value: w_backing) => w_member,
		f_default?: () => w_backing  // eslint-disable-line @typescript-eslint/no-unused-vars
	): Dict<w_member> {
		// wrap in proxy
		return new Proxy({}, {
			// reads
			get(k_target, z_property) {
				// property defined on dict; deserialize
				if(Object.hasOwn(h_members, z_property)) {
					return f_deserializer(h_members[z_property as string]);
				}

				// forward to object
				return Reflect.get(h_members, z_property, h_members);
			},

			// writes
			set(k_target, z_property, w_value, receiver) {
				// anything other than string prohibited
				if('string' !== typeof z_property) {
					throw TypeError(`Not allowed to use ${typeof z_property} as property key on dict datatype`);
				}

				// set
				h_members[z_property] = f_serializer(w_value as w_member);

				// success
				return true;
			},

			// delete
			deleteProperty(k_target, z_property) {
				return Reflect.deleteProperty(h_members, z_property);
			},

			// get own
			getOwnPropertyDescriptor(k_target, z_property) {
				// proeprty defined on dict
				if(Object.hasOwn(h_members, z_property)) {
					// deserialize before returning descriptor
					return Reflect.getOwnPropertyDescriptor({
						[z_property]: f_deserializer(h_members[z_property as string]),
					}, z_property);
				}

				// forward
				return Reflect.getOwnPropertyDescriptor(h_members, z_property);
			},
		});
	},
};
