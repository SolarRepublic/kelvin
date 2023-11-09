import type {JsonValue, Dict, JsonObject} from '@blake.regalia/belt';

import {__UNDEFINED, fold, ode} from '@blake.regalia/belt';

import {KelvinKeyValueStore, type StorageChanges, CompliantChange, KelvinKeyValueWriter} from 'src/store';

type ListenerCallback = (h_changes: StorageChanges) => void;

class MemoryWriter extends KelvinKeyValueWriter<MemoryWrapper> {
	protected _set_many<w_type extends JsonValue | Uint8Array>(
		h_set: Dict<w_type>
	): Promise<void> {
		// destructure field(s)
		const {_h_store} = this._k_reader;

		// prep changes
		const h_changes: StorageChanges = {};

		// each entry
		for(const [si_key, w_value] of ode(h_set)) {
			// ref old value
			const w_old = _h_store[si_key] as w_type;

			// add to changes
			h_changes[si_key] = {
				oldValue: new CompliantChange(w_old),
				newValue: new CompliantChange(w_value),
			};

			// set in store
			_h_store[si_key] = w_value;
		}

		// queue change notification
		this._k_reader._queue_notify(h_changes);

		// resolve
		return Promise.resolve();
	}


	override setStringMany(h_set: Dict): Promise<void> {
		return this._set_many<string>(h_set);
	}

	override setJsonMany(h_set: Dict<JsonValue>): Promise<void> {
		return this._set_many<JsonValue>(h_set);
	}

	override setBytesMany(h_set: Dict<Uint8Array>): Promise<void> {
		return this._set_many<Uint8Array>(h_set);
	}

	override clear(): Promise<void> {
		// remove every entry
		return this.removeMany(Object.keys(this._k_reader._h_store));
	}

	override removeMany(a_keys: string[]): Promise<void> {
		// destructure field(s)
		const {_h_store} = this._k_reader;

		// prep changes
		const h_changes: StorageChanges = {};

		// each key
		for(const si_key of a_keys) {
			// add to changes
			h_changes[si_key] = {
				oldValue: new CompliantChange(_h_store[si_key]),
				newValue: new CompliantChange(__UNDEFINED),
			};

			// delete from store
			delete _h_store[si_key];
		}

		// queue change notification
		this._k_reader._queue_notify(h_changes);

		// resolve
		return Promise.resolve();
	}
}

export class MemoryWrapper<
	h_schema extends JsonObject=JsonObject,
> extends KelvinKeyValueStore<MemoryWriter, h_schema> {
	protected _a_listeners: ListenerCallback[] = [];

	/**
	 * @internal
	 */
	_h_store: Dict<JsonValue | Uint8Array> = {};

	protected _get_sync(si_key: string): JsonValue | Uint8Array | undefined {
		return this._h_store[si_key];
	}

	protected _get_many_sync<w_out>(a_keys: string[]): Promise<w_out> {
		return Promise.resolve(fold(a_keys, si_key => ({
			[si_key]: this._get_sync(si_key),
		})) as w_out);
	}

	/**
	 * @internal
	 */
	_queue_notify(h_changes: StorageChanges): void {
		// copy listeners to avoid recursion
		const a_listeners = this._a_listeners.slice();

		// queue microtask
		queueMicrotask(() => {
			// each listener; execute callback
			for(const f_listener of a_listeners) {
				f_listener(h_changes);
			}
		});
	}

	// protected _set_many<w_type extends JsonValue | Uint8Array>(
	// 	h_set: Dict<w_type>
	// ): Promise<void> {
	// 	// destructure field(s)
	// 	const {_h_store} = this;

	// 	// prep changes
	// 	const h_changes: StorageChanges = {};

	// 	// each entry
	// 	for(const [si_key, w_value] of ode(h_set)) {
	// 		// ref old value
	// 		const w_old = _h_store[si_key] as w_type;

	// 		// add to changes
	// 		h_changes[si_key] = {
	// 			oldValue: new CompliantChange(w_old),
	// 			newValue: new CompliantChange(w_value),
	// 		};

	// 		// set in store
	// 		_h_store[si_key] = w_value;
	// 	}

	// 	// queue change notification
	// 	this._queue_notify(h_changes);

	// 	// resolve
	// 	return Promise.resolve();
	// }

	override getStringMany<
		h_types extends Dict=Dict,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return this._get_many_sync(a_keys);
	}

	override getJsonMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return this._get_many_sync(a_keys);
	}

	override getBytesMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return this._get_many_sync(a_keys);
	}

	override getAllKeys(): Promise<string[]> {
		return Promise.resolve(Object.keys(this._h_store));
	}

	// override setStringMany(h_set: Dict): Promise<void> {
	// 	return this._set_many<string>(h_set);
	// }

	// override setJsonMany(h_set: Dict<JsonValue>): Promise<void> {
	// 	return this._set_many<JsonValue>(h_set);
	// }

	// override setBytesMany(h_set: Dict<Uint8Array>): Promise<void> {
	// 	return this._set_many<Uint8Array>(h_set);
	// }

	// override clear(): Promise<void> {
	// 	// remove every entry
	// 	return this.removeMany(Object.keys(this._h_store));
	// }

	// override removeMany(a_keys: string[]): Promise<void> {
	// 	// destructure field(s)
	// 	const {_h_store} = this;

	// 	// prep changes
	// 	const h_changes: StorageChanges = {};

	// 	// each key
	// 	for(const si_key of a_keys) {
	// 		// add to changes
	// 		h_changes[si_key] = {
	// 			oldValue: new CompliantChange(_h_store[si_key]),
	// 			newValue: new CompliantChange(__UNDEFINED),
	// 		};

	// 		// delete from store
	// 		delete _h_store[si_key];
	// 	}

	// 	// queue change notification
	// 	this._queue_notify(h_changes);

	// 	// resolve
	// 	return Promise.resolve();
	// }

	override onChanged(fk_changed: (h_changes: StorageChanges) => void): VoidFunction {
		// ref listeners array
		const a_listeners = this._a_listeners;

		// add to listeners
		a_listeners.push(fk_changed as ListenerCallback);

		// return remover callback
		return () => {
			a_listeners.splice(a_listeners.indexOf(fk_changed as ListenerCallback), 1);
		};
	}
}
