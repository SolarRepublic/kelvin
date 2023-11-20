import {buffer_to_base93, text_to_buffer} from '@blake.regalia/belt';
import {VaultHub} from 'src/hub';
import {Vault} from 'src/vault';
import {MemoryWrapper} from 'src/wrappers/memory';

import {ChainNamespace, Toggle, init_chains} from './chains';
import {ContactType, controllers} from './schema';

const k_content = new MemoryWrapper('content');
const k_session = new MemoryWrapper('session');

const k_client = new Vault(0, k_content, k_session);

// connect to the database
await k_client.connect('default');

// passphrase
const sh_phrase = 'test';

// database is empty
if(!k_client.exists()) {
	// register 
	await k_client.register(text_to_buffer(sh_phrase), console.info);
}

// client is not unlocked
if(!k_client.isUnlocked()) {
	// unlock it
	await k_client.unlock(text_to_buffer(sh_phrase));
}

const {Chains} = init_chains(k_client);

// attempt to open the vault
const k_hub = await k_client.open();

await Chains.put({
	ns: ChainNamespace.COSMOS,
	ref: 'test-1',
	on: Toggle.ON,
});

debugger;

// // use item
// const g_item = await Contacts.getAt([ContactType.HUMAN, buffer_to_base93(text_to_buffer('data'))]);

// debugger;

// console.log({
// 	k_content,
// 	k_session,
// 	k_client,
// });
