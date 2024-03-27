/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable quote-props */
import type {TestContext, TestFunction} from 'vitest';

import {__UNDEFINED, fold, is_array, entries, timeout} from '@blake.regalia/belt';

import {XT_ROTATION_DEBOUNCE} from 'src/constants';
import {$_CODE} from 'src/item-proto';
import {ItemRef} from 'src/item-ref';
import {beforeEach, describe, expect, expectTypeOf, it, vi} from 'vitest';

import {BazQuxesType, FooBarNamespace, init_bazquxes, init_foobars} from './foo-bars';
import {SI_DATABASE, client, Stage, init, phrase, init_destruct, spread_async} from './kit';
import {VaultHub} from '../src/hub';
import {Vault} from '../src/vault';


type Tree<w_leaf> = {
	[si_key: string]: Tree<w_leaf> | w_leaf;
};

type TestFunctionTree = Tree<TestFunction<{}>>;

const entries_to_values = (a_entries: [any, any][]) => a_entries.map(([, w_value]) => w_value);

const f_arrayify = (z: unknown) => is_array(z)? [...z]: z;

const tests = (h_tests: TestFunctionTree) => {
	for(const [si_key, z_value] of entries(h_tests)) {
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
			const {FooBars, g_foobar_1} = await init_destruct(Stage.DATA);

			await expect(FooBars.get(g_foobar_1))
				.resolves.toBeUndefined();
		},

		async 'get at 0 undefined'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.DATA);

			await expect(FooBars.getAt([g_foobar_1.ns, g_foobar_1.ref]))
				.resolves.toBeUndefined();
		},

		async 'entries 0 empty'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.DATA);

			const di_chains = FooBars.entries();

			let c_values = 0;
			for await(const w_never of di_chains) {
				c_values++;
			}

			expect(c_values).toBe(0);
		},

		async 'put 1 resolves'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.DATA);

			await expect(FooBars.put(g_foobar_1))
				.resolves.toBeDefined();
		},

		async 'get full 1 original matches'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.PUT_1);

			await expect(FooBars.get(g_foobar_1))
				.resolves.toMatchObject(g_foobar_1);
		},

		async 'get full 1 copy matches'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.PUT_1);

			await expect(FooBars.get({...g_foobar_1}))
				.resolves.toMatchObject(g_foobar_1);
		},

		async 'get partial 1 matches'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.PUT_1);

			const dp_get_partial = FooBars.get({
				ns: g_foobar_1.ns,
				ref: g_foobar_1.ref,
			});

			await expect(dp_get_partial).resolves.toMatchObject(g_foobar_1);
		},

		async 'get at 1 matches'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.PUT_1);

			await expect(FooBars.getAt([g_foobar_1.ns, g_foobar_1.ref]))
				.resolves.toMatchObject(g_foobar_1);
		},

		async 'entries 1 matches'() {
			const {FooBars, g_foobar_1} = await init_destruct(Stage.PUT_1);

			const di_chains = FooBars.entries();

			expect(typeof di_chains[Symbol.asyncIterator]).toBe('function');

			const a_values = entries_to_values(await spread_async(di_chains));

			expect(a_values).toMatchObject([
				g_foobar_1,
			]);
		},

		async 'get full 2 original matches'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.get(g_foobar_2))
				.resolves.toMatchObject(g_foobar_2);

			await expect(FooBars.get(g_foobar_1))
				.resolves.toMatchObject(g_foobar_1);
		},

		async 'get full 2 copy matches'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.get({...g_foobar_1}))
				.resolves.toMatchObject(g_foobar_1);

			await expect(FooBars.get({...g_foobar_2}))
				.resolves.toMatchObject(g_foobar_2);
		},

		async 'get partial 2 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_2);

			const dp_get_partial_2 = FooBars.get({
				ns: g_foobar_2.ns,
				ref: g_foobar_2.ref,
			});

			await expect(dp_get_partial_2).resolves.toMatchObject(g_foobar_2);

			const dp_get_partial_1 = FooBars.get({
				ns: g_foobar_1.ns,
				ref: g_foobar_1.ref,
			});

			await expect(dp_get_partial_1).resolves.toMatchObject(g_foobar_1);
		},

		async 'get at 2 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.getAt([g_foobar_1.ns, g_foobar_1.ref]))
				.resolves.toMatchObject(g_foobar_1);

			await expect(FooBars.getAt([g_foobar_2.ns, g_foobar_2.ref]))
				.resolves.toMatchObject(g_foobar_2);
		},

		async 'entries 2 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_2);

			const a_values = entries_to_values(await spread_async(FooBars.entries()));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_2,
			]);
		},


		async 'get full 2/1 original matches'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.get(g_foobar_1))
				.resolves.toMatchObject(g_foobar_1);

			await expect(FooBars.get(g_foobar_2))
				.resolves.toMatchObject(g_foobar_2);

			await FooBars.put(g_foobar_3);

			await expect(FooBars.get(g_foobar_3))
				.resolves.toMatchObject(g_foobar_3);
		},

		async 'get full 2/1 copy matches'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.get({...g_foobar_1}))
				.resolves.toMatchObject(g_foobar_1);

			await expect(FooBars.get({...g_foobar_2}))
				.resolves.toMatchObject(g_foobar_2);

			await FooBars.put(g_foobar_3);

			await expect(FooBars.get({...g_foobar_3}))
				.resolves.toMatchObject(g_foobar_3);
		},

		async 'get partial 2/1 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_2);

			const dp_get_partial_2 = FooBars.get({
				ns: g_foobar_2.ns,
				ref: g_foobar_2.ref,
			});

			await expect(dp_get_partial_2).resolves.toMatchObject(g_foobar_2);

			const dp_get_partial_1 = FooBars.get({
				ns: g_foobar_1.ns,
				ref: g_foobar_1.ref,
			});

			await expect(dp_get_partial_1).resolves.toMatchObject(g_foobar_1);

			await FooBars.put(g_foobar_3);

			const dp_get_partial_3 = FooBars.get({
				ns: g_foobar_3.ns,
				ref: g_foobar_3.ref,
			});

			await expect(dp_get_partial_3).resolves.toMatchObject(g_foobar_3);
		},

		async 'get at 2/1 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_2);

			await expect(FooBars.getAt([g_foobar_1.ns, g_foobar_1.ref]))
				.resolves.toMatchObject(g_foobar_1);

			await expect(FooBars.getAt([g_foobar_2.ns, g_foobar_2.ref]))
				.resolves.toMatchObject(g_foobar_2);

			await FooBars.put(g_foobar_3);

			await expect(FooBars.getAt([g_foobar_3.ns, g_foobar_3.ref]))
				.resolves.toMatchObject(g_foobar_3);
		},

		async 'entries 3 matches'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_3);

			const a_values = entries_to_values(await spread_async(FooBars.entries()));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_2,
				g_foobar_3,
			]);
		},

		async 'filter match all'() {
			const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_3);

			expect(await spread_async(FooBars.filter({}))).toMatchObject([
				g_foobar_1,
				g_foobar_2,
				g_foobar_3,
			]);
		},

		async 'filter match none'() {
			const {FooBars} = await init_destruct(Stage.PUT_3);

			expect(await spread_async(FooBars.filter({
				ns: FooBarNamespace.UNKNOWN,
			}))).toMatchObject([]);
		},

		async 'filter match 1'() {
			const {FooBars, g_foobar_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(FooBars.filter({
				ns: FooBarNamespace.COMMON,
				ref: g_foobar_2.ref,
			}));

			expect(a_values).toMatchObject([
				g_foobar_2,
			]);

			expect(a_values).toHaveLength(1);
		},

		async 'filter match 2; Set<string> by key part'() {
			const {FooBars, g_foobar_1, g_foobar_3} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(FooBars.filter({
				ns: FooBarNamespace.COMMON,
				ref: new Set([g_foobar_1.ref, g_foobar_3.ref]),
			}));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_3,
			]);

			expect(a_values).toHaveLength(2);
		},

		async 'filter match 2; Set<string> by field'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(FooBars.filter({
				ns: FooBarNamespace.COMMON,
				str: new Set([g_foobar_1.str, g_foobar_2.str]),
			}));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_2,
			]);
		},

		async 'filter match 2; Set<Uint8Array> by field'() {
			const {FooBars, g_foobar_1, g_foobar_2} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(FooBars.filter({
				ns: FooBarNamespace.COMMON,
				bytes: new Set([g_foobar_1.bytes, g_foobar_2.bytes]),
			}));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_2,
			]);

			expect(a_values).toHaveLength(2);
		},

		async 'filter match 2; regex'() {
			const {FooBars, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_3);

			const a_values = await spread_async(FooBars.filter({
				str: /^ba/,
			}));

			expect(a_values).toMatchObject([
				g_foobar_2,
				g_foobar_3,
			]);

			expect(a_values).toHaveLength(2);
		},
	});
});

