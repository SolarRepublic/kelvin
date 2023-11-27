import type {ChainStruct} from './chains';
import type {VaultHub} from '../src/hub';
import type {TestContext} from 'vitest';

import {text_to_buffer} from '@blake.regalia/belt';

import {init_chains} from './chains';
import {Vault} from '../src/vault';
import {MemoryWrapper} from '../src/wrappers/memory';


type TestContextExtension = {
	k_client: Vault;
	k_hub?: VaultHub;
	Chains: ReturnType<typeof init_chains>['Chains'];
	g_chain_sample_1: ChainStruct;
	g_chain_sample_2: ChainStruct;
	g_chain_sample_3: ChainStruct;
};

declare module 'vitest' {
	export interface TestContext extends TestContextExtension {}
}

export const SI_DATABASE = 'test';

export const phrase = (): Uint8Array => text_to_buffer('passphrase');

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

	const k_client: Vault = new Vault({
		content: k_content,
		session: k_session,
	});

	const g_context = {
		k_client,
	} as TestContextExtension;

	if(xc_stage >= Stage.CONNECT) {
		await k_client.connect({
			id: SI_DATABASE,
			version: 0,
			migrations: {},
		});

		if(xc_stage >= Stage.REGISTER) {
			// data
			const g_init = init_chains(k_client);
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = g_init;
			if(xc_stage >= Stage.DATA) {
				Object.assign(g_context, g_init);
			}

			await k_client.register(phrase());

			if(xc_stage >= Stage.OPEN) {
				g_context.k_hub = await k_client.open();
			}

			if(xc_stage >= Stage.PUT_1) {
				await Chains.put(g_chain_sample_1);

				if(xc_stage >= Stage.PUT_2) {
					await Chains.put(g_chain_sample_2);

					if(xc_stage >= Stage.PUT_3) {
						await Chains.put(g_chain_sample_3);
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
