
import {ode} from '@blake.regalia/belt';

import {ItemRef} from 'src/item-ref';
import {expect} from 'vitest';

import {BazQuxesType, FooBarNamespace, init_bazquxes, init_foobars} from './foo-bars';
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

const g_init_foobars = await init_destruct(Stage.PUT_3);

const {FooBars, g_foobar_1, g_foobar_2, g_foobar_3, BazQuxes} = g_init_foobars;

// // attempt to open the vault
// const k_hub = await k_client.open();

// await Chains.put(g_foobar_1);

// await Chains.put(g_foobar_2);

// await Chains.put(g_foobar_3);


// const g_read_1 = await FooBars.get(g_foobar_1);

// for(const [si_key, w_value] of ode(g_foobar_1)) {
// 	console.log(`expect ${si_key} `, g_foobar_1[si_key], g_read_1![si_key]);
// }

const g_init_bazquxes = init_bazquxes(g_init_foobars);
const {g_bazqux_1, g_bazqux_2, g_bazqux_3} = g_init_bazquxes;

// await BazQuxes.put(g_bazqux_1);

// await BazQuxes.putMany([g_bazqux_1, g_bazqux_2]);
// // await BazQuxes.put(g_bazqux_2);

// // const g_read_2 = await Chains.get(g_foobar_2);

// // const g_read_3 = await Chains.get(g_foobar_3);

// const g_ref_1 = (await FooBars.get(g_foobar_1))!;

// await BazQuxes.put({
// 	...g_bazqux_1,
// 	ref: ItemRef.fromItem(g_ref_1),
// });

// const g_read_bq1 = await BazQuxes.get(g_bazqux_1);

// const g_ref_round = g_read_bq1!.ref;

// debugger;

// console.log(g_ref_round);

await BazQuxes.put(g_bazqux_2);
await BazQuxes.put(g_bazqux_3);

const g_read_bq2 = (await BazQuxes.get(g_bazqux_2))!;
const g_read_bq3 = (await BazQuxes.get(g_bazqux_3))!;

debugger;

if(BazQuxesType.BAZ === g_read_bq2.type && BazQuxesType.BAZ === g_bazqux_2.type) {
	const a_actual = g_read_bq2.switch.slice(0, 2);
	const a_expect = g_bazqux_2.switch.slice(0, 2);
	debugger;
}


g_read_bq3.array.length = 3;

debugger;
// g_read_bq1.array.length;
// g_read_bq1.array.slice(1);
// g_read_bq1.array.filter(x => x);

// delete g_read_bq1.array[0];

// console.log(g_read_bq1.array.join(', '));

// debugger;

// const a_vals = await spread_async(FooBars.filter({
// 	ns: FooBarNamespace.COMMON,
// 	ref: new Set([g_foobar_1.ref, g_foobar_3.ref]),
// }));

// const a_values = [];
// for await(const [si_item, g_item] of Chains.entries()) {
// 	a_values.push(g_item);
// }
