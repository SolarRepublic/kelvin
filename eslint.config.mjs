import elite from '@blake.regalia/eslint-config-elite';

export default [
	...elite,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',

			parserOptions: {
				tsconfigRootDir: __dirname,
				project: 'tsconfig.json',
			},
		},
	},
];
