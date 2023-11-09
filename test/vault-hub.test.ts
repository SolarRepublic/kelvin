/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable quote-props */
import type {TestFunction} from 'vitest';

import {ode, type Dict, text_to_buffer} from '@blake.regalia/belt';
import {VaultClient} from 'src/vault-client';
import {MemoryWrapper} from 'src/wrappers/memory';
import {describe, expect, it} from 'vitest';

const client = () => {
	const k_content = new MemoryWrapper();
	const k_session = new MemoryWrapper();

	const k_client: VaultClient = new VaultClient(k_content, k_session);

	return {k_client};
};

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
	const f_throwers = (k_client: VaultClient) => ({
		'isUnlocked() throws'() {
			expect(() => k_client.isUnlocked()).toThrowError();
		},

		async 'open() rejects'() {
			await expect(k_client.open()).rejects.toThrow(/locked/);
		},

		async 'connect() resolves'() {
			await expect(k_client.connect()).resolves.toBeInstanceOf(VaultClient);
		},
	});

	describe('before connecting', () => {
		const {k_client} = client();

		tests({
			'exists() throws'() {
				expect(() => k_client.exists()).toThrowError();
			},

			...f_throwers(k_client),
		});
	});

	describe('after connecting', async() => {
		const {k_client} = client();
		await k_client.connect();

		tests({
			'exists() false'() {
				expect(k_client.exists()).to.be.false;
			},

			...f_throwers(k_client),
		});
	});
});

describe('init', async() => {
	const {k_client} = client();
	await k_client.connect();

	tests({
		'register no info'() {
			expect(k_client.register(text_to_buffer('passphrase'))).resolves.toBeUndefined;
		},
	});
});

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
