/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable quote-props */
import type {ItemStruct} from 'src/item-proto';
import type {TestContext, TestFunction} from 'vitest';

import {ode, text_to_buffer} from '@blake.regalia/belt';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {init_chains, type ChainStruct} from './chains';
import {VaultHub} from '../src/hub';
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


const SI_DATABASE = 'test';

const phrase = () => text_to_buffer('passphrase');

enum Stage {
	INIT=0,
	CONNECT=1,
	REGISTER=2,
	OPEN=3,
	DATA=4,
	PUT_1=5,
	PUT_2=6,
	PUT_3=7,
}

const client = async(xc_stage: Stage) => {
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
			await k_client.register(phrase());

			// data
			const g_init = init_chains(k_client);
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = g_init;
			if(xc_stage >= Stage.DATA) {
				Object.assign(g_context, g_init);
			}

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


const init_destruct = async(xc_stage: Stage, w_obj: object={}) => Object.assign(w_obj, await client(xc_stage));

// eslint-disable-next-line no-sequences
const init = (xc_stage: Stage) => async(g_ctx: TestContext) => (await init_destruct(xc_stage, g_ctx), void 0);

type Tree<w_leaf> = {
	[si_key: string]: Tree<w_leaf> | w_leaf;
};

type TestFunctionTree = Tree<TestFunction<{}>>;


const tests = (h_tests: TestFunctionTree) => {
	for(const [si_key, z_value] of ode(h_tests)) {
		if('object' === typeof z_value) {
			describe(si_key, () => {
				tests(z_value);
			});
		}
		else {
			it(si_key, z_value);
		}
	}
};

describe('nonexistant', () => {
	const f_throwers = (k_client: Vault) => ({
		'isUnlocked() throws'() {
			expect(() => k_client.isUnlocked()).to.throw;
		},

		async 'open() rejects'() {
			await expect(k_client.open()).rejects.toThrow(/locked/);
		},

		async 'connect() resolves'() {
			await expect(k_client.connect({
				id: SI_DATABASE,
				version: 0,
				migrations: {},
			})).resolves.toBeInstanceOf(Vault);
		},
	});

	describe('before connecting', async() => {
		const {k_client} = await client(Stage.INIT);

		tests({
			'exists() throws'() {
				expect(() => k_client.exists()).toThrowError();
			},

			...f_throwers(k_client),

			'untilOpened is a promise'() {
				expect(k_client.untilOpened()).toBeInstanceOf(Promise);
			},
		});
	});

	describe('after connecting', async() => {
		const {k_client} = await client(Stage.CONNECT);

		tests({
			'exists() false'() {
				expect(k_client.exists()).to.be.false;
			},

			...f_throwers(k_client),

			'untilOpened is a promise'() {
				expect(k_client.untilOpened()).toBeInstanceOf(Promise);
			},
		});
	});
});

describe('init', () => {
	beforeEach(init(Stage.CONNECT));

	tests({
		async 'register no info'({k_client}) {
			await expect(k_client.register(phrase())).resolves.toBeUndefined();
		},

		async 'register with info'({k_client}) {
			const f_info = vi.fn();

			await expect(k_client.register(phrase(), f_info)).resolves.toBeUndefined();
			expect(f_info).toHaveBeenCalled();
		},
	});
});

describe('open', () => {
	beforeEach(init(Stage.REGISTER));

	tests({
		'exists() true'({k_client}) {
			expect(k_client.exists()).to.be.true;
		},

		'isUnlocked() true'({k_client}) {
			expect(k_client.isUnlocked()).to.be.true;
		},

		async 'redundant unlock OK'({k_client}) {
			await expect(k_client.unlock(phrase())).resolves.toBeUndefined();
		},

		async 'open() resolves'({k_client}) {
			await expect(k_client.open()).resolves.toBeInstanceOf(VaultHub);
		},

		'hub() throws before open'({k_client}) {
			expect(() => k_client.hub()).to.throw;
		},
	});
});

describe('after open', () => {
	beforeEach(init(Stage.OPEN));

	tests({
		async 'redundant open() OK'({k_client, k_hub}) {
			await expect(k_client.open()).resolves.toEqual(k_hub);
		},

		'isUnlocked() after open still true'({k_client}) {
			expect(k_client.isUnlocked()).to.be.true;
		},

		'hub() returns after open'({k_client, k_hub}) {
			expect(k_client.hub()).to.be.equal(k_hub);
		},
	});
});


describe('item', () => {
	tests({
		async 'get full 0 undefined'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.DATA);

			await expect(Chains.get(g_chain_sample_1))
				.resolves.toBeUndefined();
		},

		async 'get at 0 undefined'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.DATA);

			await expect(Chains.getAt([g_chain_sample_1.ns, g_chain_sample_1.ref]))
				.resolves.toBeUndefined();
		},

		async 'entries 0 empty'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.DATA);

			const di_chains = Chains.entries();

			let c_values = 0;
			for await(const w_never of di_chains) {
				c_values++;
			}

			expect(c_values).toBe(0);
		},

		async 'put 1 resolves'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.DATA);

			await expect(Chains.put(g_chain_sample_1))
				.resolves.toBeDefined();
		},

		async 'get full 1 original matches'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.PUT_1);

			await expect(Chains.get(g_chain_sample_1))
				.resolves.toMatchObject(g_chain_sample_1);
		},

		async 'get full 1 copy matches'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.PUT_1);

			await expect(Chains.get({...g_chain_sample_1}))
				.resolves.toMatchObject(g_chain_sample_1);
		},

		async 'get partial 1 matches'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.PUT_1);

			const dp_get_partial = Chains.get({
				ns: g_chain_sample_1.ns,
				ref: g_chain_sample_1.ref,
			});

			await expect(dp_get_partial).resolves.toMatchObject(g_chain_sample_1);
		},

		async 'get at 1 matches'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.PUT_1);

			await expect(Chains.getAt([g_chain_sample_1.ns, g_chain_sample_1.ref]))
				.resolves.toMatchObject(g_chain_sample_1);
		},

		async 'entries 1 matches'() {
			const {Chains, g_chain_sample_1} = await init_destruct(Stage.PUT_1);

			const di_chains = Chains.entries();

			expect(typeof di_chains[Symbol.asyncIterator]).toBe('function');

			let c_values = 0;
			for await(const [si_item, g_item] of di_chains) {
				expect(g_item).toMatchObject(g_chain_sample_1);
				c_values++;
			}

			expect(c_values).toBe(1);
		},

		async 'get full 2 original matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_2);

			await expect(Chains.get(g_chain_sample_2))
				.resolves.toMatchObject(g_chain_sample_2);

			await expect(Chains.get(g_chain_sample_1))
				.resolves.toMatchObject(g_chain_sample_1);
		},

		async 'get full 2 copy matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_2);

			await expect(Chains.get({...g_chain_sample_1}))
				.resolves.toMatchObject(g_chain_sample_1);

			await expect(Chains.get({...g_chain_sample_2}))
				.resolves.toMatchObject(g_chain_sample_2);
		},

		async 'get partial 2 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_2);

			const dp_get_partial_2 = Chains.get({
				ns: g_chain_sample_2.ns,
				ref: g_chain_sample_2.ref,
			});

			await expect(dp_get_partial_2).resolves.toMatchObject(g_chain_sample_2);

			const dp_get_partial_1 = Chains.get({
				ns: g_chain_sample_1.ns,
				ref: g_chain_sample_1.ref,
			});

			await expect(dp_get_partial_1).resolves.toMatchObject(g_chain_sample_1);
		},

		async 'get at 2 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_2);

			await expect(Chains.getAt([g_chain_sample_1.ns, g_chain_sample_1.ref]))
				.resolves.toMatchObject(g_chain_sample_1);

			await expect(Chains.getAt([g_chain_sample_2.ns, g_chain_sample_2.ref]))
				.resolves.toMatchObject(g_chain_sample_2);
		},

		async 'entries 2 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_2);

			const di_chains = Chains.entries();

			expect(typeof di_chains[Symbol.asyncIterator]).toBe('function');

			const a_values: ChainStruct[] = [];
			for await(const [si_item, g_item] of di_chains) {
				a_values.push(g_item);
			}

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
			]);
		},
	});
});
