import type {SerSchema, SerField} from './types';

import {is_dict_es, type Dict, type JsonArray, type JsonObject, type JsonValue} from '@blake.regalia/belt';

import {SchemaError, VaultCorruptedError, Bug, TypeFieldNotWritableError} from './errors';


export const $_TUPLE = Symbol('item-shape-tuple');
export const $_PARTS = Symbol('item-shape-parts');


type PropertyDescriptorMap = Dict<PropertyDescriptor & ThisType<any>>;

/**
 * 
 * @param a_fields 
 * @param s_err_context 
 * @param a_part_keys 
 * @param h_props - property decsriptor map
 * @returns 
 */
export function create_shape_struct(
	a_fields: SerField[],
	s_err_context: string,
	a_part_keys: string[]=[],
	h_props: PropertyDescriptorMap={}
): PropertyDescriptorMap {
	// each field
	for(let i_field=0; i_field<a_fields.length; i_field++) {
		const z_field = a_fields[i_field];

		// key
		let si_key = '';

		// prep prop descriptor
		let gc_prop: PropertyDescriptor & ThisType<any>;

		// field name
		if('string' === z_field) {
			si_key = z_field;

			// create descriptor
			gc_prop = {
				// access item at corresponding index
				get() {
					return this[$_TUPLE][i_field];
				},

				// overwrite item at corresponding index
				set(w_set: JsonValue) {
					this[$_TUPLE][i_field] = w_set;
				},
			};
		}
		// struct
		else if(Array.isArray(z_field)) {
			// first item is key
			si_key = z_field[0];

			// rest are field members
			const a_members = z_field.slice(1);

			// recurse
			const h_props_sub = create_shape_struct(a_members, s_err_context+`["${si_key}"]`);

			// create descriptor
			gc_prop = {
				// struct is being accessed
				get() {
					// access value
					const z_value = this[$_TUPLE][i_field];

					// assert value is tuple
					if(!Array.isArray(z_value)) {
						throw new SchemaError(`struct values are not stored in tuple at ${si_key} ${s_err_context}`);
					}

					// apply sub property descriptor map
					return Object.defineProperties({
						[$_TUPLE]: z_value,
					}, h_props_sub);
				},

				// struct is being overwritten
				set(w_set: JsonValue) {
					// TODO: call initializer

					// init subtuple
					const a_subtuple: JsonArray = []; // init();

					// create template
					const g_template = Object.defineProperties({
						[$_TUPLE]: a_subtuple,
					}, h_props_sub);

					// invoke setters
					Object.assign(g_template, w_set);

					// save to tuple
					this[$_TUPLE][i_field] = a_subtuple;
				},
			};
		}
		// tagged type
		else if(is_dict_es(z_field)) {
			// switch on code
			if(z_field.s) {
				// destructure
				const [si_field, i_switch, z_options] = z_field.s;

				// set key
				si_key = si_field;

				// localize error context
				const s_err_context_tag = `at ${si_key} ${s_err_context}`;

				// invalid switch index
				if(i_switch >= a_part_keys.length || i_switch < 0) {
					throw new SchemaError(`switch index outside bounds of preceding scoped key range (${i_switch} / ${a_part_keys.length}) ${s_err_context_tag}`);
				}

				// ref switch field
				const si_switch = a_part_keys[i_switch];

				// options are in sequence
				if(Array.isArray(z_options)) {
					gc_prop = {
						get() {
							// expect uint
							const i_option = this[si_switch] as number;
							if(!Number.isInteger(i_option) || i_option < 0) {
								throw new SchemaError(`switch value is not an unsigned int "${i_option}" (${typeof i_option}) ${s_err_context_tag}`);
							}
							// not in range, but allow undefined
							else if(i_option > z_options.length) {
								console.warn(new SchemaError(`switch value "${i_option}" is outside bounds of option space (length: ${z_options.length}) ${s_err_context_tag}`));
							}

							// select option
							const w_option_value = z_options[i_option];

							// ref 
							this[$_TUPLE][i_field];
						},
					};
				}
				// options are in map
				else if(is_dict_es(z_options)) {
					// expect string, number, or boolean
					if(!['string', 'number', 'boolean'].includes(typeof w_switch_value)) {
						throw new VaultCorruptedError(`switch value is not a primitive (${typeof w_switch_value}) ${s_err_context_tag}`);
					}

					// stringify
					const si_option = w_switch_value+'';

					// not in map
					if(!(si_option in z_options)) {
						throw new SchemaError(`switch option map has no key for "${si_option}" ${s_err_context}`);
					}

					// select option
					w_option_value = z_options[si_option];
				}
				// something else
				else {
					throw new VaultCorruptedError(`switch options are neither a sequence nor a map: ${typeof z_options} ${s_err_context_tag}`);
				}

				// option value is a struct
				if(Array.isArray(w_option_value)) {
					// assert content value is a tuple
					if(!Array.isArray(z_value)) {
						throw new VaultCorruptedError(`switched content value is not a tuple ${s_err_context_tag}`);
					}

					// recurse
					w_value = restruct_struct(w_option_value as SerField[], z_value, s_err_context+`.s(${w_switch_value}).["${si_key}"]`);
				}
			}
			// not handled
			else {
				throw new Bug(`unhandled shape tag(s) ${Object.keys(z_field).map(s => `"${s}"`).join(' | ')}`);
			}
		}

		// set property descriptor
		h_props[si_key] = gc_prop;

		// add to keys
		a_part_keys.push(si_key);
	}

	// return property descriptor map
	return h_props;
}

export function create_shape_item(
	a_shape: SerSchema,
	s_err_context: string
): PropertyDescriptorMap {
	// destructure shape tuple
	const [n_version, a_part_keys, a_fields] = a_shape;

	// prep property descriptor map
	const h_props: PropertyDescriptorMap = {};

	// each part key
	for(let i_key=0; i_key<a_part_keys.length; i_key++) {
		const si_key = a_part_keys[i_key];

		// set descriptor
		h_props[si_key] = {
			get() {
				return this[$_PARTS][i_key];
			},

			set() {
				throw new TypeFieldNotWritableError(si_key);
			},
		};
	}

	// process remaining struct
	create_shape_struct(a_fields, s_err_context, a_part_keys, h_props);

	// return property descriptor map
	return h_props;
}



// const gc_item = {

// 	get type(w_set: JsonValue) {
// 		this[$_PARTS][0] = w_set;
// 	},
// };

// const g_item_backed = Object.defineProperties({
// 	[$_TUPLE]: empty(),
// }, gc_item);

// Object.assign(g_item_backed, g_item_set);



