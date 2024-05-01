
import type {StructFromController} from '../src/schema-types';
import type {ItemCode} from '../src/types';
import type {Vault} from '../src/vault';

import {type NaiveBase64, text_to_base64} from '@blake.regalia/belt';


import {ItemController} from '../src/controller';
import {ItemRef} from '../src/item-ref';

export enum Toggle {
	OFF=0,
	ON=1,
}

export enum FooBarNamespace {
	UNKNOWN=0,
	COMMON=1,
}

const H_NS_LABELS: Record<FooBarNamespace, string> = {
	[FooBarNamespace.UNKNOWN]: '',
	[FooBarNamespace.COMMON]: 'common',
};

const G_SWITCH_COMMON = {
	acc: '',
	accpub: 'pub',
	valcons: 'valcons',
	valconspub: 'valconspub',
	valoper: 'valoper',
	valoperpub: 'valoperpub',
};

export enum BazQuxesType {
	UNKNOWN=0,
	BAZ=1,
	QUX=2,
}

export type FooBarsController = ReturnType<typeof init_foobars>['FooBars'];

export type FooBarsStruct = StructFromController<FooBarsController>;

export type BazQuxesController = ReturnType<typeof init_foobars>['BazQuxes'];

export type BazQuxesStruct = StructFromController<BazQuxesController>;


export const init_foobars = (k_client: Vault) => {
	const FooBars = new ItemController({
		client: k_client,
		domain: 'foo-bars',

		schema: (k, xc_ns: FooBarNamespace, si_ref: string) => ({
			ns: k.int(xc_ns),
			ref: k.str(si_ref),
			on: k.int<Toggle>(),
			int: k.int(),
			str: k.str(),
			bytes: k.bytes(),
			object: k.obj(),
		}),

		proto: cast => ({
			get hrid(): string {
				return H_NS_LABELS[cast(this).ns]+':'+cast(this).ref;
			},

			// hrp(): string {
			// 	const k_this = cast(this);
			// 	return FooBarNamespace.COMMON === k_this.ns? k_this.switch.accpub: '';
			// },

			// async pfpData(): Promise<string> {
			// 	return (await cast(this).pfp).data;
			// },

			// t1(): string[] {
			// 	return cast(this).tuple[0];
			// },
		}),
	});

	const BazQuxes = new ItemController({
		client: k_client,
		domain: 'baz-quxes',

		schema: (k, xc_type: BazQuxesType, s_id: string, i_code: ItemCode) => ({
			type: k.int(xc_type),
			id: k.str(s_id),
			ref_part: k.ref(FooBars, i_code),
			on: k.int<Toggle>(),

			ref: k.ref(FooBars),
			array_str: k.array.str(),
			set_str: k.set.str(),
			tuple: k.tuple([k.array.str(), k.int()]),
			struct: k.struct({
				struct_int: k.int(),
				struct_str: k.str(),
			}),
			registry: k.registry({
				reg_int: k.int(),
				reg_str: k.str(),
			}),
			dict_str_str: k.dict.str(),
			dict_base64_str: k.dict<NaiveBase64>().str(),
			// dict_base64: k.dict('' as NaiveBase64, k1 => k1.str()),
			switch: k.switch('type', xc_type, {
				[BazQuxesType.UNKNOWN]: k.int(),
				[BazQuxesType.BAZ]: k.tuple([
					k.int(),
					k.str(),
					k.ref(FooBars),
				]),
				[BazQuxesType.QUX]: k.struct({
					a: k.str(),
					b: k.str(),
					c: k.str(),
					v: k.int<Toggle>(),
					sub: k.switch('v', 0 as Toggle, {
						[Toggle.OFF]: k.str(),
						[Toggle.ON]: k.int(),
					}),
				}),
			}),
			cap: k.array.str(),
		}),

		proto: cast => ({
			// hrp(): string {
			// 	const k_this = cast(this);
			// 	return FooBarNamespace.COMMON === k_this.ns? k_this.switch.accpub: '';
			// },

			// // async pfpData(): Promise<string> {
			// // 	return (await cast(this).pfp).data;
			// // },

			// t1(): string[] {
			// 	return cast(this).tuple[0];
			// },
		}),
	});


	const g_foobar_1 = {
		ns: FooBarNamespace.COMMON,
		ref: 'test-1',
		on: Toggle.ON,
		int: 1,
		str: 'foo',
		bytes: Uint8Array.from([0x01]),
		object: {},
	};

	const g_foobar_2 = {
		ns: FooBarNamespace.COMMON,
		ref: 'test-2',
		on: Toggle.ON,
		int: 2,
		str: 'bar',
		bytes: Uint8Array.from([0x01, 0x02]),
		object: {
			a: 'apple',
		},
	};

	const g_foobar_3 = {
		ns: FooBarNamespace.COMMON,
		ref: 'test-3',
		on: Toggle.ON,
		int: 3,
		str: 'baz',
		bytes: Uint8Array.from([0x01, 0x02, 0x03]),
		object: {
			a: 'apple',
			b: ['banana', 3, true],
			c: {},
		},
	};


	return {
		FooBars,
		g_foobar_1,
		g_foobar_2,
		g_foobar_3,
		BazQuxes,
	};
};


