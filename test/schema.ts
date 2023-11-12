import type {NaiveBase93} from '@blake.regalia/belt';
import type {VaultClient} from 'src/vault-client';

import {ItemController} from 'src/controller';

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


export const controllers = (k_client: VaultClient) => {
	// create item controller
	const Contacts = new ItemController({
		client: k_client,
		domain: 'contact',

		schema: (k, [xc_type, sb93_data]: [ContactType, NaiveBase93]) => ({
			type: k.int(xc_type),
			addr: k.str(sb93_data),
			name: k.str(),
			notes: k.str(),
		}),
	});


	return {
		Contacts,
	};
};
