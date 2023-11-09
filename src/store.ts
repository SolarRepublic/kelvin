import type {A, C, F} from 'ts-toolbelt';

import type {SimpleLockManager} from './locks';

import type {Promisable, Dict, JsonObject, JsonValue, NaiveBase93} from '@blake.regalia/belt';

import {fodemtv, base93_to_buffer, buffer_to_base93, __UNDEFINED, buffer_to_json} from '@blake.regalia/belt';

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


export type KelvinSchema = Dict<JsonValue |Uint8Array>;


export class CompliantChange<w_nil extends null | undefined=null> implements ChangeValue {
	constructor(protected _w_value: JsonValue | Uint8Array | w_nil) {}

	asString(): string | undefined {
		return this._w_value? this._w_value as string: __UNDEFINED;
	}

	asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined {
		return this._w_value? this._w_value as w_value: __UNDEFINED;
	}

	asBytes(): Uint8Array | undefined {
		return this._w_value? this._w_value as Uint8Array: __UNDEFINED;
	}
}

export class StringBasedChange<w_nil extends null | undefined=null> extends CompliantChange<w_nil> {
	override asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined {
		return this._w_value? JSON.parse(this._w_value as string) as w_value: __UNDEFINED;
	}

	override asBytes(): Uint8Array | undefined {
		return this._w_value? base93_to_buffer(this._w_value as string): __UNDEFINED;
	}
}

export class JsonBasedChange<w_nil extends null | undefined=null> extends CompliantChange<w_nil> {
	override asBytes(): Uint8Array | undefined {
		return this._w_value? base93_to_buffer(this._w_value as string): __UNDEFINED;
	}
}

export class BytesBasedChange<w_nil extends null | undefined=null> extends CompliantChange<w_nil> {
	override asString(): string | undefined {
		return this._w_value? buffer_to_base93(this._w_value as Uint8Array): __UNDEFINED;
	}

	override asJson<w_value extends JsonValue=JsonValue>(): w_value | undefined {
		return this._w_value? buffer_to_json(this._w_value as Uint8Array) as w_value: __UNDEFINED;
	}
}


export abstract class KelvinKeyValueWriter<
	k_reader extends KelvinKeyValueStore<any>=KelvinKeyValueStore<any>,
	h_schema extends KelvinSchema=KelvinSchema,
> {
	protected _b_destroyed = false;

	constructor(protected _k_reader: k_reader) {}

	abstract setStringMany(h_set: Dict): Promise<void>;

	abstract removeMany(a_keys: string[]): Promise<void>;

	abstract clear(): Promise<void>;

	/**
	 * @internal
	 */
	_destroy() {
		this._b_destroyed = true;

		// destroy instance to prevent out-of-scope writes
		Object.setPrototypeOf(this, null);
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
}

/**
 * Describes a compatible backing key-value store
 */
export abstract class KelvinKeyValueStore<
	k_writer extends KelvinKeyValueWriter,
	h_schema extends KelvinSchema=KelvinSchema,
> {
	constructor(
		// magical type inferencing to allow referencing an instance of a class that extends self
		protected _dc_writer: any extends infer k_reader
			? k_reader extends KelvinKeyValueStore<k_writer, h_schema>
				? C.Class<[k_reader], k_writer>
				: never
			: never,
		protected _y_locks: SimpleLockManager,
		protected _si_lock_prefix: string=crypto.randomUUID()
	) {}

	abstract getAllKeys(): Promise<string[]>;

	abstract getStringMany<
		h_types extends Dict=Dict,
		w_out={
			[si_key in keyof h_types]: h_types[si_key] | undefined;
		},
	>(a_keys: string[]): Promise<w_out>;

	// abstract setStringMany(h_set: Dict): Promise<void>;

	// abstract removeMany(a_keys: string[]): Promise<void>;

	// abstract clear(): Promise<void>;

	abstract onChanged(fk_changed: (h_changes: StorageChanges) => void): VoidFunction;

	lockAll<w_out>(fk_use: (k_writer: k_writer, y_lock: Lock | null) => Promisable<w_out>): Promise<w_out> {
		// acquire a lock from the lock manager
		return this._y_locks.request(this._si_lock_prefix, {mode:'exclusive'}, async(y_lock) => {
			// create new writer instance
			const k_writer = new this._dc_writer(this);

			// attempt to use the lock with the ad-hoc writer instance
			try {
				return await fk_use(k_writer, y_lock);
			}
			// destroy the writer before lock is released
			finally {
				k_writer._destroy();
			}
		});
	}

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

	// setString(si_key: string, s_value: string): Promise<void> {
	// 	return this.setStringMany({
	// 		[si_key]: s_value,
	// 	});
	// }

	// setJson(si_key: string, w_value: JsonValue): Promise<void> {
	// 	return this.setJsonMany({
	// 		[si_key]: w_value,
	// 	});
	// }

	// setJsonMany(h_set: Dict<JsonValue>): Promise<void> {
	// 	return this.setStringMany(fodemtv(h_set, w_value => JSON.stringify(w_value)));
	// }

	// setBytes(si_key: string, atu8_value: Uint8Array): Promise<void> {
	// 	return this.setBytesMany({
	// 		[si_key]: atu8_value,
	// 	});
	// }

	// setBytesMany(h_set: Dict<Uint8Array>): Promise<void> {
	// 	return this.setStringMany(fodemtv(h_set, atu8_value => buffer_to_base93(atu8_value)));
	// }

	// remove(si_key: string): Promise<void> {
	// 	return this.removeMany([si_key]);
	// }

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