// describe('filter', () => {k
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
			const {k_client, FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_3);

			// TODO: force an interrupt somehow
			await k_client.withExclusive(async() => {
				await timeout(XT_ROTATION_DEBOUNCE*1.1);
			});

			const a_values = entries_to_values(await spread_async(FooBars.entries()));

			expect(a_values).toMatchObject([
				g_foobar_1,
				g_foobar_2,
				g_foobar_3,
			]);
		},
	});
});


describe('baz-quxes', () => {
	beforeEach(async(g_ctx: TestContext) => {
		const g_init_foobars = await init_destruct(Stage.PUT_3);

		Object.assign(g_ctx, g_init_foobars);
		Object.assign(g_ctx, init_bazquxes(g_init_foobars));
	});

	tests({
		async 'put 1'({BazQuxes, g_bazqux_1}) {
			await expect(BazQuxes.put(g_bazqux_1)).resolves.toBeDefined();
		},

		async 'put many (0)'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await expect(BazQuxes.putMany([])).resolves.toBeDefined();
		},

		async 'put many (1 replace)'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await BazQuxes.put(g_bazqux_1);

			await expect(BazQuxes.putMany([g_bazqux_1])).resolves.toBeDefined();
		},

		async 'put many (1 new)'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await expect(BazQuxes.putMany([g_bazqux_2])).resolves.toBeDefined();
		},

		async 'put many (1 existing + 1 new)'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await BazQuxes.put(g_bazqux_1);

			await expect(BazQuxes.putMany([g_bazqux_1, g_bazqux_2])).resolves.toBeDefined();
		},

		async 'put many (2 new)'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await expect(BazQuxes.putMany([g_bazqux_1, g_bazqux_2])).resolves.toBeDefined();
		},

		async 'get ref null'({BazQuxes, g_bazqux_1, g_bazqux_2}) {
			await BazQuxes.put({
				...g_bazqux_1,
				ref: null,
			});

			await expect(BazQuxes.get(g_bazqux_1)).resolves.toMatchObject({
				ref: null,
			});

			expect((await BazQuxes.get(g_bazqux_1))!.ref).toEqual(null);
		},

		async 'put/get ref via fromItem'({FooBars, g_foobar_1, BazQuxes, g_bazqux_1, g_bazqux_2}) {
			const g_runtime_1 = (await FooBars.get(g_foobar_1))!;

			const g_ref_1 = ItemRef.fromItem(g_runtime_1);

			await BazQuxes.put({
				...g_bazqux_1,
				ref: g_ref_1,
			});

			const g_read_bq1 = (await BazQuxes.get(g_bazqux_1))!;

			const g_ref_round = g_read_bq1.ref;

			expect(g_ref_round!.code).toEqual(g_ref_1.code);
			expect(g_ref_round!.ident).toEqual(g_ref_1.ident);
			expect(g_ref_round!.controller).toEqual(g_ref_1.controller);

			await expect(g_ref_round).resolves.toMatchObject(g_runtime_1);
		},

		async 'put/get ref via struct'({FooBars, g_foobar_1, BazQuxes, g_bazqux_1, g_bazqux_2}) {
			const g_runtime_1 = (await FooBars.get(g_foobar_1))!;

			await BazQuxes.put({
				...g_bazqux_1,
				ref: g_runtime_1,
			});

			const g_read_bq1 = (await BazQuxes.get(g_bazqux_1))!;

			const g_ref_round = g_read_bq1.ref;

			const g_ref_1 = ItemRef.fromItem(g_runtime_1);

			expect(g_ref_round!.code).toEqual(g_ref_1.code);
			expect(g_ref_round!.ident).toEqual(g_ref_1.ident);
			expect(g_ref_round!.controller).toEqual(g_ref_1.controller);

			await expect(g_ref_round).resolves.toMatchObject(g_runtime_1);
		},

		async 'put/get ref via setter'({FooBars, g_foobar_1, BazQuxes, g_bazqux_1, g_bazqux_2}) {
			const g_runtime_1 = (await FooBars.get(g_foobar_1))!;

			await BazQuxes.put({
				...g_bazqux_1,
				ref: null,
			});

			const g_read_bq1 = (await BazQuxes.get(g_bazqux_1))!;

			g_read_bq1.ref = ItemRef.fromItem(g_runtime_1);

			await BazQuxes.put(g_read_bq1);

			const g_read_bq2 = (await BazQuxes.get(g_bazqux_1))!;

			const g_ref_round = g_read_bq2.ref;

			const g_ref_1 = ItemRef.fromItem(g_runtime_1);

			expect(g_ref_round!.code).toEqual(g_ref_1.code);
			expect(g_ref_round!.ident).toEqual(g_ref_1.ident);
			expect(g_ref_round!.controller).toEqual(g_ref_1.controller);

			await expect(g_ref_round).resolves.toMatchObject(g_runtime_1);
		},

		// console.warn(`##### FINDME ####\n${g_ref_round?.controller.domain} : ${g_ref_1.controller.domain}`);
	});
});

