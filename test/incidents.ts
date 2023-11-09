import type {IndexLabel, IndexValue} from '../src/types';
import {VaultClient} from '../src/vault-client';

import { createItemController } from '../src/item-controller';
import { LocalStorageWrapper } from 'src/wrappers/local-storage';
import { MemoryWrapper } from 'src/wrappers/memory';


const k_local = new MemoryWrapper();
const k_session = new MemoryWrapper();

let K_VAULT_CLIENT!: VaultClient = new VaultClient(k_local, k_session);



enum IncidentType {
	UNKNOWN,
	ACCOUNT_CREATED,
	ACCOUNT_EDITED,
}

enum ChangeType {
	UNKNOWN=0,
	ATTRIBUTE=1,
	CONTACT=2,
}

type Contact = {};

const f_subschema_edit = (k, [xc_type]: [ChangeType]) => ({
	account: k.ref(),
	type: k.int(xc_type),
	change: k.switch('type', xc_type, k => ({
		[ChangeType.UNKNOWN]: k.int(),
		[ChangeType.ATTRIBUTE]: k.struct(k => ({
			key: k.str(),
			old: k.str(),
			new: k.str(),
		})),
		[ChangeType.CONTACT]: k.struct(k => ({
			edge: k.str(),
			old: k.ref<Contact>(),
			new: k.ref<Contact>(),
		})),
	})),
});

export const Incidents = createItemController({
	client: K_VAULT_CLIENT,
	domain: 'incidents',

	schema: (k, [xc_type, si_id]: [IncidentType, string]) => ({
		type: k.int(xc_type),
		id: k.str(si_id),
		time: k.int(),
		data: k.switch('type', xc_type, k => ({
			[IncidentType.UNKNOWN]: k.int(),
			[IncidentType.ACCOUNT_CREATED]: k.ref<Account>(),
			[IncidentType.ACCOUNT_EDITED]: k.struct(f_subschema_edit),
		})),
	}),


	index: (g_item) => {
		const h_indexes: Record<IndexLabel, Set<IndexValue>> = {};

		// transaction
		if([IncidentType.ACCOUNT_CREATED, IncidentType.ACCOUNT_EDITED].includes(g_item.type)) {
			// index sender
			h_indexes[''] = 
		}
	},
});

const shape = [
	1,  // schema version
	// key fields
	[
		'type',
		'id',
	],
	// data fields
	[
		'time',
		{  // switch: field label, switch index
			"s": ['data', 0, [
				'',  // 0: no struct
				1,   // 1: item ref
				[    // 2: struct
					'account',
					'type',
					{
						"s": ['change', 1, [
							'',
							[
								'key',
								'old',
								'new',
							],
							[
								'edge',
								'old',
								'new',
							],
						]],
					},
				],
			]],
		},
	],
];

const data = [
	[161554120, 421]  // ref needs index
	[161563981, [
		22,
		ChangeType.ATTRIBUTE,
		['name', 'Bob', 'Bobbie'],
	]]
];

declare function test<xc_type extends IncidentType>(w_arg: {type: xc_type}): xc_type;

test({
	type: IncidentType.ACCOUNT_CREATED,
});

const si_txn = 'ata';

Incidents.put({
	type: IncidentType.UNKNOWN,
	id: si_txn,
	time: Date.now(),
	data: 25,
});

Incidents.put({
	type: IncidentType.ACCOUNT_CREATED,
	id: si_txn,
	time: Date.now(),
	data: {
		stage: ChangeType.UNKNOWN,
		raw_log: 'data',
	},
});

Incidents.putAt([IncidentType.UNKNOWN, 'data'], {
	time: Date.now(),
	data: 25,
});

Incidents.putAt([IncidentType.ACCOUNT_CREATED, 'data'], {
	time: Date.now(),
	data: {
		stage: ChangeType.ATTRIBUTE,
		code: 10,
	},
});

const g_test = Incidents.getAt([IncidentType.UNKNOWN, 'data']);

if(g_test) {
	// g_test.
}

void Incidents.get({
	type: IncidentType.UNKNOWN,
	id: '',
});

Incidents.find({

});



// Incidents.putW([IncidentType.TX_OUT, si_txn], {
// 	time: Date.now(),
// 	id: 'ok',
// 	data
// });



// const h_schema_tx = (k: SchemaTyper) => ({
// 	// txResponse.code
// 	code: k.int,

// 	// txResponse.rawLog
// 	raw_log: k.str,

// 	// txResponse.hash
// 	hash: k.str,

// 	// tx.authInfo.fee.gasLimit
// 	gas_limit: k.str<CwUint128>(),

// 	// txResponse.gasWanted
// 	gas_wanted: k.str<CwUint128>(),

// 	// txResponse.gasUsed
// 	gas_used: k.str<CwUint128>(),
// });
