import type {ItemStruct} from '../src/item-proto';
import type {Vault} from '../src/vault';

import {ItemController} from '../src/controller';

export enum Toggle {
	OFF=0,
	ON=1,
}

export enum PfpType {
	UNKNOWN=0,
	IMG=1,
}

export enum ChainNamespace {
	UNKNOWN=0,
	COSMOS=1,
}

const H_NS_LABELS: Record<ChainNamespace, string> = {
	[ChainNamespace.UNKNOWN]: '',
	[ChainNamespace.COSMOS]: 'cosmos',
};

const G_BECH32S_COSMOS = {
	acc: '',
	accpub: 'pub',
	valcons: 'valcons',
	valconspub: 'valconspub',
	valoper: 'valoper',
	valoperpub: 'valoperpub',
};

export type ChainStruct = ItemStruct<ReturnType<typeof init_chains>['Chains']>;

export const init_chains = (k_client: Vault) => {
	const Pfps = new ItemController({
		client: k_client,
		domain: 'pfps',

		schema: (k, xc_type: PfpType, s_hash: string) => ({
			type: k.int(xc_type),
			hash: k.str(s_hash),
			data: k.str(),
		}),
	});

	const Chains = new ItemController({
		client: k_client,
		domain: 'chains',

		schema: (k, xc_ns: ChainNamespace, si_ref: string) => ({
			ns: k.int(xc_ns),
			ref: k.str(si_ref),
			on: k.int<Toggle>(),
			int: k.int(),
			str: k.str(),
			bytes: k.bytes(),
			array: k.arr(k1 => k1.str()),
			tuple: k.tuple(k1 => [k1.arr(k2 => k2.str()), k1.int()]),
			pfp: k.ref(Pfps),
			bech32s: k.switch('ns', xc_ns, {
				[ChainNamespace.UNKNOWN]: k1 => k1.int(),
				[ChainNamespace.COSMOS]: k1 => ({
					acc: k1.str(),
					accpub: k1.str(),
					valcons: k1.str(),
					valconspub: k1.str(),
					valoper: k1.str(),
					valoperpub: k1.str(),
				}),
			}),
			// ftIfaces: k.arr(),
			// nftIfaces: k.arr(),

			// fungibleTokenInterfaces: k.arr(),
			// nonFungibleTokenInterfaces: k.arr(),
			// sata: k.str(),
		}),

		proto: cast => ({
			get caip2(): string {
				return H_NS_LABELS[cast(this).ns]+':'+cast(this).ref;
			},

			hrp(): string {
				const k_this = cast(this);
				return ChainNamespace.COSMOS === k_this.ns? k_this.bech32s.accpub: '';
			},

			async pfpData(): Promise<string> {
				return (await cast(this).pfp).data;
			},

			t1(): string[] {
				return cast(this).tuple[0];
			},

			// addressFor(z_context: Chain | string): string {
			// 	return pubkey_to_bech32(this.a z_context);
			// }
		}),

		// indexes: [
		// 	'data',
		// ],
	});


	// export type Chain = typeof Chains;


	enum Protocol {
		UNKNOWN=0,
		HTTPS=1,
		HTTP=2,
		WSS=3,
		WS=4,
	}

	enum Transport {
		UNKNOWN=0,
		RPC=1,
		LCD=2,
	}

	// const Providers = new ItemController({
	// 	client: k_client,
	// 	domain: 'providers',

	// 	schema: (k, [xc_protocol, si_hostname, sn_port]: [Protocol, string, string]) => ({
	// 		protocol: k.int(xc_protocol),
	// 		hostname: k.str(si_hostname),
	// 		port: k.str(sn_port),
	// 		chains: k.map({
	// 			keys: k.ref<Chain>(),
	// 			values: k.struct({
	// 				transports: k.map({
	// 					keys: k.int<Transport>(),
	// 					values: k.arr(k.struct({
	// 						path: k.str(),
	// 						headers: k.obj(),
	// 					})),
	// 				}),
	// 			}),
	// 		}),
	// 	}),
	// });

	type LocalChainStruct = ItemStruct<typeof Chains>;

	const g_chain_sample_1: LocalChainStruct = {
		ns: ChainNamespace.COSMOS,
		ref: 'test-1',
		on: Toggle.ON,
		int: 1,
		str: 'foo',
		bytes: Uint8Array.from([0x01]),
	};

	const g_chain_sample_2: LocalChainStruct = {
		ns: ChainNamespace.COSMOS,
		ref: 'test-2',
		on: Toggle.ON,
		int: 2,
		str: 'bar',
		bytes: Uint8Array.from([0x01, 0x02]),
	};

	const g_chain_sample_3: LocalChainStruct = {
		ns: ChainNamespace.COSMOS,
		ref: 'test-3',
		on: Toggle.ON,
		int: 3,
		str: 'baz',
		bytes: Uint8Array.from([0x01, 0x02, 0x03]),
	};


	return {
		Chains,
		g_chain_sample_1,
		g_chain_sample_2,
		g_chain_sample_3,
	};
};
