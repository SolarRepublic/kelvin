import type {JsonValue, Dict, JsonObject} from '@blake.regalia/belt';

import {__UNDEFINED, fold, ode} from '@blake.regalia/belt';

import {JsonBasedChange, JsonKeyValueStore, StringBasedChange, type StorageChanges} from 'src/store';

type ListenerCallback = (h_changes: StorageChanges) => void;

export class MemoryWrapper<
	h_schema extends JsonObject=JsonObject,
> extends JsonKeyValueStore<h_schema> {
	protected _h_store: Dict = {};

	protected _a_listeners: ListenerCallback[] = [];

	protected _get_sync(si_key: string): JsonValue | undefined {
		const sx_value = this._h_store[si_key];

		return sx_value? JSON.parse(sx_value): __UNDEFINED;
	}

	protected _queue_notify(h_changes: StorageChanges): void {
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

	override getStringMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return Promise.resolve(fold(a_keys, si_key => ({
			[si_key]: this._get_sync(si_key),
		})) as w_out);
	}

	override getAllKeys(): Promise<string[]> {
		return Promise.resolve(Object.keys(this._h_store));
	}

	override setStringMany(h_set: Dict<JsonValue>): Promise<void> {
		// destructure field(s)
		const {_h_store} = this;

		// prep changes
		const h_changes: StorageChanges = {};

		// each entry
		for(const [si_key, w_value] of ode(h_set)) {
			// ref old value
			const w_old = _h_store[si_key];

			// prep new value
			const w_new = JSON.stringify(w_value);

			// add to changes
			h_changes[si_key] = {
				oldValue: new StringBasedChange(w_old),
				newValue: new StringBasedChange(w_new),
			};

			// set in store
			_h_store[si_key] = w_new;
		}

		// queue change notification
		this._queue_notify(h_changes);

		// resolve
		return Promise.resolve();
	}

	override clear(): Promise<void> {
		// remove every entry
		return this.removeMany(Object.keys(this._h_store));
	}

	override removeMany(a_keys: string[]): Promise<void> {
		// destructure field(s)
		const {_h_store} = this;

		// prep changes
		const h_changes: StorageChanges = {};

		// each key
		for(const si_key of a_keys) {
			// add to changes
			h_changes[si_key] = {
				oldValue: new JsonBasedChange(_h_store[si_key]),
				newValue: new JsonBasedChange(__UNDEFINED),
			};

			// delete from store
			delete _h_store[si_key];
		}

		// queue change notification
		this._queue_notify(h_changes);

		// resolve
		return Promise.resolve();
	}

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
