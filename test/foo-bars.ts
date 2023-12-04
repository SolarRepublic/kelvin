import type {ItemStruct} from '../src/item-proto';
import type {Vault} from '../src/vault';

import type {ItemCode} from 'src/types';

import {ItemRef} from 'src/item-ref';

import {ItemController} from '../src/controller';

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

export type FooBarsStruct = FooBarsController extends ItemController<
	infer g_schema,
	infer g_item,
	infer g_proto,
	infer g_runtime,
	infer s_domain,
	infer si_domain,
	infer a_parts,
	infer f_schema,
	infer g_parts
>? g_item: never;

export type BazQuxesController = ReturnType<typeof init_foobars>['BazQuxes'];

export type BazQuxesStruct = BazQuxesController extends ItemController<
	infer g_schema,
	infer g_item,
	infer g_proto,
	infer g_runtime,
	infer s_domain,
	infer si_domain,
	infer a_parts,
	infer f_schema,
	infer g_parts
>? g_item: never;


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

		schema: (k, xc_type: BazQuxesType, s_id: string) => ({
			type: k.int(xc_type),
			id: k.str(s_id),
			on: k.int<Toggle>(),

			ref: k.ref(FooBars),
			array_str: k.array(k1 => k1.str()),
			set_str: k.set(k1 => k1.str()),
			tuple: k.tuple(k1 => [k1.array(k2 => k2.str()), k1.int()]),
			struct: k.struct(k1 => ({
				struct_int: k1.int(),
				struct_str: k1.str(),
			})),
			registry: k.registry(k1 => ({
				reg_int: k1.int(),
				reg_str: k1.str(),
			})),
			dict_str: k.dict(k1 => k1.str()),
			switch: k.switch('type', xc_type, {
				[BazQuxesType.UNKNOWN]: k1 => k1.int(),
				[BazQuxesType.BAZ]: k1 => k1.tuple(k2 => [
					k2.int(),
					k2.str(),
					k2.ref(FooBars),
				]),
				[BazQuxesType.QUX]: k1 => ({
					a: k1.str(),
					b: k1.str(),
					c: k1.str(),
				}),
			}),
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
		dict_str: {},
		switch: 9,
	};

	const g_bazqux_2: BazQuxesStruct = {
		type: BazQuxesType.BAZ,
		id: 'baz',
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
		dict_str: {
			apple: 'red',
			banana: 'yellow',
		},
		switch: [
			42,
			'color',
			FooBars.getItemRef(g_foobar_3),
		],
	};

	const g_bazqux_3: BazQuxesStruct = {
		type: BazQuxesType.QUX,
		id: 'qux',
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
		dict_str: {
			red: 'apple',
			yellow: 'banana',
			blue: 'blueberry',
		},
		switch: {
			a: 'apple',
			b: 'banana',
			c: 'cantelope',
		},
	};

	return {
		g_bazqux_1,
		g_bazqux_2,
		g_bazqux_3,
	};
};
