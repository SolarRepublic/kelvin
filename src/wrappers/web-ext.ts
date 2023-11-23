import type {Dict, JsonValue} from '@blake.regalia/belt';
import type {StorageChanges} from 'src/store';

import {fodemtv} from '@blake.regalia/belt';

import {KelvinKeyValueStore, JsonBasedChange, KelvinKeyValueWriter} from 'src/store';

export class WebExtWriter extends KelvinKeyValueWriter<WebExtWrapper> {
	override setStringMany(h_set: Dict): Promise<void> {
		return this.setJsonMany(h_set);
	}

	override setJsonMany(h_set: Dict<JsonValue>): Promise<void> {
		return this._k_reader._d_area.set(h_set);
	}

	override removeMany(a_keys: string[]): Promise<void> {
		return this._k_reader._d_area.remove(a_keys);
	}

	override clear(): Promise<void> {
		return this._k_reader._d_area.clear();
	}
}


export class WebExtWrapper extends KelvinKeyValueStore<WebExtWriter> {
	constructor(
		si_lock_prefix: string,
		/**
		 * @internal
		 */
		public _d_area: chrome.storage.StorageArea=chrome.storage.local,
		y_locks=navigator.locks
	) {
		super(WebExtWriter, y_locks, si_lock_prefix);
	}

	override async getAllKeys(): Promise<string[]> {
		return Object.keys(await this._d_area.get(null));
	}

	override getStringMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return this.getJsonMany(a_keys);
	}

	override getJsonMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return this._d_area.get(a_keys) as Promise<w_out>;
	}

	override onChanged(fk_changed: (h_changes: StorageChanges) => void): VoidFunction {
		// ref event object
		const d_event = this._d_area.onChanged;

		// intermediary
		const fk_handler = (h_changes: Record<string, chrome.storage.StorageChange>) => fk_changed(fodemtv(h_changes, g_change => ({
			newValue: new JsonBasedChange(g_change.newValue),
			oldValue: new JsonBasedChange(g_change.oldValue),
		})));

		// add listener
		d_event.addListener(fk_handler);

		// return remover callback
		return () => {
			d_event.removeListener(fk_handler);
		};
	}
}
