import {pubkey_to_bech32} from '@solar-republic/crypto';
import {ItemController} from 'src/controller';

export enum Toggle {
	OFF=0,
	ON=1,
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

const Chains = new ItemController({
	client: k_client,
	domain: 'chains',

	schema: (k, [xc_ns, si_ref]: [ChainNamespace, string]) => ({
		ns: k.int(xc_ns),
		ref: k.str(si_ref),
		on: k.int(Toggle.ON),
		pfp: k.ref<Pfp>(),
		bech32s: k.switch('ns', xc_ns, k => ({
			[ChainNamespace.UNKNOWN]: k.obj({}),
			[ChainNamespace.COSMOS]: k.struct(G_BECH32S_COSMOS),
		})),
		ftIfaces: k.arr(),
		nftIfaces: k.arr(),

		// fungibleTokenInterfaces: k.arr(),
		// nonFungibleTokenInterfaces: k.arr(),
	}),

	proto: class {
		static caip2([xc_ns, si_ref]: [ChainNamespace, string]) {
			return H_NS_LABELS[xc_ns]+':'+si_ref;
		}

		get caip2() {
			return H_NS_LABELS[this.ns]+':'+this.ref;
		}

		// addressFor(z_context: Chain | string): string {
		// 	return pubkey_to_bech32(this.a z_context);
		// }
	},
});

export type Chain = typeof Chains;


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

const Providers = new ItemController({
	client: k_client,
	domain: 'providers',

	schema: (k, [xc_protocol, si_hostname, sn_port]: [Protocol, string, string]) => ({
		protocol: k.int(xc_protocol),
		hostname: k.str(si_hostname),
		port: k.str(sn_port),
		chains: k.map({
			keys: k.ref<Chain>(),
			values: k.struct({
				transports: k.map({
					keys: k.int<Transport>(),
					values: k.arr(k.struct({
						path: k.str(),
						headers: k.obj(),
					})),
				}),
			}),
		}),
	}),
});
