import {text_to_buffer} from '@blake.regalia/belt';
import {VaultClient} from 'src/vault-client';
import {MemoryWrapper} from 'src/wrappers/memory';

const k_content = new MemoryWrapper();
const k_session = new MemoryWrapper();

const k_client: VaultClient = new VaultClient(k_content, k_session);

await k_client.connect();

await k_client.register(text_to_buffer('test'));
