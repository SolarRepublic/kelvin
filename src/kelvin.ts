import type { Dict } from '@blake.regalia/belt';
import type {ConnectConfig, KelvinConfig} from './api';
import type { GenericItemController } from './controller';
import type { RuntimeItem } from './item-proto';
import type { StructuredSchema, AcceptablePartTuples, PartFields } from './schema-types';
import type { DomainLabel } from './types';

import {Vault} from './vault';


export class Kelvin {
	// controllers
	protected _h_controllers: Record<DomainLabel, GenericItemController> = {};

	// connected Vault instance
	protected _k_vault: undefined | Vault;

	constructor(
		protected _gc_kelvin: KelvinConfig
	) {
	}

	get vault(): typeof this._k_vault {
		return this._k_vault;
	}

	get controllers(): typeof this._h_controllers {
		return this._h_controllers;
	}

	/**
	 * Connects to the given database
	 * @param si_database - id of the database
	 * @returns 
	 */
	async connect<n_db_version extends number>(gc_connect: ConnectConfig<n_db_version>): Promise<Vault> {
		// destructure kelvin config
		const {
			content: _k_content,
			session: _k_session,
		} = this._gc_kelvin;

		// destructure connection params
		const {
			id: _si_name,
			version: _n_db_version,
			migrations: _h_migrations,
		} = gc_connect;

		// create new Vault instance
		const k_vault = this._k_vault = await Vault.create(this, {
			...this._gc_kelvin,
			...gc_connect,
		});

		// done
		return k_vault;
	}

	/**
	 * @internal
	 * Registers an item controller instance for its domain
	 */
	registerController(si_domain: DomainLabel, k_controller: GenericItemController): void {
		// destructure
		const {_h_controllers} = this;

		// already registered
		if(_h_controllers[si_domain]) {
			throw Error(`An item controller for the "${si_domain}" domain has already been registered`);
		}

		// accept
		_h_controllers[si_domain] = k_controller;
	}


	/**
	 * @internal
	 * Retrieves the registered (weakly typed) item controller for a given domain
	 */
	controllerFor<
		g_item extends Dict<any>=Dict<any>,
		g_runtime extends RuntimeItem<g_item>=RuntimeItem<g_item>,
		g_schema extends StructuredSchema=StructuredSchema,
		a_parts extends AcceptablePartTuples=AcceptablePartTuples,
		g_parts extends PartFields<g_schema>=PartFields<g_schema>,
	>(si_domain: DomainLabel): GenericItemController<g_item, g_runtime, g_schema, a_parts, g_parts> | undefined {
		return this._h_controllers[si_domain] as unknown as GenericItemController<g_item, g_runtime, g_schema, a_parts, g_parts>;
	}

}
