import {fodemtv, type Dict, type JsonObject, type JsonValue, fold, base93_to_buffer, type NaiveBase93, buffer_to_base58, buffer_to_base93, json_to_buffer, safe_json, __UNDEFINED} from '@blake.regalia/belt';

import {VaultDamagedError} from './errors';

export type ChangeValue = {
	asString(): string | undefined;
	asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined;
	asBytes(): Uint8Array | undefined;
};

export type StorageChanges = Record<string, {
	oldValue: ChangeValue;
	newValue: ChangeValue;
}>;

export class StringBasedChange<w_nil extends null | undefined=null> implements ChangeValue {
	constructor(protected _s_value: string | w_nil) {}

	asString(): string | undefined {
		return this._s_value ?? __UNDEFINED;
	}

	asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined {
		return this._s_value? JSON.parse(this._s_value) as w_value: __UNDEFINED;
	}

	asBytes(): Uint8Array | undefined {
		return this._s_value? base93_to_buffer(this._s_value): __UNDEFINED;
	}
}

export class JsonBasedChange<w_nil extends null | undefined=null> implements ChangeValue {
	constructor(protected _w_value: JsonValue<w_nil>) {}

	asString(): string | undefined {
		return this._w_value as string ?? __UNDEFINED;
	}

	asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined {
		return this._w_value as w_value ?? __UNDEFINED;
	}

	asBytes(): Uint8Array | undefined {
		return this._w_value? base93_to_buffer(this._w_value as string): __UNDEFINED;
	}
}

/**
 * Describes a compatible backing key-value store
 */
export abstract class JsonKeyValueStore<
	h_schema extends JsonObject=JsonObject,
> {
	abstract getAllKeys(): Promise<string[]>;

	abstract getStringMany<
		h_types extends Dict=Dict,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out>;

	abstract setStringMany(h_set: Dict): Promise<void>;

	abstract removeMany(a_keys: string[]): Promise<void>;

	abstract clear(): Promise<void>;

	abstract onChanged(fk_changed: (h_changes: StorageChanges) => void): VoidFunction;

	async getString<
		w_value extends string=string,
		si_key extends string=string,
		w_out=(string extends w_value? h_schema[si_key]: w_value) | undefined,
	>(si_key: si_key): Promise<w_out> {
		return (await this.getStringMany([si_key]))[si_key] as w_out;
	}

	async getJson<
		w_value extends JsonValue=JsonValue,
		si_key extends string=string,
		w_out=JsonValue extends w_value? h_schema[si_key]: w_value,
	>(si_key: si_key): Promise<w_out> {
		return (await this.getJsonMany([si_key]))[si_key] as w_out;
	}

	async getJsonMany<
		h_types extends Dict<JsonValue>=Dict<JsonValue>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out> {
		return fodemtv(await this.getStringMany(a_keys), (sx_data, si_key) => {
			try {
				return 'undefined' === typeof sx_data? __UNDEFINED: JSON.parse(sx_data);
			}
			catch(e_decode) {
				throw new VaultDamagedError(`could not decode JSON for key "${si_key}" within implementor ${Object.getPrototypeOf(this)}`);
			}
		}) as w_out;
	}

	getBytes<
		w_value extends Uint8Array=Uint8Array,
		si_key extends string=string,
	>(si_key: si_key): Promise<JsonValue extends w_value? h_schema[si_key]: w_value> {
		return this.getBytesMany([si_key]);
	}

	async getBytesMany<
		h_types extends Dict<Uint8Array>=Dict<Uint8Array>,
		w_out={
			[si_key in keyof h_types]: h_types[si_key];
		},
	>(a_keys: string[]): Promise<w_out> {
		return fodemtv(await this.getStringMany(a_keys), (sb93_data, si_key) => {
			try {
				return base93_to_buffer(sb93_data as NaiveBase93);
			}
			catch(e_decode) {
				throw new VaultDamagedError(`could not decode bytes for key "${si_key}" within implementor ${Object.getPrototypeOf(this)}`);
			}
		}) as w_out;
	}

	setString(si_key: string, s_value: string): Promise<void> {
		return this.setStringMany({
			[si_key]: s_value,
		});
	}

	setJson(si_key: string, w_value: JsonValue): Promise<void> {
		return this.setJsonMany({
			[si_key]: w_value,
		});
	}

	setJsonMany(h_set: Dict<JsonValue>): Promise<void> {
		return this.setStringMany(fodemtv(h_set, w_value => JSON.stringify(w_value)));
	}

	setBytes(si_key: string, atu8_value: Uint8Array): Promise<void> {
		return this.setBytesMany({
			[si_key]: atu8_value,
		});
	}

	setBytesMany(h_set: Dict<Uint8Array>): Promise<void> {
		return this.setStringMany(fodemtv(h_set, atu8_value => buffer_to_base93(atu8_value)));
	}

	remove(si_key: string): Promise<void> {
		return this.removeMany([si_key]);
	}

	onEntryChanged(
		si_key: string,
		fk_changed: (w_new: ChangeValue, w_old: ChangeValue) => void
	): VoidFunction {
		return this.onChanged((h_changes) => {
			// change affects target key
			const g_change = h_changes[si_key];
			if(g_change) {
				// apply callback
				fk_changed(g_change.newValue, g_change.oldValue);
			}
		});
	}
}
