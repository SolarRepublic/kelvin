import type {IndexLabel, IndexValue} from '../src/types';


import {LocalStorageWrapper} from 'src/wrappers/local-storage';
import {MemoryWrapper} from 'src/wrappers/memory';

import {createItemController} from '../src/item-controller';
import {VaultClient} from '../src/vault-client';


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
			s: ['data', 0, [
				'',  // 0: no struct
				1,   // 1: item ref
				[    // 2: struct
					'account',
					'type',
					{
						s: ['change', 1, [
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
		]],
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
