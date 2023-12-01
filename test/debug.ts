
import {ode} from '@blake.regalia/belt';

import {expect} from 'vitest';

import {FooBarNamespace, init_foobars} from './foo-bars';
import {Stage, init_destruct, spread_async} from './kit';

// const k_content = new MemoryWrapper('content');
// const k_session = new MemoryWrapper('session');

// const k_client = new Vault({
// 	content: k_content,
// 	session: k_session,
// });

// // connect to the database
// await k_client.connect({
// 	id: 'default',
// 	version: 0,
// 	migrations: {},
// });

// // passphrase
// const sh_phrase = 'test';

// // database is empty
// if(!k_client.exists()) {
// 	// register 
// 	await k_client.register(text_to_buffer(sh_phrase), console.info);
// }

// // client is not unlocked
// if(!k_client.isUnlocked()) {
// 	// unlock it
// 	await k_client.unlock(text_to_buffer(sh_phrase));
// }

const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3} = await init_destruct(Stage.PUT_3);

// // attempt to open the vault
// const k_hub = await k_client.open();

// await Chains.put(g_foobar_1);

// await Chains.put(g_foobar_2);

// await Chains.put(g_foobar_3);


const g_read_1 = await FooBars.get(g_foobar_1);

for(const [si_key, w_value] of ode(g_foobar_1)) {
	console.log(`expect ${si_key} `, g_foobar_1[si_key], g_read_1![si_key]);
}

await expect(FooBars.get(g_foobar_1))
	.resolves.toMatchObject(g_foobar_1);

// const g_read_2 = await Chains.get(g_foobar_2);

// const g_read_3 = await Chains.get(g_foobar_3);
debugger;

const a_vals = await spread_async(FooBars.filter({
	ns: FooBarNamespace.COMMON,
	ref: new Set([g_foobar_1.ref, g_foobar_3.ref]),
}));

// const a_values = [];
// for await(const [si_item, g_item] of Chains.entries()) {
// 	a_values.push(g_item);
// }

console.log(a_vals);

debugger;

// const g_read = await Chains.getAt([ChainNamespace.COSMOS, 'test-1']);

debugger;
// console.log(g_read_1);
// console.log(g_read_2);

// // use item
// const g_item = await Contacts.getAt([ContactType.HUMAN, buffer_to_base93(text_to_buffer('data'))]);

// debugger;

// console.log({
// 	k_content,
// 	k_session,
// 	k_client,
// });
