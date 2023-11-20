/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable quote-props */
import type {DomainLabel} from '../src/types';
import type {TestContext, TestFunction} from 'vitest';

import {ode, text_to_buffer} from '@blake.regalia/belt';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {ItemController} from '../src/controller';
import {VaultHub} from '../src/hub';
import {Vault} from '../src/vault';
import {MemoryWrapper} from '../src/wrappers/memory';

type TestContextExtension = {
	k_client: Vault;
	k_hub?: VaultHub;
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
}

const client = async(xc_stage: Stage) => {
	const k_content = new MemoryWrapper();
	const k_session = new MemoryWrapper();

	const k_client: Vault = new Vault(0, k_content, k_session);

	const g_context: TestContextExtension = {
		k_client,
	};

	if(xc_stage >= Stage.CONNECT) {
		await k_client.connect(SI_DATABASE);

		if(xc_stage >= Stage.REGISTER) {
			await k_client.register(phrase());

			if(xc_stage >= Stage.OPEN) {
				g_context.k_hub = await k_client.open();
			}
		}
	}

	return g_context;
};

// eslint-disable-next-line no-sequences
const init = (xc_stage: Stage) => async(g: TestContext) => (Object.assign(g, await client(xc_stage)), void 0);

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
			await expect(k_client.connect(SI_DATABASE)).resolves.toBeInstanceOf(Vault);
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



// const k_content = new MemoryWrapper();
// const k_session = new MemoryWrapper();

// export const k_vault = new Vault(k_content, k_session);

// const k_db = await k_vault.connect('default');

// if(k_db.exists) {
// 	await k_db.unlock(phrase());
// }
// else {
// 	await k_db.register(phrase());
// }

// await k_db.open();

// await k_db.close();

// new ItemController({
// 	vault: k_vault,
// 	domain: 'chains',
// });



	// describe('before connecting', () => {
	// 	it('exists() throws', () => {
	// 		expect(() => k_client.exists()).to.throw;
	// 	});

	// 	it('isUnlocked() throws', () => {
	// 		expect(() => k_client.isUnlocked()).to.throw;
	// 	});
	// });
// });

// describe('before unlocking', () => {

// 	k_client.
// });


// await k_client.connect();


// k_client.isUnlocked();


describe('item', () => {
	beforeEach(init(Stage.OPEN));

	tests({
		async controller({k_client, k_hub}) {
		},
	});
});
