import {text_to_buffer} from '@blake.regalia/belt';
import {VaultClient} from 'src/vault-client';
import {MemoryWrapper} from 'src/wrappers/memory';

const k_content = new MemoryWrapper();
const k_session = new MemoryWrapper();

const k_client: VaultClient = new VaultClient(k_content, k_session);

// connect to the database
await k_client.connect('default');

// passphrase
const atu8_phrase = text_to_buffer('test');

// database is empty
if(!k_client.exists()) {
	// register 
	await k_client.register(atu8_phrase);
}

if(!k_client.isUnlocked()) {
	k_client.unlock();
}
