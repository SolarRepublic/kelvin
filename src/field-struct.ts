import type {RuntimeItem, SerdefaultsTuple} from './item-proto';
import type {Datatype} from './schema-types';
import type {FieldLabel, FieldPath} from './types';
import type {Dict, JsonArray} from '@blake.regalia/belt';

export const FieldStruct = {
	create<h_shape extends Dict<Datatype>>(
		h_serdefs: Record<FieldLabel, SerdefaultsTuple>,
		a_members: JsonArray,
		a_path: FieldPath,
		g_runtime: RuntimeItem
	): h_shape {
		// cache keys
		const a_keys = Object.keys(h_serdefs);

		// wrap in proxy
		return new Proxy({} as h_shape, {
			// reads
			get(k_target, z_property) {
				// property defined on struct; deserialize
				const i_field = a_keys.indexOf(z_property as string);
				if(-1 !== i_field) {
					// destructure deserializer
					const [, f_deser] = h_serdefs[z_property as FieldLabel];

					// deserializer corresponding member
					return f_deser(a_members[i_field], [...a_path, z_property] as FieldPath, g_runtime);
				}

				// forward to object
				return Reflect.get(h_serdefs, z_property, h_serdefs);
			},

			// writes
			set(k_target, z_property, w_value) {
				// anything other than string prohibited
				if('string' !== typeof z_property) {
					throw TypeError(`Not allowed to use ${typeof z_property} as property key on struct datatype`);
				}

				// find field index
				const i_field = a_keys.indexOf(z_property);

				// destructure serializer
				const [f_ser] = h_serdefs[z_property as FieldLabel];

				// set
				a_members[i_field] = f_ser(w_value, [...a_path, z_property] as FieldPath, g_runtime);

				// success
				return true;
			},

			// delete
			deleteProperty(k_target, z_property) {
				// property defined on struct
				const i_field = a_keys.indexOf(z_property as string);
				if(-1 !== i_field) {
					// destructure defaulter
					const [, , f_default] = h_serdefs[z_property as FieldLabel];

					// reset
					a_members[i_field] = f_default();

					// property never gets deleted
					return false;
				}

				// forward to object
				return Reflect.deleteProperty(h_serdefs, z_property);
			},

			// get own keys
			ownKeys(k_target) {
				// forward to object
				return Reflect.ownKeys(h_serdefs);
			},

			// get own
			getOwnPropertyDescriptor(k_target, z_property) {
				// property defined on struct
				const i_field = a_keys.indexOf(z_property as string);
				if(-1 !== i_field) {
					// destructure deserializer
					const [, f_deser] = h_serdefs[z_property as FieldLabel];

					// deserialize before returning descriptor
					return Reflect.getOwnPropertyDescriptor({
						[z_property]: f_deser(a_members[i_field], [...a_path, z_property] as FieldPath, g_runtime),
					}, z_property);
				}

				// forward
				return Reflect.getOwnPropertyDescriptor(h_serdefs, z_property);
			},
		});
	},
};
