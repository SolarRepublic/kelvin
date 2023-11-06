
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
export const SI_LOCK_LOCAL_ALL = 'storage:local:*';

export const SI_KEY_SESSION_ROOT = 'root';
export const SI_KEY_SESSION_VECTOR = 'vector';
export const SI_KEY_SESSION_AUTH = 'auth';

export const SI_KEY_STORAGE_BASE = '@base';
export const SI_KEY_STORAGE_HUB = '#hub';