export const init_bazquxes = (
	g_foobars: ReturnType<typeof init_foobars> & {k_client?: Vault},
	k_client: Vault=g_foobars.k_client!
) => {
	const {
		FooBars,
		g_foobar_1,
		g_foobar_2,
		g_foobar_3,
	} = g_foobars;

	const g_bazqux_1: BazQuxesStruct = {
		type: BazQuxesType.UNKNOWN,
		id: 'nil',
		ref_part: FooBars.getItemRef(g_foobar_1),
		on: Toggle.ON,

		ref: null,
		array_str: [],
		set_str: new Set(),
		tuple: [[], 0],
		struct: {
			struct_int: 0,
			struct_str: '',
		},
		registry: {},
		dict_str_str: {},
		dict_base64_str: {},
		switch: 9,
		cap: [],
	};

	const g_bazqux_2: BazQuxesStruct = {
		type: BazQuxesType.BAZ,
		id: 'baz',
		ref_part: FooBars.getItemRef(g_foobar_1),
		on: Toggle.ON,

		ref: FooBars.getItemRef(g_foobar_1)!,
		array_str: ['hello', 'world'],
		set_str: new Set(['data', 'computer']),
		tuple: [[], 0],
		struct: {
			struct_int: 1,
			struct_str: 'Apple',
		},
		registry: {
			reg_int: 1,
		},
		dict_str_str: {
			apple: 'red',
			banana: 'yellow',
		},
		dict_base64_str: {
			['A' as NaiveBase64]: '0',
		},
		switch: [
			42,
			'color',
			FooBars.getItemRef(g_foobar_3),
		],
		cap: [],
	};

	const g_bazqux_3: BazQuxesStruct = {
		type: BazQuxesType.QUX,
		id: 'qux',
		ref_part: FooBars.getItemRef(g_foobar_2),
		on: Toggle.ON,

		ref: FooBars.getItemRef(g_foobar_2)!,
		array_str: ['lorem', 'ipsum', 'dolor', 'fa'],
		set_str: new Set(['red', 'orange', 'yellow', 'blue']),
		tuple: [['apple', 'banana'], 17],
		struct: {
			struct_int: 21,
			struct_str: 'red',
		},
		registry: {
			reg_int: 2,
			reg_str: 'hi',
		},
		dict_str_str: {
			red: 'apple',
			yellow: 'banana',
			blue: 'blueberry',
		},
		dict_base64_str: {
			[text_to_base64('test')]: 'orange',
		},
		switch: {
			a: 'apple',
			b: 'banana',
			c: 'cantelope',
			v: Toggle.ON,
			sub: 3,
		},
		cap: [],
	};

	// const a_keys = odk(g_bazqux_3.dict_base64_str);

	return {
		g_bazqux_1,
		g_bazqux_2,
		g_bazqux_3,
	};
};
