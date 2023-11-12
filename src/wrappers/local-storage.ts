import type {StorageChanges} from '../store';
import type {JsonValue, Dict} from '@blake.regalia/belt';

import {__UNDEFINED, ode} from '@blake.regalia/belt';

import {KelvinKeyValueStore, KelvinKeyValueWriter, StringBasedChange} from '../store';

// create event listener adder for given storage
function storage_listener(d_storage: Storage) {
	// create invocable
	return (f_callback: (d_event: StorageEvent) => void) => {
		// create event handler
		const fk_listener = (d_event: StorageEvent) => {
			// applies to this storage area; execute callback
			if(d_storage === d_event.storageArea) {
				f_callback(d_event);
			}
		};

		// bind listener
		globalThis.addEventListener('storage', fk_listener);

		// remover callback
		return () => {
			globalThis.removeEventListener('storage', fk_listener);
		};
	};
}


export class LocalStorageWriter extends KelvinKeyValueWriter<LocalStorageWrapper> {
	override setStringMany(h_set: Dict<JsonValue>): Promise<void> {
		// destructure storage
		const {_d_storage} = this._k_reader;

		// each item; set synchronously
		for(const [si_key, w_value] of ode(h_set)) {
			_d_storage.setItem(si_key, JSON.stringify(w_value));
		}

		// resolve
		return Promise.resolve();
	}

	override removeMany(a_keys: string[]): Promise<void> {
		// destructure storage
		const {_d_storage} = this._k_reader;

		// each item, delete synchronously
		for(const si_key of a_keys) {
			_d_storage.removeItem(si_key);
		}

		// resolve
		return Promise.resolve();
	}

	override clear(): Promise<void> {
		// synchronously clear storage
		this._k_reader._d_storage.clear();

		// resolve
		return Promise.resolve();
	}
}


export class LocalStorageWrapper extends KelvinKeyValueStore<LocalStorageWriter> {
	constructor(
		/**
		 * @internal
		 */
		public _d_storage=localStorage,

		/**
		 * @internal
		 */
		public _f_add_listener=storage_listener(_d_storage),

		y_locks=navigator.locks
	) {
		super(LocalStorageWriter, y_locks);
	}

	_get_sync(si_key: string): JsonValue {
		// get item
		const sx_item = this._d_storage.getItem(si_key);

		// return
		return sx_item? JSON.parse(sx_item): null;
	}

	override getAllKeys(): Promise<string[]> {
		// destructure field(s)
		const {_d_storage} = this;

		// prep return list
		const a_keys: string[] = [];

		// each key by index; add to list
		for(let i_key=0; i_key<_d_storage.length; i_key++) {
			a_keys.push(_d_storage.key(i_key)!);
		}

		// return values
		return Promise.resolve(a_keys);
	}

	override getStringMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		// prep return dict
		const h_values: Dict<JsonValue> = {};

		// each key; get its value and store it to dict
		for(const si_key of a_keys) {
			h_values[si_key] = this._get_sync(si_key);
		}

		// return dict
		return Promise.resolve(h_values as w_out);
	}

	override onChanged(fk_changed: (h_changes: StorageChanges) => void): VoidFunction {
		return this._f_add_listener((d_event) => {
			// everything was cleared, don't have old values
			if(!d_event.key) {
				throw new Error(`Cannot produce change set for Web Storage provider when cleared`);
			}
			else {
				const sx_old = d_event.oldValue;
				const sx_new = d_event.newValue;

				fk_changed({
					[d_event.key]: {
						oldValue: new StringBasedChange(sx_old),
						newValue: new StringBasedChange(sx_new),
					},
				});
			}
		});
	}
}
