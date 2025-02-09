
export const enum LockCategory {
	STORAGE='storage',
}

export const enum LockArea_Storage {
	SESSION='session',
	LOCAL='local',
}

export const enum LockTarget_StorageLocal {
	ALL='*',
	HUB='hub',
}

export const SI_LOCK_SESSION_ALL = 'storage:session:*';
export const SI_LOCK_CONTENT_ALL = 'storage:content:*';

/**
 * Controls access to the managing authority over the database connection
 */
export const SI_KEY_SESSION_SEMAPHORE = 'semaphore';

/**
 * The `root` key's raw bytes, used to derive all keys for the current session.
 * This allows the application to access the unlocked vault from other contexts.
 */
export const SI_KEY_SESSION_ROOT = 'root';

/**
 * The `vector` stores input nonce material when peforming current cipher operations
 */
export const SI_KEY_SESSION_VECTOR = 'vector';

/**
 * The `auth` key is used to authenticate callbacks from foriegn/untrusted apps during this session
 */
export const SI_KEY_SESSION_AUTH = 'auth';

export const SI_KEY_STORAGE_BASE = '@base';
export const SI_KEY_STORAGE_HUB = '#hub';
