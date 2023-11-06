import type {A, U} from 'ts-toolbelt';


export type AllValues<h_any> = h_any[keyof h_any];

export type UnionToIntersection<w_union> = (
	w_union extends never? never: (w_arg: w_union) => never
) extends (w_arg: infer w_infer) => void? w_infer: never;

export type UnionToTuple<w_union> = UnionToIntersection<
	w_union extends never? never: (w_arg: w_union) => w_union
> extends (w_arg: never) => infer w_infer
	? [...UnionToTuple<Exclude<w_union, w_infer>>, w_infer]
	: [];


export type KvTuplesToObject<a_keys extends readonly any[], a_values extends readonly any[]> = U.Merge<{
	[i_index in keyof a_keys]: {
		[si in a_keys[i_index]]: i_index extends keyof a_values? a_values[i_index]: never;
	};
}[number]>;

{
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const t_test: A.Compute<KvTuplesToObject<
		['foo', 'bar'],
		['FOO', 'BAR']
	>> = {
		foo: 'FOO',
		bar: 'BAR',
	};
}

export type FilterDrop<g_object extends object, w_what=never> = Pick<g_object, AllValues<{
	[si_key in keyof g_object]: g_object[si_key] extends w_what? never: si_key;
}>>;
