/// <reference types="vite/client" />

export type KelvinLogLevel =
	| 'silent'
	| 'error'
	| 'warn'
	| 'info'
	| 'verbose';

interface ImportMetaEnv {
	DEV?: boolean;
	KELVIN_LOG_LEVEL?: KelvinLogLevel;
}

export interface ImportMeta {
	env?: ImportMetaEnv;
}

