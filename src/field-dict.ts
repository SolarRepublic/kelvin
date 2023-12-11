import type {ItemDefaulter, ItemDeserializer, ItemSerializer, RuntimeItem} from './item-proto';
import type {FieldPath} from './types';
import type {Dict, JsonValue} from '@blake.regalia/belt';

// associates each instance to its backing dict
const hm_instances = new WeakMap<{}, Dict<JsonValue>>();

export const FieldDict = {
	create<w_member, w_backing extends JsonValue>(
		h_members: Dict<w_backing>,
		f_serializer: ItemSerializer<w_backing, w_member>,
		f_deserializer: ItemDeserializer<w_backing, w_member>,
		f_default: ItemDefaulter<w_backing>,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	): Dict<w_member> {
		// wrap in proxy
		const k_proxy = new Proxy({}, {
			// reads
			get(k_target, z_property) {
				// property defined on dict; deserialize
				if(Object.hasOwn(h_members, z_property)) {
					return f_deserializer(h_members[z_property as string], [...a_path, z_property as string], g_runtime);
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
				h_members[z_property] = f_serializer(w_value as w_member, [...a_path, z_property], g_runtime);

				// success
				return true;
			},

			// delete
			deleteProperty(k_target, z_property) {
				return Reflect.deleteProperty(h_members, z_property);
			},

			// own keys
			ownKeys() {
				// forward to object
				return Reflect.ownKeys(h_members);
			},

			// get own
			getOwnPropertyDescriptor(k_target, z_property) {
				// proeprty defined on dict
				if(Object.hasOwn(h_members, z_property)) {
					// deserialize before returning descriptor
					return Reflect.getOwnPropertyDescriptor({
						[z_property]: f_deserializer(h_members[z_property as string], [...a_path, z_property as string], g_runtime),
					}, z_property);
				}

				// forward to object
				return Reflect.getOwnPropertyDescriptor(h_members, z_property);
			},
		});

		// save to weak map
		hm_instances.set(k_proxy, h_members);

		// return proxy
		return k_proxy;
	},

	hasInstance(z_dict: {}): boolean {
		return hm_instances.has(z_dict);
	},

	serialize(k_dict: {}): Dict<JsonValue> {
		return hm_instances.get(k_dict)!;
	},
};