describe('fully loaded', () => {
	beforeEach(async(g_ctx) => {
		const g_init_foobars = await init_destruct(Stage.PUT_3);

		Object.assign(g_ctx, g_init_foobars);
		const {BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3} = Object.assign(g_ctx, init_bazquxes(g_init_foobars));

		await BazQuxes.put(g_bazqux_1);
		await BazQuxes.put(g_bazqux_2);
		await BazQuxes.put(g_bazqux_3);

		Object.assign(g_ctx, {
			g_read_bq1: await BazQuxes.get(g_bazqux_1),
			g_read_bq2: await BazQuxes.get(g_bazqux_2),
			g_read_bq3: await BazQuxes.get(g_bazqux_3),
		});
	});

	tests({
		'tagged': {
			'arrays'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				expect([...g_read_bq1.array_str]).toMatchObject(g_bazqux_1.array_str);
				expect([...g_read_bq2.array_str]).toMatchObject(g_bazqux_2.array_str);
				expect([...g_read_bq3.array_str]).toMatchObject(g_bazqux_3.array_str);
			},

			'tuples'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				expect([...g_read_bq1.tuple].map(f_arrayify)).toMatchObject(g_bazqux_1.tuple);
				expect([...g_read_bq2.tuple].map(f_arrayify)).toMatchObject(g_bazqux_2.tuple);
				expect([...g_read_bq3.tuple].map(f_arrayify)).toMatchObject(g_bazqux_3.tuple);
			},

			'structs'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				expect(g_read_bq1.struct).toMatchObject(g_bazqux_1.struct);
				expect(g_read_bq2.struct).toMatchObject(g_bazqux_2.struct);
				expect(g_read_bq3.struct).toMatchObject(g_bazqux_3.struct);
			},
		},

		'field array': {
			'get length'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				expect(g_read_bq1.array_str).toHaveLength(g_bazqux_1.array_str.length);
				expect(g_read_bq2.array_str).toHaveLength(g_bazqux_2.array_str.length);
				expect(g_read_bq3.array_str).toHaveLength(g_bazqux_3.array_str.length);
			},

			async 'set length grow'({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				g_read_bq1.array_str.length = 3;

				await BazQuxes.put(g_read_bq1);

				expect(g_read_bq1.array_str).toHaveLength(3);

				const g_read2_bq1 = (await BazQuxes.get(g_read_bq1))!;

				expect(g_read2_bq1.array_str).toHaveLength(3);

				// expect new slot to be filled with default value for item type
				expect(g_read2_bq1.array_str[2]).toEqual('');
			},

			async 'set length shrink'({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				g_read_bq3.array_str.length = 1;

				await BazQuxes.put(g_read_bq3);

				expect(g_read_bq3.array_str).toHaveLength(1);

				const g_read2_bq3 = (await BazQuxes.get(g_read_bq3))!;

				expect(g_read2_bq3.array_str).toHaveLength(1);
			},

			async 'set length clear'({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				g_read_bq3.array_str.length = 0;

				await BazQuxes.put(g_read_bq3);

				expect(g_read_bq3.array_str).toHaveLength(0);

				const g_read2_bq3 = (await BazQuxes.get(g_read_bq3))!;

				expect(g_read2_bq3.array_str).toHaveLength(0);
			},

			'0-arg mutators': fold(['shift', 'pop', 'reverse', 'sort'], si_method => ({
				[si_method]: ({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) => {
					g_read_bq1.array_str[si_method as 'pop']();
					g_bazqux_1.array_str[si_method as 'pop']();

					expect([...g_read_bq1.array_str]).toMatchObject(g_bazqux_1.array_str);
				},
			})),

			'delete'({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				delete g_read_bq3.array_str[0];
				delete g_bazqux_3.array_str[0];

				expect([...g_read_bq3.array_str]).toMatchObject(g_bazqux_3.array_str);
			},

			// 'splice'({BazQuxes, g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
			// 	g_read_bq1.array.splice();
			// 	g_bazqux_1.array.shift

			// 	expect(g_read2_bq1.array).toHaveLength(3);
			// },
		},

		// TODO: all proxy checks (incl. Object.keys(..), etc.) for the following:
		// TODO: field-set
		// TODO: field-dict
		// TODO: field-struct

		'switches': {
			'switch primitive (numeric)'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				if(BazQuxesType.UNKNOWN === g_read_bq1.type) {
					expectTypeOf(g_read_bq1.switch).toBeNumber();
					expect(g_read_bq1.switch).toEqual(g_bazqux_1.switch);
				}
				else {
					throw Error('Fix test case');
				}
			},

			'switch tagged (tuple)'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				if(BazQuxesType.BAZ === g_read_bq2.type && BazQuxesType.BAZ === g_bazqux_2.type) {
					expectTypeOf(g_read_bq2.switch as [any, any, any]).toBeArray();
					expect(g_read_bq2.switch.slice(0, 2)).toEqual(g_bazqux_2.switch.slice(0, 2));
				}
				else {
					throw Error('Fix test case');
				}
			},

			'switch tagged (struct)'({g_bazqux_1, g_bazqux_2, g_bazqux_3, g_read_bq1, g_read_bq2, g_read_bq3}) {
				if(BazQuxesType.QUX === g_read_bq3.type) {
					expectTypeOf(g_read_bq3.switch).toBeObject();
					expect(g_read_bq3.switch).toEqual(g_bazqux_3.switch);
				}
				else {
					throw Error('Fix test case');
				}
			},
		},
	});
});
