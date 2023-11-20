import type {NaiveBase93} from '@blake.regalia/belt';
import type {Vault} from 'src/vault';

import {ItemController} from 'src/controller';

enum ChainNamespace {
	UNKNOWN=0,
	COSMOS=1,
}

export enum ContactType {
	UNKNOWN=0,
	HUMAN=1,
	ROBOT=2,
	CONTRACT=3,
}

export enum IncidentType {
	UNKNOWN,
	ACCOUNT_CREATED,
	ACCOUNT_EDITED,
}

export enum ChangeType {
	UNKNOWN=0,
	ATTRIBUTE=1,
	CONTACT=2,
}


// await Chains.put({
// 	ns: ChainNamespace.COSMOS,
// 	ref: 'secret-4',
// 	data: 'test',
// });

// const g_chain = await Chains.getAt([ChainNamespace.COSMOS, 'test-1']);

// g_chain?.caip2;

// type Target = {
// 	ns: ChainNamespace;
// 	ref: string;
// 	data: string;
// 	readonly caip2: string;
// };


export const controllers = (k_client: Vault) => {
	// // create item controller
	// const Contacts = new ItemController({
	// 	client: k_client,
	// 	domain: 'contact',

	// 	schema: (k, xc_type: ContactType, sb93_data: NaiveBase93) => ({
	// 		type: k.int(xc_type),
	// 		addr: k.str(sb93_data),
	// 		name: k.str(),
	// 		notes: k.str(),
	// 	}),
	// });


	const Chains = new ItemController({
		client: k_client,
		domain: 'chains',

		schema: (k0, xc_ns: ChainNamespace, si_ref: string) => ({
			ns: k0.int(xc_ns),
			ref: k0.str(si_ref),
			data: k0.str(),
		}),

		proto: cast => ({
			get caip2(): string {
				return cast(this).ns+':'+cast(this).ref;
			},
		}),
	});

	return {
		Chains,
		// Contacts,
	};
};
