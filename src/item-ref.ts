import type {GenericItemController} from './controller';
import type {RuntimeItem} from './item-proto';

import type {DomainLabel, ItemCode, ItemIdent} from './types';
import type {Dict} from '@blake.regalia/belt';


export class ItemRef<
	g_dst extends Dict<any>=Dict<any>,
	g_runtime extends RuntimeItem<g_dst>=RuntimeItem<g_dst>,
> implements PromiseLike<g_runtime> {
	constructor(
		protected _k_src: GenericItemController<g_dst, g_runtime>,
		protected _i_item: ItemCode
	) {}

	get code(): ItemCode {
		return this._i_item;
	}

	get ident(): ItemIdent | undefined {
		return this._k_src.hub.decodeItem(this._i_item);
	}

	get controller(): GenericItemController {
		return this._k_src;
	}

	get domain(): DomainLabel {
		return this._k_src.domain;
	}

	then<
		w_value=g_runtime,
		e_reason=never,
	>(
		fk_resolve?: ((w_value: g_runtime) => w_value | PromiseLike<w_value>) | null | undefined,
		fe_reject?: ((e_reason: any) => e_reason | PromiseLike<e_reason>) | null | undefined
	): PromiseLike<w_value | e_reason> {
		const k_dst = this._k_src.hub.vault.controllerFor<g_dst, g_runtime>(this.domain);

		if(!k_dst) {
			throw new Error(`No item controller was registered for "${this.domain}" domain while trying to dereference item ${this.ident}`);
		}

		// load the item
		return k_dst.getByCode(this._i_item).then(
			fk_resolve as ((value: g_runtime | undefined) => w_value | PromiseLike<w_value>) | null | undefined,
			fe_reject);
	}
}
