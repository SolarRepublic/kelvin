import type {Vault} from '../src/vault';

import {ItemController} from '../src/controller';


const build = async(k_client: Vault) => {
	const Chains = new ItemController({
		client: k_client,
		domain: 'chains',

		schema: (k, si_ref: string) => ({
			si: k.str(si_ref),
		}),
	});

	const Accounts = new ItemController({
		client: k_client,
		domain: 'accounts',

		schema: (k, si_ref: string) => ({
			si: k.str(si_ref),
			mr: k.mapRef(Chains).struct({
				data: k.str(),
			}),
		}),
	});

	const x = await Accounts.get({si:'test'});

	// x?.mr.get()
};

