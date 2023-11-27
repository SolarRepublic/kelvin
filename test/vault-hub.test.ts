/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable quote-props */
import type {TestFunction} from 'vitest';

import {ode, timeout} from '@blake.regalia/belt';

import {XT_ROTATION_DEBOUNCE} from 'src/constants';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {ChainNamespace} from './chains';
import {SI_DATABASE, client, Stage, init, phrase, init_destruct, spread_async} from './kit';
import {VaultHub} from '../src/hub';
import {Vault} from '../src/vault';


type Tree<w_leaf> = {
	[si_key: string]: Tree<w_leaf> | w_leaf;
};

type TestFunctionTree = Tree<TestFunction<{}>>;

const entries_to_values = (a_entries: [any, any][]) => a_entries.map(([, w_value]) => w_value);

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

			const a_values = entries_to_values(await spread_async(di_chains));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
			]);
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

			const a_values = entries_to_values(await spread_async(Chains.entries()));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
			]);
		},


		async 'get full 2/1 original matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_2);

			await expect(Chains.get(g_chain_sample_1))
				.resolves.toMatchObject(g_chain_sample_1);

			await expect(Chains.get(g_chain_sample_2))
				.resolves.toMatchObject(g_chain_sample_2);

			await Chains.put(g_chain_sample_3);

			await expect(Chains.get(g_chain_sample_3))
				.resolves.toMatchObject(g_chain_sample_3);
		},

		async 'get full 2/1 copy matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_2);

			await expect(Chains.get({...g_chain_sample_1}))
				.resolves.toMatchObject(g_chain_sample_1);

			await expect(Chains.get({...g_chain_sample_2}))
				.resolves.toMatchObject(g_chain_sample_2);

			await Chains.put(g_chain_sample_3);

			await expect(Chains.get({...g_chain_sample_3}))
				.resolves.toMatchObject(g_chain_sample_3);
		},

		async 'get partial 2/1 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_2);

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

			await Chains.put(g_chain_sample_3);

			const dp_get_partial_3 = Chains.get({
				ns: g_chain_sample_3.ns,
				ref: g_chain_sample_3.ref,
			});

			await expect(dp_get_partial_3).resolves.toMatchObject(g_chain_sample_3);
		},

		async 'get at 2/1 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_2);

			await expect(Chains.getAt([g_chain_sample_1.ns, g_chain_sample_1.ref]))
				.resolves.toMatchObject(g_chain_sample_1);

			await expect(Chains.getAt([g_chain_sample_2.ns, g_chain_sample_2.ref]))
				.resolves.toMatchObject(g_chain_sample_2);

			await Chains.put(g_chain_sample_3);

			await expect(Chains.getAt([g_chain_sample_3.ns, g_chain_sample_3.ref]))
				.resolves.toMatchObject(g_chain_sample_3);
		},

		async 'entries 3 matches'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_3);

			const a_values = entries_to_values(await spread_async(Chains.entries()));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
				g_chain_sample_3,
			]);
		},

		async 'filter match all'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_3);

			expect(await spread_async(Chains.filter({}))).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
				g_chain_sample_3,
			]);
		},

		async 'filter match none'() {
			const {Chains} = await init_destruct(Stage.PUT_3);

			expect(await spread_async(Chains.filter({
				ns: ChainNamespace.UNKNOWN,
			}))).toMatchObject([]);
		},

		async 'filter match 1'() {
			const {Chains, g_chain_sample_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(Chains.filter({
				ns: ChainNamespace.COSMOS,
				ref: g_chain_sample_2.ref,
			}));

			expect(a_values).toMatchObject([
				g_chain_sample_2,
			]);

			expect(a_values).toHaveLength(1);
		},

		async 'filter match 2; Set<string> by key part'() {
			const {Chains, g_chain_sample_1, g_chain_sample_3} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(Chains.filter({
				ns: ChainNamespace.COSMOS,
				ref: new Set([g_chain_sample_1.ref, g_chain_sample_3.ref]),
			}));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_3,
			]);

			expect(a_values).toHaveLength(2);
		},

		async 'filter match 2; Set<string> by field'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(Chains.filter({
				ns: ChainNamespace.COSMOS,
				str: new Set([g_chain_sample_1.str, g_chain_sample_2.str]),
			}));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
			]);
		},

		async 'filter match 2; Set<Uint8Array> by field'() {
			const {Chains, g_chain_sample_1, g_chain_sample_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(Chains.filter({
				ns: ChainNamespace.COSMOS,
				bytes: new Set([g_chain_sample_1.bytes, g_chain_sample_2.bytes]),
			}));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
			]);

			expect(a_values).toHaveLength(2);
		},

		async 'filter match 2; regex'() {
			const {Chains, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(Chains.filter({
				str: /^ba/,
			}));

			expect(a_values).toMatchObject([
				g_chain_sample_2,
				g_chain_sample_3,
			]);

			expect(a_values).toHaveLength(2);
		},
	});
});

// describe('filter', () => {
// 	filters({
// 		'Set<string> on part': ({g1, g2}) => [{
// 			ns: ChainNamespace.COSMOS,
// 			str: new Set([g1.str, g2.str]),
// 		}, [g1, g2]],
// 	});
// });

describe('rotation', () => {
	tests({
		async 'rotation interrupt'() {
			const {k_client, Chains, g_chain_sample_1, g_chain_sample_2, g_chain_sample_3} = await init_destruct(Stage.PUT_3);

			// TODO: force an interrupt somehow
			await k_client.withExclusive(async() => {
				await timeout(XT_ROTATION_DEBOUNCE*1.1);
			});

			const a_values = entries_to_values(await spread_async(Chains.entries()));

			expect(a_values).toMatchObject([
				g_chain_sample_1,
				g_chain_sample_2,
				g_chain_sample_3,
			]);
		},
	});
});
