import type {GenericItemController} from './controller';

import type {RuntimeItem} from './item-proto';
import type {DomainLabel, ItemCode, ItemIdent} from './types';

import {is_dict_es, type Dict, __UNDEFINED} from '@blake.regalia/belt';

import {$_CODE, $_CONTROLLER, is_runtime_item} from './item-proto';


export type Refish<
	g_item extends Dict<any>=Dict<any>,
> = number | ItemRef<g_item> | RuntimeItem<g_item>;

export const refish_to_code = (z_refish: Refish, g_controller?: GenericItemController): ItemCode | undefined => {
	// other item
	if(is_runtime_item(z_refish)) {
		return z_refish[$_CODE];
	}
	// other ref
	else if(z_refish instanceof ItemRef) {
		return z_refish.code;
	}
	// key parts
	else if(g_controller && is_dict_es(z_refish)) {
		return g_controller.getItemCode(z_refish);
	}
	// item code
	else if('number' === typeof z_refish) {
		return z_refish as ItemCode;
	}

	return __UNDEFINED;
};


export class ItemRef<
	g_dst extends Dict<any>=Dict<any>,
	g_runtime extends RuntimeItem<g_dst>=RuntimeItem<g_dst>,
> {
	static fromItem<g_dst extends Dict<any>>(g_item: RuntimeItem<g_dst>): ItemRef<g_dst> {
		if(!is_runtime_item(g_item)) {
			throw TypeError(`Argument passed to ItemRef.fromItem() must be a RuntimeItem`);
		}

		return new ItemRef(g_item[$_CONTROLLER], g_item[$_CODE]) as ItemRef<g_dst>;
	}

	constructor(
		protected _k_src: GenericItemController<g_dst, g_runtime>,
		protected _i_item: ItemCode
	) {}

	/**
	 * Get the target item's code (scoped by its domain)
	 */
	get code(): ItemCode {
		return this._i_item;
	}

	/**
	 * Get the target item's string-based identifier (scoped by its domain)
	 */
	get ident(): ItemIdent | undefined {
		return this._k_src.hub.decodeItem(this._i_item);
	}

	/**
	 * Get the controller for the source item that holds this reference
	 */
	get controller(): GenericItemController {
		return this._k_src;
	}

	/**
	 * Get the domain's unique label
	 */
	get domain(): DomainLabel {
		return this._k_src.domain;
	}

	/**
	 * Dereference this {@link ItemRef} to get a Promise that resolves to its {@link RuntimeItem}
	 */
	async item(): Promise<g_runtime | undefined> {
		// lookup the controller class for the referenced item's domain
		const k_dst = this._k_src.hub.vault.kelvin.controllerFor<g_dst, g_runtime>(this.domain);

		// controller wasn't found/registered
		if(!k_dst) {
			throw new Error(`No item controller was registered for "${this.domain}" domain while trying to dereference item ${this.ident}`);
		}

		// load the item
		return await k_dst.getByCode(this._i_item);
	}

	get [Symbol.toStringTag](): string {
		return `[object ItemRef{code:${this.code}; domain:${this.domain}}]`;
	}

	[Symbol.toPrimitive](s_hint?: string): number {
		return 'string' === s_hint? this.code: this.code;
	}
}
