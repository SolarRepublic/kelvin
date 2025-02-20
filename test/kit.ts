import type {BazQuxesController, BazQuxesStruct, BazQuxesType, FooBarsController, FooBarsStruct, init_bazquxes} from './foo-bars';
import type {VaultHub} from '../src/hub';
import type {RuntimeItem} from 'src/item-proto';
import type {TestContext} from 'vitest';

import {text_to_bytes} from '@blake.regalia/belt';

import {init_foobars} from './foo-bars';
import {Vault} from '../src/vault';
import {MemoryWrapper} from '../src/wrappers/memory';
import { Kelvin } from 'src/kelvin';


type TestContextExtension = {
	k_kelvin: Kelvin;
	k_hub?: VaultHub;

	FooBars: FooBarsController;
	g_foobar_1: FooBarsStruct;
	g_foobar_2: FooBarsStruct;
	g_foobar_3: FooBarsStruct;

	BazQuxes: BazQuxesController;
	g_bazqux_1: BazQuxesStruct;
	g_bazqux_2: BazQuxesStruct;
	g_bazqux_3: BazQuxesStruct;

	g_read_bq1: RuntimeItem<BazQuxesStruct>;
	g_read_bq2: RuntimeItem<BazQuxesStruct>;
	g_read_bq3: RuntimeItem<BazQuxesStruct>;
};

declare module 'vitest' {
	export interface TestContext extends TestContextExtension {}
}

export const SI_DATABASE = 'test';

export const phrase = (): Uint8Array => text_to_bytes('passphrase');

export enum Stage {
	INIT=0,
	CONNECT=1,
	REGISTER=2,
	OPEN=3,
	DATA=4,
	PUT_1=5,
	PUT_2=6,
	PUT_3=7,
}

export const client = async(xc_stage: Stage) => {
	const k_content = new MemoryWrapper();
	const k_session = new MemoryWrapper();

	const k_kelvin = new Kelvin({
		content: k_content,
		session: k_session,
	});

	const g_context = {
		k_kelvin,
	} as TestContextExtension;

	if(xc_stage >= Stage.CONNECT) {
		const k_vault = await k_kelvin.connect({
			id: SI_DATABASE,
			version: 0,
			migrations: {},
		});

		if(xc_stage >= Stage.REGISTER) {
			// data
			const g_init = init_foobars(k_vault);
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = g_init;
			if(xc_stage >= Stage.DATA) {
				Object.assign(g_context, g_init);
			}

			await k_vault.register(phrase());

			if(xc_stage >= Stage.OPEN) {
				g_context.k_hub = await k_vault.open();
			}

			if(xc_stage >= Stage.PUT_1) {
				await FooBars.put(g_foobar_1);

				if(xc_stage >= Stage.PUT_2) {
					await FooBars.put(g_foobar_2);

					if(xc_stage >= Stage.PUT_3) {
						await FooBars.put(g_foobar_3);
					}
				}
			}
		}
	}

	return g_context;
};

export const spread_async = async<w>(di_items: AsyncIterableIterator<w>) => {
	const a_items: w[] = [];
	for await(const z_item of di_items) {
		a_items.push(z_item);
	}

	return a_items;
};

export const init_destruct = async(xc_stage: Stage, w_obj: object={}) => Object.assign(w_obj, await client(xc_stage));

// eslint-disable-next-line no-sequences
export const init = (xc_stage: Stage) => async(g_ctx: TestContext) => (await init_destruct(xc_stage, g_ctx), void 0);
