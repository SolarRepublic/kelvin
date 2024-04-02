
import {base64_to_bytes, bytes_to_base64, bytes_to_text} from '@blake.regalia/belt';
import {beforeEach, describe, expect, expectTypeOf, it, vi} from 'vitest';

import {Stage, client} from './kit';
import {ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR} from '../src/constants';

describe('vault', async() => {
	const {k_client} = await client(Stage.OPEN);

	it('encrypts with automatic nonce', async() => {
		const atu8_test_1 = await k_client.encryptBytes('test', ATU8_DUMMY_PHRASE);
		const atu8_test_2 = await k_client.encryptBytes('test', ATU8_DUMMY_PHRASE);

		expect(bytes_to_base64(atu8_test_1) !== bytes_to_base64(atu8_test_2)).toBe(true);
	});

	it('decrypts', async() => {
		const atu8_test_1 = await k_client.encryptBytes('test', ATU8_DUMMY_PHRASE);
		const atu8_test_2 = await k_client.encryptBytes('test', ATU8_DUMMY_PHRASE);
		const atu8_other_1 = await k_client.encryptBytes('other', ATU8_DUMMY_PHRASE);
		const atu8_other_2 = await k_client.encryptBytes('other', ATU8_DUMMY_VECTOR);

		const atu8_test_p1 = await k_client.decryptBytes('test', atu8_test_1);
		const atu8_test_p2 = await k_client.decryptBytes('test', atu8_test_2);
		const atu8_other_p1 = await k_client.decryptBytes('other', atu8_other_1);
		const atu8_other_p2 = await k_client.decryptBytes('other', atu8_other_2);

		const sb64_phrase = bytes_to_base64(ATU8_DUMMY_PHRASE);
		const sb64_vector = bytes_to_base64(ATU8_DUMMY_VECTOR);

		expect(bytes_to_base64(atu8_test_p1)).toBe(sb64_phrase);
		expect(bytes_to_base64(atu8_test_p2)).toBe(sb64_phrase);
		expect(bytes_to_base64(atu8_other_p1)).toBe(sb64_phrase);
		expect(bytes_to_base64(atu8_other_p2)).toBe(sb64_vector);
	});

	it('decrypts across sessions', async() => {
		const atu8_test_p1 = base64_to_bytes('AGiTylNJNkYTOiE79tRhOzH2BfyYNeDf+UuXLCFDLq7350a6u7JLRZacDtg9eh0cOdmmsGqH84U3FB9Anbz8iWM=');

		const atu8_test_1 = await k_client.decryptBytes('test', atu8_test_p1);

		console.log(bytes_to_text(atu8_test_1));
	});
});
